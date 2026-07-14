import express from 'express';
import cors from 'cors';
import { generateIncidentResolution, handleCopilotChat } from './agents.js';
import { verifyIncidentRecommendation } from './guardrails.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-Memory Digital Twin State
let state = {
    gates: [
        { zone_id: 'GATE_A', crowd_density: 1.2, throughput_rate: 32, status: 'NORMAL' },
        { zone_id: 'GATE_B', crowd_density: 2.8, throughput_rate: 68, status: 'NORMAL' },
        { zone_id: 'GATE_C', crowd_density: 3.1, throughput_rate: 75, status: 'NORMAL' },
        { zone_id: 'GATE_D', crowd_density: 0.8, throughput_rate: 15, status: 'NORMAL' }
    ],
    concessions: [
        { stall_id: 'CONCESSION_1', location_zone: 'SECTOR_102', item_name: 'Water', current_volume: 120.0, depletion_rate: 1.5, status: 'OK' },
        { stall_id: 'CONCESSION_2', location_zone: 'SECTOR_205', item_name: 'Water', current_volume: 85.0, depletion_rate: 0.8, status: 'OK' },
        { stall_id: 'CONCESSION_3', location_zone: 'SECTOR_310', item_name: 'Water', current_volume: 140.0, depletion_rate: 2.4, status: 'OK' }
    ],
    foodCourts: [
        { zone_id: 'FOOD_COURT_ZONE_A', crowd_density: 1.8, wait_time: 9, refill_status: 'OK' },
        { zone_id: 'FOOD_COURT_ZONE_B', crowd_density: 3.2, wait_time: 16, refill_status: 'OK' }
    ],
    washrooms: [
        { zone_id: 'WASHROOM_NORTH', occupancy: 35, queue_length: 2, supply_status: 'OK', security_incident_flag: false },
        { zone_id: 'WASHROOM_SOUTH', occupancy: 65, queue_length: 6, supply_status: 'Toilet Paper: Low', security_incident_flag: false },
        { zone_id: 'WASHROOM_EAST', occupancy: 85, queue_length: 12, supply_status: 'OK', security_incident_flag: false }
    ],
    logistics: {
        volunteer_ratio: 0.82,
        volunteers_active: 82,
        volunteers_needed: 100,
        shuttles: [
            { id: 'SHUTTLE_NORTH', status: 'ACTIVE', route: 'Metro Direct' },
            { id: 'SHUTTLE_EAST', status: 'DELAYED', route: 'Express Outer' },
            { id: 'SHUTTLE_SOUTH', status: 'ACTIVE', route: 'VIP Bypass' }
        ]
    },
    incidents: [],
    anomalies: [],
    stats: {
        safetyScore: 100,
        totalEntries: 4850,
        activeAlerts: 0,
        timestamp: new Date().toISOString()
    },
    simulationActive: true
};

// Telemetry Cool-down Hold Timers (30 seconds)
const cooldowns = {
    refill_water: 0,
    restock_toilet_paper: 0,
    refill_food_stalls: 0
};

// SSE active clients
let sseClients = [];

// Broadcast State to SSE subscribers
function broadcastState() {
    const data = JSON.stringify(state);
    sseClients.forEach(client => {
        client.write(`data: ${data}\n\n`);
    });
}

// Map zones or incidents to Playbook keys
function getPlaybookKeyForAnomaly(anomaly) {
    if (anomaly.type === 'MEDICAL_EMERGENCY') {
        return `MEDICAL_EMERGENCY_${anomaly.location}`;
    }
    if (anomaly.type === 'GATE_OVERFLOW') {
        return `GATE_OVERFLOW_${anomaly.location}`;
    }
    if (anomaly.type === 'BAD_WEATHER_ALERT') {
        return 'WEATHER_ALERT_SECTOR_ALL';
    }
    if (anomaly.type === 'WATER_SHORTAGE') {
        return `WATER_SHORTAGE_${anomaly.location}`;
    }
    if (anomaly.type === 'FOOD_COURT_OVERFLOW') {
        return `FOOD_COURT_OVERFLOW_${anomaly.location}`;
    }
    if (anomaly.type === 'SECURITY_BREACH' && anomaly.location) {
        return `WASHROOM_CONGESTION_${anomaly.location}`;
    }
    return null;
}

// Watchdog anomaly scanner
async function runWatchdogCheck() {
    const originalAnomalies = [...state.anomalies];
    const newAnomaliesList = [];

    // 1. Check Gates
    state.gates.forEach(gate => {
        if (gate.crowd_density > 4.0) {
            newAnomaliesList.push({
                id: `ANOMALY-GATE-${gate.zone_id}`,
                source: gate.zone_id,
                type: 'GATE_OVERFLOW',
                location: gate.zone_id,
                severity: 'HIGH',
                message: `Gate ${gate.zone_id} is heavily congested (Density: ${gate.crowd_density.toFixed(1)} people/sqm).`,
                timestamp: new Date().toISOString()
            });
        }
    });

    // 2. Check Concessions
    state.concessions.forEach(stall => {
        if (stall.current_volume <= 20) {
            newAnomaliesList.push({
                id: `ANOMALY-STALL-${stall.stall_id}`,
                source: stall.stall_id,
                type: 'WATER_SHORTAGE',
                location: stall.location_zone,
                severity: stall.current_volume <= 5 ? 'CRITICAL' : 'MEDIUM',
                message: `Stall ${stall.stall_id} is critically low on water (${stall.current_volume.toFixed(1)}L remaining).`,
                timestamp: new Date().toISOString()
            });
        }
    });

    // 2b. Check Food Courts
    state.foodCourts.forEach(fc => {
        if (fc.crowd_density > 4.0) {
            newAnomaliesList.push({
                id: `ANOMALY-FC-${fc.zone_id}`,
                source: fc.zone_id,
                type: 'FOOD_COURT_OVERFLOW',
                location: fc.zone_id === 'FOOD_COURT_ZONE_A' ? 'FOOD_COURT_ZONE_A' : 'FOOD_COURT_ZONE_A', // map to key
                severity: 'HIGH',
                message: `Food Court ${fc.zone_id} is heavily congested (Density: ${fc.crowd_density.toFixed(1)}/sqm).`,
                timestamp: new Date().toISOString()
            });
        }
    });

    // 2c. Check Washrooms
    state.washrooms.forEach(w => {
        if (w.security_incident_flag) {
            newAnomaliesList.push({
                id: `ANOMALY-WASHROOM-${w.zone_id}`,
                source: w.zone_id,
                type: 'SECURITY_BREACH',
                location: w.zone_id,
                severity: 'CRITICAL',
                message: `Active security breach in Restroom ${w.zone_id}.`,
                timestamp: new Date().toISOString()
            });
        }
    });

    // 3. Check Incident Logs
    state.incidents.forEach(inc => {
        if (inc.priority === 'CRITICAL' || inc.priority === 'HIGH') {
            newAnomaliesList.push({
                id: `ANOMALY-INCIDENT-${inc.incident_id}`,
                source: inc.incident_id,
                type: inc.incident_type,
                location: inc.location_zone,
                severity: inc.priority,
                message: `Active incident ${inc.incident_id} (${inc.incident_type}): ${inc.details}`,
                timestamp: inc.timestamp
            });
        }
    });

    // Update anomalies list, evaluating evaluations for newly introduced ones
    const finalAnomalies = [];
    for (const anomaly of newAnomaliesList) {
        const existing = originalAnomalies.find(a => a.id === anomaly.id);
        if (existing) {
            // Keep existing evaluation if available
            finalAnomalies.push({ ...anomaly, evaluation: existing.evaluation });
        } else {
            // Evaluate new anomaly automatically via Gemini + Guardrail!
            const playbookKey = getPlaybookKeyForAnomaly(anomaly);
            if (playbookKey) {
                console.log(`Running agent analysis for new anomaly: ${anomaly.id} with playbook: ${playbookKey}`);
                try {
                    // Default to clean recommendation first
                    const rawResolution = await generateIncidentResolution(playbookKey, anomaly, false);
                    const evaluation = verifyIncidentRecommendation(playbookKey, rawResolution);
                    finalAnomalies.push({ ...anomaly, evaluation });
                } catch (e) {
                    console.error("Error generating auto watchdog evaluation:", e);
                    finalAnomalies.push(anomaly);
                }
            } else {
                finalAnomalies.push(anomaly);
            }
        }
    }

    state.anomalies = finalAnomalies;

    // Compute safety score
    let score = 100;
    state.anomalies.forEach(a => {
        if (a.severity === 'CRITICAL' || a.severity === 'HIGH') {
            score -= 15;
        } else {
            score -= 5;
        }
    });
    state.stats.safetyScore = Math.max(score, 10);
    state.stats.activeAlerts = state.anomalies.length;
    state.stats.timestamp = new Date().toISOString();
}

// Telemetry Simulation loop
setInterval(async () => {
    if (!state.simulationActive) return;

    // 1. Gates fluctuate
    state.gates = state.gates.map(gate => {
        let deltaDensity = (Math.random() - 0.5) * 0.4;
        // If gate overflow triggered manual inject, push density up
        const hasActiveOverflow = state.incidents.some(i => i.location_zone === gate.zone_id && i.incident_type === 'GATE_OVERFLOW');

        let density = gate.crowd_density + deltaDensity;
        if (hasActiveOverflow && density < 4.2) {
            density = 4.3 + (Math.random() * 0.4);
        }

        // Bounds check
        density = Math.max(0.3, Math.min(6.0, density));

        let throughput = Math.round(density * 22 + (Math.random() - 0.5) * 10);
        throughput = Math.max(5, throughput);

        let status = 'NORMAL';
        if (density > 4.0) status = 'CRITICAL';
        else if (density > 2.8) status = 'CONGESTED';

        return { ...gate, crowd_density: density, throughput_rate: throughput, status };
    });

    // 2. Concessions deplete water
    const isWaterCooldownActive = Date.now() < cooldowns.refill_water;
    state.concessions = state.concessions.map(stall => {
        let volume = stall.current_volume;
        if (!isWaterCooldownActive) {
            volume -= stall.depletion_rate;
            if (volume < 0) volume = 0;
        }

        let status = 'OK';
        if (volume <= 5) status = 'DEPLETED';
        else if (volume <= 35) status = 'LOW';

        return { ...stall, current_volume: Number(volume.toFixed(1)), status };
    });

    // 2b. Food Courts fluctuate
    const isFoodCooldownActive = Date.now() < cooldowns.refill_food_stalls || Date.now() < cooldowns.refill_water;
    state.foodCourts = state.foodCourts.map(fc => {
        let density = fc.crowd_density;
        let waitTime = fc.wait_time;
        let refill_status = fc.refill_status;

        if (!isFoodCooldownActive) {
            let deltaDensity = (Math.random() - 0.5) * 0.4;
            const hasActiveSurge = state.incidents.some(i => i.location_zone === fc.zone_id && i.incident_type === 'FOOD_COURT_OVERFLOW');
            density = fc.crowd_density + deltaDensity;
            if (hasActiveSurge && density < 4.2) {
                density = 4.3 + (Math.random() * 0.4);
            }
            density = Math.max(0.5, Math.min(5.5, density));
            waitTime = Math.round(density * 5);

            refill_status = 'OK';
            if (density > 4.5) refill_status = 'DANGER_LOW';
            else if (density > 3.5) refill_status = 'REFILLING';
        } else {
            density = 1.5;
            waitTime = 7;
            refill_status = 'OK';
        }
        return { ...fc, crowd_density: Number(density.toFixed(1)), wait_time: waitTime, refill_status };
    });

    // 2c. Washrooms fluctuate
    const isTPCooldownActive = Date.now() < cooldowns.restock_toilet_paper || Date.now() < cooldowns.refill_water;
    state.washrooms = state.washrooms.map(w => {
        let occupancy = w.occupancy;
        let wait = w.queue_length;
        let supply = w.supply_status;

        if (!isTPCooldownActive) {
            let deltaOccupancy = Math.round((Math.random() - 0.5) * 12);
            occupancy = w.occupancy + deltaOccupancy;
            occupancy = Math.max(5, Math.min(99, occupancy));
            wait = Math.max(1, Math.round(occupancy * 0.15 + (Math.random() - 0.5) * 2));

            if (occupancy > 85 && Math.random() < 0.15) {
                supply = 'Toilet Paper: Low';
            }
        } else {
            occupancy = Math.max(10, Math.round(occupancy * 0.5));
            wait = Math.max(1, Math.round(wait * 0.5));
            supply = 'OK';
        }

        const hasSecurityIncident = state.incidents.some(i => i.location_zone === w.zone_id && i.incident_type === 'SECURITY_BREACH');

        return {
            ...w,
            occupancy,
            queue_length: wait,
            supply_status: supply,
            security_incident_flag: hasSecurityIncident
        };
    });

    // 2d. Logistics fluctuate
    let activeVols = state.logistics.volunteers_active;
    let neededVols = state.logistics.volunteers_needed;
    activeVols += Math.round((Math.random() - 0.5) * 4);
    activeVols = Math.max(50, Math.min(100, activeVols));
    let volRatio = activeVols / neededVols;

    const updatedShuttles = state.logistics.shuttles.map(sh => {
        let status = sh.status;
        if (Math.random() < 0.05) {
            status = status === 'ACTIVE' ? 'DELAYED' : 'ACTIVE';
        }
        return { ...sh, status };
    });

    state.logistics = {
        volunteer_ratio: Number(volRatio.toFixed(2)),
        volunteers_active: activeVols,
        volunteers_needed: neededVols,
        shuttles: updatedShuttles
    };

    // 3. Stats update
    state.stats.totalEntries += Math.round(state.gates.reduce((acc, g) => acc + g.throughput_rate, 0) / 20);

    // 3b. Automatic threshold incident integration rules
    if (!isTPCooldownActive) {
        state.washrooms.forEach(w => {
            if (w.occupancy > 80) {
                const hasAlert = state.incidents.some(i => i.location_zone === w.zone_id && i.incident_type === 'WASHROOM_CONGESTION');
                if (!hasAlert) {
                    state.incidents.push({
                        incident_id: `INCIDENT-${w.zone_id}-${Math.floor(100 + Math.random() * 900)}`,
                        location_zone: w.zone_id,
                        incident_type: 'WASHROOM_CONGESTION',
                        priority: 'MEDIUM',
                        details: `Restroom ${w.zone_id} occupancy has exceeded the safe limit (${w.occupancy}%). Queue length is ${w.queue_length}.`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    }

    if (!isWaterCooldownActive) {
        state.concessions.forEach(c => {
            if (c.current_volume < 22.5) {
                const hasAlert = state.incidents.some(i => i.location_zone === c.location_zone && i.incident_type === 'WATER_SHORTAGE');
                if (!hasAlert) {
                    state.incidents.push({
                        incident_id: `INCIDENT-${c.stall_id}-${Math.floor(100 + Math.random() * 900)}`,
                        location_zone: c.location_zone,
                        incident_type: 'WATER_SHORTAGE',
                        priority: c.current_volume < 7.5 ? 'CRITICAL' : 'HIGH',
                        details: `Inventory alert: Stall ${c.stall_id} water level is under 15% threshold (${c.current_volume}L remaining).`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    }

    if (!isFoodCooldownActive) {
        state.foodCourts.forEach(fc => {
            if (fc.wait_time > 15) {
                const hasAlert = state.incidents.some(i => i.location_zone === fc.zone_id && i.incident_type === 'FOOD_COURT_OVERFLOW');
                if (!hasAlert) {
                    state.incidents.push({
                        incident_id: `INCIDENT-${fc.zone_id}-${Math.floor(100 + Math.random() * 900)}`,
                        location_zone: fc.zone_id,
                        incident_type: 'FOOD_COURT_OVERFLOW',
                        priority: 'HIGH',
                        details: `Congestion warning: Food court ${fc.zone_id} queue wait time exceeds 15 minutes (${fc.wait_time} mins).`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    }

    // Auto-resolve self-healing code for active incidents that fall back below thresholds
    state.incidents = state.incidents.filter(inc => {
        if (inc.incident_type === 'WASHROOM_CONGESTION') {
            const w = state.washrooms.find(rest => rest.zone_id === inc.location_zone);
            if (w && w.occupancy <= 80) return false;
        }
        if (inc.incident_type === 'WATER_SHORTAGE') {
            const c = state.concessions.find(con => con.location_zone === inc.location_zone);
            if (c && c.current_volume >= 22.5) return false;
        }
        if (inc.incident_type === 'FOOD_COURT_OVERFLOW') {
            const fc = state.foodCourts.find(f => f.zone_id === inc.location_zone);
            if (fc && fc.wait_time <= 15) return false;
        }
        return true;
    });

    // Scan for anomalies and update state
    await runWatchdogCheck();

    // Send update to frontend
    broadcastState();
}, 3000);

// --- Express Rest Routing ---

// SSE Endpoint
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify(state)}\n\n`);
    sseClients.push(res);

    req.on('close', () => {
        sseClients = sseClients.filter(c => c !== res);
    });
});

// Fetch current state
app.get('/api/state', (req, res) => {
    res.json(state);
});

// Inject/Trigger active incident
app.post('/api/incident', async (req, res) => {
    const { location_zone, incident_type, priority, details } = req.body;
    const newIncident = {
        incident_id: `INCIDENT-${Math.floor(1000 + Math.random() * 9000)}`,
        location_zone,
        incident_type,
        priority: priority || 'HIGH',
        details: details || 'No additional details provided.',
        timestamp: new Date().toISOString()
    };

    state.incidents.push(newIncident);

    // Specific handler to speed up density if gate overflow injected
    if (incident_type === 'GATE_OVERFLOW') {
        state.gates = state.gates.map(g => {
            if (g.zone_id === location_zone) {
                return { ...g, crowd_density: 4.5, status: 'CRITICAL' };
            }
            return g;
        });
    }

    await runWatchdogCheck();
    broadcastState();

    res.status(201).json({ message: 'Incident injected successfully', incident: newIncident });
});

// Resolve/Clear individual incident
app.post('/api/incident/resolve', async (req, res) => {
    const { incident_id } = req.body;

    // Find incident to handle side effects
    const incidentObj = state.incidents.find(i => i.incident_id === incident_id);
    if (incidentObj) {
        if (incidentObj.incident_type === 'GATE_OVERFLOW') {
            state.gates = state.gates.map(g => {
                if (g.zone_id === incidentObj.location_zone) {
                    return { ...g, crowd_density: 1.5, status: 'NORMAL' };
                }
                return g;
            });
        }
    }

    state.incidents = state.incidents.filter(i => i.incident_id !== incident_id);

    await runWatchdogCheck();
    broadcastState();

    res.json({ message: 'Incident resolved successfully', incident_id });
});

// Staff Copilot Chat endpoint
app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message payload is required' });
    }

    try {
        const aiResponse = await handleCopilotChat(history || [], message, state);
        res.json({ response: aiResponse });
    } catch (error) {
        console.error("Chat routing error:", error);
        res.status(500).json({ error: "Internal AI Copilot error" });
    }
});

// Manually trigger incident query with Gemini + Guardrail audit logs
app.post('/api/verify', async (req, res) => {
    const { playbookKey, anomaly, simulateHallucination } = req.body;

    if (!playbookKey || !anomaly) {
        return res.status(400).json({ error: 'playbookKey and anomaly dataset required' });
    }

    try {
        // Generate recommendation (real Gemini API or mock)
        const rawResult = await generateIncidentResolution(playbookKey, anomaly, simulateHallucination);

        // Evaluate through deterministic interceptor
        const guardrailResult = verifyIncidentRecommendation(playbookKey, rawResult);

        // Save evaluation result directly onto the anomaly state
        state.anomalies = state.anomalies.map(an => {
            if (an.id === anomaly.id || (an.type === anomaly.type && an.location === anomaly.location)) {
                return { ...an, evaluation: guardrailResult };
            }
            return an;
        });

        broadcastState();
        res.json({ rawResult, guardrailResult });
    } catch (error) {
        console.error("Verify endpoint error:", error);
        res.status(500).json({ error: 'Failed to verify recommendation' });
    }
});

// Control panel actions (Refill water, speed up, pause/resume, clear)
app.post('/api/control', async (req, res) => {
    const { action } = req.body;

    if (action === 'refill_water') {
        cooldowns.refill_water = Date.now() + 30000;
        state.concessions = state.concessions.map(c => ({
            ...c,
            current_volume: 120.0 + Math.random() * 30,
            status: 'OK'
        }));
        state.foodCourts = state.foodCourts.map(fc => ({
            ...fc,
            crowd_density: 1.5,
            refill_status: 'OK'
        }));
        state.washrooms = state.washrooms.map(w => ({
            ...w,
            supply_status: 'OK'
        }));
    } else if (action === 'restock_toilet_paper') {
        cooldowns.restock_toilet_paper = Date.now() + 30000;
        state.washrooms = state.washrooms.map(w => ({
            ...w,
            supply_status: 'OK',
            occupancy: Math.max(10, Math.round(w.occupancy * 0.5)),
            queue_length: Math.max(1, Math.round(w.queue_length * 0.5))
        }));
    } else if (action === 'refill_food_stalls') {
        cooldowns.refill_food_stalls = Date.now() + 30000;
        state.foodCourts = state.foodCourts.map(fc => ({
            ...fc,
            crowd_density: 1.5,
            wait_time: 7,
            refill_status: 'OK'
        }));
    } else if (action === 'pause') {
        state.simulationActive = false;
    } else if (action === 'resume') {
        state.simulationActive = true;
    } else if (action === 'reset') {
        state.incidents = [];
        state.anomalies = [];
        state.gates = state.gates.map(g => ({ ...g, crowd_density: 1.5, status: 'NORMAL' }));
        state.concessions = state.concessions.map(c => ({ ...c, current_volume: 120.0, status: 'OK' }));
        state.foodCourts = state.foodCourts.map(fc => ({ ...fc, crowd_density: 1.5, wait_time: 7, refill_status: 'OK' }));
        state.washrooms = state.washrooms.map(w => ({ ...w, occupancy: 35, queue_length: 2, supply_status: 'OK', security_incident_flag: false }));
        state.logistics = {
            volunteer_ratio: 0.82,
            volunteers_active: 82,
            volunteers_needed: 100,
            shuttles: [
                { id: 'SHUTTLE_NORTH', status: 'ACTIVE', route: 'Metro Direct' },
                { id: 'SHUTTLE_EAST', status: 'DELAYED', route: 'Express Outer' },
                { id: 'SHUTTLE_SOUTH', status: 'ACTIVE', route: 'VIP Bypass' }
            ]
        };
        state.stats.safetyScore = 100;
        state.stats.activeAlerts = 0;
    }

    await runWatchdogCheck();
    broadcastState();

    res.json({ message: `Engine Action: ${action} executed`, state });
});

app.listen(PORT, () => {
    console.log(`Smart Stadium Command Center server operational on port ${PORT}`);
});

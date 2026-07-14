import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Gemini with safety checks
const apiKey = process.env.GEMINI_API_KEY || '';
let genAI = null;
let useMock = true;

if (apiKey && apiKey !== 'YOUR_API_KEY_HERE') {
    try {
        genAI = new GoogleGenerativeAI(apiKey);
        useMock = false;
        console.log("Successfully initialized Google Gemini API client.");
    } catch (err) {
        console.error("Failed to initialize Google Generative AI:", err);
    }
} else {
    console.warn("WARNING: No GEMINI_API_KEY found in environment. Falling back to mock responses.");
}

/**
 * Standardized local mock playbook responder
 */
export function getMockIncidentResolution(playbookKey) {
    const key = (playbookKey || '').trim().toUpperCase();
    if (key === 'MEDICAL_SECTOR_102' || key === 'MEDICAL_EMERGENCY_SECTOR_102') {
        return `Medical emergency logged at Sector 102. Action Plan: Dispatch Medics Team 3 immediately. Move the patient to Medical Station Echo (Room 2B-Level 1) using the evacuation route via Tunnel Exit 4 to Concourse Corridor South. Field volunteers must clear this path.`;
    } else if (key === 'GATE_A_OVERFLOW' || key === 'GATE_OVERFLOW_GATE_A') {
        return `Gate overflow detected at Gate A. Action Plan: Deploy Crowd Control Squad Alpha to Concourse Command A (Gate Control Cabin A) via Ramp 1 North to Main Plaza. Open supplemental gates to relieve crowd tension.`;
    } else if (key === 'WATER_SHORTAGE_SECTOR_310') {
        return `Water shortage reported at Sector 310 concession. Action Plan: Deploy Logistics Support Unit 1 to Logistics Hub North (Supply Depot 3A). The evacuation route via Service Lift Delta to Third Tier Concourse should be secured.`;
    } else if (key === 'FOOD_COURT_OVERFLOW_ZONE_A' || key === 'FOOD_COURT_OVERFLOW_FOOD_COURT_ZONE_A') {
        return `Food court congestion detected at Food Court Zone A. Action Plan: Deploy Steward Team Bravo to Crowd Control Command (Concourse Sector A Queue Lanes). Use evacuation route External Plaza Gates 1-3 to divert flow.`;
    } else {
        return `Emergency alert initiated for ${playbookKey}. Dispatch standard containment crew and report to command office.`;
    }
}

/**
 * Staff Copilot local state keyword parser
 */
export function runLocalStateChatParser(userMessage, currentTelemetry) {
    const question = userMessage.toLowerCase();

    // 1. Water depleting soon
    if (question.includes("water") || question.includes("stall") || question.includes("20 mins")) {
        const lowStalls = currentTelemetry.concessions.map(c => {
            const timeToDeplete = c.depletion_rate > 0 ? (c.current_volume / c.depletion_rate) : Infinity;
            return { ...c, timeToDeplete };
        }).filter(c => c.timeToDeplete <= 20);

        if (lowStalls.length > 0) {
            return `[Copilot Engine (Local State)] Alert: The following concessions will deplete water in the next 20 minutes:\n- ${lowStalls.map(s => `${s.stall_id} (${s.current_volume}L left, depleting at ${s.depletion_rate}L/min. Depletes in ${Math.round(s.timeToDeplete)} mins)`).join('\n- ')}\nRefill teams should be dispatched immediately.`;
        }
        return `[Copilot Engine (Local State)] All concession stalls have sufficient water supply. No stalls are projected to deplete within 20 minutes.`;
    }

    // 2. Gates under stress
    if (question.includes("gate") || question.includes("stress") || question.includes("congest")) {
        const stressedGates = currentTelemetry.gates.filter(g => g.crowd_density > 4.0 || g.status === 'CRITICAL' || g.status === 'CONGESTED');
        if (stressedGates.length > 0) {
            return `[Copilot Engine (Local State)] Currently, ${stressedGates.length} gate(s) are experiencing high pressure:\n- ${stressedGates.map(g => `${g.zone_id}: Density at ${g.crowd_density} people/sqm, throughputting ${g.throughput_rate} people/min. Status is ${g.status}.`).join('\n- ')}\nRecommend re-routing incoming fans.`;
        }
        return `[Copilot Engine (Local State)] All gate turnstiles are operating within safe bounds (crowd density values are under 4.0 people/sqm).`;
    }

    // 3. Washrooms/Restrooms status query
    if (question.includes("washroom") || question.includes("restroom") || question.includes("toilet") || question.includes("bath") || question.includes("paper")) {
        if (currentTelemetry.washrooms) {
            const details = currentTelemetry.washrooms.map(w =>
                `- ${w.zone_id}: Occupancy: ${w.occupancy}%, Q-Wait: ${w.queue_length} mins, Supplies: ${w.supply_status}, Security Alert: ${w.security_incident_flag ? '⚠️ YES' : 'NOMINAL'}`
            ).join('\n');
            return `[Copilot Engine (Local State)] Restroom Telemetry Summary:\n${details}`;
        }
        return `[Copilot Engine (Local State)] Restroom telemetry is not configured on this twin yet.`;
    }

    // 4. Food Court query
    if (question.includes("food") || question.includes("court") || question.includes("hungry") || question.includes("eat")) {
        if (currentTelemetry.foodCourts) {
            const details = currentTelemetry.foodCourts.map(f =>
                `- ${f.zone_id}: Crowd Density: ${f.crowd_density.toFixed(1)}/sqm, Refill Status: ${f.refill_status}`
            ).join('\n');
            return `[Copilot Engine (Local State)] Food Court Telemetry Summary:\n${details}`;
        }
        return `[Copilot Engine (Local State)] Food court telemetry is not configured on this twin yet.`;
    }

    // 5. Shuttle / Transits / Logistics query
    if (question.includes("shuttle") || question.includes("bus") || question.includes("transit") || question.includes("logistics")) {
        if (currentTelemetry.logistics) {
            const log = currentTelemetry.logistics;
            const sh = log.shuttles.map(s => `- ${s.id}: ${s.status} (${s.route})`).join('\n');
            return `[Copilot Engine (Local State)] Logistics & Transit Summary:\n- Vol. Ratio: ${Math.round(log.volunteer_ratio * 100)}% (${log.volunteers_active}/${log.volunteers_needed} Active)\nShuttle Network:\n${sh}`;
        }
        return `[Copilot Engine (Local State)] Logistics telemetry is not configured on this twin yet.`;
    }

    // 6. Where are volunteers needed
    if (question.includes("volunteer") || question.includes("people") || question.includes("staff")) {
        const recommendations = [];
        const criticalIncidents = currentTelemetry.incidents.filter(i => i.priority === 'CRITICAL');
        if (criticalIncidents.length > 0) {
            criticalIncidents.forEach(inc => {
                recommendations.push(`Support active critical incident ${inc.incident_id} at ${inc.location_zone}`);
            });
        }
        const stressedGates = currentTelemetry.gates.filter(g => g.crowd_density > 3.5);
        if (stressedGates.length > 0) {
            stressedGates.forEach(g => {
                recommendations.push(`Crowd routing backup at ${g.zone_id} (Density: ${g.crowd_density}/sqm)`);
            });
        }
        if (currentTelemetry.logistics) {
            recommendations.push(`Current active volunteers: ${currentTelemetry.logistics.volunteers_active}/${currentTelemetry.logistics.volunteers_needed}. Deployment: ${Math.round(currentTelemetry.logistics.volunteer_ratio * 100)}%`);
        }
        if (recommendations.length > 0) {
            return `[Copilot Engine (Local State)] Volunteer Deployment Recommendations:\n1. ${recommendations.join('\n2. ')}`;
        }
        return `[Copilot Engine (Local State)] Crowd flow is stable. Maintain standard shifts. Volunteers are currently not urgently requested for extra zones.`;
    }

    // General fallback
    return `[Copilot Engine (Local State Simulation)] System standing by. Current digital twin telemetry metrics are nominal. No critical anomalies matched the exact keyword lookup parameters for: "${userMessage}".`;
}

/**
 * Incident Commander Agent: Generates action recommendation.
 * Can simulate hallucination for testing guardrails, or query Gemini.
 */
export async function generateIncidentResolution(playbookKey, incidentDetails, mockHallucinated = false) {
    if (mockHallucinated) {
        // Generate a response with deliberately incorrect room numbers, exit routes, and squad details
        return `[Incident Commander Agent Alert]
Severe incident reported. Action Plan:
- Dispatch Medics Team 99 immediately to the scene.
- Transport casualty to Medical Station Echo in Room 9B-Level 10 (Critical Care Room).
- Guide ground crews to evacuate via Tunnel Exit 99 to Concourse Corridor North.
- Status: Proceeding with deployment.`;
    }

    // Define normal prompt
    const systemInstruction = `You are a Stadium Incident Commander Agent. 
You must draft a concise alert message detailing the response plan for an emergency.
You will be provided with an incident and must direct ground crews.
CRITICAL: You MUST use the following incident details to formulate your recommendation:
Incident: ${JSON.stringify(incidentDetails)}
Playbook Key: ${playbookKey}

Be concise (max 3-4 sentences).`;

    if (useMock) {
        return getMockIncidentResolution(playbookKey);
    }

    try {
        if (!genAI || typeof genAI.getGenerativeModel !== 'function') {
            throw new Error("Generative AI client not initialized (missing API key or config error)");
        }
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        if (!model) {
            throw new Error("Unable to retrieve gemini-2.5-flash model definition");
        }
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: systemInstruction }] }],
            generationConfig: {
                maxOutputTokens: 250,
                temperature: 0.2
            }
        });
        return result.response.text().trim();
    } catch (error) {
        console.error("Error calling Gemini API for incident resolution:", error);

        // Quota check
        const isQuotaError = error.status === 429 ||
            (error.message && (error.message.includes("429") ||
                error.message.toLowerCase().includes("quota exceeded") ||
                error.message.toLowerCase().includes("rate limit")));

        if (isQuotaError) {
            console.warn(`[Quota Fallback Alert] Intercepted 429 Rate Limit. Serving playbook fallback resolution for key: ${playbookKey}`);
            return getMockIncidentResolution(playbookKey);
        }

        return `Emergency alert initiated for ${playbookKey}. Ground staff must secure the location and stand by for instructions.`;
    }
}

/**
 * Staff Copilot Agent: Chat assistant for stadium operatives.
 * Uses current telemetry snapshot to answer questions.
 */
export async function handleCopilotChat(chatHistory, userMessage, currentTelemetry) {
    const telemetryContext = `
CURRENT STADIUM TELEMETRY STATE (DIGITAL TWIN):
${JSON.stringify(currentTelemetry, null, 2)}

Playbooks Available in System:
- MEDICAL_SECTOR_102 (Medical Station Echo, Room 2B-Level 1, Evacuation Route: Tunnel Exit 4 to Concourse Corridor South, Squad: Medics Team 3)
- GATE_A_OVERFLOW (Concourse Command A, Room: Gate Control Cabin A, Evacuation Route: Ramp 1 North to Main Plaza, Squad: Crowd Control Squad Alpha)
- BAD_WEATHER_ALERT (Stadium Command Center, Room: Emergency Command Room, Evacuation Route: Under-Grandstand Shelters, Squad: Emergency Operations Unit)
- POST_MATCH_EXIT_SURGE (Main Security Operations, Room: Control Center Dome, Evacuation Route: Open All Express Gates 1-10, Squad: Full Event Wardens Support)
- WATER_SHORTAGE_SECTOR_310 (Logistics Hub North, Room: Supply Depot 3A, Evacuation Route: Service Lift Delta to Third Tier Concourse, Squad: Logistics Support Unit 1)
- FOOD_COURT_OVERFLOW_ZONE_A (Crowd Control Command, Room: Concourse Sector A Queue Lanes, Evacuation Route: External Plaza Gates 1-3, Squad: Steward Team Bravo)

Operational Assistant Guidelines:
1. Provide direct, data-backed answers referencing exact gates, sectors, concessions, food courts, washrooms, or logistics metrics.
2. If the user asks about water depletion times:
   - For concessions, calculate minutes to depletion = (current_volume / depletion_rate). Flag any concessions depleting under 20 mins.
3. Query gate pressure: Identify gates with crowd_density > 4.0 people/sqm or throughput > 100 people/min.
4. Food Courts: Monitor density and refill status. Report low inventory or high congestion.
5. Washrooms: Identify occupancy % (>80% is critical), queue waiting minutes, toilet paper supply issues, or security flags.
6. Logistics: Track shuttle fleets (delayed/active) and volunteer ratios.
7. Be extremely concise. Cite exact values (occupancy %, queue min, water liters).
  `;

    if (useMock) {
        return runLocalStateChatParser(userMessage, currentTelemetry);
    }

    try {
        if (useMock || !genAI || typeof genAI.getGenerativeModel !== 'function') {
            return runLocalStateChatParser(userMessage, currentTelemetry);
        }
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        if (!model) {
            throw new Error("Unable to retrieve gemini-2.5-flash model definition");
        }

        // Standardize chat format for Gemini
        const formattedHistory = chatHistory.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        // Injected system context
        formattedHistory.unshift({
            role: 'user',
            parts: [{ text: `SYSTEM CONTEXT: ${telemetryContext}\nAct as the Copilot for command staff.` }]
        });

        formattedHistory.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        const chatSession = model.startChat({
            history: formattedHistory.slice(0, -1), // feed previous history
            generationConfig: {
                maxOutputTokens: 350,
                temperature: 0.3
            }
        });

        const result = await chatSession.sendMessage(userMessage);
        return result.response.text().trim();
    } catch (error) {
        console.error("Error executing Copilot Gemini chat session:", error);

        // Quota check
        const isQuotaError = error.status === 429 ||
            (error.message && (error.message.includes("429") ||
                error.message.toLowerCase().includes("quota exceeded") ||
                error.message.toLowerCase().includes("rate limit")));

        if (isQuotaError) {
            console.warn(`[Quota Fallback Alert] Intercepted 429 Rate Limit in chat session. Serving local state parser fallback.`);
            return runLocalStateChatParser(userMessage, currentTelemetry);
        }

        return `Failed to fetch AI feedback due to server connection constraints. Current incidents: ${currentTelemetry.incidents.length} active.`;
    }
}

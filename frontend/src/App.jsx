import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert, ShieldCheck, Zap, Users, Droplet,
  AlertTriangle, RefreshCw, Send, Activity, Play, Pause,
  CheckCircle, MessageSquare, Plus, Clock, MapPin, AlertCircle,
  Minus, Maximize2, Minimize2, X
} from 'lucide-react';

function App() {
  const [state, setState] = useState({
    gates: [],
    concessions: [],
    foodCourts: [],
    washrooms: [],
    logistics: { volunteer_ratio: 0.82, volunteers_active: 82, volunteers_needed: 100, shuttles: [] },
    incidents: [],
    anomalies: [],
    stats: { safetyScore: 100, totalEntries: 0, activeAlerts: 0, timestamp: '' },
    simulationActive: true
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Copilot Chat States
  const [chatHistory, setChatHistory] = useState([
    {
      sender: 'ai',
      text: `Welcome to Stadium Control Copilot.

SYSTEM USER GUIDE:
• [Pause/Resume]: Freeze/unfreeze telemetry ticks.
• [Refill Water]: Restore concessions/food court stocks and restroom supplies.
• [Reset]: Revert digital twin values to default nominals.
• [Live Dispatch Simulation]: Fire custom anomalies into stadium zones.
• [Run Guardian Commander]: Triggers Gemini AI and feeds through Guardian Control.
🛡️ Guardian Control: Outward-bound deterministic validation layer intercepting/correcting AI model hallucinations against immutable playbooks.

How run-time checks are synchronized: ask me about gate pressures, water volumes, or active incidents.`
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [activeUtilityTab, setActiveUtilityTab] = useState('concessions');
  const chatBottomRef = useRef(null);

  // Guardrail Simulation Settings
  const [simulateHallucination, setSimulateHallucination] = useState(false);
  const [verifyingAnomalyId, setVerifyingAnomalyId] = useState(null);

  const [copilotUIState, setCopilotUIState] = useState('overlay'); // minimized, overlay, fullscreen
  const [hoveredNode, setHoveredNode] = useState(null);

  // Custom Incident Injector Form States
  const [injectDetails, setInjectDetails] = useState({
    location_zone: 'SECTOR_102',
    incident_type: 'MEDICAL_EMERGENCY',
    priority: 'CRITICAL',
    details: 'Fan experiencing severe heat exhaustion, unconscious.'
  });

  // SSE Stream Initialization
  useEffect(() => {
    let eventSource;

    const connectSSE = () => {
      setLoading(true);
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setState(parsed);
          setError(null);
          setLoading(false);
        } catch (e) {
          console.error("Failed to parse SSE data stream:", e);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE stream connection lost. Attempting reconnection...");
        setError("Retrying connection to Smart Stadium Digital Twin...");
        eventSource.close();
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Auto scroll copilot chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Execute Guardrail trigger
  const runGuardrailAnalysis = async (anomaly) => {
    // Locate playbook key
    let playbookKey = '';
    if (anomaly.type === 'MEDICAL_EMERGENCY' && anomaly.location === 'SECTOR_102') {
      playbookKey = 'MEDICAL_SECTOR_102';
    } else if (anomaly.type === 'GATE_OVERFLOW' && anomaly.location === 'GATE_A') {
      playbookKey = 'GATE_A_OVERFLOW';
    } else if (anomaly.type === 'BAD_WEATHER_ALERT') {
      playbookKey = 'BAD_WEATHER_ALERT';
    } else if (anomaly.type === 'POST_MATCH_EXIT_SURGE') {
      playbookKey = 'POST_MATCH_EXIT_SURGE';
    } else {
      // General fallbacks
      alert(`No deterministic playbook configured for ${anomaly.type} at ${anomaly.location}.`);
      return;
    }

    setVerifyingAnomalyId(anomaly.id);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbookKey,
          anomaly,
          simulateHallucination
        })
      });

      if (!response.ok) throw new Error("Failed to compile analysis");
      // Server-sent SSE updates the state context. Anomaly object will contain evaluation results.
    } catch (err) {
      console.error("Guardrail execution error:", err);
      alert("Error generating guardrail instructions: " + err.message);
    } finally {
      setVerifyingAnomalyId(null);
    }
  };

  // Submit Copilot Chat Message
  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const userMsg = { sender: 'user', text: currentMessage };
    setChatHistory(prev => [...prev, userMsg]);
    setCurrentMessage('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          history: chatHistory
        })
      });

      if (!response.ok) throw new Error("Connection failed");
      const data = await response.json();
      setChatHistory(prev => [...prev, { sender: 'ai', text: data.response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { sender: 'ai', text: `Failed to connect with command copilot. State diagnostics match: ${state.incidents.length} incidents logged.` }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Ingest manual mock anomaly
  const injectMockIncident = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(injectDetails)
      });
      if (response.ok) {
        // Clear inputs depending on type
        alert(`Injected mock incident into zone ${injectDetails.location_zone}!`);
      }
    } catch (err) {
      console.error("Failed to inject incident:", err);
    }
  };

  // Resolve active incident
  const resolveIncident = async (incident_id) => {
    try {
      await fetch('/api/incident/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id })
      });
    } catch (err) {
      console.error("Resolve error:", err);
    }
  };

  // Control Engine commands
  const runControlAction = async (action) => {
    try {
      await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
    } catch (err) {
      console.error("Engine Control command error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#050609] text-[#e2e8f0] pb-8 w-full">
      {/* Header Panel */}
      <header className="border-b border-[#1b223c] bg-[#0c0e18] px-6 py-4 sticky top-0 z-50 shadow-lg backdrop-blur-md w-full">
        <div className="w-full px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#45f3ff]/10 p-2 rounded border border-[#45f3ff]/30">
              <Activity className="h-6 w-6 text-neonBlue animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wider text-white">COLOSSEUM OPS CENTER</h1>
              <p className="text-xs text-darkMuted tracking-widest uppercase">Digital Twin State Engine v1.02</p>
            </div>
          </div>

          <div className="flex flex-flow gap-4 items-center flex-wrap">
            {/* Status Indices */}
            <div className="flex items-center gap-6 text-xs bg-[#101423] py-2 px-4 rounded border border-[#1b223c]">
              <div className="text-center border-r border-[#1b223c] pr-4">
                <span className="text-[#a0aec0] block uppercase tracking-wider scale-90">Safety Code</span>
                <span className={`text-base font-black ${state.stats.safetyScore > 80 ? 'text-neonGreen' : state.stats.safetyScore > 50 ? 'text-neonYellow' : 'text-neonRed'}`}>
                  {state.stats.safetyScore}%
                </span>
              </div>
              <div className="text-center border-r border-[#1b223c] pr-4">
                <span className="text-[#a0aec0] block uppercase tracking-wider scale-90">Attendance</span>
                <span className="text-base font-black text-white">{state.stats.totalEntries}</span>
              </div>
              <div className="text-center pr-2">
                <span className="text-[#a0aec0] block uppercase tracking-wider scale-90">Watchdogs</span>
                <span className="text-base font-black text-neonCyan">{state.stats.activeAlerts} Alerts</span>
              </div>
            </div>

            {/* Simulation Controllers */}
            <div className="flex items-center gap-2">
              {state.simulationActive ? (
                <button
                  onClick={() => runControlAction('pause')}
                  className="bg-neonYellow/10 text-neonYellow border border-neonYellow/30 p-2 rounded hover:bg-neonYellow/20 transition flex items-center gap-1.5 text-xs text-semibold"
                  title="Pause simulation state ticks"
                >
                  <Pause className="h-4 w-4" /> Pause
                </button>
              ) : (
                <button
                  onClick={() => runControlAction('resume')}
                  className="bg-[#45f3ff]/10 text-neonBlue border border-[#45f3ff]/30 p-2 rounded hover:bg-[#45f3ff]/20 transition flex items-center gap-1.5 text-xs text-semibold"
                  title="Resume simulation state ticks"
                >
                  <Play className="h-4 w-4" /> Resume
                </button>
              )}
              <button
                onClick={() => runControlAction('refill_water')}
                className="bg-neonGreen/10 text-neonGreen border border-neonGreen/30 p-2 rounded hover:bg-neonGreen/20 transition flex items-center gap-1.5 text-xs text-semibold shrink-0"
                title="Refill water stall inventories"
              >
                <Droplet className="h-4 w-4" /> Refill Water
              </button>
              <button
                onClick={() => runControlAction('restock_toilet_paper')}
                className="bg-neonCyan/15 text-neonCyan border border-neonCyan/30 p-2 rounded hover:bg-neonCyan/25 transition flex items-center gap-1.5 text-xs text-semibold shrink-0"
                title="Restock toilet paper supply"
              >
                <span className="font-bold text-xs">🧻</span> Restock TP
              </button>
              <button
                onClick={() => runControlAction('refill_food_stalls')}
                className="bg-neonYellow/15 text-neonYellow border border-neonYellow/30 p-2 rounded hover:bg-neonYellow/25 transition flex items-center gap-1.5 text-xs text-semibold shrink-0"
                title="Refill food stall inventory"
              >
                <Zap className="h-4 w-4" /> Refill Food
              </button>
              <button
                onClick={() => runControlAction('reset')}
                className="bg-[#343a40] text-gray-300 border border-[#495057] p-2 rounded hover:bg-[#495057] transition text-xs flex items-center gap-1"
                title="Reset simulation state"
              >
                <RefreshCw className="h-3 w-3" /> Reset
              </button>
            </div>
          </div>
        </div >
      </header >

      {/* Main Grid Interface */}
      <main className="w-full px-0 mx-0 mt-6">
        {error && (
          <div className="mb-4 bg-neonRed/10 border border-neonRed/30 text-neonRed px-4 py-3 rounded flex items-center gap-2 text-sm justify-between">
            <span className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              {error}
            </span>
            <button className="underline text-xs" onClick={() => window.location.reload()}>Reload Hub</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full px-0 mx-0">

          {/* COLUMN 1: LIVE DIGITAL TWIN TELEMETRY (span 4) */}
          <div className="lg:col-span-4 flex flex-col gap-6">

            {/* GATES MONITOR */}
            <div className="glass-card rounded-lg p-5 border border-[#1b223c]">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1b223c]">
                <h2 className="font-semibold text-[#66fcf1] tracking-wider text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" /> Edge CCTV Turnstiles
                </h2>
                <span className="text-[10px] bg-[#1a2e37] text-neonBlue px-2 py-0.5 rounded font-mono">CCTV counting</span>
              </div>

              <div className="space-y-4">
                {state.gates.map(gate => (
                  <div key={gate.zone_id} className="p-3 border border-[#1a1f33] rounded-md bg-[#0a0d17]/50 flex justify-between items-center hover:bg-[#0d1222] transition">
                    <div>
                      <div className="font-semibold text-white text-sm">{gate.zone_id}</div>
                      <div className="text-xs text-darkMuted mt-0.5">
                        Crowd density: <span className="text-gray-300 font-medium">{gate.crowd_density.toFixed(2)}/sqm</span>
                      </div>
                      <div className="text-xs text-darkMuted">
                        Throughput: <span className="text-gray-300 font-medium">{gate.throughput_rate} people/min</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${gate.status === 'CRITICAL' ? 'bg-[#ff003c]/20 text-neonRed border border-[#ff003c]/40 glow-red animate-pulse' :
                        gate.status === 'CONGESTED' ? 'bg-neonYellow/20 text-neonYellow border border-neonYellow/40' :
                          'bg-neonGreen/10 text-neonGreen border border-neonGreen/30'
                        }`}>
                        {gate.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CONSOLIDATED UTILITIES TAB PANEL */}
            <div className="glass-card rounded-lg p-4 border border-[#1b223c]">
              {/* Tab Header Switches */}
              <div className="flex border-b border-[#1b223c] mb-3">
                <button
                  type="button"
                  onClick={() => setActiveUtilityTab('concessions')}
                  className={`flex-1 pb-1.5 text-xs font-bold tracking-wider transition ${activeUtilityTab === 'concessions' ? 'text-neonBlue border-b border-neonBlue border-b-2' : 'text-darkMuted hover:text-white'}`}
                >
                  💧 Concessions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveUtilityTab('food')}
                  className={`flex-1 pb-1.5 text-xs font-bold tracking-wider transition ${activeUtilityTab === 'food' ? 'text-neonCyan border-b border-neonCyan border-b-2' : 'text-darkMuted hover:text-white'}`}
                >
                  🍔 Food Courts
                </button>
                <button
                  type="button"
                  onClick={() => setActiveUtilityTab('washrooms')}
                  className={`flex-1 pb-1.5 text-xs font-bold tracking-wider transition ${activeUtilityTab === 'washrooms' ? 'text-neonYellow border-b border-neonYellow border-b-2' : 'text-darkMuted hover:text-white'}`}
                >
                  漏 Restrooms
                </button>
              </div>

              {/* High Density Inline Zone (No Scrolling) */}
              <div className="space-y-2">
                {/* 1. Concessions Tab */}
                {activeUtilityTab === 'concessions' && (
                  <div className="space-y-2">
                    {state.concessions?.map(stall => {
                      const minutesLeft = stall.depletion_rate > 0 ? (stall.current_volume / stall.depletion_rate) : Infinity;
                      const isLow = minutesLeft <= 20;

                      return (
                        <div key={stall.stall_id} className="p-2 border border-[#1a1f33] rounded-md bg-[#0a0d17]/50 hover:bg-[#0d1222] transition text-[11px]">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold text-white text-xs mr-2">{stall.stall_id}</span>
                              <span className="text-[10px] text-darkMuted">Loc: <span className="text-gray-300 font-mono">{stall.location_zone}</span></span>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${stall.status === 'DEPLETED' ? 'bg-neonRed/20 text-neonRed border border-neonRed/40 animate-pulse' :
                              stall.status === 'LOW' ? 'bg-neonYellow/20 text-neonYellow border border-neonYellow/40' :
                                'bg-neonGreen/10 text-neonGreen border border-neonGreen/30'
                              }`}>
                              {stall.status}
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-4">
                            <span className="text-[10px] text-darkMuted font-mono shrink-0">Vol: {stall.current_volume.toFixed(1)}L / 150L</span>
                            <div className="flex-1 bg-[#141829] h-1.5 rounded overflow-hidden">
                              <div
                                className={`h-full rounded-r transition-all duration-500 ${isLow ? 'bg-neonRed glow-red' : 'bg-neonBlue glow-cyan'}`}
                                style={{ width: `${Math.min(100, (stall.current_volume / 150) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-darkMuted font-mono shrink-0">{stall.depletion_rate}L/min</span>
                          </div>

                          <div className="flex justify-between items-center mt-1.5 pt-1 border-t border-[#141829]/60 text-[10px]">
                            <span className="text-darkMuted flex items-center gap-1 font-mono">
                              <Clock className="w-2.5 h-2.5" /> Est. Depletion:
                            </span>
                            <span className={`font-mono font-medium ${isLow ? 'text-neonRed font-bold' : 'text-gray-300'}`}>
                              {minutesLeft === Infinity ? 'Stable' : `${Math.round(minutesLeft)} mins`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Food Courts Tab */}
                {activeUtilityTab === 'food' && (
                  <div className="space-y-2">
                    {state.foodCourts?.map(fc => {
                      const isHigh = fc.crowd_density > 4.0;
                      return (
                        <div key={fc.zone_id} className="p-2 border border-[#1a1f33] rounded-md bg-[#0a0d17]/50 hover:bg-[#0d1222] transition text-[11px]">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold text-white text-xs mr-2">{fc.zone_id}</span>
                              <span className="text-[10px] text-darkMuted font-mono">Density: <span className="text-gray-300">{fc.crowd_density} / sqm</span></span>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${isHigh ? 'bg-neonRed/20 text-neonRed border border-neonRed/40 animate-pulse' : 'bg-[#101423] text-darkMuted'}`}>
                              {fc.refill_status}
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-4">
                            <span className="text-[10px] text-darkMuted font-mono shrink-0">Capacity Grid</span>
                            <div className="flex-1 bg-[#141829] h-1.5 rounded overflow-hidden">
                              <div
                                className={`h-full rounded-r transition-all duration-500 ${isHigh ? 'bg-neonRed glow-red' : 'bg-neonCyan glow-cyan'}`}
                                style={{ width: `${Math.min(100, (fc.crowd_density / 5) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-darkMuted font-mono shrink-0">{Math.round((fc.crowd_density / 5) * 100)}%</span>
                          </div>

                          <div className="flex justify-between items-center mt-1.5 pt-1 border-t border-[#141829]/60 text-[10px] font-mono">
                            <span className="text-darkMuted">Wait Duration:</span>
                            <span className={`font-semibold ${fc.wait_time > 15 ? 'text-neonRed font-bold animate-pulse' : 'text-gray-300'}`}>
                              {fc.wait_time || 0} mins
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Restrooms Tab */}
                {activeUtilityTab === 'washrooms' && (
                  <div className="space-y-2">
                    {state.washrooms?.map(w => {
                      const isHighOccupancy = w.occupancy > 80;
                      const isWarningOccupancy = w.occupancy >= 50 && w.occupancy <= 80;
                      const hasAlert = w.security_incident_flag;

                      return (
                        <div key={w.zone_id} className="p-2 border border-[#1a1f33] rounded-md bg-[#0a0d17]/50 hover:bg-[#0d1222] transition text-[11px]">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs">{w.zone_id}</span>
                              {hasAlert && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neonRed opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-neonRed"></span>
                                </span>
                              )}
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${hasAlert ? 'bg-neonRed text-white animate-pulse' : 'bg-[#101423] text-darkMuted'}`}>
                              {hasAlert ? 'SECURITY ALERT' : 'NOMINAL'}
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-4">
                            <span className="text-[10px] text-darkMuted font-mono shrink-0">Occupancy</span>
                            <div className="flex-1 bg-[#141829] h-1.5 rounded overflow-hidden">
                              <div
                                className={`h-full rounded-r transition-all duration-300 ${isHighOccupancy ? 'bg-[#ff003c] glow-red' : isWarningOccupancy ? 'bg-neonYellow' : 'bg-neonGreen'}`}
                                style={{ width: `${w.occupancy}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-darkMuted font-mono shrink-0">{w.occupancy}%</span>
                          </div>

                          <div className="flex justify-between items-center mt-1.5 pt-1 border-t border-[#141829]/60 text-[10px] font-mono">
                            <span className="text-[10px] text-darkMuted">Wait Time: <span className={`font-semibold ${w.queue_length > 8 ? 'text-neonRed font-bold animate-pulse' : 'text-gray-300'}`}>{w.queue_length}m</span></span>
                            <span className="text-[10px] text-darkMuted">Supply: <span className={`font-semibold ${w.supply_status.includes('Low') ? 'text-neonYellow' : 'text-neonGreen'}`}>{w.supply_status}</span></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* LOGISTICS MONITOR */}
            <div className="glass-card rounded-lg p-5 border border-[#1b223c]">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#1b223c]">
                <h2 className="font-semibold text-white tracking-wider text-sm flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-neonCyan" /> Logistics & Shuttle Fleets
                </h2>
                <span className="text-[10px] bg-[#1a2e37] text-neonBlue px-1.5 py-0.5 rounded font-mono">Real-Time Transit</span>
              </div>

              <div className="space-y-3.5">
                {/* Volunteer Deployment Tracker */}
                <div>
                  <div className="flex justify-between items-center text-[11px] text-darkMuted mb-1 font-mono">
                    <span>Volunteers Active</span>
                    <span className="text-neonCyan font-bold">{state.logistics?.volunteers_active || 82} / {state.logistics?.volunteers_needed || 100} ({Math.round((state.logistics?.volunteer_ratio || 0.82) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-[#141829] h-2 rounded overflow-hidden">
                    <div
                      className="h-full bg-neonCyan glow-cyan rounded-r transition-all duration-500"
                      style={{ width: `${(state.logistics?.volunteer_ratio || 0.82) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Shuttle Fleets Tracker */}
                <div className="space-y-2 pt-2 border-t border-[#141829]">
                  <div className="text-[11px] text-darkMuted font-mono">Active Shuttle Routes:</div>
                  <div className="grid grid-cols-3 gap-2">
                    {state.logistics?.shuttles?.map(s => {
                      const isDelayed = s.status === 'DELAYED';
                      return (
                        <div key={s.id} className={`p-2 border rounded font-mono text-[9px] flex flex-col justify-between ${isDelayed ? 'bg-neonRed/10 border-neonRed/30 text-neonRed animate-pulse' : 'bg-neonGreen/10 border-neonGreen/30 text-neonGreen'
                          }`}>
                          <span className="font-bold truncate" title={s.id}>{s.id.replace('SHUTTLE_', '')}</span>
                          <span className="opacity-60 text-[8px] truncate mt-1 leading-none">{s.route}</span>
                          <span className="text-[8px] font-black mt-0.5 tracking-wider uppercase">{s.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* COLUMN 2: WHAT NEEDS ATTENTION NOW & GUARDRAILS (span 5) */}
          <div className="lg:col-span-5 flex flex-col gap-6">

            {/* WHAT NEEDS ATTENTION PANEL */}
            <div className="glass-card rounded-lg p-5 border border-neonYellow/20 panel-border-yellow flex-1">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1b223c]">
                <h2 className="font-semibold text-white tracking-wider text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 text-neonYellow" /> What Needs Attention Now
                </h2>
                <div className="flex items-center gap-2 bg-[#1a1710] border border-neonYellow/20 px-2 py-0.5 rounded text-[10px] text-neonYellow">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neonYellow opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-neonYellow"></span>
                  </span>
                  Watchdog Monitoring
                </div>
              </div>

              {state.anomalies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-darkMuted border border-[#1b223c] border-dashed rounded-md bg-[#0a0d17]/20">
                  <ShieldCheck className="h-12 w-12 text-[#2e7d32] mb-3 opacity-60" />
                  <p className="text-sm font-semibold text-gray-300">All Stadium Systems Nominal</p>
                  <p className="text-xs max-w-xs mt-1">Ready for telemetry triggers. Guardrail structures armed.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {state.anomalies.map(anomaly => {
                    const validation = anomaly.evaluation;
                    const isVerifying = verifyingAnomalyId === anomaly.id;

                    return (
                      <div key={anomaly.id} className="p-4 border border-[#2b2416] rounded-md bg-[#13110b]/55 space-y-4">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className={`inline-block text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded text-white bg-red-800 uppercase`}>
                              ANOMALY DETECTED: {anomaly.type}
                            </span>
                            <h3 className="font-bold text-white text-xs mt-1">{anomaly.message}</h3>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-darkMuted">
                              <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3 text-neonYellow" /> {anomaly.location}</span>
                              <span>•</span>
                              <span>Source: {anomaly.source}</span>
                            </div>
                          </div>
                        </div>

                        {/* Guardrail Controls */}
                        {!validation ? (
                          <div className="bg-[#101423] p-3 rounded rounded-sm border border-[#1b223c] flex flex-col gap-2.5">
                            <p className="text-[11px] text-darkMuted leading-relaxed">
                              LLM decision is required for execution routes. Test state allows forcing AI hallucinations to probe deterministic filters:
                            </p>
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={simulateHallucination}
                                  onChange={(e) => setSimulateHallucination(e.target.checked)}
                                  className="rounded border-[#1b223c] bg-[#050609] text-neonBlue focus:ring-[#45f3ff]"
                                />
                                <span className={`font-medium ${simulateHallucination ? 'text-neonRed font-bold' : 'text-gray-300'}`}>
                                  Force AI Hallucination
                                </span>
                              </label>

                              <button
                                onClick={() => runGuardrailAnalysis(anomaly)}
                                disabled={isVerifying}
                                className="bg-neonYellow hover:bg-[#e6d200] text-black text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 transition"
                              >
                                {isVerifying ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Analysing...
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-3 w-3" /> Run Guardian Commander
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Guardrail Evaluation comparison display
                          <div className="space-y-3 bg-[#0a0c14] border border-[#1d273a] p-3.5 rounded rounded-sm">
                            <div className="flex justify-between items-center border-b border-[#141b29] pb-2">
                              <h4 className="text-xs font-bold text-neonCyan tracking-wider flex items-center gap-1">
                                <ShieldAlert className="h-3.5 w-3.5 text-neonCyan" /> GUARDIAN DECISION LOG
                              </h4>

                              <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded ${validation.status === 'OVERRIDDEN' ? 'bg-neonRed/20 text-neonRed border border-neonRed/40 pulse-glow-red' :
                                'bg-neonGreen/20 text-neonGreen border border-neonGreen/40 glow-green'
                                }`}>
                                GUARDRAILS: {validation.status === 'OVERRIDDEN' ? 'INTERCEPTED & OVERRIDDEN' : 'PASSED'}
                              </span>
                            </div>

                            {/* Carousel / Tabbed detailed audit */}
                            {validation.status === 'OVERRIDDEN' && (
                              <div className="text-[10px] bg-red-950/20 border border-red-500/20 rounded p-2.5 text-neonRed leading-relaxed">
                                <p className="font-bold flex items-center gap-1 mb-1"><AlertTriangle className="h-3.5 w-3.5" /> Deterministic Mismatch Triggered!</p>
                                <ul className="list-disc pl-4 space-y-1">
                                  {validation.details.discrepancies.map((disc, idx) => (
                                    <li key={idx}> {disc} </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Side by side before/after comparison */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                              <div className="p-2 border border-[#1b223c] rounded bg-[#0a0d17]/40">
                                <h5 className="font-bold text-[#a0aec0] uppercase tracking-wider mb-1">Original GenAI Output</h5>
                                <p className="text-gray-400 italic font-mono leading-relaxed line-clamp-4">
                                  {validation.details.originalOutput || validation.verifiedOutput}
                                </p>
                              </div>
                              <div className="p-2 border border-[#1c2e2c] rounded bg-[#081a17]/20">
                                <h5 className="font-bold text-neonCyan uppercase tracking-wider mb-1">Approved/Enforced Dispatch</h5>
                                <p className="text-[#a0aec0] leading-relaxed line-clamp-4 font-mono font-bold">
                                  {validation.verifiedOutput}
                                </p>
                              </div>
                            </div>

                            {/* Details table for variables extraction */}
                            <div className="overflow-x-auto text-[10px] border border-[#141b29] rounded">
                              <table className="min-w-full divide-y divide-[#141b29]">
                                <thead className="bg-[#0b0f19]">
                                  <tr>
                                    <th className="px-3 py-1.5 text-left text-[10px] font-bold text-darkMuted uppercase">Param key</th>
                                    <th className="px-3 py-1.5 text-left text-[10px] font-bold text-darkMuted uppercase">Lock values</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#141b29] bg-[#0c101c]/40 font-mono text-[9.5px]">
                                  <tr>
                                    <td className="px-3 py-1 text-neonCyan">PRIMARY FACILITY</td>
                                    <td className="px-3 py-1 text-gray-300">{validation.details.playbookUsed?.primary_response_facility}</td>
                                  </tr>
                                  <tr>
                                    <td className="px-3 py-1 text-neonCyan">LAYOUT ROOM</td>
                                    <td className="px-3 py-1 text-gray-300">{validation.details.playbookUsed?.room_number}</td>
                                  </tr>
                                  <tr>
                                    <td className="px-3 py-1 text-neonCyan">EVAC CORRIDOR</td>
                                    <td className="px-3 py-1 text-gray-300">{validation.details.playbookUsed?.evacuation_route}</td>
                                  </tr>
                                  <tr>
                                    <td className="px-3 py-1 text-neonCyan">ASSIGNED SQUAD</td>
                                    <td className="px-3 py-1 text-gray-300">{validation.details.playbookUsed?.dispatch_squad}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            <button
                              onClick={() => {
                                // Close verification result by sending request to reset verification for it
                                setSimulateHallucination(false);
                                runGuardrailAnalysis(anomaly);
                              }}
                              className="w-full bg-[#1b223c] text-xs py-1 rounded text-darkMuted hover:text-white transition hover:bg-[#252f4f]"
                            >
                              Re-Verify / Test Mode Toggle
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* COLUMN 3: SPATIAL MAP & INCIDENTS (span 3) */}
          <div className="lg:col-span-3 flex flex-col gap-6">

            {/* ISOMETRIC VECTOR MAP ENGINE */}
            <div className="glass-card rounded-lg p-4 border border-[#1b223c] flex flex-col relative overflow-hidden min-h-[300px]">
              <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-[#1b223c] z-10">
                <h2 className="font-semibold text-white tracking-wider text-xs flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-neonCyan" /> Spatial Twin Map
                </h2>
                <span className="text-[9px] bg-[#1a2e37] text-neonBlue px-1.5 py-0.5 rounded font-mono">3D Sector Vector</span>
              </div>

              <p className="text-[10px] text-darkMuted mb-2 leading-tight font-mono z-10">
                Hover indicators to inspect stats. Click dots to link injector location.
              </p>

              {/* STADIUM VECTOR CANVAS */}
              <div className="relative flex-1 w-full bg-[#070a13] rounded-lg border border-[#1a1f33] overflow-hidden flex items-center justify-center p-2 min-h-[200px]">
                <svg viewBox="0 0 400 240" className="w-full h-full opacity-60 absolute inset-0 pointer-events-none">
                  {/* Outer stadium outline */}
                  <ellipse cx="200" cy="120" rx="170" ry="90" fill="none" stroke="#1c2541" strokeWidth="2" />
                  <ellipse cx="200" cy="120" rx="140" ry="70" fill="none" stroke="#2b3147" strokeWidth="1.5" />
                  {/* Arena field tilt */}
                  <polygon points="200,65 290,120 200,175 110,120" fill="#0d1b2a" fillOpacity={0.6} stroke="#00f3ff" strokeOpacity={0.3} strokeWidth="1.5" />
                  {/* Half field lines & Dividers */}
                  <line x1="155" y1="92" x2="245" y2="148" stroke="#00f3ff" strokeOpacity={0.2} strokeWidth={1} />
                  <line x1="200" y1="65" x2="200" y2="175" stroke="#00f3ff" strokeOpacity={0.25} strokeWidth={1.5} />
                  <line x1="200" y1="30" x2="200" y2="65" stroke="#2b3147" strokeDasharray="3,3" />
                  <line x1="200" y1="175" x2="200" y2="210" stroke="#2b3147" strokeDasharray="3,3" />
                  <line x1="60" y1="120" x2="110" y2="120" stroke="#2b3147" strokeDasharray="3,3" />
                  <line x1="290" y1="120" x2="340" y2="120" stroke="#2b3147" strokeDasharray="3,3" />
                  <ellipse cx="200" cy="120" rx="190" ry="105" fill="none" stroke="#161c2e" strokeWidth={1} />
                </svg>

                {[
                  // 1. Gates (4 dots)
                  { id: 'GATE_A', label: 'Gate B', area: 'Turnstile Plaza A', x: 26, y: 76 },
                  { id: 'GATE_B', label: 'Gate B', area: 'Turnstile Plaza B', x: 20, y: 52 },
                  { id: 'GATE_C', label: 'Gate C', area: 'Turnstile Plaza C', x: 48, y: 16 },
                  { id: 'GATE_D', label: 'Gate D', area: 'Turnstile Plaza D', x: 78, y: 52 },
                  // 2. Concessions (3 dots - map to custom items or sectors)
                  { id: 'CONCESSION_1', label: 'Concession 1', area: 'Sector 102 Shop', x: 32, y: 42 },
                  { id: 'CONCESSION_2', label: 'Concession 2', area: 'Sector 205 Shop', x: 62, y: 34 },
                  { id: 'CONCESSION_3', label: 'Concession 3', area: 'Sector 310 Shop', x: 82, y: 64 },
                  // 3. Food Sectors (2 dots)
                  { id: 'FOOD_COURT_ZONE_A', label: 'Food Sect. A', area: 'Main Food Plaza', x: 55, y: 55 },
                  { id: 'FOOD_COURT_ZONE_B', label: 'Food Sect. B', area: 'West Food Plaza', x: 38, y: 28 },
                  // 4. Washrooms (2 dots)
                  { id: 'WASHROOM_EAST', label: 'Washroom East', area: 'East Restrooms', x: 74, y: 72 },
                  { id: 'WASHROOM_NORTH', label: 'Washroom West', area: 'North Restrooms', x: 66, y: 44 }
                ].map(node => {
                  const hasAnomaly = state.anomalies?.some(an => an.location === node.id || an.source === node.id || (node.id === 'CONCESSION_1' && (an.location === 'SECTOR_102' || an.source === 'CONCESSION_1')) || (node.id === 'CONCESSION_2' && (an.location === 'SECTOR_205' || an.source === 'CONCESSION_2')) || (node.id === 'CONCESSION_3' && (an.location === 'SECTOR_310' || an.source === 'CONCESSION_3')));
                  const anomalyInfo = state.anomalies?.find(an => an.location === node.id || an.source === node.id || (node.id === 'CONCESSION_1' && (an.location === 'SECTOR_102' || an.source === 'CONCESSION_1')) || (node.id === 'CONCESSION_2' && (an.location === 'SECTOR_205' || an.source === 'CONCESSION_2')) || (node.id === 'CONCESSION_3' && (an.location === 'SECTOR_310' || an.source === 'CONCESSION_3')));
                  const severity = anomalyInfo?.severity || 'NORMAL';

                  let metricValue = 'Nominal';
                  if (node.id.startsWith('GATE_')) {
                    const g = state.gates?.find(gate => gate.zone_id === node.id);
                    metricValue = g ? `Density: ${g.crowd_density.toFixed(1)}/sqm, Flow: ${g.throughput_rate}p/m` : 'Normal';
                  } else if (node.id.startsWith('CONCESSION_')) {
                    const c = state.concessions?.find(con => con.stall_id === node.id);
                    metricValue = c ? `Water Inventory: ${c.current_volume.toFixed(1)}L, Status: ${c.status}` : 'Normal';
                  } else if (node.id.startsWith('FOOD_COURT_')) {
                    const fc = state.foodCourts?.find(f => f.zone_id === node.id);
                    metricValue = fc ? `Queue Density: ${fc.crowd_density}/sqm, Wait: ${fc.wait_time}m` : 'Normal';
                  } else if (node.id.startsWith('WASHROOM_')) {
                    const w = state.washrooms?.find(rest => rest.zone_id === node.id);
                    metricValue = w ? `Occupancy: ${w.occupancy}%, Wait: ${w.queue_length}m` : 'Normal';
                  }

                  let colorClass = 'bg-neonGreen border-neonGreen shadow-green';
                  let pulseClass = 'bg-neonGreen/45';
                  if (hasAnomaly) {
                    if (severity === 'CRITICAL' || severity === 'HIGH') {
                      colorClass = 'bg-[#ff003c] border-neonRed shadow-red';
                      pulseClass = 'bg-[#ff003c]/45 animate-ping';
                    } else {
                      colorClass = 'bg-neonYellow border-neonYellow shadow-yellow';
                      pulseClass = 'bg-neonYellow/45 animate-ping';
                    }
                  }

                  return (
                    <div
                      key={node.id}
                      className="absolute cursor-pointer select-none z-10"
                      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
                      onMouseEnter={() => setHoveredNode({ ...node, metrics: metricValue, anomaly: anomalyInfo })}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => {
                        let desc = 'Mock event selected.';
                        let type = 'MEDICAL_EMERGENCY';
                        let zone = node.id;

                        if (node.id.startsWith('GATE_')) {
                          type = 'GATE_OVERFLOW';
                          desc = `${node.label} reports crowd density threshold exceeded. Critical turnstile traffic.`;
                        } else if (node.id.startsWith('CONCESSION_')) {
                          type = 'WATER_SHORTAGE';
                          let sector = 'SECTOR_310';
                          if (node.id === 'CONCESSION_1') sector = 'SECTOR_102';
                          else if (node.id === 'CONCESSION_2') sector = 'SECTOR_205';
                          zone = sector;
                          desc = `Inventory alert: ${node.label} reports water level is critically low.`;
                        } else if (node.id.startsWith('FOOD_COURT_')) {
                          type = 'FOOD_COURT_OVERFLOW';
                          desc = `Congestion warning: ${node.label} queue wait time exceeds limits.`;
                        } else if (node.id.startsWith('WASHROOM_')) {
                          type = 'SECURITY_BREACH';
                          desc = `Altercation reported at ${node.label}. Dispatch emergency response.`;
                        }

                        setInjectDetails({
                          incident_type: type,
                          location_zone: zone,
                          priority: 'CRITICAL',
                          details: desc
                        });
                      }}
                    >
                      <div className="relative group/indicator flex items-center justify-center">
                        <div className={`absolute h-7 w-7 rounded-full opacity-60 ${pulseClass}`} />
                        <div className={`h-4.5 w-4.5 rounded-full border-2 border-black flex items-center justify-center transition-all ${colorClass} hover:scale-125 hover:brightness-125`} />
                        <span className="absolute top-5 bg-black/85 text-[8px] font-mono font-bold px-1 py-0.2 rounded text-white border border-[#2b3147]/50 pointer-events-none truncate max-w-[80px]">
                          {node.label.replace('Sector ', 'S').replace('Washroom ', 'W-')}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Hover floating map tooltip */}
                {hoveredNode && (
                  <div
                    className="absolute z-20 p-2.5 rounded bg-[#070b13]/95 border border-[#45f3ff]/30 backdrop-blur-md text-[10px] w-48 text-left text-white shadow-2xl pointer-events-none"
                    style={{
                      left: hoveredNode.x > 50 ? 'auto' : '10px',
                      right: hoveredNode.x > 50 ? '10px' : 'auto',
                      bottom: '10px'
                    }}
                  >
                    <div className="font-bold text-neonBlue font-mono flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-neonCyan text-[9px]"></span>
                      {hoveredNode.label}
                    </div>
                    <div className="text-darkMuted text-[8px] font-mono uppercase tracking-wider mt-0.5">Area: {hoveredNode.area}</div>

                    <div className="border-t border-[#1b223c]/60 my-1"></div>

                    <div className="text-gray-300 font-mono text-[9px] leading-tight">
                      <span className="text-neonCyan font-bold">Metrics:</span>
                      <p className="mt-0.5 text-gray-400">{hoveredNode.metrics}</p>
                    </div>

                    {hoveredNode.anomaly && (
                      <div className="text-neonRed font-black font-sans text-[8px] mt-1 tracking-wider uppercase border border-neonRed/35 bg-neonRed/10 px-1 py-0.5 rounded flex items-center gap-1 animate-pulse">
                        ⚠️ ALERT: {hoveredNode.anomaly.type}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* INCIDENT DATABASE */}
            <div className="glass-card rounded-lg p-4 border border-[#1b223c] flex flex-col max-h-[300px]">
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-[#1b223c]">
                <h2 className="font-semibold text-white tracking-wider text-xs flex items-center gap-1.5 font-mono">
                  <ShieldAlert className="h-3.5 w-3.5" /> Incident Database
                </h2>
                <span className="text-[9px] bg-[#2d1b20] text-neonRed px-1.5 py-0.5 rounded font-mono font-bold">{state.incidents.length} active</span>
              </div>

              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                {state.incidents.length === 0 ? (
                  <div className="text-center text-xs text-darkMuted py-8 font-mono">No incident cases opened.</div>
                ) : (
                  state.incidents.map(inc => (
                    <div key={inc.incident_id} className="p-2 border border-[#2b1f24] bg-[#140e11]/45 rounded text-[10px] space-y-1 flex justify-between items-start gap-1 font-mono">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-300 truncate text-[9px]">{inc.incident_id}</span>
                          <span className="text-neonRed font-black uppercase text-[8px]">{inc.priority}</span>
                        </div>
                        <p className="text-gray-300 font-semibold truncate mt-0.5">{inc.location_zone}: {inc.incident_type}</p>
                        <p className="text-darkMuted text-[9px] leading-tight italic line-clamp-2 mt-0.5">{inc.details}</p>
                      </div>
                      <button
                        onClick={() => resolveIncident(inc.incident_id)}
                        className="bg-transparent hover:bg-neonGreen/20 border border-neonGreen/30 hover:border-neonGreen/60 text-neonGreen p-1 rounded transition shrink-0 ml-1 mt-0.5"
                        title="Resolve & Wipe"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* INJECT EDGE INCIDENT FORM */}
            <div className="glass-card rounded-lg p-4 border border-[#1b223c]">
              <h2 className="font-semibold text-white tracking-wider text-xs flex items-center gap-1.5 mb-2 font-mono">
                <Plus className="h-3.5 w-3.5 text-neonBlue" /> Inject Edge Incident
              </h2>
              <form onSubmit={injectMockIncident} className="space-y-2.5">
                <div>
                  <label className="block text-[9px] text-[#8a99ad] uppercase mb-0.5">Incident Type</label>
                  <select
                    value={injectDetails.incident_type}
                    onChange={(e) => {
                      const type = e.target.value;
                      let loc = 'SECTOR_102';
                      let desc = 'Fan experiencing severe heat exhaustion, unconscious.';
                      if (type === 'GATE_OVERFLOW') { loc = 'GATE_A'; desc = 'CCTV Turnstile density exceeds 4.5. Mass queues.'; }
                      if (type === 'BAD_WEATHER_ALERT') { loc = 'SECTOR_ALL'; desc = 'Severe lightning alert reported within 5km of arena.'; }
                      if (type === 'POST_MATCH_EXIT_SURGE') { loc = 'EXITS_ALL'; desc = 'Egress surge: Exit routes blocked by queuing vehicles.'; }
                      if (type === 'WATER_SHORTAGE') { loc = 'SECTOR_310'; desc = 'Sector 310 water level critically low.'; }
                      if (type === 'FOOD_COURT_OVERFLOW') { loc = 'FOOD_COURT_ZONE_A'; desc = 'Plaza Food Court density exceeds 4.2.'; }
                      if (type === 'SECURITY_BREACH') { loc = 'WASHROOM_EAST'; desc = 'Reported altercation inside East Washrooms.'; }

                      setInjectDetails({
                        incident_type: type,
                        location_zone: loc,
                        priority: 'CRITICAL',
                        details: desc
                      });
                    }}
                    className="w-full bg-[#101423] border border-[#1b223c] rounded p-1.5 text-xs text-white"
                  >
                    <option value="MEDICAL_EMERGENCY">MEDICAL EMERGENCY</option>
                    <option value="GATE_OVERFLOW">GATE OVERFLOW</option>
                    <option value="BAD_WEATHER_ALERT">WEATHER ALERT</option>
                    <option value="POST_MATCH_EXIT_SURGE">POST_MATCH EXIT SURGE</option>
                    <option value="WATER_SHORTAGE">WATER SHORTAGE (SECTOR 310)</option>
                    <option value="FOOD_COURT_OVERFLOW">FOOD COURT OVERFLOW (ZONE A)</option>
                    <option value="SECURITY_BREACH">SECURITY BREACH (WASHROOM)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-[#8a99ad] uppercase mb-0.5">Location Zone</label>
                    <input
                      type="text"
                      value={injectDetails.location_zone}
                      onChange={(e) => setInjectDetails(prev => ({ ...prev, location_zone: e.target.value }))}
                      className="w-full bg-[#101423] border border-[#1b223c] rounded p-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#8a99ad] uppercase mb-0.5">Priority</label>
                    <select
                      value={injectDetails.priority}
                      onChange={(e) => setInjectDetails(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full bg-[#101423] border border-[#1b223c] rounded p-1.5 text-xs text-white"
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] text-[#8a99ad] uppercase mb-0.5">Details Summary</label>
                  <textarea
                    value={injectDetails.details}
                    onChange={(e) => setInjectDetails(prev => ({ ...prev, details: e.target.value }))}
                    className="w-full bg-[#101423] border border-[#1b223c] rounded p-2 text-xs text-white h-11 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#45f3ff]/10 hover:bg-[#45f3ff]/20 text-[#66fcf1] border border-[#45f3ff]/40 p-2 rounded text-xs font-semibold uppercase tracking-widest flex items-center justify-center gap-1.5 transition"
                >
                  <Zap className="h-3 w-3" /> Live Dispatch Simulation
                </button>
              </form>
            </div>

          </div>

        </div>
      </main >

      {/* FLOATING MULTIMODE COPILOT WIDGET */}
      <div className="fixed bottom-6 right-6 z-[60]">
        <button
          onClick={() => setCopilotUIState(prev => prev === 'minimized' ? 'overlay' : 'minimized')}
          className="h-14 w-14 rounded-full bg-emerald-950/45 hover:bg-emerald-900/60 text-emerald-400 border-2 border-emerald-500/30 flex items-center justify-center shadow-lg transition duration-300 transform hover:scale-105 active:scale-95"
          style={{ boxShadow: '0 0 18px rgba(52, 211, 153, 0.45)' }}
          title={copilotUIState === 'minimized' ? "Open Staff Copilot window" : "Minimize Staff Copilot window"}
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      </div>

      {
        copilotUIState === 'overlay' && (
          <div className="fixed bottom-6 right-24 z-50 w-[380px] glass-card border border-neonBlue/40 flex flex-col h-[525px] overflow-hidden bg-[#090b12]/95 shadow-2xl">
            <div className="px-4 py-3 border-b border-[#1b223c] bg-[#0e111d] flex justify-between items-center text-white">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-neonCyan" />
                <span className="font-bold text-sm tracking-wider">Staff Copilot</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCopilotUIState('minimized')}
                  className="text-darkMuted hover:text-white transition p-1"
                  title="Minimize"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setCopilotUIState('fullscreen')}
                  className="text-darkMuted hover:text-white transition p-1"
                  title="Full-Screen"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setCopilotUIState('minimized')}
                  className="text-darkMuted hover:text-red-500 transition p-1"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded p-2.5 text-xs leading-relaxed ${msg.sender === 'user'
                    ? 'bg-[#1b223c] text-white rounded-br-none border border-[#2b355d]'
                    : 'bg-[#101423] text-teal-300 rounded-bl-none border border-[#151c35]'
                    }`}>
                    <p className="font-semibold text-[8px] uppercase tracking-wider text-neonCyan mb-1 font-mono">
                      {msg.sender === 'user' ? 'Operator' : 'AI Copilot'}
                    </p>
                    <p className="whitespace-pre-line font-mono text-[11px]">{msg.text}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#101423] border border-[#151c35] text-darkMuted rounded rounded-bl-none p-2 text-xs flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-neonBlue" />
                    <span>Copilot parsing telemetry...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={sendChatMessage} className="p-3 border-t border-[#1b223c] bg-[#0c0e18] flex gap-1.5">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder="Ask: 'Which gate is under stress?'"
                disabled={chatLoading}
                className="flex-1 bg-[#050609] border border-[#1b223c] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#45f3ff]"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="bg-[#45f3ff]/10 hover:bg-[#45f3ff]/20 text-[#66fcf1] border border-[#45f3ff]/40 p-2 rounded transition"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </form>
          </div>
        )
      }

      {
        copilotUIState === 'fullscreen' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm">
            <div className="w-full max-w-4xl h-[85vh] glass-card border border-neonCyan/40 flex flex-col overflow-hidden bg-[#090b12]/95 shadow-2xl">
              <div className="px-4 py-3 bg-[#0e111d] flex justify-between items-center text-white border-b border-[#1b223c]">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-4.5 w-4.5 text-neonCyan" />
                  <span className="font-bold text-base tracking-wider">Staff Copilot — Full View Space</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCopilotUIState('overlay')}
                    className="text-darkMuted hover:text-white transition p-1 flex items-center gap-1 text-xs"
                    title="Restore Down"
                  >
                    <Minimize2 className="h-4 w-4" /> Restore
                  </button>
                  <button
                    onClick={() => setCopilotUIState('minimized')}
                    className="text-darkMuted hover:text-white transition p-1"
                    title="Minimize"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCopilotUIState('overlay')}
                    className="text-darkMuted hover:text-red-500 transition p-1"
                    title="Close Workspace"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatHistory.map((msg, index) => (
                  <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded p-4 text-xs leading-relaxed ${msg.sender === 'user'
                      ? 'bg-[#1b223c] text-white rounded-br-none border border-[#2b355d]'
                      : 'bg-[#101423] text-teal-300 rounded-bl-none border border-[#151c35]'
                      }`}>
                      <p className="font-semibold text-[9px] uppercase tracking-wider text-neonCyan mb-1.5 font-mono">
                        {msg.sender === 'user' ? 'Operator' : 'AI Copilot'}
                      </p>
                      <p className="whitespace-pre-line font-mono text-[12px]">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#101423] border border-[#151c35] text-darkMuted rounded rounded-bl-none p-3.5 text-xs flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-neonBlue" />
                      <span>Copilot parsing telemetry...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              <form onSubmit={sendChatMessage} className="p-4 border-t border-[#1b223c] bg-[#0c0e18] flex gap-2">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Ask: 'Which gate is under stress?'"
                  disabled={chatLoading}
                  className="flex-1 bg-[#050609] border border-[#1b223c] rounded px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#45f3ff]"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="bg-[#45f3ff]/10 hover:bg-[#45f3ff]/20 text-[#66fcf1] border border-[#45f3ff]/40 px-4 py-2 rounded transition font-semibold"
                >
                  Send Query
                </button>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default App;

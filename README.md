# FIFA World Cup 2026: Smart Stadium Command Center & Digital Twin

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Vite](https://img.shields.io/badge/Vite-v8.1.4-blueviolet.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-v4.x-emerald.svg)](https://expressjs.com/)
[![Gemini LLM](https://img.shields.io/badge/GenAI-Google%20Gemini-brightgreen.svg)](https://deepmind.google/technologies/gemini/)

A real-time, low-latency Smart Stadium Digital Twin and Generative AI Command Center designed to coordinate crowds, manage water supplies, prevent gate blockages, and resolve incidents during the **FIFA World Cup 2026**.

---

## 🏛️ Challenge Vertical Alignment

*   **Chosen Vertical:** Smart Stadiums & Tournament Operations
*   **Target User Base:** Stadium Command Center Operators, Venue Security, and Field Volunteers.
*   **Core Objective:** Orchestrate physical facility management and dynamic hazard responses by merging live telemetry feeds with responsible, guardrailed Generative AI workflows.


---

## 📌 Problem Statement

Host arenas during global tournaments struggle with sudden crowd peaks, resource strains, and critical emergencies. Standard GPS fails under concrete dome geometries and deep interior zones, resulting in blind spots for emergency responders. 

Traditional Command Centers rely on static cameras, manual dispatch, and siloed spreadsheets. This delays incident resolutions, creating dangerous bottlenecks at gate checkpoints, toilet paper shortages at restrooms, and water logistics issues at beverage concessions, risking public safety and structural stability.

---

## 🏛️ System Architecture Layers

The Smart Stadium Command Center application processes data through a **hybrid probabilistic + deterministic safety architecture** across five modular system layers:
```
[Layer 1: Edge Simulation] ──> [Layer 2: Digital Twin State] ──> [Layer 3: GenAI Multi-Agent]
                                                                        │
                                                                        ▼
[Layer 4: Dashboard UI]   <────────────────────────────────────── [Layer 5: Guardrail Engine]
```

### 1. Layer 1: Edge Data Live Simulation
Simulates high-density sensor telemetry ticks from turnstiles, restroom scale sensors, water flow systems, and shuttle GPS units. Runs on an active `setInterval` background loop inside Express to test stadium resilience in real time.

### 2. Layer 2: Local Digital Twin State Memory Engine
An in-memory, single-source-of-truth JSON state repository in Node.js mapping structural metrics across 11 key zones. State synchronization leverages Server-Sent Events (SSE) to broadcast changes to the frontend with zero-configuration overhead.

### 3. Layer 3: Generative AI Multi-Agent reasoning Loop
Leverages Google's Gemini Model. It is triggered by anomaly alerts, reading immediate telemetry snapshots and querying the database to write dispatch plans.

### 4. Layer 4: High-Density Glassmorphism Dashboard
A React, Tailwind CSS, and Lucide React single-page frontend. Features:
*   A premium dark theme with interactive **3D Isometric Vector Map** plotting Gates, concessions, washrooms, and food courts.
*   High-contrast color-coded indicators representing real-time sensor levels.
*   Integrated, tabbed dispatch logs to command operator actions instantly.

### 5. Layer 5: Deterministic Guardrail Interception Engine (0% Hallucination)
Before any AI recommendation is broadcasted to emergency responders, the engine intercepts the output inside `guardrails.js`, dynamically normalizes keys, and validates details against layout playbooks inside `playbooks.json`. Any hallucinated rooms, routes, or dispatch teams are overwritten instantly with safe configurations.

---

## 🛡️ Guardrail Deep Dive & Key Normalization

In emergency medical or severe weather contexts, AI hallucination is a critical hazard. The system mitigates this via a deterministic guardrail logic flow inside `backend/guardrails.js`.

### Key Normalization Matchers
The interceptor dynamically normalizes key strings to prevent lookup errors from spacing or character variants. It translates space-separated, colon-separated, or inverted structures (e.g. `"WASHROOM_SOUTH: WASHROOM CONGESTION"` or `"WASHROOM_CONGESTION at WASHROOM_SOUTH"`) into upper-case, underscore-separated format (`"WASHROOM_CONGESTION_WASHROOM_SOUTH"`), and queries the playbook database:

```javascript
// Example string parsing logic
normalizedKey = normalizedKey.replace(/\s+AT\s+/g, ' ');
normalizedKey = normalizedKey.replace(/\s*-\s*/g, ' ');
normalizedKey = normalizedKey.replace(/\s*:\s*/g, ' ');
normalizedKey = normalizedKey.replace(/[\s_]+/g, '_');
```

If the AI's generated response contains incorrect facilities, invalid room names, or wrong evacuation corridors, the interceptor marks the status as **`OVERRIDDEN`**, suppresses the hallucinated text, and loads the verified playbook instructions from `playbooks.json` to prevent operational errors.

---

## 🎮 Command Center Operations Guide

### 1. Manual Overrides
At the top header panel, click any of the action buttons:
*   `Refill Water`: Restores water concessions to 100% volume and suspends water depletion metrics.
*   `Restock TP`: Floods restroom supply status back to "OK" and resets congestion queues.
*   `Refill Food`: Resets crowd queue volumes and wait times at vendor outlets.

### 2. Cool-down hold timers
Executing any manual override triggers a **30-second telemetry hold window** for that sector. The simulator suspends crowd/resource decay and blockages for that zone during this period, giving on-ground personnel time to resolve the situation without generating new alarm points.

### 3. Injecting Custom Incidents
Clicking any on-map node (e.g., Gate A or Concession 2) automatically populates the **Inject Edge Incident** panel with the location's ID and description. You can click the "Live Dispatch Simulation" button to submit the event into the simulation.

### 4. Interactive Copilot Dialogues
Click the floating green-emerald Copilot button in the bottom-right corner to open the chat interface. Seek operational answers from the chatbot, such as:
*   *“Which gate is under stress right now?”*
*   *“Provide an audit on restroom sanitation issues.”*

### 5. Bilateral Toggle Switch
The floating logo button acts as a toggle: clicking the logo opens the chat box; clicking the logo again automatically minimizes it, making the drawer transition smoothly.

---
### ⚙️ Real-World Usability & Engineering Polish
### 1. Robust Rate Limit (429) & Quota Shields
Because the automated digital twin background loop continuously triggers anomalies to simulate a live event environment, free-tier API keys can exhaust quotas rapidly. The application features a Graceful Fallback Mechanism:

If the backend catches a 429 Too Many Requests error from the Gemini API, it suppresses the server failure.

It immediately executes local failover logic, serving the matching local playbook response dynamically to ensure zero operational downtime for command operators.

### 2. Contextual UI Action Control
The center action button changes dynamically depending on the type of active anomaly selected by the operator, matching real-world operational language:

WEATHER_ALERT ──> 🚨 Deploy Evacuation / Shelter Protocol

GATE_OVERFLOW ──> 🚨 Trigger Fan Rerouting

FOOD_COURT_OVERFLOW ──> 🍔 Dispatch Refill Units

MEDICAL_EMERGENCY ──> 🚑 Dispatch Medics Team

### 3. Comprehensive Accessibility (WCAG Compliance)
Screen Reader Optimization: Every interactive input, selector dropdown, and interactive SVG map marker is equipped with descriptive aria-label and aria-live="polite" hooks.

Keyboard Navigable Elements: Form sub-panels and custom control triggers are explicitly tied to semantic <label> descriptors with complete id mappings.

📋 Strategic System Assumptions
Network Constraints & Local Fallbacks: It is assumed that global sports arenas experience extreme cellular congestion. The architecture intentionally relies on low-overhead Server-Sent Events (SSE) for data streaming instead of heavy WebSockets, and uses cached local playbooks for complete offline resilience.

API Key Rate Limits: The background simulation loop deliberately runs continuously to stress-test the state framework. The app assumes free-tier keys will hit rate boundaries, which is why the dual-mode execution logic seamlessly runs both live LLM queries and token-less local simulations side-by-side.

---
## 🚀 Step-by-Step Production Deployment Guide

Deploy the system at zero-cost using **Render** for the backend and **Vercel** for the frontend.

### Prerequisites
*   A **GitHub** account.
*   A **Render** account (linked to GitHub).
*   A **Vercel** account (linked to GitHub).
*   A **Google Gemini API Key** (acquired via Google AI Studio).

---

### Step 1: Push Repository to GitHub
1. Create a public or private repository on GitHub (e.g., `fifa-stadium-twin`).
2. Run these terminal commands at the project root to push the codebase:
   ```bash
   git init
   git add .
   git commit -m "feat: digital twin ready for production"
   git branch -M main
   git remote add origin https://github.com/your-username/your-repo-name.git
   git push -u origin main
   ```

---

### Step 2: Deploy Backend to Render (Node/Express Server)
1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service:
   *   **Name**: `fifa-stadium-backend`
   *   **Language/Runtime**: `Node`
   *   **Root Directory**: `backend`
   *   **Build Command**: `npm install`
   *   **Start Command**: `node server.js`
   *   **Instance Type**: `Free`
5. Click **Advanced** and add the following **Environment Variables**:
   *   `PORT`: `3001` (Render will allocate this dynamically, but this fallback is safe)
   *   `GEMINI_API_KEY`: `your_actual_gemini_api_key_here`
6. Click **Create Web Service**. Wait for the deployment to finish and copy your Render URL (e.g., `https://fifa-stadium-backend.onrender.com`).

---

### Step 3: Deploy Frontend to Vercel (React Client)
1. Open `frontend/vercel.json` and replace the rewrite destination URL with your new Render URL:
   ```json
   "destination": "https://fifa-stadium-backend.onrender.com/api/:path*"
   ```
2. Save, commit, and push this change to GitHub:
   ```bash
   git add frontend/vercel.json
   git commit -m "config: update backend gateway endpoints"
   git push
   ```
3. Log in to the [Vercel Dashboard](https://vercel.com/dashboard).
4. Click **Add New** -> **Project**.
5. Import your GitHub repository.
6. Configure the Vercel Project:
   *   **Framework Preset**: `Vite`
   *   **Root Directory**: `frontend`
   *   **Build Command**: `npm run build`
   *   **Output Directory**: `dist`
7. Click **Deploy**. Vercel will build index assets and deploy them at a static `.vercel.app` URL.

---

## 🛠️ Verification Tests

To verify that the system runs smoothly:

```bash
# 1. Run local guardrails tests
cd backend
node test-guardrails.js

# 2. Run local server checks
cd backend
node test-server.js
```

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Created for the PromptWars Hackathon 2026.*

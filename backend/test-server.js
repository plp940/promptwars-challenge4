import http from 'http';

console.log("Checking Digital Twin Endpoint http://localhost:3001/api/state...");
http.get('http://localhost:3001/api/state', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const state = JSON.parse(data);
            console.log("SUCCESS: Connection to Express status server established!");
            console.log(`Active Gates: ${state.gates.length}`);
            console.log(`Active Concessions: ${state.concessions.length}`);
            console.log(`Active Food Courts: ${state.foodCourts?.length}`);
            console.log(`Active Washrooms: ${state.washrooms?.length}`);
            console.log(`Logistics Volunteer Ratio: ${state.logistics?.volunteer_ratio}`);
            console.log(`Active Shuttles: ${state.logistics?.shuttles?.length}`);
            console.log(`Active Incidents: ${state.incidents.length}`);
            console.log(`Watchdog Alerts: ${state.anomalies.length}`);
            console.log(`Stadium Entry count: ${state.stats.totalEntries}`);
            console.log(`Safety Integrity score: ${state.stats.safetyScore}%`);
            console.log("State Snapshot:", JSON.stringify(state.stats, null, 2));

            // Verify they are defined and non-empty
            if (!state.foodCourts || state.foodCourts.length === 0) throw new Error("Missing foodCourts");
            if (!state.washrooms || state.washrooms.length === 0) throw new Error("Missing washrooms");
            if (!state.logistics || !state.logistics.shuttles || state.logistics.shuttles.length === 0) throw new Error("Missing logistics");

            process.exit(0);
        } catch (e) {
            console.error("FAIL: State was not valid JSON", e);
            process.exit(1);
        }
    });
}).on('error', (err) => {
    console.error("FAIL: Server could not be reached.", err.message);
    process.exit(1);
});

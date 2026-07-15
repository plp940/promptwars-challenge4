import { verifyIncidentRecommendation } from './guardrails.js';

console.log("=========================================");
console.log("RUNNING DETERMINISTIC GUARDRAILS AUDIT...");
console.log("=========================================\n");

// TEST CASE 1: Compliant output for Sector 102 Medical Emergency
console.log("TEST CASE 1: Compliant AI Output (Matches Playbook)");
const compliantOutput = `Medical emergency flagged in Sector 102. Ground crews, immediately dispatch Medics Team 3 to the location. The evacuation route is Tunnel Exit 4 to Concourse Corridor South. Please transport the patient immediately to Medical Station Echo (Room 2B-Level 1) for urgent care.`;

const result1 = verifyIncidentRecommendation('MEDICAL_SECTOR_102', compliantOutput);
console.log(`Status: ${result1.status}`);
console.log(`Changes Made: ${result1.changesMade}`);
console.log(`Verified Output Preview:\n---\n${result1.verifiedOutput}\n---`);
console.log("-----------------------------------------\n");

// TEST CASE 2: Hallucinated output for Sector 102 Medical Emergency
console.log("TEST CASE 2: Hallucinated AI Output (Deviates Room / Team)");
const hallucinatedOutput = `Medical emergency flagged in Sector 102. Action Plan: Deploy Rescue Squad Omega to Medical Suite Room 9B-Level 10. Evacuate patient via Escalator 4 North to VIP Concourse.`;

const result2 = verifyIncidentRecommendation('MEDICAL_SECTOR_102', hallucinatedOutput);
console.log(`Status: ${result2.status}`);
console.log(`Changes Made: ${result2.changesMade}`);
console.log(`Discrepancies Audited:\n  ${result2.details.discrepancies.join('\n  ')}`);
console.log(`Verified Output Preview (Intercepted & Corrected):\n---\n${result2.verifiedOutput}\n---`);
console.log("-----------------------------------------\n");

// TEST CASE 3: Hallucinated output for Sector 310 Water Shortage
console.log("TEST CASE 3: Hallucinated AI Output for Sector 310 Water Shortage");
const waterHallucination = `Concession 3 at Sector 310 reports water shortage. Dispatch Logistics Squad 9 to Stadium Reserve Depot A (Room Depot Storage Cage 1) and evacuate through Service Corridor 2.`;
const result3 = verifyIncidentRecommendation('WATER_SHORTAGE_SECTOR_310', waterHallucination);
console.log(`Status: ${result3.status}`);
console.log(`Changes Made: ${result3.changesMade}`);
console.log(`Discrepancies Audited:\n  ${result3.details.discrepancies.join('\n  ')}`);
console.log(`Verified Output Preview (Intercepted & Corrected):\n---\n${result3.verifiedOutput}\n---`);
console.log("-----------------------------------------\n");

// TEST CASE 4: Hallucinated output for Food Court Overflow Zone A
console.log("TEST CASE 4: Hallucinated AI Output for Food Court Overflow Zone A");
const foodOverflowHallucination = `Food court overflow in Zone A. Dispatch Crowd Control Group Z to West Gate (Room Main Command Suite) and use Gate 1 Exit Corridor.`;
const result4 = verifyIncidentRecommendation('FOOD_COURT_OVERFLOW_ZONE_A', foodOverflowHallucination);
console.log(`Status: ${result4.status}`);
console.log(`Changes Made: ${result4.changesMade}`);
console.log(`Discrepancies Audited:\n  ${result4.details.discrepancies.join('\n  ')}`);
console.log(`Verified Output Preview (Intercepted & Corrected):\n---\n${result4.verifiedOutput}\n---`);
console.log("-----------------------------------------");

// TEST CASE 5: Playbook Key Normalization rule audit
console.log("TEST CASE 5: Normalization audit for string 'WATER_SHORTAGE at SECTOR_102'");
const compliantOutput5 = `Water shortage logged. Primary destination: Logistics Station Alpha (Supply Room 1C). Evacuation Route: Lower Concourse Transit Corridor. Dispatch Logistics Support Unit 2 immediately to coordinates.`;
const result5 = verifyIncidentRecommendation('WATER_SHORTAGE at SECTOR_102', compliantOutput5);
console.log(`Status: ${result5.status}`);
console.log(`Changes Made: ${result5.changesMade}`);
console.log("-----------------------------------------");

// TEST CASE 6: Normalization audit for string 'WASHROOM_SOUTH: WASHROOM CONGESTION'
console.log("TEST CASE 6: Normalization audit for string 'WASHROOM_SOUTH: WASHROOM CONGESTION'");
const compliantOutput6 = `Washroom congestion logged. Primary destination: Facilities Command South (Sanitation Hub 1). Evacuation Route: South Concourse Exit Corridor. Dispatch Custodial Rapid Response 1 immediately to coordinates.`;
const result6 = verifyIncidentRecommendation('WASHROOM_SOUTH: WASHROOM CONGESTION', compliantOutput6);
console.log(`Status: ${result6.status}`);
console.log(`Changes Made: ${result6.changesMade}`);
console.log("-----------------------------------------");

// TEST CASE 7: Normalization audit for string 'WASHROOM_CONGESTION at WASHROOM_SOUTH'
console.log("TEST CASE 7: Normalization audit for string 'WASHROOM_CONGESTION at WASHROOM_SOUTH'");
const result7 = verifyIncidentRecommendation('WASHROOM_CONGESTION at WASHROOM_SOUTH', compliantOutput6);
console.log(`Status: ${result7.status}`);
console.log(`Changes Made: ${result7.changesMade}`);
console.log("-----------------------------------------");

// TEST CASE 8: Deduplication and Normalization of Repeating Key Segments
console.log("TEST CASE 8: Normalization audit for repetitive string 'FOOD_COURT_OVERFLOW_FOOD_COURT_ZONE_A'");
const compliantOutput8 = `Food court overflow in Zone A. Dispatch Steward Team Echo directly to Concourse Sector A Queue Lanes. The evacuation route is External Plaza Gates 1-3 and primary destination is Crowd Control Command.`;
const result8 = verifyIncidentRecommendation('FOOD_COURT_OVERFLOW_FOOD_COURT_ZONE_A', compliantOutput8);
console.log(`Status: ${result8.status}`);
console.log(`Changes Made: ${result8.changesMade}`);
console.log("-----------------------------------------");

// TEST CASE 9: Dynamic splitting and mapping / Key Reconstruction Fallbacks (WATER_SHORTAGE_205)
console.log("TEST CASE 9: Reconstruction fallback for string 'WATER_SHORTAGE_205'");
const compliantOutput9 = `Water shortage logged. Primary destination: Logistics Station Central (Supply Room 2E). Evacuation Route: Mid-Level Concourse Service Path. Dispatch Logistics Support Unit 3 immediately to coordinates.`;
const result9 = verifyIncidentRecommendation('WATER_SHORTAGE_205', compliantOutput9);
console.log(`Status: ${result9.status}`);
console.log(`Changes Made: ${result9.changesMade}`);
console.log("-----------------------------------------");

// TEST CASE 10: Preposition simplification ('WATER_SHORTAGE at SECTOR_102') using clean AT to underscore replacement
console.log("TEST CASE 10: Preposition simplification for string 'WATER_SHORTAGE at SECTOR_102'");
const result10 = verifyIncidentRecommendation('WATER_SHORTAGE at SECTOR_102', compliantOutput5);
console.log(`Status: ${result10.status}`);
console.log(`Changes Made: ${result10.changesMade}`);
console.log("-----------------------------------------\n");

// Dynamic import to test generateIncidentResolution API error handling paths
process.env.GEMINI_API_KEY = 'test-mock-key-disable-mock';
const { GoogleGenerativeAI } = await import('@google/generative-ai');
const { generateIncidentResolution } = await import('./agents.js');

let simulateErrorStatus = null;
GoogleGenerativeAI.prototype.getGenerativeModel = function () {
    return {
        generateContent: async function () {
            if (simulateErrorStatus === 429) {
                const err = new Error("Rate limit exceeded");
                err.status = 429;
                throw err;
            } else if (simulateErrorStatus === 404) {
                const err = new Error("Model not found");
                err.status = 404;
                throw err;
            }
            return { response: { text: () => "Nominal response" } };
        }
    };
};

console.log("TEST CASE 11: generateIncidentResolution handling simulated 429 Quota Exceeded exception");
simulateErrorStatus = 429;
const result429 = await generateIncidentResolution('MEDICAL_SECTOR_102', { details: "Severe casualty" });
console.log(`429 Fallback Output:\n${result429}`);
const pass429 = result429.includes("Medical Station Echo") && result429.includes("Room 2B-Level 1");
console.log(`Intercept status: ${pass429 ? "SUCCESS (Matched local playbook)" : "FAILED"}`);
console.log("-----------------------------------------\n");

console.log("TEST CASE 12: generateIncidentResolution handling simulated 404 Model Not Found exception");
simulateErrorStatus = 404;
const result404 = await generateIncidentResolution('GATE_A_OVERFLOW', { details: "Egress block" });
console.log(`404 Fallback Output:\n${result404}`);
const pass404 = result404.includes("Gate Control Cabin A") && result404.includes("Crowd Control Squad Alpha");
console.log(`Intercept status: ${pass404 ? "SUCCESS (Matched local playbook)" : "FAILED"}`);
console.log("-----------------------------------------\n");

if (
    result1.status === 'PASSED' &&
    result2.status === 'OVERRIDDEN' &&
    result3.status === 'OVERRIDDEN' &&
    result4.status === 'OVERRIDDEN' &&
    result5.status === 'PASSED' &&
    result6.status === 'PASSED' &&
    result7.status === 'PASSED' &&
    result8.status === 'PASSED' &&
    result9.status === 'PASSED' &&
    result10.status === 'PASSED' &&
    pass429 &&
    pass404
) {
    console.log("\n✅ ALL GUARDRAIL & API EXCEPTION ROBUSTNESS TEST CASES PASSED!");
    process.exit(0);
} else {
    console.error("\n❌ GUARDRAIL & API EXCEPTION ROBUSTNESS TEST CASES FAILED!");
    process.exit(1);
}

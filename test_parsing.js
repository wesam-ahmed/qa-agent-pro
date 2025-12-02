const repairJson = (jsonStr) => {
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        // console.log('Attempting to repair JSON...');
        let repaired = jsonStr.trim();

        // New Logic: Extract JSON object first
        const firstBrace = repaired.indexOf('{');
        const lastBrace = repaired.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            repaired = repaired.substring(firstBrace, lastBrace + 1);
        }

        // Remove markdown code blocks if present (just in case they are inside the braces, though unlikely for valid JSON)
        repaired = repaired.replace(/```json\n?/g, '').replace(/```\n?/g, '');

        // Fix trailing commas in arrays/objects
        repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

        // Attempt to close unclosed braces/brackets (simple heuristic)
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;

        if (openBraces > closeBraces) repaired += '}'.repeat(openBraces - closeBraces);
        if (openBrackets > closeBrackets) repaired += ']'.repeat(openBrackets - closeBrackets);

        return JSON.parse(repaired);
    }
};

// Simulate the logic in QAAgentPro.tsx lines 696-702
const testParsing = (text) => {
    console.log("Original text length:", text.length);
    let responseText = text;

    // We can remove the initial cleanup here since repairJson now handles extraction
    // responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    console.log("Input text start:", responseText.substring(0, 50).replace(/\n/g, '\\n'));

    try {
        const result = repairJson(responseText);
        console.log("SUCCESS: Parsed JSON");
        if (result.testCases && Array.isArray(result.testCases)) {
            console.log(`Found ${result.testCases.length} test cases.`);
        }
        return result;
    } catch (e) {
        console.error("FAILURE: " + e.message);
    }
};

// Test case 1: Clean JSON in code block (User's case)
const userCase = "```json\n{\n  \"testCases\": [\n    {\n      \"id\": \"TC_001\",\n      \"title\": \"Test\"\n    }\n  ]\n}\n```";

console.log("--- Test Case 1: User Case ---");
testParsing(userCase);

// Test case 2: Preamble text
const preambleCase = "Here is the JSON:\n```json\n{\n  \"testCases\": []\n}\n```";

console.log("\n--- Test Case 2: Preamble ---");
testParsing(preambleCase);

// Test case 3: Postscript text
const postscriptCase = "```json\n{\n  \"testCases\": []\n}\n```\nHope this helps!";

console.log("\n--- Test Case 3: Postscript ---");
testParsing(postscriptCase);

// Test case 4: No code blocks, just text and JSON
const plainTextCase = "Sure, here it is:\n{\n  \"testCases\": []\n}\nThanks.";
console.log("\n--- Test Case 4: Plain Text ---");
testParsing(plainTextCase);
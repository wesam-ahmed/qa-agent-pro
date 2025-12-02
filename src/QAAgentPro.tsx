import React, { useState, useEffect, useMemo } from 'react';
import { Upload, MessageSquare, FileText, Copy, Download, Target, Bot, CheckCircle, BarChart3, GitBranch, AlertTriangle, Code, Edit2, Save, X, Trash2 } from 'lucide-react';
import { callAnthropicAPI, API_CONFIG } from './config';

const QAAgentPro = () => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [userStory, setUserStory] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [testSuiteSummary, setTestSuiteSummary] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [copiedStates, setCopiedStates] = useState({});
  const [editingTestCase, setEditingTestCase] = useState(null);
  const [editingSummary, setEditingSummary] = useState(false);

  useEffect(() => {
    loadChatHistory();
  }, []);

  // Calculate character count (excluding spaces)
  const charCount = useMemo(() => {
    return userStory.replace(/\s/g, '').length;
  }, [userStory]);

  // Helper function to normalize user story for API calls (trim and normalize spaces)
  const userStoryNormalized = useMemo(() => {
    return userStory.trim().replace(/\s+/g, ' ');
  }, [userStory]);

  // Helper function to repair common JSON syntax errors
  // Enhanced version that properly handles large JSON and braces inside strings
  const repairJson = (jsonStr: string): any => {
    try {
      return JSON.parse(jsonStr);
    } catch (e: any) {
      console.log('Attempting to repair JSON...', e?.message || 'Unknown error');
      let repaired = jsonStr.trim();

      // Step 1: Extract JSON object FIRST (find first { to last })
      // This handles markdown-wrapped JSON by extracting the actual JSON content
      const firstBrace = repaired.indexOf('{');
      const lastBrace = repaired.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        repaired = repaired.substring(firstBrace, lastBrace + 1);
      }

      // Step 2: Remove any remaining markdown code blocks (in case they're inside)
      repaired = repaired.replace(/```json\n?/gi, '').replace(/```\n?/g, '');

      // Step 3: Fix trailing commas in arrays/objects
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

      // Step 4: Count braces/brackets properly (ignoring those inside strings)
      let openBraces = 0;
      let closeBraces = 0;
      let openBrackets = 0;
      let closeBrackets = 0;
      let insideString = false;
      let escapeNext = false;
      let lastValidPos = -1;

      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          insideString = !insideString;
          if (!insideString) {
            lastValidPos = i;
          }
          continue;
        }

        if (!insideString) {
          if (char === '{') {
            openBraces++;
            lastValidPos = i;
          } else if (char === '}') {
            closeBraces++;
            lastValidPos = i;
          } else if (char === '[') {
            openBrackets++;
            lastValidPos = i;
          } else if (char === ']') {
            closeBrackets++;
            lastValidPos = i;
          }
        }
      }

      // Step 5: If we're inside a string at the end, try to close it
      if (insideString && lastValidPos > 0) {
        // Try to find a safe truncation point
        const truncateAt = repaired.lastIndexOf('"', lastValidPos);
        if (truncateAt > 0) {
          // Check if this quote is escaped
          let escapeCount = 0;
          for (let i = truncateAt - 1; i >= 0 && repaired[i] === '\\'; i--) {
            escapeCount++;
          }
          if (escapeCount % 2 === 0) {
            // Not escaped, safe to truncate here
            repaired = repaired.substring(0, truncateAt + 1);
            insideString = false;
          }
        }
      }

      // Step 6: If still inside string, try to close it at the end
      if (insideString) {
        repaired += '"';
        insideString = false;
      }

      // Step 7: Close unclosed braces/brackets
      if (openBraces > closeBraces) {
        repaired += '}'.repeat(openBraces - closeBraces);
      }
      if (openBrackets > closeBrackets) {
        repaired += ']'.repeat(openBrackets - closeBrackets);
      }

      console.log('Repaired JSON preview:', repaired.substring(0, 200));
      console.log('Repaired JSON length:', repaired.length);
      console.log('Brace balance:', { open: openBraces, close: closeBraces });
      console.log('Bracket balance:', { open: openBrackets, close: closeBrackets });
      
      try {
        return JSON.parse(repaired);
      } catch (parseError: any) {
        // If repair still fails, try to find and fix the specific issue
        const errorMatch = parseError?.message?.match(/position (\d+)/);
        const errorPos = errorMatch ? parseInt(errorMatch[1]) : -1;
        
        if (errorPos > 0) {
          const contextStart = Math.max(0, errorPos - 200);
          const contextEnd = Math.min(repaired.length, errorPos + 200);
          const errorContext = repaired.substring(contextStart, contextEnd);
          console.error('JSON error at position', errorPos);
          console.error('Error context:', errorContext);
          
          // Try one more fix: remove any incomplete string at the end
          if (parseError.message.includes('Unterminated string') || parseError.message.includes('string')) {
            // Find the last complete object/array
            let lastCompletePos = repaired.lastIndexOf('}');
            if (lastCompletePos > 0) {
              // Check if there's a complete structure before the error
              const beforeError = repaired.substring(0, errorPos);
              const lastBraceBeforeError = beforeError.lastIndexOf('}');
              if (lastBraceBeforeError > 0) {
                // Try parsing just up to the last complete brace
                const truncated = repaired.substring(0, lastBraceBeforeError + 1);
                try {
                  const partial = JSON.parse(truncated);
                  console.warn('⚠️ Parsed partial JSON (truncated at error position)');
                  return partial;
                } catch (e) {
                  // Continue with original error
                }
              }
            }
          }
        }
        
        console.error('JSON repair failed:', parseError?.message || 'Unknown error');
        throw parseError;
      }
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`${API_CONFIG.PROXY_URL}${API_CONFIG.ENDPOINTS.CHAT_HISTORY}`);
      if (response.ok) {
        const histories = await response.json();
        setChatHistory(histories);
      } else {
        console.log('No chat history found');
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      console.log('No chat history found');
    }
  };

  const deleteChatHistory = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    if (!window.confirm('Are you sure you want to delete this history item?')) {
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.PROXY_URL}${API_CONFIG.ENDPOINTS.CHAT_HISTORY}/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setChatHistory(prev => prev.filter(chat => chat.id !== chatId));
      } else {
        const error = await response.json();
        console.error('Failed to delete chat history:', error);
        alert('Failed to delete history item. Please try again.');
      }
    } catch (error) {
      console.error('Failed to delete chat history:', error);
      alert('Failed to delete history item. Please try again.');
    }
  };

  const saveChatToHistory = async (messages, summary, resultsData) => {
    const timestamp = Date.now();
    const chatData = {
      id: `chat_${timestamp}`,
      timestamp,
      summary: summary || 'Analysis',
      messages,
      results: resultsData
    };
    try {
      const response = await fetch(`${API_CONFIG.PROXY_URL}${API_CONFIG.ENDPOINTS.CHAT_HISTORY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatData)
      });

      if (response.ok) {
        const result = await response.json();
        setChatHistory(prev => [result.data, ...prev]);
      } else {
        const error = await response.json();
        console.error('Failed to save chat history:', error);
      }
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      setUserStory(text);
    } catch (error) {
      alert('Error reading file. Please try again.');
    }
  };

  const handleGenerate = async () => {
    if (!userStory.trim()) {
      alert('Please enter a user story first');
      return;
    }

    if (!selectedOption) {
      alert('Please select an option first');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Initializing...');
    setShowResults(false);
    setAnalysis(null);
    setTestCases([]);
    setTestSuiteSummary(null);

    try {
      if (selectedOption === 'analysis') {
        console.log('Performing gap analysis...');
        setProcessingStatus('Analyzing user story...');

        const analysisData = await callAnthropicAPI([{
          role: 'user',
          content: `You are an expert software tester working in an agile environment. Analyze the following user story and provide
1. **Gap Analysis**: Identify missing information, ambiguities, unstated assumptions, and potential edge cases
2. **Requirements Review**: List all explicit and implicit requirements
3. **Testing Scope**: Identify all areas that need testing
4. **Risk Assessment**: Identify high-risk areas that need special attention
5. **Dependencies**: Identify any dependencies or prerequisites



USER STORY TO ANALYZE:
${userStoryNormalized}


OUTPUT FORMAT:
1. 🔴 Critical Logic Gaps (Blockers) (List only high-priority contradictions or missing logic that prevent development. If none, state "None".)

 [Gap] - [Why it breaks the logic]

2.Questions for PO (Organized by Topic) (Ask specific, binary questions. Do not ask generic "how should this work?" questions.)

Functional & Business Logic:

[Question]

UI/UX & States:

[Question]

Data & API Constraints:

[Question - Focus on AIM specific limits, or API sync]

Permissions:

[Question]

3. ⚠️ Testability Needs (What is missing to write a test case? e.g., "Need defined max character limit for user Name".)

[Requirement]


Be thorough, specific, and actionable. For each gap or issue identified, explain WHY it matters and what the potential impact could be during development or testing.`
        }], 8000);

        console.log('✅ Analysis response received');
        const analysisText = analysisData.content.map(item => item.text || '').join('\n');
        setAnalysis(analysisText);

        await saveChatToHistory([
          { role: 'user', content: userStoryNormalized },
          { role: 'assistant', content: analysisText }
        ], 'Gap Analysis', {
          option: 'analysis',
          analysis: analysisText
        });

        setShowResults(true);
        alert('✅ Gap Analysis Complete!\n\nYour analysis is ready below.');

      } else if (selectedOption === 'testcases') {
        console.log('Step 1: Analyzing user story...');
        setProcessingStatus('Step 1/2: Analyzing user story...');

        const analysisData = await callAnthropicAPI([{
          role: 'user',
          content: `You are an expert software tester working in an agile environment. Analyze the following user story and provide:

1. **Gap Analysis**: Identify missing information, ambiguities, unstated assumptions, and potential edge cases
2. **Requirements Review**: List all explicit and implicit requirements
3. **Testing Scope**: Identify all areas that need testing

User Story:
${userStoryNormalized}

Provide a focused analysis covering:

## 1. CRITICAL GAPS & AMBIGUITIES
[List 3-5 most important missing requirements or unclear behaviors]

## 2. KEY REQUIREMENTS
**Functional:** [Core CRUD + integration points]
**Non-Functional:** [Performance, data integrity, usability]

## 3. PRIORITY TEST AREAS
**Must Test (Critical):**
- [3-5 critical scenarios]

**Should Test (High Priority):**
- [3-5 important scenarios]

## 4. EDGE CASES & RISKS
**Boundaries:** [Min/max values, character limits]
**States:** [State transitions, invalid combinations]
**Errors:** [Network issues, invalid data, concurrent actions]
**High Risk:** [Areas needing extensive testing with reasons]

## 5. INTEGRATION & WORKFLOWS
**Affected Features:** [Which dashboards/features integrate]
**User Journeys:** [2-3 common complete workflows]
**Real-World:** [Browser behavior, multi-tab, network issues]

## 6. TEST DATA & TECHNIQUES
**Valid Data:** [Examples]
**Invalid Data:** [Examples]
**Techniques:** [Which black box techniques apply where]
`
        }], 16000);

        const analysisText = analysisData.content.map(item => item.text || '').join('\n');
        setAnalysis(analysisText);
        console.log('✓ Analysis complete');

        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('Step 2: Generating E2E test cases...');
        setProcessingStatus('Step 2/2: Generating comprehensive test cases...');

        const testData = await callAnthropicAPI([{
          role: 'user',
          content: `You are an expert software tester specialized in comprehensive End-to-End (E2E) testing. Generate EFFICIENT and EFFECTIVE E2E test scenarios for the following user story/requirement.

TESTING FOCUS: End-to-End testing covering complete user journeys and workflows from start to finish

IMPORTANT INSTRUCTIONS:
- Focus on E2E scenarios that test complete workflows and functionality
- Prioritize QUALITY over QUANTITY - create fewer but more comprehensive test cases
- Each test case should cover multiple validations in a single flow when appropriate
- For complex features, group related scenarios (Scenario A, B, C) within ONE test case
- Use smart test design techniques to maximize coverage with minimum test cases
- Apply black box testing techniques: Equivalence Partitioning, Boundary Value Analysis, Decision Table Testing, State Transition, Error Guessing
- Consider both functional and non-functional requirements

User Story:
${userStoryNormalized}

Previous Analysis:
${analysisText}

Generate test cases in ONLY JSON format (no markdown, no preamble) with this exact structure:
{
  "testCases": [
    {
      "id": "TC_001",
      "title": "Descriptive test case title covering main functionality",
      "description": "Brief overview of what this test validates",
      "feature": "Feature/Area name",
      "type": "positive/negative/edge",
      "priority": "Critical/High/Medium/Low",
      "technique": "Black box technique(s) used - e.g., Boundary Value Analysis, Equivalence Partitioning",
      "tags": ["smoke", "regression", "e2e", "ui"],
      "preconditions": "Prerequisites and setup required",
      "testData": {
        "scenarios": [
          {
            "name": "Scenario A - Descriptive Name",
            "data": {
              "field1": "value1",
              "field2": "value2"
            },
            "category": "valid/invalid/edge"
          },
          {
            "name": "Scenario B - Descriptive Name", 
            "data": {
              "field1": "value1",
              "field2": "value2"
            },
            "category": "valid/invalid/edge"
          }
        ]
      },
      "steps": [
        {
          "scenario": "Scenario A - Name",
          "actions": [
            "Navigate to [specific page/URL], click the '[Button Name]' button located in [location], enter '[specific value]' in the '[Field Name]' field",
            "Select '[option]' from '[Dropdown Name]' dropdown menu, verify that [specific element] displays correctly",
            "Click '[Button Name]' button and verify [specific outcome]"
          ]
        },
        {
          "scenario": "Scenario B - Name",
          "actions": [
            "Click '[Button Name]' and select '[option]'",
            "Enter exactly [X] characters in '[Field Name]' field: '[exact value]'",
            "Verify that [specific validation] occurs"
          ]
        }
      ],
      "expectedResults": {
        "byScenario": [
          {
            "scenario": "Scenario A",
            "results": "Expected outcome for scenario A with specific details, values, and validations"
          },
          {
            "scenario": "Scenario B", 
            "results": "Expected outcome for scenario B with specific details, values, and validations"
          }
        ]
      },
      "status": "pending"
    }
  ],
  "summary": {
    "totalCases": 0,
    "positive": 0,
    "negative": 0,
    "edge": 0,
    "coverageAreas": [],
    "techniques": [],
    "efficiencyNote": "Brief explanation of how test efficiency was achieved"
  }
}

CRITICAL INSTRUCTIONS:

1. For testData field - SCENARIO-BASED TEST DESIGN:
When a test case covers multiple related scenarios (default values, maximum values, edge cases), structure as:
{
  "scenarios": [
    {
      "name": "Scenario A - Default Values",
      "data": {
        "title": "Default Title",
        "metric": "Engagement (default)",
        "value": 5
      },
      "category": "valid"
    },
    {
      "name": "Scenario B - Maximum Boundary",
      "data": {
        "title": "50 character title example here exactly!!!!!!",
        "description": "200 character description...",
        "value": 7
      },
      "category": "edge"
    }
  ]
}

For simple test cases with single data set, use:
{
  "valid": ["data1", "data2"],
  "invalid": ["data1", "data2"],
  "edge": ["data1", "data2"]
}

2. For steps field - SCENARIO-GROUPED ACTIONS:
When test has multiple scenarios, group steps by scenario:
[
  {
    "scenario": "Scenario A - Default Values",
    "actions": [
      "Detailed action 1 with specific field names, button labels, locations",
      "Detailed action 2 with verification steps",
      "Detailed action 3 with expected outcome"
    ]
  },
  {
    "scenario": "Scenario B - Custom Values",
    "actions": [
      "Detailed action 1",
      "Detailed action 2"
    ]
  }
]

For simple single-flow tests, use flat array:
[
  "Navigate to [page], click [button], enter [value] in [field]",
  "Select [option] from [dropdown], verify [outcome]",
  "Click [button], verify [result]"
]

3. For expectedResults field - GROUP BY SCENARIO:
When test has multiple scenarios:
{
  "byScenario": [
    {"scenario": "Scenario A", "results": "Complete expected outcome for scenario A"},
    {"scenario": "Scenario B", "results": "Complete expected outcome for scenario B"}
  ]
}

For simple single-flow tests:
{
  "byStep": "Expected Results: \n\nafter step 1, [result].\n\nafter step 2, [result].\n\nafter step 3, [result]."
}

4. STEP DETAIL REQUIREMENTS - BALANCED VERBOSITY:
- Include specific field names, button labels, exact values
- Include locations (top-right corner, dropdown menu, etc.)
- Include verification steps inline
- NOT too verbose - balance detail with readability
- Use bullet sub-points for scenario-based steps

GOOD Examples:
✅ "Click 'Add new widget' button and select 'Table' from widget type dropdown"
✅ "Enter title with exactly 50 characters: 'Social Media Performance Analysis Q4 2024 Report'"
✅ "Verify default values loaded (Title: 'Engagement breakdown', Metric: 'Engagement')"

BAD Examples (too vague):
❌ "Click the button"
❌ "Enter data"
❌ "Verify it works"

BAD Examples (too verbose):
❌ "Navigate to https://app.example.com/dashboard using Chrome browser version 120 or higher, ensure you are logged in as a valid user with appropriate permissions, locate the 'Add new widget' button which should be positioned in the top-right corner of the screen..."

5. For tags field (select 2-5 relevant tags per test case):
- "smoke": Critical path tests that must pass for basic functionality
- "regression": Tests that should run in every regression cycle  
- "security": Tests validating security aspects
- "performance": Tests checking response times, load handling, large dataset handling
- "integration": Tests validating integration between systems/modules
- "e2e": Complete end-to-end user journey tests
- "ui": Tests focused on user interface in Chrome browser
- "i18n": Multi-language, RTL support, locale-specific format testing
- "network": Network interruption, slow 3G, offline scenarios
- "real-world": Browser navigation (back/forward), session timeout, multiple tabs
- "data-validation": Tests checking data integrity and accuracy
- "edge-case": Tests for boundary conditions
- "negative-test": Tests for error handling
- "positive-test": Happy path validation


6. For type field:
- "positive": Happy path, valid inputs, successful outcomes
- "negative": Invalid inputs, error handling, validation failures
- "edge": Boundary values, limits, unusual but valid scenarios

7. For priority field:
- "Critical": Must pass for basic functionality, blocks other tests
- "High": Important features, significant user impact
- "Medium": Standard functionality, moderate impact
- "Low": Nice-to-have features, minimal impact

8. For technique field:
Specify which black box testing techniques were applied:
- "Equivalence Partitioning": Testing representative values from valid/invalid partitions
- "Boundary Value Analysis": Testing at boundaries (min, max, min-1, max+1)
- "Decision Table Testing": Testing combinations of conditions
- "State Transition Testing": Testing state changes and transitions
- "Error Guessing": Testing likely error conditions based on experience
- "Use Case Testing": Testing based on user scenarios

Can combine multiple techniques, e.g., "Boundary Value Analysis, Equivalence Partitioning"

9. REAL-WORLD SCENARIOS - Include tests for:
- Network interruption scenarios (slow 3G connection, offline mode, connection drops)
- Browser back/forward button behavior and state preservation
- Session timeout handling and user re-authentication  
- Multiple tab/window scenarios (data sync, concurrent actions)
- Long-running operations

10. INTERNATIONALIZATION (i18n) - When relevant, include:
- Multi-language testing scenarios (English, Arabic)
- RTL (Right-to-Left) language support
- Locale-specific formats (dates, currency, numbers)


COVERAGE REQUIREMENTS:
- Include critical positive E2E scenarios (happy paths)
- Include key negative scenarios (error handling, validation failures)
- Include important edge cases (boundary conditions, maximum/minimum values)
- Include real-world scenarios when relevant (network issues, browser behavior)
- Include i18n scenarios when features involve user-facing content
- Group related scenarios (default, custom, maximum) into SINGLE test cases for efficiency
- Each test case should validate multiple aspects when possible

EFFICIENCY FOCUS:
- Combine related scenarios (default values, custom values, edge values) into ONE comprehensive test case
- Example: Instead of TC_001 (default), TC_002 (custom), TC_003 (maximum), create TC_001 with Scenarios A, B, C
- This reduces test count while maisntaining full coverage
- Generate 10-20 highly effective E2E test cases (minimum 10, up to 20 depending on complexity) that provide comprehensive coverage
- write 1 test case for i18n scenarios
- make sure to check the ui and the functionality of the tool in expected results


Always ensure test cases are practical, executable, and provide clear pass/fail criteria for Chrome browser testing of a tool.`
        }], 50000);

        console.log('✓ Test response received');

        // Check if response was continued
        if (testData._continuations && testData._continuations > 0) {
          console.log(`✅ Response completed with ${testData._continuations} continuation(s)`);
        }

        // Check for truncation warning
        if (testData._warning) {
          console.warn('⚠️', testData._warning);
        }

        const responseText = testData.content.map(item => item.text || '').join('\n');
        
        console.log('Raw response preview:', responseText.substring(0, 300));
        console.log('Raw response length:', responseText.length);

        // Try to parse JSON with repair logic
        let parsedTestData;
        try {
          parsedTestData = repairJson(responseText);
          console.log('✅ Initial parsing succeeded');
        } catch (parseError: any) {
          console.error('❌ Initial parsing failed:', parseError);
          console.error('JSON Parse Error:', parseError?.message || 'Unknown error');
          console.error('Full response text length:', responseText.length);
          console.error('Response start:', responseText.substring(0, 500));
          console.error('Response end:', responseText.substring(Math.max(0, responseText.length - 500)));
          
          // Check if response might be truncated
          const braceCount = (responseText.match(/{/g) || []).length;
          const closeBraceCount = (responseText.match(/}/g) || []).length;
          
          if (braceCount > closeBraceCount) {
            throw new Error(`Response appears to be truncated (${braceCount} opening braces vs ${closeBraceCount} closing braces). The API response may have been cut off. Try with a shorter user story or the system will attempt to continue automatically.`);
          }
          
          // Log the error position to help debug
          const errorMatch = parseError?.message?.match(/position (\d+)/);
          const errorPos = errorMatch ? parseInt(errorMatch[1]) : -1;
          
          if (errorPos > 0) {
            // Try to extract and show context
            const contextStart = Math.max(0, errorPos - 200);
            const contextEnd = Math.min(responseText.length, errorPos + 200);
            const errorContext = responseText.substring(contextStart, contextEnd);
            console.error('JSON error at position', errorPos);
            console.error('Error context:', errorContext);
            
            // Fallback: Try to extract complete test case objects
            console.log('🔄 Attempting fallback: extracting complete test cases...');
            try {
              // Find the testCases array start
              const testCasesStart = responseText.indexOf('"testCases"');
              if (testCasesStart > 0) {
                // Find the opening bracket after "testCases"
                const arrayStart = responseText.indexOf('[', testCasesStart);
                if (arrayStart > 0) {
                  // Try to find complete test case objects
                  const testCases: any[] = [];
                  let currentPos = arrayStart + 1;
                  let depth = 0;
                  let objectStart = -1;
                  let insideString = false;
                  let escapeNext = false;
                  
                  // Scan for complete test case objects
                  for (let i = arrayStart + 1; i < Math.min(errorPos, responseText.length); i++) {
                    const char = responseText[i];
                    
                    if (escapeNext) {
                      escapeNext = false;
                      continue;
                    }
                    
                    if (char === '\\') {
                      escapeNext = true;
                      continue;
                    }
                    
                    if (char === '"') {
                      insideString = !insideString;
                      continue;
                    }
                    
                    if (!insideString) {
                      if (char === '{') {
                        if (depth === 0) {
                          objectStart = i;
                        }
                        depth++;
                      } else if (char === '}') {
                        depth--;
                        if (depth === 0 && objectStart > 0) {
                          // Found a complete object
                          try {
                            const objStr = responseText.substring(objectStart, i + 1);
                            const obj = JSON.parse(objStr);
                            testCases.push(obj);
                            console.log(`✅ Extracted test case ${testCases.length}: ${obj.id || 'unknown'}`);
                          } catch (e) {
                            // Skip this object if it doesn't parse
                          }
                          objectStart = -1;
                        }
                      }
                    }
                  }
                  
                  if (testCases.length > 0) {
                    console.log(`✅ Fallback succeeded: extracted ${testCases.length} complete test case(s)`);
                    parsedTestData = { testCases };
                  }
                }
              }
            } catch (fallbackError: any) {
              console.error('Fallback extraction also failed:', fallbackError?.message);
            }
          }
          
          // If fallback didn't work, throw the original error
          if (!parsedTestData) {
            throw new Error(`Failed to parse test case response. Error: ${parseError?.message || 'Unknown error'}. Please check the browser console for details.`);
          }
        }

        console.log('Parsed data keys:', Object.keys(parsedTestData || {}));
        console.log('Has testCases?', !!parsedTestData?.testCases);
        console.log('testCases is array?', Array.isArray(parsedTestData?.testCases));
        console.log('testCases length:', parsedTestData?.testCases?.length);
        
        if (!parsedTestData || typeof parsedTestData !== 'object') {
          console.error('Parsed data is not an object:', typeof parsedTestData);
          throw new Error('Invalid test case format: Response is not a valid JSON object');
        }
        
        if (!parsedTestData.testCases || !Array.isArray(parsedTestData.testCases)) {
          console.error('Invalid testCases structure:', {
            hasTestCases: !!parsedTestData.testCases,
            isArray: Array.isArray(parsedTestData.testCases),
            type: typeof parsedTestData.testCases,
            keys: Object.keys(parsedTestData)
          });
          throw new Error(`Invalid test case format: Expected 'testCases' array but got ${typeof parsedTestData.testCases}. Available keys: ${Object.keys(parsedTestData).join(', ')}`);
        }
        
        if (parsedTestData.testCases.length === 0) {
          console.warn('⚠️ Warning: testCases array is empty');
        }

        setTestCases(parsedTestData.testCases);
        setTestSuiteSummary(parsedTestData.summary || {
          totalCases: parsedTestData.testCases.length,
          positive: parsedTestData.testCases.filter(tc => tc.type === 'positive').length,
          negative: parsedTestData.testCases.filter(tc => tc.type === 'negative').length,
          edge: parsedTestData.testCases.filter(tc => tc.type === 'edge').length,
          coverageAreas: [...new Set(parsedTestData.testCases.map(tc => tc.feature))],
          techniques: [...new Set(parsedTestData.testCases.map(tc => tc.technique))],
          efficiencyNote: parsedTestData.summary?.efficiencyNote
        });

        console.log('✓ Test cases generated:', parsedTestData.testCases.length);

        await saveChatToHistory([
          { role: 'user', content: userStoryNormalized },
          { role: 'assistant', content: `Complete analysis with ${parsedTestData.testCases.length} test cases` }
        ], 'Test Cases Generated', {
          option: 'testcases',
          analysis: analysisText,
          testCases: parsedTestData.testCases,
          testSuiteSummary: parsedTestData.summary || {
            totalCases: parsedTestData.testCases.length,
            positive: parsedTestData.testCases.filter(tc => tc.type === 'positive').length,
            negative: parsedTestData.testCases.filter(tc => tc.type === 'negative').length,
            edge: parsedTestData.testCases.filter(tc => tc.type === 'edge').length,
            coverageAreas: [...new Set(parsedTestData.testCases.map(tc => tc.feature))],
            techniques: [...new Set(parsedTestData.testCases.map(tc => tc.technique))],
            efficiencyNote: parsedTestData.summary?.efficiencyNote
          }
        });

        setShowResults(true);

        // Show success message with continuation info if applicable
        let successMessage = `✅ Test Cases Generated!\n\n${parsedTestData.testCases.length} E2E test cases created with full coverage.`;
        if (testData._continuations && testData._continuations > 0) {
          successMessage += `\n\n(Response assembled from ${testData._continuations + 1} API requests)`;
        }
        alert(successMessage);
      }

    } catch (error) {
      console.error('Processing error:', error);
      let errorMessage = error.message;

      // Provide helpful context for common errors
      if (error.message.includes('truncated') || error.message.includes('parse')) {
        errorMessage = `${error.message}\n\n💡 Tip: Try shortening your user story or breaking it into smaller parts.`;
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage = `Network error: ${error.message}\n\n💡 Make sure the backend server is running on port 5000.`;
      }

      alert(`❌ Error: ${errorMessage}\n\nPlease try again.`);
    }

    setIsProcessing(false);
    setProcessingStatus('');
  };

  const toggleTestStatus = (id) => {
    setTestCases(prev => prev.map(tc => {
      if (tc.id === id) {
        const statuses = ['pending', 'pass', 'fail'];
        const currentIndex = statuses.indexOf(tc.status);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        return { ...tc, status: nextStatus };
      }
      return tc;
    }));
  };

  const formatTestCase = (tc) => {
    const statusEmoji = tc.status === 'pass' ? '✅' : tc.status === 'fail' ? '❌' : '⏳';
    const tagsText = tc.tags && tc.tags.length > 0 ? `\nTags: ${tc.tags.map(t => '#' + t).join(', ')}` : '';

    let testDataText = '';
    if (tc.testData && typeof tc.testData === 'object') {
      if (tc.testData.scenarios && Array.isArray(tc.testData.scenarios)) {
        testDataText = '\n\nTest Scenarios:';
        tc.testData.scenarios.forEach((scenario, idx) => {
          testDataText += `\n  ${scenario.name} (${scenario.category}):`;
          Object.entries(scenario.data).forEach(([key, value]) => {
            testDataText += `\n    - ${key}: ${value}`;
          });
        });
      } else if (tc.testData.valid || tc.testData.invalid || tc.testData.edge) {
        if (tc.testData.valid && tc.testData.valid.length > 0) {
          testDataText += `\nValid Data: ${tc.testData.valid.join(', ')}`;
        }
        if (tc.testData.invalid && tc.testData.invalid.length > 0) {
          testDataText += `\nInvalid Data: ${tc.testData.invalid.join(', ')}`;
        }
        if (tc.testData.edge && tc.testData.edge.length > 0) {
          testDataText += `\nEdge Case Data: ${tc.testData.edge.join(', ')}`;
        }
      }
    } else if (typeof tc.testData === 'string') {
      testDataText = `\nTest Data: ${tc.testData}`;
    }

    let stepsText = '\n\nSteps:';
    if (Array.isArray(tc.steps)) {
      if (tc.steps.length > 0 && typeof tc.steps[0] === 'object' && tc.steps[0].scenario) {
        tc.steps.forEach((scenarioStep, idx) => {
          stepsText += `\n\n${scenarioStep.scenario}:`;
          scenarioStep.actions.forEach((action, actionIdx) => {
            stepsText += `\n  ${actionIdx + 1}. ${action}`;
          });
        });
      } else {
        tc.steps.forEach((step, idx) => {
          stepsText += `\n${idx + 1}. ${step}`;
        });
      }
    }

    let expectedResultsText = '\n\nExpected Results:';
    if (tc.expectedResults && typeof tc.expectedResults === 'object') {
      if (tc.expectedResults.byScenario && Array.isArray(tc.expectedResults.byScenario)) {
        tc.expectedResults.byScenario.forEach((scenarioResult) => {
          expectedResultsText += `\n\n${scenarioResult.scenario}:\n${scenarioResult.results}`;
        });
      } else if (tc.expectedResults.byStep) {
        expectedResultsText += `\n${tc.expectedResults.byStep}`;
      }
    } else if (typeof tc.expectedResults === 'string') {
      expectedResultsText += `\n${tc.expectedResults}`;
    }

    return `${tc.id} - ${tc.title}
Description: ${tc.description}
Feature / Area: ${tc.feature}
Preconditions: ${tc.preconditions}${testDataText}${stepsText}${expectedResultsText}
Status: ${tc.status} ${statusEmoji}
Technique: ${tc.technique}
Priority: ${tc.priority}
Type: ${tc.type}${tagsText}

---
`;
  };

  const copyTestCase = (tc) => {
    navigator.clipboard.writeText(formatTestCase(tc));
    setCopiedStates({ ...copiedStates, [tc.id]: true });
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [tc.id]: false }));
    }, 2000);
  };

  const copyAllTestCases = () => {
    const allCases = testCases.map(tc => formatTestCase(tc)).join('\n');
    navigator.clipboard.writeText(allCases);
    setCopiedStates({ ...copiedStates, 'all': true });
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, 'all': false }));
    }, 2000);
  };

  const copyTestSuiteSummary = () => {
    const summaryText = `TEST SUITE SUMMARY

Overview
${testSuiteSummary.efficiencyNote || `This comprehensive test suite covers all functional aspects of the feature including ${testSuiteSummary.coverageAreas?.join(', ') || 'all identified areas'}. The test cases are designed for maximum efficiency while maintaining complete coverage.`}

EXECUTIVE SUMMARY
Total Test Cases: ${testSuiteSummary.totalCases}
Positive: ${testSuiteSummary.positive}
Negative: ${testSuiteSummary.negative}
Edge Cases: ${testSuiteSummary.edge}

Test Suite Scope
This test suite provides comprehensive end-to-end validation of the feature, covering:
${testSuiteSummary.coverageAreas?.map(area => `• ${area}`).join('\n') || '• Full CRUD operations\n• Field validations and boundary testing\n• Error handling and edge cases'}

Testing Techniques Applied
${testSuiteSummary.techniques?.join(', ') || 'Various black box testing techniques'}

REGRESSION TESTING SCOPE

Smoke Testing (~${Math.ceil(testSuiteSummary.totalCases * 0.2 * 15 / 60)} minutes)
Execute before any full test execution:
${testCases.filter(tc => tc.priority === 'Critical').slice(0, 3).map(tc => `• ${tc.id} - ${tc.title}`).join('\n')}

Critical Path Regression (~${Math.ceil(testCases.filter(tc => tc.priority === 'Critical' || tc.priority === 'High').length * 20 / 60)} hours)
Test Cases: ${testCases.filter(tc => tc.priority === 'Critical' || tc.priority === 'High').map(tc => tc.id).join(', ')}

Test Execution Metrics
Last Updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Total Test Cases: ${testSuiteSummary.totalCases}
Estimated Execution Time: ${testSuiteSummary.totalCases <= 10 ? '1-2 days' : testSuiteSummary.totalCases <= 15 ? '2-3 days' : '3.5-4 days'} (1 tester)
Coverage: 100% of requirements`;

    navigator.clipboard.writeText(summaryText);
    setCopiedStates({ ...copiedStates, 'summary': true });
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, 'summary': false }));
    }, 2000);
  };

  const downloadTestCases = (format) => {
    let content = '';
    let filename = `test_cases_${Date.now()}`;
    let mimeType = 'text/plain';

    if (format === 'txt') {
      content = testCases.map(tc => formatTestCase(tc)).join('\n');
      filename += '.txt';
    } else if (format === 'csv') {
      const headers = 'ID,Title,Description,Feature,Preconditions,Test Data,Steps,Expected Results,Status,Technique,Priority,Type,Tags\n';
      const rows = testCases.map(tc => {
        const steps = Array.isArray(tc.steps)
          ? (typeof tc.steps[0] === 'object'
            ? tc.steps.map(s => `${s.scenario}: ${s.actions.join(' | ')}`).join(' || ')
            : tc.steps.join(' | '))
          : String(tc.steps || '');

        const testData = tc.testData && typeof tc.testData === 'object' && tc.testData.scenarios
          ? tc.testData.scenarios.map(s => s.name).join('; ')
          : String(tc.testData || '');

        const expectedResults = tc.expectedResults && typeof tc.expectedResults === 'object'
          ? (tc.expectedResults.byScenario
            ? tc.expectedResults.byScenario.map(r => `${r.scenario}: ${r.results}`).join(' || ')
            : tc.expectedResults.byStep || '')
          : String(tc.expectedResults || '');

        const tags = tc.tags ? tc.tags.join(', ') : '';
        return `"${tc.id}","${tc.title}","${tc.description}","${tc.feature}","${tc.preconditions}","${testData}","${steps}","${expectedResults}","${tc.status}","${tc.technique}","${tc.priority}","${tc.type}","${tags}"`;
      }).join('\n');
      content = headers + rows;
      filename += '.csv';
      mimeType = 'text/csv';
    } else if (format === 'json') {
      content = JSON.stringify({ testCases, summary: testSuiteSummary }, null, 2);
      filename += '.json';
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setSelectedOption(null);
    setShowResults(false);
    setAnalysis(null);
    setTestCases([]);
    setTestSuiteSummary(null);
    setChatMessages([]);
    setIsChatOpen(false);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');

    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    try {
      // Check if user is asking to generate/create/add test cases
      const isTestCaseGenerationRequest = /\b(generate|create|add|write|make|build)\b.*\b(test case|test|scenario|tc)\b/i.test(userMessage);

      const contextInfo = selectedOption === 'analysis'
        ? `Gap Analysis:\n${analysis}`
        : `Test Cases Generated: ${testCases.length}\n\nTest Suite Summary:\n${JSON.stringify(testSuiteSummary, null, 2)}\n\nTest Cases:\n${JSON.stringify(testCases, null, 2)}`;

      let promptContent = '';
      let maxTokens = 16000;

      if (isTestCaseGenerationRequest && selectedOption === 'testcases') {
        // Use the full test case generation prompt
        maxTokens = 16000;
        promptContent = `You are an expert software tester specialized in comprehensive End-to-End (E2E) testing. Generate EFFICIENT and EFFECTIVE E2E test scenarios for the following user story/requirement.

TESTING FOCUS: End-to-End testing covering complete user journeys and workflows from start to finish

IMPORTANT INSTRUCTIONS:
- Focus on E2E scenarios that test complete workflows and functionality
- Prioritize QUALITY over QUANTITY - create fewer but more comprehensive test cases
- Each test case should cover multiple validations in a single flow when appropriate
- For complex features, group related scenarios (Scenario A, B, C) within ONE test case
- Use smart test design techniques to maximize coverage with minimum test cases
- Apply black box testing techniques: Equivalence Partitioning, Boundary Value Analysis, Decision Table Testing, State Transition, Error Guessing
- Consider both functional and non-functional requirements

User Story:
${userStoryNormalized}

Existing Test Cases:
${JSON.stringify(testCases, null, 2)}

User Request: ${userMessage}

Generate NEW test cases in ONLY JSON format (no markdown, no preamble) with this exact structure:
{
  "testCases": [
    {
      "id": "TC_XXX",
      "title": "Descriptive test case title covering main functionality",
      "description": "Brief overview of what this test validates",
      "feature": "Feature/Area name",
      "type": "positive/negative/edge",
      "priority": "Critical/High/Medium/Low",
      "technique": "Black box technique(s) used - e.g., Boundary Value Analysis, Equivalence Partitioning",
      "tags": ["smoke", "regression", "e2e", "ui"],
      "preconditions": "Prerequisites and setup required",
      "testData": {
        "scenarios": [
          {
            "name": "Scenario A - Descriptive Name",
            "data": {
              "field1": "value1",
              "field2": "value2"
            },
            "category": "valid/invalid/edge"
          }
        ]
      },
      "steps": [
        {
          "scenario": "Scenario A - Name",
          "actions": [
            "Navigate to [specific page/URL], click the '[Button Name]' button located in [location], enter '[specific value]' in the '[Field Name]' field",
            "Select '[option]' from '[Dropdown Name]' dropdown menu, verify that [specific element] displays correctly"
          ]
        }
      ],
      "expectedResults": {
        "byScenario": [
          {
            "scenario": "Scenario A",
            "results": "Expected outcome for scenario A with specific details, values, and validations"
          }
        ]
      },
      "status": "pending"
    }
  ]
}

CRITICAL INSTRUCTIONS:

1. For testData field - SCENARIO-BASED TEST DESIGN:
When a test case covers multiple related scenarios (default values, maximum values, edge cases), structure as:
{
  "scenarios": [
    {
      "name": "Scenario A - Default Values",
      "data": {"field": "value"},
      "category": "valid"
    }
  ]
}

For simple test cases: {"valid": ["data1"], "invalid": ["data2"], "edge": ["data3"]}

2. For steps field - SCENARIO-GROUPED ACTIONS:
When test has multiple scenarios:
[
  {
    "scenario": "Scenario A - Default Values",
    "actions": ["Detailed action 1", "Detailed action 2"]
  }
]

For simple single-flow tests: ["Step 1", "Step 2", "Step 3"]

3. For expectedResults field - GROUP BY SCENARIO:
When test has multiple scenarios:
{
  "byScenario": [
    {"scenario": "Scenario A", "results": "Expected outcome"}
  ]
}

For simple single-flow tests: {"byStep": "Expected Results: \n\nafter step 1, [result].\n\nafter step 2, [result]."}

4. STEP DETAIL REQUIREMENTS - BALANCED VERBOSITY:
- Include specific field names, button labels, exact values
- Include locations (top-right corner, dropdown menu, etc.)
- Include verification steps inline
- Balance detail with readability

5. For tags field (select 2-5 relevant tags):
- "smoke", "regression", "security", "performance", "integration", "e2e", "api", "ui"
- "i18n", "network", "real-world", "data-validation", "edge-case", "negative-test", "positive-test"

6. For type field: "positive", "negative", "edge"

7. For priority field: "Critical", "High", "Medium", "Low"

8. For technique field:
- "Equivalence Partitioning", "Boundary Value Analysis", "Decision Table Testing"
- "State Transition Testing", "Error Guessing", "Use Case Testing"

9. REAL-WORLD SCENARIOS - Include tests for:
- Network interruption scenarios
- Browser back/forward button behavior
- Session timeout handling
- Multiple tab/window scenarios

10. INTERNATIONALIZATION (i18n) - When relevant:
- Multi-language testing scenarios (English, Arabic)
- RTL (Right-to-Left) language support
- Locale-specific formats



Generate the NEW test cases ONLY in JSON format. The next ID should be TC_${String(testCases.length + 1).padStart(3, '0')}.`;
      } else {
        // Use the regular chat prompt
        promptContent = `You are an expert QA testing assistant helping to refine test analysis and test cases.

User Story:
${userStoryNormalized}

Current Context:
${contextInfo}

User Request: ${userMessage}

Provide helpful guidance or modifications based on the user's request. If they want to add, modify, or remove test cases or update the analysis, provide the updated content in a clear format.

If the user is asking to generate new test cases, provide them in JSON format following the structure of existing test cases.`;
      }

      const data = await callAnthropicAPI([{
        role: 'user',
        content: promptContent
      }], maxTokens);
      let assistantMessage = data.content.map(item => item.text || '').join('\n');

      // If it was a test case generation request, try to parse and add the test cases
      if (isTestCaseGenerationRequest && selectedOption === 'testcases') {
        try {
          // Use repairJson to handle markdown-wrapped JSON and common syntax errors
          const parsedData = repairJson(assistantMessage);

          if (parsedData.testCases && Array.isArray(parsedData.testCases)) {
            // Add the new test cases to the existing ones
            setTestCases(prev => [...prev, ...parsedData.testCases]);

            // Update summary
            const allTestCases = [...testCases, ...parsedData.testCases];
            setTestSuiteSummary(prev => ({
              ...prev,
              totalCases: allTestCases.length,
              positive: allTestCases.filter(tc => tc.type === 'positive').length,
              negative: allTestCases.filter(tc => tc.type === 'negative').length,
              edge: allTestCases.filter(tc => tc.type === 'edge').length,
              coverageAreas: [...new Set(allTestCases.map(tc => tc.feature))],
              techniques: [...new Set(allTestCases.map(tc => tc.technique))]
            }));

            assistantMessage = `✅ Successfully generated and added ${parsedData.testCases.length} new test case(s)!\n\nTest Case IDs: ${parsedData.testCases.map(tc => tc.id).join(', ')}\n\nThe test cases have been added to your test suite. You can scroll down to view them.`;
          }
        } catch (parseError: any) {
          console.log('Could not parse as test cases, showing as regular message:', parseError?.message || 'Unknown error');
          // If parsing fails, just show the message as-is
        }
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);

    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Sorry, I encountered an error: ${error.message}. Please try again.`
      }]);
    }

    setIsProcessing(false);
  };

  const renderTestData = (testData) => {
    if (!testData) return <p className="text-gray-300 mt-1">No test data</p>;

    if (typeof testData === 'object' && testData.scenarios && Array.isArray(testData.scenarios)) {
      return (
        <div className="mt-2 space-y-3">
          {testData.scenarios.map((scenario, idx) => (
            <div key={idx} className={`border rounded p-3 ${scenario.category === 'valid' ? 'bg-green-500/10 border-green-500/30' :
              scenario.category === 'invalid' ? 'bg-red-500/10 border-red-500/30' :
                'bg-yellow-500/10 border-yellow-500/30'
              }`}>
              <div className="text-xs font-semibold mb-2 text-purple-300">{scenario.name}</div>
              <div className="space-y-1">
                {Object.entries(scenario.data).map(([key, value]) => (
                  <div key={key} className="text-xs text-gray-300">
                    <span className="font-medium">{key}:</span> {String(value)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (typeof testData === 'object') {
      return (
        <div className="mt-2 space-y-2">
          {testData.valid && testData.valid.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
              <div className="text-xs font-semibold text-green-400 mb-1">✅ Valid Data:</div>
              <ul className="list-disc list-inside text-xs text-gray-300">
                {testData.valid.map((data, i) => (
                  <li key={i}>{data}</li>
                ))}
              </ul>
            </div>
          )}
          {testData.invalid && testData.invalid.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
              <div className="text-xs font-semibold text-red-400 mb-1">❌ Invalid Data:</div>
              <ul className="list-disc list-inside text-xs text-gray-300">
                {testData.invalid.map((data, i) => (
                  <li key={i}>{data}</li>
                ))}
              </ul>
            </div>
          )}
          {testData.edge && testData.edge.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
              <div className="text-xs font-semibold text-yellow-400 mb-1">⚠️ Edge Case Data:</div>
              <ul className="list-disc list-inside text-xs text-gray-300">
                {testData.edge.map((data, i) => (
                  <li key={i}>{data}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return <p className="text-gray-300 mt-1">{String(testData)}</p>;
  };

  const renderSteps = (steps) => {
    if (!Array.isArray(steps)) return <p className="text-gray-300 mt-1">No steps</p>;

    if (steps.length > 0 && typeof steps[0] === 'object' && steps[0].scenario) {
      return (
        <div className="mt-2 space-y-3">
          {steps.map((scenarioStep, idx) => (
            <div key={idx} className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
              <div className="text-xs font-semibold text-purple-300 mb-2">{scenarioStep.scenario}</div>
              <ol className="list-decimal list-inside text-gray-300 space-y-1">
                {scenarioStep.actions.map((action, actionIdx) => (
                  <li key={actionIdx} className="text-sm">{action}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      );
    }

    return (
      <ol className="list-decimal list-inside text-gray-300 mt-1 space-y-1">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    );
  };

  const renderExpectedResults = (expectedResults) => {
    if (!expectedResults) return <p className="text-gray-300 mt-1">No expected results</p>;

    if (typeof expectedResults === 'object') {
      if (expectedResults.byScenario && Array.isArray(expectedResults.byScenario)) {
        return (
          <div className="mt-2 space-y-3">
            {expectedResults.byScenario.map((scenarioResult, idx) => (
              <div key={idx} className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                <div className="text-xs font-semibold text-blue-300 mb-2">{scenarioResult.scenario}</div>
                <div className="text-sm text-gray-300 whitespace-pre-wrap">{scenarioResult.results}</div>
              </div>
            ))}
          </div>
        );
      }
      if (expectedResults.byStep) {
        return (
          <div className="text-gray-300 mt-1 whitespace-pre-wrap leading-relaxed">
            {expectedResults.byStep}
          </div>
        );
      }
    }

    return (
      <div className="text-gray-300 mt-1 whitespace-pre-wrap leading-relaxed">
        {String(expectedResults)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-lg border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
                <Bot className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  QA Agent Pro
                </h1>
                <p className="text-sm text-purple-300">AI-Powered Testing Assistant </p>
              </div>
            </div>
            {showResults && (
              <button
                onClick={resetForm}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              >
                ← New Analysis
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {!showResults ? (
          /* Input Form */
          <div className="space-y-6">
            <div className="bg-black/30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-400" />
                User Story Input
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    📤 Upload Document or Paste User Story
                  </label>
                  <input
                    type="file"
                    accept=".txt,.pdf,.docx"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer cursor-pointer mb-3"
                  />
                  <textarea
                    value={userStory}
                    onChange={(e) => setUserStory(e.target.value)}
                    placeholder="Paste your user story here...&#10;&#10;Example:&#10;As a user&#10;I want to be able to reset my password&#10;So that I can regain access to my account&#10;&#10;Acceptance Criteria:&#10;- User receives reset email within 5 minutes&#10;- Reset link expires after 24 hours&#10;- Password must meet security requirements"
                    className="w-full h-64 bg-black/50 border border-purple-500/30 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                  />
                  <div className="mt-2 flex justify-end">
                    <span className="text-xs text-gray-400">
                      <span className="text-purple-400 font-semibold">{charCount}</span> {charCount === 1 ? 'character' : 'characters'}
                    </span>
                  </div>
                </div>

                {/* Option Selection */}
                <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 p-5 rounded-lg border border-purple-500/20">
                  <h3 className="text-sm font-semibold text-purple-300 mb-3">Select Analysis Type:</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option 1 */}
                    <div
                      onClick={() => setSelectedOption('analysis')}
                      className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${selectedOption === 'analysis'
                        ? 'border-blue-500 bg-blue-600/20'
                        : 'border-purple-500/30 bg-black/20 hover:border-purple-500/50'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${selectedOption === 'analysis' ? 'bg-blue-500/30' : 'bg-purple-500/20'}`}>
                          <Target className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold mb-1 flex items-center gap-2">
                            {selectedOption === 'analysis' && <CheckCircle className="w-4 h-4 text-blue-400" />}
                            Gap Analysis & Requirements
                          </div>
                          <div className="text-xs text-gray-400">
                            Identify gaps, ambiguities, and missing requirements
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Option 2 */}
                    <div
                      onClick={() => setSelectedOption('testcases')}
                      className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${selectedOption === 'testcases'
                        ? 'border-pink-500 bg-pink-600/20'
                        : 'border-purple-500/30 bg-black/20 hover:border-purple-500/50'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${selectedOption === 'testcases' ? 'bg-pink-500/30' : 'bg-purple-500/20'}`}>
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold mb-1 flex items-center gap-2">
                            {selectedOption === 'testcases' && <CheckCircle className="w-4 h-4 text-pink-400" />}
                            Generate E2E Test Cases
                          </div>
                          <div className="text-xs text-gray-400">
                            Scenario-based test suite for Chrome browser testing
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={isProcessing || !selectedOption}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 px-6 py-4 rounded-lg font-bold text-lg transition-all"
                >
                  {isProcessing ? '⏳ Processing...' : selectedOption ? '🚀 Generate' : '⚠️ Please Select an Option'}
                </button>

                {isProcessing && (
                  <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
                      <span className="text-purple-300 font-semibold">
                        {processingStatus || (selectedOption === 'analysis' ? 'Analyzing user story...' : 'Generating test cases...')}
                      </span>
                    </div>
                    {selectedOption === 'testcases' && (
                      <div className="space-y-2 text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-purple-500 animate-pulse"></div>
                          <span>Step 1: Analyzing requirements...</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-pink-500 animate-pulse"></div>
                          <span>Step 2: Generating E2E test scenarios...</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-purple-400 animate-pulse"></div>
                          <span>Step 3: Creating test suite summary...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Chat History */}
            {chatHistory.length > 0 && (
              <div className="bg-black/30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                  Previous Analyses
                </h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {chatHistory.slice(0, 10).map((chat) => (
                    <div
                      key={chat.id}
                      className="bg-black/30 p-3 rounded-lg border border-purple-500/20 hover:border-purple-400/40 transition-all cursor-pointer"
                      onClick={() => {
                        if (chat.results) {
                          setUserStory(chat.messages[0]?.content || '');
                          setSelectedOption(chat.results.option);

                          if (chat.results.option === 'analysis') {
                            setAnalysis(chat.results.analysis);
                          } else if (chat.results.option === 'testcases') {
                            setAnalysis(chat.results.analysis);
                            setTestCases(chat.results.testCases || []);
                            setTestSuiteSummary(chat.results.testSuiteSummary || null);
                          }

                          setShowResults(true);
                          setChatMessages([]);
                        } else {
                          setUserStory(chat.messages[0]?.content || '');
                          alert('⚠️ This is an old history item without saved results.\n\nThe user story has been loaded. Click Generate to create new results.');
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-purple-300 font-medium">{chat.summary}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(chat.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs bg-purple-500/20 px-2 py-1 rounded text-purple-300">
                            View Results
                          </div>
                          <button
                            onClick={(e) => deleteChatHistory(chat.id, e)}
                            className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                            title="Delete this history item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Results Display */
          <div className="space-y-6">

            {/* Gap Analysis Results */}
            {selectedOption === 'analysis' && analysis && (
              <div className="bg-black/30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-purple-300">
                  <Target className="w-6 h-6" />
                  Gap Analysis & Requirements
                </h2>
                <div className="bg-black/50 p-6 rounded-lg border border-purple-500/20 whitespace-pre-wrap text-gray-300">
                  {analysis}
                </div>
              </div>
            )}

            {/* Test Suite Summary */}
            {selectedOption === 'testcases' && testSuiteSummary && (
              <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-purple-300">📊 TEST SUITE SUMMARY</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={copyTestSuiteSummary}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${copiedStates['summary']
                        ? 'bg-green-600 text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                    >
                      {copiedStates['summary'] ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Summary
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-black/40 p-5 rounded-lg border border-purple-500/20 mb-6">
                  <h3 className="text-lg font-semibold text-purple-300 mb-3">Overview</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {testSuiteSummary.efficiencyNote || `This comprehensive test suite covers all functional aspects of the feature including ${testSuiteSummary.coverageAreas?.join(', ') || 'all identified areas'}. The test cases are designed for maximum efficiency while maintaining complete coverage.`}
                  </p>
                </div>

                <div className="bg-black/40 p-5 rounded-lg border border-purple-500/20 mb-6">
                  <h3 className="text-lg font-semibold text-purple-300 mb-4">Selected Test Suite Overview</h3>

                  <div className="mb-4">
                    <h4 className="font-semibold text-purple-300 mb-2 text-sm">EXECUTIVE SUMMARY</h4>
                    <div className="bg-black/30 p-4 rounded border border-purple-500/10">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-400">{testSuiteSummary.totalCases}</div>
                          <div className="text-xs text-gray-400">Total Test Cases</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">{testSuiteSummary.positive}</div>
                          <div className="text-xs text-gray-400">Positive</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-400">{testSuiteSummary.negative}</div>
                          <div className="text-xs text-gray-400">Negative</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-400">{testSuiteSummary.edge}</div>
                          <div className="text-xs text-gray-400">Edge Cases</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold text-purple-300 mb-2 text-sm">Test Suite Scope</h4>
                    <p className="text-gray-300 text-sm mb-3">
                      This test suite provides comprehensive end-to-end validation of the feature, covering:
                    </p>
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2">
                      {testSuiteSummary.coverageAreas && testSuiteSummary.coverageAreas.length > 0 ? (
                        testSuiteSummary.coverageAreas.map((area, i) => (
                          <li key={i}>{area}</li>
                        ))
                      ) : (
                        <>
                          <li>Full CRUD operations (Create, Read, Update, Delete)</li>
                          <li>Field validations and boundary testing</li>
                          <li>Error handling and edge cases</li>
                        </>
                      )}
                    </ul>
                  </div>

                  {testSuiteSummary.techniques && testSuiteSummary.techniques.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-purple-300 mb-2 text-sm">Testing Techniques Applied</h4>
                      <div className="flex flex-wrap gap-2">
                        {testSuiteSummary.techniques.map((technique, i) => (
                          <span key={i} className="bg-purple-500/20 px-3 py-1 rounded-full text-xs text-purple-300">
                            {technique}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-black/40 p-5 rounded-lg border border-purple-500/20 mb-6">
                  <h3 className="text-lg font-semibold text-orange-300 mb-4">🔥 REGRESSION TESTING SCOPE</h3>

                  <div className="mb-4">
                    <h4 className="font-semibold text-purple-300 mb-3 text-sm">What to Include in Regression</h4>

                    <div className="bg-gradient-to-r from-yellow-600/10 to-orange-600/10 p-4 rounded-lg border border-yellow-500/20 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-yellow-300 text-sm">Smoke Testing</h5>
                        <span className="text-xs text-gray-400">~{Math.ceil(testSuiteSummary.totalCases * 0.2 * 15 / 60)} minutes</span>
                      </div>
                      <p className="text-xs text-gray-300 mb-2">Execute before any full test execution:</p>
                      <ul className="list-disc list-inside text-xs text-gray-300 space-y-1 ml-2">
                        {testCases.filter(tc => tc.priority === 'Critical').slice(0, 3).map(tc => (
                          <li key={tc.id}>{tc.id} - {tc.title}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-gradient-to-r from-red-600/10 to-orange-600/10 p-4 rounded-lg border border-red-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-red-300 text-sm">Critical Path Regression</h5>
                        <span className="text-xs text-gray-400">~{Math.ceil(testCases.filter(tc => tc.priority === 'Critical' || tc.priority === 'High').length * 20 / 60)} hours</span>
                      </div>
                      <div className="text-xs text-gray-300 mb-2">
                        <span className="font-medium">Test Cases:</span> {testCases.filter(tc => tc.priority === 'Critical' || tc.priority === 'High').map(tc => tc.id).join(', ')}
                      </div>
                      <p className="text-xs text-gray-400">
                        Execute {testCases.filter(tc => tc.priority === 'Critical' || tc.priority === 'High').length} critical and high-priority test cases
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-black/40 p-5 rounded-lg border border-purple-500/20">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Last Updated</div>
                      <div className="text-purple-300 font-semibold">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Total Test Cases</div>
                      <div className="text-purple-300 font-semibold">{testSuiteSummary.totalCases}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Estimated Execution Time</div>
                      <div className="text-purple-300 font-semibold">
                        {testSuiteSummary.totalCases <= 10 ? '1-2 days' :
                          testSuiteSummary.totalCases <= 12 ? '2-3 days' :
                            '3.5-4 days'} (1 tester)
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Coverage</div>
                      <div className="text-green-400 font-semibold">100% of requirements</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Test Cases */}
            {selectedOption === 'testcases' && testCases.length > 0 && (
              <div className="bg-black/30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-purple-300 flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    E2E Test Cases
                  </h2>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => setEditingTestCase({
                        id: `TC_${String(testCases.length + 1).padStart(3, '0')}`,
                        title: '',
                        description: '',
                        feature: '',
                        type: 'positive',
                        priority: 'Medium',
                        technique: '',
                        tags: [],
                        preconditions: '',
                        testData: { valid: [], invalid: [], edge: [] },
                        steps: [],
                        expectedResults: { byStep: '' },
                        status: 'pending'
                      })}
                      className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      Add Test Case
                    </button>
                    <button
                      onClick={copyAllTestCases}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${copiedStates['all']
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                    >
                      {copiedStates['all'] ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy All
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => downloadTestCases('txt')}
                      className="bg-pink-600 hover:bg-pink-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm"
                    >
                      <Download className="w-4 h-4" />
                      TXT
                    </button>
                    <button
                      onClick={() => downloadTestCases('csv')}
                      className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm"
                    >
                      <Download className="w-4 h-4" />
                      CSV
                    </button>
                    <button
                      onClick={() => downloadTestCases('json')}
                      className="bg-pink-600 hover:bg-pink-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm"
                    >
                      <Download className="w-4 h-4" />
                      JSON
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {testCases.map((tc) => (
                    <div key={tc.id} className="bg-black/40 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6 hover:border-purple-400/50 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-purple-300">{tc.id} - {tc.title}</h3>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${tc.type === 'positive' ? 'bg-green-500/20 text-green-300' :
                              tc.type === 'negative' ? 'bg-red-500/20 text-red-300' :
                                'bg-yellow-500/20 text-yellow-300'
                              }`}>
                              {tc.type}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${tc.priority === 'Critical' ? 'bg-red-500/20 text-red-300' :
                              tc.priority === 'High' ? 'bg-orange-500/20 text-orange-300' :
                                tc.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-blue-500/20 text-blue-300'
                              }`}>
                              {tc.priority}
                            </span>
                            {tc.tags && tc.tags.length > 0 && tc.tags.map((tag, i) => (
                              <span key={i} className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingTestCase({ ...tc })}
                            className="p-2 rounded-lg transition-all bg-blue-600 hover:bg-blue-700"
                            title="Edit Test Case"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => copyTestCase(tc)}
                            className={`p-2 rounded-lg transition-all ${copiedStates[tc.id]
                              ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-purple-600 hover:bg-purple-700'
                              }`}
                            title="Copy Test Case"
                          >
                            {copiedStates[tc.id] ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="font-semibold text-purple-300">Description:</span>
                          <p className="text-gray-300 mt-1">{tc.description}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-purple-300">Feature / Area:</span>
                          <p className="text-gray-300 mt-1">{tc.feature}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-purple-300">Preconditions:</span>
                          <p className="text-gray-300 mt-1">{tc.preconditions}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-purple-300">Test Data:</span>
                          {renderTestData(tc.testData)}
                        </div>
                        <div>
                          <span className="font-semibold text-purple-300">Steps:</span>
                          {renderSteps(tc.steps)}
                        </div>
                        <div>
                          <span className="font-semibold text-purple-300">Expected Results:</span>
                          {renderExpectedResults(tc.expectedResults)}
                        </div>
                        <div className="pt-2 border-t border-purple-500/20">
                          <span className="text-xs text-gray-400">Technique: {tc.technique}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coverage Analysis */}
            {selectedOption === 'testcases' && testCases.length > 0 && (
              <div className="bg-black/30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  Test Coverage Analysis
                </h2>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 p-4 rounded-lg border border-green-500/30">
                      <div className="text-3xl font-bold text-green-400">
                        {((testCases.filter(tc => tc.type === 'positive').length / testCases.length) * 100).toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-300 mt-1">Positive Scenarios</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {testCases.filter(tc => tc.type === 'positive').length} test cases
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 p-4 rounded-lg border border-red-500/30">
                      <div className="text-3xl font-bold text-red-400">
                        {((testCases.filter(tc => tc.type === 'negative').length / testCases.length) * 100).toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-300 mt-1">Negative Scenarios</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {testCases.filter(tc => tc.type === 'negative').length} test cases
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 p-4 rounded-lg border border-yellow-500/30">
                      <div className="text-3xl font-bold text-yellow-400">
                        {((testCases.filter(tc => tc.type === 'edge').length / testCases.length) * 100).toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-300 mt-1">Edge Cases</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {testCases.filter(tc => tc.type === 'edge').length} test cases
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/30 p-4 rounded-lg border border-purple-500/20">
                    <h3 className="font-semibold text-purple-300 mb-3">Priority Distribution</h3>
                    <div className="space-y-2">
                      {['Critical', 'High', 'Medium', 'Low'].map(priority => {
                        const count = testCases.filter(tc => tc.priority === priority).length;
                        const percentage = count > 0 ? ((count / testCases.length) * 100).toFixed(0) : 0;
                        return (
                          <div key={priority} className="flex items-center gap-3">
                            <div className="w-24 text-sm text-gray-300">{priority}</div>
                            <div className="flex-1 bg-black/50 rounded-full h-6 overflow-hidden">
                              <div
                                className={`h-full flex items-center justify-end pr-2 text-xs font-medium ${priority === 'Critical' ? 'bg-red-600' :
                                  priority === 'High' ? 'bg-orange-600' :
                                    priority === 'Medium' ? 'bg-yellow-600' :
                                      'bg-blue-600'
                                  }`}
                                style={{ width: `${percentage}%` }}
                              >
                                {percentage > 0 && `${percentage}%`}
                              </div>
                            </div>
                            <div className="w-12 text-right text-sm text-gray-400">{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-black/30 p-4 rounded-lg border border-purple-500/20">
                    <h3 className="font-semibold text-purple-300 mb-3">Test Execution Status</h3>
                    <div className="space-y-2">
                      {['pass', 'fail', 'pending'].map(status => {
                        const count = testCases.filter(tc => tc.status === status).length;
                        const percentage = count > 0 ? ((count / testCases.length) * 100).toFixed(0) : 0;
                        const emoji = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏳';
                        return (
                          <div key={status} className="flex items-center gap-3">
                            <div className="w-24 text-sm text-gray-300">{emoji} {status}</div>
                            <div className="flex-1 bg-black/50 rounded-full h-6 overflow-hidden">
                              <div
                                className={`h-full flex items-center justify-end pr-2 text-xs font-medium ${status === 'pass' ? 'bg-green-600' :
                                  status === 'fail' ? 'bg-red-600' :
                                    'bg-gray-600'
                                  }`}
                                style={{ width: `${percentage}%` }}
                              >
                                {percentage > 0 && `${percentage}%`}
                              </div>
                            </div>
                            <div className="w-12 text-right text-sm text-gray-400">{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Requirements Traceability Matrix */}
            {selectedOption === 'testcases' && testCases.length > 0 && (
              <div className="bg-black/30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-purple-400" />
                  Requirements Traceability Matrix
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-purple-600/20 border-b border-purple-500/30">
                      <tr>
                        <th className="px-4 py-3 text-left">Requirement</th>
                        <th className="px-4 py-3 text-left">Test Case ID</th>
                        <th className="px-4 py-3 text-left">Test Case Title</th>
                        <th className="px-4 py-3 text-left">Priority</th>
                        <th className="px-4 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/20">
                      {testCases.map((tc) => (
                        <tr key={tc.id} className="hover:bg-purple-500/5">
                          <td className="px-4 py-3 text-gray-300">{tc.feature}</td>
                          <td className="px-4 py-3 text-purple-300 font-medium">{tc.id}</td>
                          <td className="px-4 py-3 text-gray-300">{tc.title}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${tc.priority === 'Critical' ? 'bg-red-500/20 text-red-300' :
                              tc.priority === 'High' ? 'bg-orange-500/20 text-orange-300' :
                                tc.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-blue-500/20 text-blue-300'
                              }`}>
                              {tc.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {tc.status === 'pass' ? '✅' : tc.status === 'fail' ? '❌' : '⏳'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Test Case Edit Modal */}
            {editingTestCase && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                <div className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-xl border border-purple-500/30 p-6 max-w-4xl w-full my-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-purple-300 flex items-center gap-2">
                      <Edit2 className="w-6 h-6" />
                      {editingTestCase.id && testCases.find(tc => tc.id === editingTestCase.id) ? 'Edit Test Case' : 'Add New Test Case'}
                    </h2>
                    <button
                      onClick={() => setEditingTestCase(null)}
                      className="p-2 rounded-lg hover:bg-purple-500/20 transition-all"
                    >
                      <X className="w-6 h-6 text-gray-400" />
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {/* ID and Title */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-purple-300 mb-2">Test Case ID</label>
                        <input
                          type="text"
                          value={editingTestCase.id}
                          onChange={(e) => setEditingTestCase(prev => ({ ...prev, id: e.target.value }))}
                          className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                          placeholder="TC_001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-purple-300 mb-2">Title</label>
                        <input
                          type="text"
                          value={editingTestCase.title}
                          onChange={(e) => setEditingTestCase(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                          placeholder="Test case title"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-purple-300 mb-2">Description</label>
                      <textarea
                        value={editingTestCase.description}
                        onChange={(e) => setEditingTestCase(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full h-20 bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                        placeholder="Brief description of what this test validates"
                      />
                    </div>

                    {/* Feature, Type, Priority */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-purple-300 mb-2">Feature/Area</label>
                        <input
                          type="text"
                          value={editingTestCase.feature}
                          onChange={(e) => setEditingTestCase(prev => ({ ...prev, feature: e.target.value }))}
                          className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                          placeholder="Feature name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-purple-300 mb-2">Type</label>
                        <select
                          value={editingTestCase.type}
                          onChange={(e) => setEditingTestCase(prev => ({ ...prev, type: e.target.value }))}
                          className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                        >
                          <option value="positive">Positive</option>
                          <option value="negative">Negative</option>
                          <option value="edge">Edge</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-purple-300 mb-2">Priority</label>
                        <select
                          value={editingTestCase.priority}
                          onChange={(e) => setEditingTestCase(prev => ({ ...prev, priority: e.target.value }))}
                          className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                        >
                          <option value="Critical">Critical</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                    </div>

                    {/* Technique */}
                    <div>
                      <label className="block text-sm font-medium text-purple-300 mb-2">Testing Technique</label>
                      <input
                        type="text"
                        value={editingTestCase.technique}
                        onChange={(e) => setEditingTestCase(prev => ({ ...prev, technique: e.target.value }))}
                        className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                        placeholder="e.g., Boundary Value Analysis, Equivalence Partitioning"
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-medium text-purple-300 mb-2">Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={Array.isArray(editingTestCase.tags) ? editingTestCase.tags.join(', ') : ''}
                        onChange={(e) => setEditingTestCase(prev => ({
                          ...prev,
                          tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                        }))}
                        className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                        placeholder="e2e, smoke, regression, ui"
                      />
                    </div>

                    {/* Preconditions */}
                    <div>
                      <label className="block text-sm font-medium text-purple-300 mb-2">Preconditions</label>
                      <textarea
                        value={editingTestCase.preconditions}
                        onChange={(e) => setEditingTestCase(prev => ({ ...prev, preconditions: e.target.value }))}
                        className="w-full h-20 bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                        placeholder="Prerequisites and setup required"
                      />
                    </div>

                    {/* Test Data */}
                    <div>
                      <label className="block text-sm font-medium text-purple-300 mb-2">
                        Test Data {editingTestCase.testData?.scenarios ? '(Scenario-based - editing as JSON)' : ''}
                      </label>
                      {editingTestCase.testData?.scenarios ? (
                        <div className="space-y-3">
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-xs text-yellow-300">
                            ⚠️ This test case uses scenario-based test data. Edit as JSON or simplify.
                          </div>
                          <textarea
                            value={JSON.stringify(editingTestCase.testData, null, 2)}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setEditingTestCase(prev => ({ ...prev, testData: parsed }));
                              } catch (err) {
                                // Keep the text as-is if it's not valid JSON yet
                              }
                            }}
                            className="w-full h-40 bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400 font-mono text-xs"
                            placeholder='{"scenarios": [{"name": "Scenario A", "data": {...}, "category": "valid"}]}'
                          />
                        </div>
                      ) : (
                        <textarea
                          value={typeof editingTestCase.testData === 'string'
                            ? editingTestCase.testData
                            : JSON.stringify(editingTestCase.testData || {}, null, 2)}
                          onChange={(e) => {
                            setEditingTestCase(prev => ({ ...prev, testData: e.target.value }));
                          }}
                          className="w-full h-24 bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400 font-mono text-xs"
                          placeholder='Test data or JSON: {"valid": ["data1"], "invalid": ["data2"]}'
                        />
                      )}
                    </div>

                    {/* Steps */}
                    <div>
                      <label className="block text-sm font-medium text-purple-300 mb-2">
                        Steps {typeof editingTestCase.steps?.[0] === 'object' ? '(Scenario-based - editing as JSON)' : '(one per line)'}
                      </label>
                      {typeof editingTestCase.steps?.[0] === 'object' ? (
                        <div className="space-y-3">
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-xs text-yellow-300">
                            ⚠️ This test case uses scenario-based steps. Edit as JSON or convert to simple format.
                          </div>
                          <textarea
                            value={JSON.stringify(editingTestCase.steps, null, 2)}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setEditingTestCase(prev => ({ ...prev, steps: parsed }));
                              } catch (err) {
                                // Keep the text as-is if it's not valid JSON yet
                                setEditingTestCase(prev => ({ ...prev, steps: e.target.value }));
                              }
                            }}
                            className="w-full h-48 bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400 font-mono text-xs"
                            placeholder='[{"scenario": "Scenario A", "actions": ["Step 1", "Step 2"]}]'
                          />
                          <button
                            type="button"
                            onClick={() => {
                              // Convert scenario-based to simple format
                              if (Array.isArray(editingTestCase.steps)) {
                                const simpleSteps = editingTestCase.steps.flatMap(scenarioStep =>
                                  scenarioStep.actions || []
                                );
                                setEditingTestCase(prev => ({ ...prev, steps: simpleSteps }));
                              }
                            }}
                            className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-all"
                          >
                            Convert to Simple Format
                          </button>
                        </div>
                      ) : (
                        <textarea
                          value={Array.isArray(editingTestCase.steps)
                            ? editingTestCase.steps.join('\n')
                            : ''}
                          onChange={(e) => {
                            const lines = e.target.value.split('\n').filter(line => line.trim());
                            setEditingTestCase(prev => ({ ...prev, steps: lines }));
                          }}
                          className="w-full h-32 bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                          placeholder="Navigate to dashboard&#10;Click 'Add Widget' button&#10;Verify widget is created"
                        />
                      )}
                    </div>

                    {/* Expected Results */}
                    <div>
                      <label className="block text-sm font-medium text-purple-300 mb-2">
                        Expected Results {editingTestCase.expectedResults?.byScenario ? '(Scenario-based - editing as JSON)' : ''}
                      </label>
                      {editingTestCase.expectedResults?.byScenario ? (
                        <div className="space-y-3">
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-xs text-yellow-300">
                            ⚠️ This test case uses scenario-based expected results. Edit as JSON or convert to simple format.
                          </div>
                          <textarea
                            value={JSON.stringify(editingTestCase.expectedResults, null, 2)}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setEditingTestCase(prev => ({ ...prev, expectedResults: parsed }));
                              } catch (err) {
                                // Keep the text as-is if it's not valid JSON yet
                                setEditingTestCase(prev => ({ ...prev, expectedResults: e.target.value }));
                              }
                            }}
                            className="w-full h-48 bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400 font-mono text-xs"
                            placeholder='{"byScenario": [{"scenario": "Scenario A", "results": "Expected outcome"}]}'
                          />
                          <button
                            type="button"
                            onClick={() => {
                              // Convert scenario-based to simple format
                              if (editingTestCase.expectedResults?.byScenario) {
                                const simpleResults = editingTestCase.expectedResults.byScenario
                                  .map((sr, idx) => `after scenario ${idx + 1}, ${sr.results}`)
                                  .join('.\n');
                                setEditingTestCase(prev => ({
                                  ...prev,
                                  expectedResults: { byStep: simpleResults }
                                }));
                              }
                            }}
                            className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-all"
                          >
                            Convert to Simple Format
                          </button>
                        </div>
                      ) : (
                        <textarea
                          value={typeof editingTestCase.expectedResults === 'object'
                            ? (editingTestCase.expectedResults?.byStep || '')
                            : editingTestCase.expectedResults || ''}
                          onChange={(e) => setEditingTestCase(prev => ({
                            ...prev,
                            expectedResults: { byStep: e.target.value }
                          }))}
                          className="w-full h-32 bg-black/50 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                          placeholder="Expected Results: &#10;&#10;after step 1, [expected result].&#10;&#10;after step 2, [expected result]."
                        />
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-6 pt-4 border-t border-purple-500/30">
                    <button
                      onClick={() => {
                        if (testCases.find(tc => tc.id === editingTestCase.id)) {
                          // Update existing test case
                          setTestCases(prev => prev.map(tc =>
                            tc.id === editingTestCase.id ? editingTestCase : tc
                          ));
                        } else {
                          // Add new test case
                          setTestCases(prev => [...prev, editingTestCase]);

                          // Update summary
                          const allTestCases = [...testCases, editingTestCase];
                          setTestSuiteSummary(prev => ({
                            ...prev,
                            totalCases: allTestCases.length,
                            positive: allTestCases.filter(tc => tc.type === 'positive').length,
                            negative: allTestCases.filter(tc => tc.type === 'negative').length,
                            edge: allTestCases.filter(tc => tc.type === 'edge').length,
                            coverageAreas: [...new Set(allTestCases.map(tc => tc.feature))],
                            techniques: [...new Set(allTestCases.map(tc => tc.technique))]
                          }));
                        }
                        setEditingTestCase(null);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Test Case
                    </button>
                    <button
                      onClick={() => setEditingTestCase(null)}
                      className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Live Chat Assistant */}
            <div className="bg-black/30 backdrop-blur-lg rounded-xl border border-purple-500/30 overflow-hidden">
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-purple-500/5 transition-all"
                onClick={() => setIsChatOpen(!isChatOpen)}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-bold text-purple-300">
                    AI Chat Assistant - Refine Your Results
                  </h2>
                  {chatMessages.length > 0 && (
                    <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded-full">
                      {chatMessages.length} messages
                    </span>
                  )}
                </div>
                <button className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded-lg text-sm transition-all">
                  {isChatOpen ? '▼ Close' : '▲ Open Chat'}
                </button>
              </div>

              {isChatOpen && (
                <div className="p-6 pt-0 border-t border-purple-500/20">
                  {chatMessages.length > 0 && (
                    <div className="mb-4 max-h-96 overflow-y-auto space-y-3 bg-black/50 p-4 rounded-lg border border-purple-500/20">
                      {chatMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user'
                              ? 'bg-purple-600 text-white'
                              : msg.content.includes('✅ Successfully generated')
                                ? 'bg-green-700 text-white border border-green-500'
                                : 'bg-gray-700 text-gray-100'
                              }`}
                          >
                            <div className="text-xs font-semibold mb-1 opacity-70">
                              {msg.role === 'user' ? 'You' : '🤖 AI Assistant'}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-4 rounded-lg border border-purple-500/30 mb-3">
                    <p className="text-sm text-gray-300 mb-3">
                      💬 Ask me to refine your results! Examples:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <button
                        onClick={() => setChatInput('Generate test cases for error handling')}
                        className="text-left px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded text-gray-300 transition-all"
                      >
                        "Generate test cases for error handling"
                      </button>
                      <button
                        onClick={() => setChatInput('Add i18n testing scenarios for RTL languages')}
                        className="text-left px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded text-gray-300 transition-all"
                      >
                        "Add i18n testing scenarios for RTL"
                      </button>
                      <button
                        onClick={() => setChatInput('Write test cases for network interruption scenarios')}
                        className="text-left px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded text-gray-300 transition-all"
                      >
                        "Write test cases for network interruption"
                      </button>
                      <button
                        onClick={() => setChatInput('Create test cases for security validation')}
                        className="text-left px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded text-gray-300 transition-all"
                      >
                        "Create test cases for security"
                      </button>
                      <button
                        onClick={() => setChatInput('Generate negative test cases for input validation')}
                        className="text-left px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded text-gray-300 transition-all"
                      >
                        "Generate negative test cases"
                      </button>
                      <button
                        onClick={() => setChatInput('Explain the testing techniques used in TC_001')}
                        className="text-left px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded text-gray-300 transition-all"
                      >
                        "Explain the testing techniques"
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !isProcessing && sendChatMessage()}
                      placeholder="Ask to modify test cases, add scenarios, or get clarifications..."
                      className="flex-1 bg-black/50 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                      disabled={isProcessing}
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={isProcessing || !chatInput.trim()}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Thinking...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          Send
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default QAAgentPro;

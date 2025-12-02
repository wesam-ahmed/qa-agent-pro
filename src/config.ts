// API Configuration
export const API_CONFIG = {
  // Backend proxy URL (default for local development)
  PROXY_URL: 'http://localhost:5000',

  // API endpoints
  ENDPOINTS: {
    ANTHROPIC: '/api/anthropic',
    HEALTH: '/health',
    CHAT_HISTORY: '/api/chat-history'
  }
};

// Helper function to make API calls through the proxy with automatic continuation
export const callAnthropicAPI = async (
  messages: any[],
  maxTokens: number = 16000,
  model: string = 'claude-sonnet-4-5-20250929',
  autoContinue: boolean = true
) => {
  try {
    const response = await fetch(`${API_CONFIG.PROXY_URL}${API_CONFIG.ENDPOINTS.ANTHROPIC}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `API request failed: ${response.status}`);
    }

    const data = await response.json();

    // Check for truncated responses and auto-continue if enabled
    if (data.stop_reason === 'max_tokens' && autoContinue) {
      console.log('🔄 Response truncated, continuing automatically...');

      // Make follow-up request to continue from where we left off
      const continuedData = await continueResponse(data, messages, maxTokens, model);
      return continuedData;
    }

    return data;
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// Helper function to continue truncated responses
const continueResponse = async (
  initialData: any,
  originalMessages: any[],
  maxTokens: number,
  model: string,
  maxContinuations: number = 5
): Promise<any> => {
  let fullText = initialData.content[0].text;
  let currentData = initialData;
  let continuationCount = 0;

  while (currentData.stop_reason === 'max_tokens' && continuationCount < maxContinuations) {
    continuationCount++;
    console.log(`📥 Fetching continuation ${continuationCount}/${maxContinuations}...`);

    // Create continuation messages
    const continuationMessages = [
      ...originalMessages,
      {
        role: 'assistant',
        content: fullText
      },
      {
        role: 'user',
        content: 'Please continue from where you left off. Continue the JSON exactly where it was cut off. Do NOT use markdown code blocks. Do NOT repeat any content.'
      }
    ];

    // Make continuation request
    const response = await fetch(`${API_CONFIG.PROXY_URL}${API_CONFIG.ENDPOINTS.ANTHROPIC}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: continuationMessages,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      console.error('Continuation request failed, returning partial response');
      break;
    }

    const continuationData = await response.json();
    const continuationText = continuationData.content[0].text;

    // Append continuation to full text
    fullText += continuationText;
    currentData = continuationData;

    console.log(`✅ Continuation ${continuationCount} received (${continuationText.length} chars)`);
  }

  if (continuationCount >= maxContinuations) {
    console.warn(`⚠️ Reached maximum continuation limit (${maxContinuations})`);
  } else if (currentData.stop_reason !== 'max_tokens') {
    console.log(`✅ Response complete after ${continuationCount} continuation(s)`);
  }

  // Return combined response
  return {
    ...currentData,
    content: [{
      type: 'text',
      text: fullText
    }],
    _continuations: continuationCount,
    stop_reason: currentData.stop_reason
  };
};


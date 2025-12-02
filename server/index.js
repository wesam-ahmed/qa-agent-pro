const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'your_actual_mongodb_uri_here';

// MongoDB connection options with increased timeouts
const mongooseOptions = {
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
  connectTimeoutMS: 30000, // 30 seconds
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 2, // Maintain at least 2 socket connections
  retryWrites: true,
  retryReads: true,
};

// Connection retry function
let isConnecting = false;
let reconnectTimeout = null;

const connectWithRetry = () => {
  if (isConnecting) return;

  isConnecting = true;
  mongoose.connect(MONGODB_URI, mongooseOptions)
    .then(() => {
      console.log('✅ Connected to MongoDB');
      isConnecting = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    })
    .catch((error) => {
      isConnecting = false;
      console.error('❌ MongoDB connection error:', error.message);

      // Retry connection after 5 seconds
      if (!reconnectTimeout) {
        console.log('🔄 Retrying connection in 5 seconds...');
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          connectWithRetry();
        }, 5000);
      }
    });
};

// Initial connection
connectWithRetry();

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
  isConnecting = false;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose disconnected from MongoDB');

  // Auto-reconnect on disconnect
  if (!reconnectTimeout && !isConnecting) {
    console.log('🔄 Auto-reconnecting in 5 seconds...');
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connectWithRetry();
    }, 5000);
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ Mongoose reconnected to MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed through app termination');
  process.exit(0);
});

// Chat History Schema
const chatHistorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timestamp: { type: Number, required: true },
  summary: { type: String, default: 'Analysis' },
  messages: { type: Array, required: true },
  results: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  res.json({
    status: mongoState === 1 ? 'ok' : 'degraded',
    mongodb: {
      state: states[mongoState] || 'unknown',
      readyState: mongoState
    }
  });
});

// Helper to wait for connection (with timeout)
const waitForConnection = (timeout = 5000) => {
  return new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) {
      return resolve(true);
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (mongoose.connection.readyState === 1) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Connection timeout'));
      }
    }, 100);
  });
};

// Save chat history to MongoDB
app.post('/api/chat-history', async (req, res) => {
  try {
    // Wait for connection (up to 5 seconds)
    try {
      await waitForConnection(5000);
    } catch (error) {
      const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      const currentState = states[mongoose.connection.readyState] || 'unknown';
      console.error('MongoDB not connected. State:', currentState);

      return res.status(503).json({
        error: 'Database not available',
        details: `MongoDB connection is ${currentState}. The server is attempting to reconnect. Please try again in a few seconds.`,
        connectionState: currentState
      });
    }

    const { id, timestamp, summary, messages, results } = req.body;

    if (!id || !timestamp || !messages) {
      return res.status(400).json({ error: 'Missing required fields: id, timestamp, messages' });
    }

    const chatData = {
      id,
      timestamp,
      summary: summary || 'Analysis',
      messages,
      results
    };

    // Use upsert to update if exists, create if not
    const savedChat = await ChatHistory.findOneAndUpdate(
      { id },
      chatData,
      { upsert: true, new: true }
    );

    res.json({ success: true, data: savedChat });
  } catch (error) {
    console.error('Error saving chat history:', error);

    // Provide more specific error messages
    let errorMessage = error.message;
    let statusCode = 500;

    if (error.message.includes('timeout')) {
      errorMessage = 'Database connection timeout. The server may be slow or unreachable.';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Cannot connect to database server. Check if MongoDB is running.';
    } else if (error.message.includes('authentication') || error.message.includes('not authorized')) {
      statusCode = 403;
      errorMessage = 'Database authorization failed. The user does not have write permissions. Please contact your database administrator to grant write access to the qa-agent database.';
    } else if (error.message.includes('E11000')) {
      errorMessage = 'Duplicate entry. This chat history already exists.';
    }

    res.status(statusCode).json({
      error: 'Failed to save chat history',
      details: errorMessage,
      hint: error.message.includes('not authorized') ? 'The MongoDB user needs readWrite role on the qa-agent database.' : undefined
    });
  }
});

// Get all chat history
app.get('/api/chat-history', async (req, res) => {
  try {
    // Wait for connection (up to 5 seconds)
    try {
      await waitForConnection(5000);
    } catch (error) {
      const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      const currentState = states[mongoose.connection.readyState] || 'unknown';
      console.error('MongoDB not connected. State:', currentState);

      return res.status(503).json({
        error: 'Database not available',
        details: `MongoDB connection is ${currentState}. The server is attempting to reconnect. Please try again in a few seconds.`,
        connectionState: currentState
      });
    }

    const histories = await ChatHistory.find({})
      .sort({ timestamp: -1 })
      .lean();

    res.json(histories);
  } catch (error) {
    console.error('Error loading chat history:', error);
    res.status(500).json({ error: 'Failed to load chat history', details: error.message });
  }
});

// Get single chat history by ID
app.get('/api/chat-history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await ChatHistory.findOne({ id }).lean();

    if (!chat) {
      return res.status(404).json({ error: 'Chat history not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error loading chat history:', error);
    res.status(500).json({ error: 'Failed to load chat history', details: error.message });
  }
});

// Delete chat history
app.delete('/api/chat-history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ChatHistory.findOneAndDelete({ id });

    if (!result) {
      return res.status(404).json({ error: 'Chat history not found' });
    }

    res.json({ success: true, message: 'Chat history deleted' });
  } catch (error) {
    console.error('Error deleting chat history:', error);
    res.status(500).json({ error: 'Failed to delete chat history', details: error.message });
  }
});

// Helper function to create a timeout promise
const createTimeout = (ms) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
};

// Helper function to make API request with retry logic
const makeRequestWithRetry = async (url, options, maxRetries, timeoutMs) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} to Anthropic API...`);

      // Create timeout promise
      const timeoutPromise = createTimeout(timeoutMs);

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(url, options),
        timeoutPromise
      ]);

      return response;
    } catch (error) {
      lastError = error;
      const isRetryable =
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout') ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT';

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: wait 1s, 2s, 4s before retrying
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`Retryable error (${error.message}), retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
};

// Anthropic API proxy
app.post('/api/anthropic', async (req, res) => {
  try {
    const { model, messages, max_tokens } = req.body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-5-20250929',
        messages,
        max_tokens: 50000
      })
    };

    const response = await makeRequestWithRetry(
      'https://api.anthropic.com/v1/messages',
      requestOptions,
      3, // max retries
      600000
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json(data);
    }

    // Check if response was truncated
    if (data.stop_reason === 'max_tokens') {
      console.warn('⚠️ Warning: API response truncated due to max_tokens limit');
      // Add warning to response
      data._warning = 'Response was truncated due to token limit. Consider increasing max_tokens or breaking down the request.';
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);

    // Provide more helpful error messages
    let errorMessage = error.message;
    if (error.message.includes('ECONNRESET')) {
      errorMessage = 'Connection was reset by the API server. This may be due to network instability or request timeout. Please try again.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timed out. The API request took too long to complete. Try reducing the request size or increasing max_tokens limit.';
    }

    res.status(500).json({ error: errorMessage });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

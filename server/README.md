# Backend Proxy Server

This is a simple Express.js server that acts as a proxy for the Anthropic API to avoid CORS issues and keep the API key secure.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your API key:
```
ANTHROPIC_API_KEY=your_actual_api_key_here
PORT=5000
```

3. Start the server:
```bash
npm start
```

## API Endpoint

**POST** `/api/anthropic`

Request body:
```json
{
  "model": "claude-sonnet-4-5-20250929",
  "messages": [
    {
      "role": "user",
      "content": "Your prompt here"
    }
  ],
  "max_tokens": 16000
}
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Your Anthropic API key (required)
- `PORT` - Server port (default: 5000)

## Security

- Never commit the `.env` file to Git
- The API key is only accessible server-side
- CORS is enabled for frontend communication


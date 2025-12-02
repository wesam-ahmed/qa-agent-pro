# 🚀 Quick Start Guide

## The Problem: CORS Error

When calling the Anthropic API directly from the browser, you'll get a CORS error because:
- **Security**: Anthropic blocks direct browser requests to protect your API key
- **Solution**: Use a backend proxy server to make API calls securely

## ✅ Solution Implemented

We've set up a simple Node.js backend server that:
1. Keeps your API key secure (server-side only)
2. Proxies requests to Anthropic API
3. Solves the CORS issue

## 📦 Easy Setup (Windows)

Just run the setup script:
```bash
setup.bat
```

This will install all dependencies and configure your API key automatically!

## 🎯 Manual Setup

### 1. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd server
npm install
cd ..
```

### 2. Configure API Key

Create `server/.env` file:
```
ANTHROPIC_API_KEY=
PORT=5000
```

### 3. Run the Application

**Terminal 1 - Backend Server:**
```bash
cd server
npm start
```

**Terminal 2 - Frontend:**
```bash
npm start
```

## 🌐 Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🔒 Security Note

✅ **Secure**: API key is stored server-side only  
❌ **Never** commit the `.env` file to Git  
✅ `.env` is already in `.gitignore`

## 🐳 Docker (Production)

```bash
docker build -t qa-agent-pro .
docker run -p 7320:7320 -p 5000:5000 \
  -e ANTHROPIC_API_KEY=your_key_here \
  qa-agent-pro
```

## 📁 Project Structure

```
qa-agent/
├── src/                    # Frontend React app
│   ├── QAAgentPro.tsx     # Main component
│   ├── config.ts          # API configuration
│   └── index.tsx          # Entry point
├── server/                 # Backend proxy server
│   ├── index.js           # Express server
│   ├── package.json       # Backend dependencies
│   └── .env              # API key (not in Git)
├── public/                # Static files
└── package.json          # Frontend dependencies
```

## 🛠️ Troubleshooting

### Backend not starting?
- Make sure you're in the `server/` directory
- Check that `.env` file exists with your API key
- Port 5000 should be available

### Frontend can't connect to backend?
- Make sure backend is running on port 5000
- Check console for connection errors
- Backend URL is `http://localhost:5000`

### Still getting CORS errors?
- Make sure the backend server is running
- Frontend should call `http://localhost:5000/api/anthropic`, not Anthropic directly
- Check the network tab to see where requests are going

## ✨ Features

- ✅ Secure API key handling
- ✅ No CORS errors
- ✅ Hot reload for development
- ✅ Production-ready Docker setup
- ✅ AI-powered test case generation
- ✅ Gap analysis
- ✅ Interactive chat interface

Happy Testing! 🎉


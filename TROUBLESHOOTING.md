# Troubleshooting Guide

## Common Issues and Solutions

### 1. JSON Parse Error / "Unterminated string in JSON"

**Error Message:**
```
Processing error: SyntaxError: Unterminated string in JSON at position XXXXX
```

**Cause:**
The API response was **truncated** because it hit the token limit (`max_tokens`). The response contains incomplete JSON that cannot be parsed.

**Solutions:**

#### Option A: Shorten Your Input (Recommended)
- Break long user stories into smaller, focused parts
- Be more concise in your requirements
- Focus on one feature at a time

#### Option B: Simplify Output Requirements
- Ask for fewer test cases (e.g., "generate 5-6 key test cases" instead of comprehensive coverage)
- Request simpler test case format with less detail

#### Option C: Increase max_tokens (Already Done)
The code now uses 16,000 max tokens instead of 8,000 for test generation, which should handle most cases.

**Prevention:**
- Keep user stories under 2000 words
- Focus on specific features rather than entire applications
- Use bullet points instead of long paragraphs

---

### 2. CORS Error

**Error Message:**
```
Access to fetch at 'https://api.anthropic.com/v1/messages' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**Cause:**
Frontend is trying to call Anthropic API directly instead of using the backend proxy.

**Solution:**
✅ This has been fixed! All API calls now go through the backend proxy at `http://localhost:5000`.

**Verify:**
- Make sure backend server is running: `cd server && npm start`
- Check browser console - requests should go to `localhost:5000/api/anthropic`
- If still seeing this, clear browser cache and restart frontend

---

### 3. "API key not configured" Error

**Error Message:**
```
ANTHROPIC_API_KEY not configured on server
```

**Cause:**
Backend server cannot find the `.env` file or the API key is missing.

**Solution:**
1. Create `server/.env` file:
```
ANTHROPIC_API_KEY=
PORT=5000
```

2. Restart backend server:
```bash
cd server
npm start
```

---

### 4. Cannot Connect to Backend

**Error Message:**
```
Failed to fetch
TypeError: NetworkError when attempting to fetch resource
```

**Cause:**
Backend server is not running or is on a different port.

**Solution:**
1. **Start backend server:**
```bash
cd server
npm start
```

2. **Verify it's running:**
   - Open http://localhost:5000/health
   - Should see: `{"status":"ok"}`

3. **Check port conflicts:**
   - If port 5000 is in use, change it in `server/.env`:
     ```
     PORT=5001
     ```
   - Then update frontend config in `src/config.ts`:
     ```typescript
     PROXY_URL: 'http://localhost:5001'
     ```

---

### 5. Response Truncated Warning

**Warning in Console:**
```
⚠️ API response was truncated. Increase max_tokens if needed.
```

**What it means:**
The AI hit the maximum token limit but successfully completed most of the response.

**Impact:**
- If JSON parsed successfully: No action needed
- If you see parse errors: Follow "JSON Parse Error" solutions above

**When to worry:**
Only if you're also getting JSON parse errors. Otherwise, the response is usable.

---

### 6. Dependencies Not Installed

**Error Message:**
```
Cannot find module 'express'
Cannot find module 'react'
```

**Solution:**
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

Or use the setup script:
```bash
setup.bat
```

---

### 7. Port Already in Use

**Error Message:**
```
Error: listen EADDRINUSE: address already in use :::5000
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution for Backend (Port 5000):**
1. Find and kill the process:
```powershell
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
```

2. Or change the port in `server/.env`:
```
PORT=5001
```

**Solution for Frontend (Port 3000):**
- The webpack dev server will automatically try the next available port (3001, 3002, etc.)
- Or manually kill the process using the same command as above

---

## Performance Tips

### For Large User Stories:
1. **Break into sections**: Instead of one huge story, split into multiple smaller requests
2. **Use phases**: Generate test cases for Phase 1, then Phase 2, etc.
3. **Focus on priorities**: Start with critical paths, add edge cases later

### For Faster Response Times:
1. **Be specific**: Clearer requirements = faster, more accurate responses
2. **Use templates**: Reuse successful prompt patterns
3. **Batch similar items**: Group related functionality in one request

### To Avoid Timeouts:
- Keep requests under 30 seconds (API timeout limit)
- If timing out consistently, break into smaller requests
- Check network connection stability

---

## Still Having Issues?

### Check Server Logs

**Backend logs:**
```bash
cd server
npm start
```
Look for error messages in the console

**Frontend logs:**
- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab to see API calls

### Verify Setup

Run this checklist:
- [ ] `server/.env` file exists with valid API key
- [ ] Backend server running on port 5000
- [ ] Frontend running on port 3000
- [ ] No CORS errors in browser console
- [ ] API calls go to `localhost:5000/api/anthropic`
- [ ] Both `node_modules` folders exist (root and server/)

### Reset Everything

If all else fails:
```bash
# Stop all servers
# Delete node_modules
rmdir /s /q node_modules
rmdir /s /q server\node_modules

# Reinstall
npm install
cd server && npm install && cd ..

# Restart
start-dev.bat
```

---

## Contact & Support

For persistent issues:
1. Check the browser console for detailed error messages
2. Check the backend server console for API errors
3. Review the network tab to see failed requests
4. Try with a simple, short user story to isolate the issue

Remember: Most issues are due to:
- Backend server not running
- Missing `.env` file
- User story too long/complex
- Dependencies not installed


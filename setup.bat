@echo off
echo ========================================
echo QA Agent Pro - Quick Setup Script
echo ========================================
echo.

echo [1/4] Installing frontend dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Frontend dependencies installation failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Installing backend dependencies...
cd server
call npm install
if errorlevel 1 (
    echo ERROR: Backend dependencies installation failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [3/4] Setting up environment file...
if not exist "server\.env" (
    echo ANTHROPIC_API_KEY= server\.env
    echo PORT=5000>> server\.env
    echo Created server\.env file with your API key
) else (
    echo server\.env already exists, skipping...
)

echo.
echo [4/4] Setup complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Open TWO terminal windows
echo.
echo Terminal 1 - Start Backend:
echo    cd server
echo    npm start
echo.
echo Terminal 2 - Start Frontend:
echo    npm start
echo.
echo The app will open at http://localhost:3000
echo ========================================
echo.
pause


@echo off
title QA Agent Pro - Development
echo ========================================
echo Starting QA Agent Pro
echo ========================================
echo.
echo Starting backend server...
start "Backend Server" cmd /k "cd server && npm start"
timeout /t 3 /nobreak > nul
echo.
echo Starting frontend...
start "Frontend" cmd /k "npm start"
echo.
echo ========================================
echo Both servers are starting...
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Close this window after both servers start
echo ========================================
timeout /t 5 /nobreak > nul


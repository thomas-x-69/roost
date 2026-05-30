@echo off
title Roost Network Controller
cd /d "%~dp0"

:: Roost binds to localhost by default. Change HOST below only if you
:: understand the security implications (see SECURITY.md).
set "HOST=127.0.0.1"
set "PORT=5000"

:: Check admin (needed for Npcap packet capture / ARP access control)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Stop only the process listening on our port (do NOT kill all python.exe)
echo Stopping any previous instance on port %PORT%...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Create data dirs
if not exist "data\blocklists" mkdir "data\blocklists"
if not exist "data\reports" mkdir "data\reports"

:: Build frontend if needed (uses npm from PATH)
if not exist "frontend\dist\index.html" (
    echo Building frontend...
    cd frontend
    call npm install --silent
    call npm run build
    cd ..
)

:: Open browser after delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:%PORT%"

echo.
echo ============================================================
echo   Roost starting at http://%HOST%:%PORT%
echo   Press Ctrl+C to stop
echo ============================================================
echo.

python -m uvicorn backend.main:app --host %HOST% --port %PORT%

pause

@echo off
title Aura Piano Launcher
echo ===================================================
echo               AURA PIANO LAUNCHER
echo ===================================================
echo.

:: Detect Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [+] Python detected. Starting web server on http://localhost:8000...
    start "" http://localhost:8000
    python -m http.server 8000
    exit /b
)

:: Detect Node.js
npx -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [+] Node.js/npx detected. Starting web server on http://localhost:3000...
    start "" http://localhost:3000
    npx -y serve -p 3000 .
    exit /b
)

echo [!] WARNING: Neither Python nor Node.js could be detected on your system PATH.
echo.
echo Double-click 'index.html' directly, or install Python/Node.js to enable the 
echo Web Audio API features (some browsers block audio from local files due to CORS restrictions).
echo.
pause

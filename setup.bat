@echo off
title Claude Ecosystem Manager - Setup
echo.
echo  ========================================
echo   Claude Ecosystem Manager - First Setup
echo  ========================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Node.js is not installed!
    echo  Please install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER% detected
echo.

:: Install dependencies
echo  Installing dependencies (this may take a minute)...
echo.
cd /d "%~dp0"
call npm install
echo.

:: Extract ecosystem data
echo  Scanning your ~/.claude/ directory...
echo.
call npm run extract
echo.

echo  ========================================
echo   Setup complete!
echo  ========================================
echo.
echo  To start the app, double-click: system.bat
echo  Or run: npm run dev
echo.
pause

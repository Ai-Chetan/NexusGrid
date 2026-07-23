@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo   NexusGrid Monitoring Script Installer (Windows)
echo =======================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: =========================================================================
:: SERVER URL CONFIGURATION
:: Default: Hosted Render backend (https://nexusgrid.onrender.com)
:: To switch to local backend, set: set "NEXUSGRID_BASE_URL=http://127.0.0.1:8000"
:: =========================================================================
if "%NEXUSGRID_BASE_URL%"=="" (
    set "NEXUSGRID_BASE_URL=https://nexusgrid.onrender.com"
)

:: Ensure URL doesn't end with trailing slash
if "%NEXUSGRID_BASE_URL:~-1%"=="/" set "NEXUSGRID_BASE_URL=%NEXUSGRID_BASE_URL:~0,-1%"
set "NEXUSGRID_INGEST_URL=%NEXUSGRID_BASE_URL%/api/ingest/"
set "UPDATE_URL=%NEXUSGRID_BASE_URL%/api/agent/script.py?format=raw"

echo [SERVER] Target Backend: %NEXUSGRID_BASE_URL%
echo.

:: Step 1: Detect Python
echo [1/5] Checking Python environment...
set "PY_CMD="
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PY_CMD=python"
) else (
    where py >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set "PY_CMD=py"
    )
)

if "%PY_CMD%"=="" (
    echo [ERROR] Python was not found in system PATH.
    echo Please install Python 3.x and ensure "Add Python to PATH" is checked.
    echo.
    exit /b 1
)

echo [OK] Using Python command: %PY_CMD%
echo.

:: Step 2: Download / update latest script.py from backend server
echo [2/5] Fetching latest monitoring script from server...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%UPDATE_URL%', '%SCRIPT_DIR%script.py.tmp')" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if exist "%SCRIPT_DIR%script.py.tmp" (
        move /y "%SCRIPT_DIR%script.py.tmp" "%SCRIPT_DIR%script.py" >nul 2>&1
        echo [OK] Successfully downloaded latest script.py from %UPDATE_URL%
    )
) else (
    echo [NOTE] Server offline or download skipped. Using local script.py.
    if exist "%SCRIPT_DIR%script.py.tmp" del "%SCRIPT_DIR%script.py.tmp" >nul 2>&1
)
echo.

:: Step 3: Install required Python dependencies
echo [3/5] Installing / verifying required dependencies...
%PY_CMD% -m pip install --upgrade requests psutil GPUtil >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Pip install had warnings/errors. Attempting standard installation...
    %PY_CMD% -m pip install requests psutil GPUtil
) else (
    echo [OK] Dependencies verified: requests, psutil, GPUtil.
)
echo.

:: Step 4: Run monitoring script immediately after installation
echo [4/5] Running monitoring script immediately...
%PY_CMD% "%SCRIPT_DIR%script.py" --once
if %ERRORLEVEL% EQU 0 (
    echo [OK] Initial monitoring payload sent successfully.
) else (
    echo [WARNING] Script ran but exited with code %ERRORLEVEL%.
)
echo.

:: Step 5: Configure persistence for system restart and shutdown offline signal
echo [5/5] Setting up automatic run on system restart / logon + shutdown offline signal...

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
%PY_CMD% "%SCRIPT_DIR%setup_persistence.py" "%SCRIPT_DIR%" "%NEXUSGRID_BASE_URL%"

:: Step 6: Start continuous background monitoring immediately
echo [6/6] Launching continuous background monitoring process...
wscript.exe "%SCRIPT_DIR%run_silent.vbs"

echo.
echo =======================================================
echo   Installation Completed Successfully!
echo   - Backend Server : %NEXUSGRID_BASE_URL%
echo   - Initial test payload sent: YES
echo   - Continuous loop launched : YES (Runs silently in background)
echo   - Auto-runs on system boot : YES (Task Scheduler / Startup folder)
echo   - Execution Frequency      : EVERY 1 MINUTE
echo   - Offline signal on shutdown: YES (NexusGridOffline task)
echo =======================================================

echo.

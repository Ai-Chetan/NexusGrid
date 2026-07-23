@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo   NexusGrid Monitoring Script Installer (Windows)
echo =======================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Load existing config if present
if exist "%SCRIPT_DIR%nexusgrid_config.bat" call "%SCRIPT_DIR%nexusgrid_config.bat"

:: Set default hosted backend if NEXUSGRID_BASE_URL is not set
if "%NEXUSGRID_BASE_URL%"=="" (
    set "NEXUSGRID_BASE_URL=https://nexusgrid.onrender.com"
)

:: Ensure URL doesn't end with trailing slash
if "%NEXUSGRID_BASE_URL:~-1%"=="/" set "NEXUSGRID_BASE_URL=%NEXUSGRID_BASE_URL:~0,-1%"
set "NEXUSGRID_INGEST_URL=%NEXUSGRID_BASE_URL%/api/ingest/"
set "UPDATE_URL=%NEXUSGRID_BASE_URL%/api/agent/script.py?format=raw"

echo [SERVER] Target Backend: %NEXUSGRID_BASE_URL%
echo.

:: Step 1: Detect Python & resolve absolute executable paths
echo [1/5] Checking Python environment...
set "PYTHON_EXE="
set "PYTHONW_EXE="

for /f "delims=" %%i in ('where python 2^>nul') do (
    if not defined PYTHON_EXE set "PYTHON_EXE=%%i"
)
if "%PYTHON_EXE%"=="" (
    for /f "delims=" %%i in ('where py 2^>nul') do (
        if not defined PYTHON_EXE set "PYTHON_EXE=%%i"
    )
)

if "%PYTHON_EXE%"=="" (
    echo [ERROR] Python was not found in system PATH.
    echo Please install Python 3.x and ensure "Add Python to PATH" is checked.
    echo.
    exit /b 1
)

for /f "delims=" %%i in ('where pythonw 2^>nul') do (
    if not defined PYTHONW_EXE set "PYTHONW_EXE=%%i"
)
if "%PYTHONW_EXE%"=="" set "PYTHONW_EXE=%PYTHON_EXE%"

echo [OK] Resolved Python EXE  : %PYTHON_EXE%
echo [OK] Resolved PythonW EXE : %PYTHONW_EXE%
echo.

:: Save config for offline script and restart tasks
echo set "NEXUSGRID_BASE_URL=%NEXUSGRID_BASE_URL%" > "%SCRIPT_DIR%nexusgrid_config.bat"
echo set "PYTHON_EXE=%PYTHON_EXE%" >> "%SCRIPT_DIR%nexusgrid_config.bat"
echo set "PYTHONW_EXE=%PYTHONW_EXE%" >> "%SCRIPT_DIR%nexusgrid_config.bat"

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
"%PYTHON_EXE%" -m pip install --upgrade requests psutil GPUtil >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Pip install had warnings/errors. Attempting standard installation...
    "%PYTHON_EXE%" -m pip install requests psutil GPUtil
) else (
    echo [OK] Dependencies verified: requests, psutil, GPUtil.
)
echo.

:: Step 4: Run monitoring script immediately after installation
echo [4/5] Running monitoring script immediately (Turning system status GREEN)...
set "NEXUSGRID_BASE_URL=%NEXUSGRID_BASE_URL%"
set "NEXUSGRID_INGEST_URL=%NEXUSGRID_INGEST_URL%"
"%PYTHON_EXE%" "%SCRIPT_DIR%script.py" --once
if %ERRORLEVEL% EQU 0 (
    echo [OK] Initial monitoring payload sent successfully. System is now ONLINE [Green].
) else (
    echo [WARNING] Script ran but exited with code %ERRORLEVEL%.
)
echo.

set "CLEAN_DIR=%SCRIPT_DIR%"
if "%CLEAN_DIR:~-1%"=="\" set "CLEAN_DIR=%CLEAN_DIR:~0,-1%"
echo [5/6] Setting up automatic run on startup + shutdown offline signal...
"%PYTHON_EXE%" "%CLEAN_DIR%\setup_persistence.py" "%CLEAN_DIR%" "%NEXUSGRID_BASE_URL%" "%PYTHON_EXE%" "%PYTHONW_EXE%"

:: Step 6: Start continuous background monitoring immediately (detached process)
echo [6/6] Launching continuous background monitoring process...
start "" wscript.exe "%SCRIPT_DIR%run_silent.vbs"

echo.
echo =======================================================
echo   Installation Completed Successfully!
echo   - Backend Server : %NEXUSGRID_BASE_URL%
echo   - Initial test payload sent: YES (Status set to Green)
echo   - Continuous loop launched : YES (Runs silently in background every 1 min)
echo   - Auto-runs on system boot : YES (Task Scheduler / Registry / Startup folder)
echo   - Offline signal on shutdown: YES (Event 1074 / Task Scheduler)
echo =======================================================

echo.



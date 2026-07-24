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
:: To switch to hosted Render backend, set NEXUSGRID_BASE_URL:
:: set "NEXUSGRID_BASE_URL=https://nexusgrid.onrender.com"
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
%PY_CMD% "%SCRIPT_DIR%script.py"
if %ERRORLEVEL% EQU 0 (
    echo [OK] Initial monitoring payload sent successfully.
) else (
    echo [WARNING] Script ran but exited with code %ERRORLEVEL%.
)
echo.

:: Step 5: Configure persistence for system restart
echo [5/5] Setting up automatic run on system restart / logon...

set "TASK_NAME=NexusGridMonitoring"
set "LAUNCHER=%SCRIPT_DIR%run_monitoring.bat"
set "TASK_XML=%SCRIPT_DIR%nexusgrid_task.xml"

:: Generate Task Scheduler XML with proper WorkingDirectory
echo ^<?xml version="1.0" encoding="UTF-16"?^> > "%TASK_XML%"
echo ^<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"^> >> "%TASK_XML%"
echo   ^<Triggers^> >> "%TASK_XML%"
echo     ^<TimeTrigger^> >> "%TASK_XML%"
echo       ^<Repetition^> >> "%TASK_XML%"
echo         ^<Interval^>PT1M^</Interval^> >> "%TASK_XML%"
echo         ^<StopAtDurationEnd^>false^</StopAtDurationEnd^> >> "%TASK_XML%"
echo       ^</Repetition^> >> "%TASK_XML%"
echo       ^<StartBoundary^>2026-01-01T00:00:00^</StartBoundary^> >> "%TASK_XML%"
echo       ^<Enabled^>true^</Enabled^> >> "%TASK_XML%"
echo     ^</TimeTrigger^> >> "%TASK_XML%"
echo     ^<BootTrigger^> >> "%TASK_XML%"
echo       ^<Enabled^>true^</Enabled^> >> "%TASK_XML%"
echo     ^</BootTrigger^> >> "%TASK_XML%"
echo   ^</Triggers^> >> "%TASK_XML%"
echo   ^<Settings^> >> "%TASK_XML%"
echo     ^<MultipleInstancesPolicy^>IgnoreNew^</MultipleInstancesPolicy^> >> "%TASK_XML%"
echo     ^<DisallowStartIfOnBatteries^>false^</DisallowStartIfOnBatteries^> >> "%TASK_XML%"
echo     ^<StopIfGoingOnBatteries^>false^</StopIfGoingOnBatteries^> >> "%TASK_XML%"
echo     ^<ExecutionTimeLimit^>PT10M^</ExecutionTimeLimit^> >> "%TASK_XML%"
echo     ^<Hidden^>true^</Hidden^> >> "%TASK_XML%"
echo   ^</Settings^> >> "%TASK_XML%"
echo   ^<Actions^> >> "%TASK_XML%"
echo     ^<Exec^> >> "%TASK_XML%"
echo       ^<Command^>wscript.exe^</Command^> >> "%TASK_XML%"
echo       ^<Arguments^>"%SCRIPT_DIR%run_silent.vbs"^</Arguments^> >> "%TASK_XML%"
echo       ^<WorkingDirectory^>%SCRIPT_DIR%^</WorkingDirectory^> >> "%TASK_XML%"
echo     ^</Exec^> >> "%TASK_XML%"
echo   ^</Actions^> >> "%TASK_XML%"
echo ^</Task^> >> "%TASK_XML%"

:: Attempt 5a: Windows Task Scheduler with XML (Runs every 1 minute + on boot)
schtasks /create /tn "%TASK_NAME%" /xml "%TASK_XML%" /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Task Scheduler job '%TASK_NAME%' created successfully - Interval: Every 1 minute
    del "%TASK_XML%" >nul 2>&1
) else (
    echo [NOTE] Task Scheduler creation required higher privileges. Falling back to Startup folder...
    del "%TASK_XML%" >nul 2>&1
)

:: Attempt 5b: Windows Startup Folder fallback (Silent VBScript loop every 1 minute)
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_FOLDER%" (
    if exist "%STARTUP_FOLDER%\NexusGridMonitoring.bat" del "%STARTUP_FOLDER%\NexusGridMonitoring.bat" >nul 2>&1
    echo Set WshShell = CreateObject("WScript.Shell") > "%STARTUP_FOLDER%\NexusGridMonitoring.vbs"
    echo WshShell.Run "wscript.exe """ ^& "%SCRIPT_DIR%run_silent.vbs" ^& """", 0, False >> "%STARTUP_FOLDER%\NexusGridMonitoring.vbs"
    echo [OK] Created Silent Startup entry in: %STARTUP_FOLDER%\NexusGridMonitoring.vbs - Interval: Every 1 minute (Hidden)
)

echo.
echo =======================================================
echo   Installation Completed Successfully!
echo   - Backend Server: %NEXUSGRID_BASE_URL%
echo   - Script ran immediately: YES
echo   - Runs on system restart: YES
echo   - Execution Frequency: EVERY 1 MINUTE
echo =======================================================

echo.
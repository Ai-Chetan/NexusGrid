@echo off
setlocal enabledelayedexpansion

:: Navigate to script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: =========================================================================
:: SERVER URL CONFIGURATION
:: To switch to hosted Render backend, set NEXUSGRID_BASE_URL:
:: set "NEXUSGRID_BASE_URL=https://nexusgrid.onrender.com"
:: =========================================================================
if "%NEXUSGRID_BASE_URL%"=="" (
    set "NEXUSGRID_BASE_URL=http://127.0.0.1:8000"
)

:: Ensure URL doesn't end with trailing slash
if "%NEXUSGRID_BASE_URL:~-1%"=="/" set "NEXUSGRID_BASE_URL=%NEXUSGRID_BASE_URL:~0,-1%"
set "NEXUSGRID_INGEST_URL=%NEXUSGRID_BASE_URL%/api/ingest/"
set "UPDATE_URL=%NEXUSGRID_BASE_URL%/api/agent/script.py?format=raw"

:: Step 1: Auto-update script.py from backend server (BOM-free download with 3s timeout)
curl.exe -s -m 3 -o "%SCRIPT_DIR%script.py.tmp" "%UPDATE_URL%" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if exist "%SCRIPT_DIR%script.py.tmp" (
        move /y "%SCRIPT_DIR%script.py.tmp" "%SCRIPT_DIR%script.py" >nul 2>&1
    )
) else (
    if exist "%SCRIPT_DIR%script.py.tmp" del "%SCRIPT_DIR%script.py.tmp" >nul 2>&1
)

:: Step 2: Run script.py once silently using pythonw and exit immediately
where pythonw >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    pythonw "%SCRIPT_DIR%script.py" --once >nul 2>&1
    exit /b 0
)

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python "%SCRIPT_DIR%script.py" --once >nul 2>&1
    exit /b 0
)

where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    py "%SCRIPT_DIR%script.py" --once >nul 2>&1
    exit /b 0
)

exit /b 0

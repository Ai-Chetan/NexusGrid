@echo off
:: NexusGrid - Send Offline Signal
:: Called automatically on shutdown by Windows Task Scheduler or manually.
:: Loads the backend URL from nexusgrid_config.bat (written by installer).

set "NEXUSGRID_BASE_URL=https://nexusgrid.onrender.com"
set "PYTHON_EXE=python"

:: Load local config if it exists (overrides default URL and Python path)
set "CONFIG=%~dp0nexusgrid_config.bat"
if exist "%CONFIG%" call "%CONFIG%"

if "%NEXUSGRID_BASE_URL:~-1%"=="/" set "NEXUSGRID_BASE_URL=%NEXUSGRID_BASE_URL:~0,-1%"

:: Try sending offline signal via resolved Python EXE first, then fallback
"%PYTHON_EXE%" -c "import platform, requests; requests.post('%NEXUSGRID_BASE_URL%/api/offline/', json={'hostname': platform.node()}, timeout=5)" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  python -c "import platform, requests; requests.post('%NEXUSGRID_BASE_URL%/api/offline/', json={'hostname': platform.node()}, timeout=5)" >nul 2>&1
)
if %ERRORLEVEL% NEQ 0 (
  py -c "import platform, requests; requests.post('%NEXUSGRID_BASE_URL%/api/offline/', json={'hostname': platform.node()}, timeout=5)" >nul 2>&1
)



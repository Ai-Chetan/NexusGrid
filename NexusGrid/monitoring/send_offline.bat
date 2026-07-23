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

:: 1. Try PowerShell (native on Windows, fast execution)
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $h = $env:COMPUTERNAME; $body = \"{`\"hostname`\":`\"$h`\"}\"; Invoke-RestMethod -Uri '%NEXUSGRID_BASE_URL%/api/offline/' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 3" >nul 2>&1
if %ERRORLEVEL% EQU 0 exit /b 0

:: 2. Try native curl.exe (built-in Windows 10/11)
curl.exe -s -X POST "%NEXUSGRID_BASE_URL%/api/offline/" -H "Content-Type: application/json" -d "{\"\"hostname\"\":\"\"%COMPUTERNAME%\"\"}" --max-time 3 >nul 2>&1
if %ERRORLEVEL% EQU 0 exit /b 0

:: 3. Try sending offline signal via resolved Python EXE first, then fallback
"%PYTHON_EXE%" -c "import platform, requests; requests.post('%NEXUSGRID_BASE_URL%/api/offline/', json={'hostname': platform.node()}, timeout=3)" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  python -c "import platform, requests; requests.post('%NEXUSGRID_BASE_URL%/api/offline/', json={'hostname': platform.node()}, timeout=3)" >nul 2>&1
)
if %ERRORLEVEL% NEQ 0 (
  py -c "import platform, requests; requests.post('%NEXUSGRID_BASE_URL%/api/offline/', json={'hostname': platform.node()}, timeout=3)" >nul 2>&1
)




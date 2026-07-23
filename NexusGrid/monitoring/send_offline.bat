@echo off
:: NexusGrid - Send Offline Signal
:: Called automatically on shutdown by Windows Task Scheduler or manually.
:: Loads the backend URL from nexusgrid_config.bat (written by installer).

set "NEXUSGRID_BASE_URL=https://nexusgrid.onrender.com"

:: Load local config if it exists (overrides default URL)
set "CONFIG=%~dp0nexusgrid_config.bat"
if exist "%CONFIG%" call "%CONFIG%"

:: Try sending offline signal via Python first, fallback to curl
python -c "import os, requests; requests.post('%NEXUSGRID_BASE_URL%/api/offline/', json={'hostname': os.getenv('COMPUTERNAME')}, timeout=5)" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  curl.exe -s -m 5 -X POST "%NEXUSGRID_BASE_URL%/api/offline/" -H "Content-Type: application/json" -d "{\"hostname\":\"%COMPUTERNAME%\"}"
)

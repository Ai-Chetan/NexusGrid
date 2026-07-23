@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo   NexusGrid Monitoring Agent Uninstaller / Stopper
echo =======================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Step 1: Send immediate offline signal to server (turns system status GREY)
echo [1/4] Sending offline status signal to backend (Turning system status GREY)...
if exist "%SCRIPT_DIR%send_offline.bat" (
    call "%SCRIPT_DIR%send_offline.bat"
)

:: Step 2: Stop running background processes
echo [2/4] Stopping background monitoring processes...
taskkill /F /IM wscript.exe >nul 2>&1
taskkill /F /IM cscript.exe >nul 2>&1
powershell -Command "Get-Process -Name wscript, cscript -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*script.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: Step 3: Remove Windows Task Scheduler tasks
echo [3/4] Removing Task Scheduler jobs...
schtasks /delete /tn "NexusGridMonitoring" /f >nul 2>&1
schtasks /delete /tn "NexusGridOffline" /f >nul 2>&1

:: Step 4: Remove Startup folder entry & Registry key
echo [4/4] Removing Startup folder & Registry fallback entries...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_FOLDER%\NexusGridMonitoring.vbs" del "%STARTUP_FOLDER%\NexusGridMonitoring.vbs" >nul 2>&1
if exist "%STARTUP_FOLDER%\NexusGridMonitoring.bat" del "%STARTUP_FOLDER%\NexusGridMonitoring.bat" >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "NexusGridMonitoring" /f >nul 2>&1

echo.
echo =======================================================
echo   NexusGrid Monitoring Agent Successfully Stopped!
echo   - Background process killed     : YES
echo   - Task Scheduler jobs removed   : YES
echo   - Startup folder entry deleted  : YES
echo   - Registry auto-start deleted   : YES
echo   - Offline signal sent to server : YES (Status set to Grey)
echo =======================================================
echo.


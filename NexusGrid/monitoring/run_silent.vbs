On Error Resume Next
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
pyScript = scriptDir & "\script.py"

' Set hosted backend URL so script always targets Render, not localhost
WshShell.Environment("PROCESS")("NEXUSGRID_BASE_URL") = "https://nexusgrid.onrender.com"
WshShell.Environment("PROCESS")("NEXUSGRID_INGEST_URL") = "https://nexusgrid.onrender.com/api/ingest/"

' Load local config override if present (set by installer for local testing)
configBat = scriptDir & "\nexusgrid_config.bat"
If fso.FileExists(configBat) Then
    ' Read URL from config file
    Set f = fso.OpenTextFile(configBat, 1)
    Do While Not f.AtEndOfStream
        line = Trim(f.ReadLine())
        If Left(LCase(line), 3) = "set" Then
            ' Extract value from: set "NEXUSGRID_BASE_URL=http://..."
            eq = InStr(line, "=")
            If eq > 0 Then
                url = Mid(line, eq + 1)
                url = Replace(url, Chr(34), "")  ' strip quotes
                url = Replace(url, Chr(13), "")  ' strip carriage returns
                url = Replace(url, Chr(10), "")  ' strip line feeds
                url = Trim(url)
                If Len(url) > 4 Then
                    WshShell.Environment("PROCESS")("NEXUSGRID_BASE_URL") = url
                    WshShell.Environment("PROCESS")("NEXUSGRID_INGEST_URL") = url & "/api/ingest/"
                End If
            End If
        End If
    Loop
    f.Close
End If

' ── Main loop: run script.py --once every 60 seconds, silently ──────────────
' 0 = SW_HIDE (no window), True = wait for process to finish before sleeping
Do While True
    WshShell.Run "pythonw """ & pyScript & """ --once", 0, True
    If Err.Number <> 0 Then
        Err.Clear
        WshShell.Run "python """ & pyScript & """ --once", 0, True
    End If
    WScript.Sleep 60000  ' wait exactly 60 seconds, then repeat
Loop

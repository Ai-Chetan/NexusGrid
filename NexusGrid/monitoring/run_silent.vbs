On Error Resume Next
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
pyScript = scriptDir & "\script.py"

pyExe = ""
pywExe = ""

' Load config file set by installer
configBat = scriptDir & "\nexusgrid_config.bat"
If fso.FileExists(configBat) Then
    Set f = fso.OpenTextFile(configBat, 1)
    Do While Not f.AtEndOfStream
        line = Trim(f.ReadLine())
        If Left(LCase(line), 3) = "set" Then
            eq = InStr(line, "=")
            If eq > 0 Then
                key = Trim(Mid(line, 4, eq - 4))
                key = Replace(key, Chr(34), "")
                val = Mid(line, eq + 1)
                val = Replace(val, Chr(34), "")
                val = Replace(val, Chr(13), "")
                val = Replace(val, Chr(10), "")
                val = Trim(val)
                If LCase(key) = "nexusgrid_base_url" And Len(val) > 4 Then
                    WshShell.Environment("PROCESS")("NEXUSGRID_BASE_URL") = val
                    WshShell.Environment("PROCESS")("NEXUSGRID_INGEST_URL") = val & "/api/ingest/"
                ElseIf LCase(key) = "python_exe" And Len(val) > 0 Then
                    pyExe = val
                ElseIf LCase(key) = "pythonw_exe" And Len(val) > 0 Then
                    pywExe = val
                End If
            End If
        End If
    Loop
    f.Close
End If

If pywExe = "" Then pywExe = "pythonw.exe"
If pyExe = "" Then pyExe = "python.exe"

' Continuous loop: execute monitoring script silently every 60 seconds
Do While True
    Err.Clear
    WshShell.Run """" & pywExe & """ """ & pyScript & """ --once", 0, True
    If Err.Number <> 0 Then
        Err.Clear
        WshShell.Run """" & pyExe & """ """ & pyScript & """ --once", 0, True
        If Err.Number <> 0 Then
            Err.Clear
            WshShell.Run "pythonw """ & pyScript & """ --once", 0, True
            If Err.Number <> 0 Then
                Err.Clear
                WshShell.Run "python """ & pyScript & """ --once", 0, True
            End If
        End If
    End If
    WScript.Sleep 60000
Loop

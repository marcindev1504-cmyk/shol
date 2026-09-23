Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
Dim root
root = fso.GetParentFolderName(WScript.ScriptFullName)

' Serwer aplikacji — ukryty
Dim serverCmd
serverCmd = "cmd /c cd /d """ & root & """"
serverCmd = serverCmd & "&& set PORT=8080"
serverCmd = serverCmd & "&& node.exe server.mjs"
shell.Run serverCmd, 0, False

WScript.Sleep 2000
shell.Run "http://localhost:8080"

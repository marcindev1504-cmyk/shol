Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
Dim root
root = fso.GetParentFolderName(WScript.ScriptFullName)

' Ollama — ukryta, wlasne modele, port 11435
Dim ollamaCmd
ollamaCmd = "cmd /c set OLLAMA_MODELS=" & root & "\ollama\models"
ollamaCmd = ollamaCmd & "&& set OLLAMA_HOST=http://localhost:11435"
ollamaCmd = ollamaCmd & "&& """ & root & "\ollama\ollama.exe"" serve"
shell.Run ollamaCmd, 0, False

WScript.Sleep 5000

' Serwer aplikacji — ukryty
Dim serverCmd
serverCmd = "cmd /c cd /d """ & root & """"
serverCmd = serverCmd & "&& set OLLAMA_HOST=http://localhost:11435"
serverCmd = serverCmd & "&& set PORT=8080"
serverCmd = serverCmd & "&& node.exe server.mjs"
shell.Run serverCmd, 0, False

WScript.Sleep 2000
shell.Run "http://localhost:8080"

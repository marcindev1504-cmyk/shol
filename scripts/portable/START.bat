@echo off
cd /d "%~dp0"

:: Tworzy skrot z ikona przy pierwszym uruchomieniu
if not exist "Kompas Wiedzy.lnk" (
  if not exist "icon.ico" copy "ollama\app.ico" "icon.ico" >nul 2>&1
  powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $lnk = $ws.CreateShortcut('%~dp0Kompas Wiedzy.lnk'); $lnk.TargetPath = '%~dp0START.bat'; $lnk.IconLocation = '%~dp0icon.ico'; $lnk.WorkingDirectory = '%~dp0'; $lnk.Description = 'Kompas Wiedzy'; $lnk.Save()" >nul 2>&1
)

:: Uruchom ukryte
wscript "%~dp0run.vbs"

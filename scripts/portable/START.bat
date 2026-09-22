@echo off
rem ============================================================
rem  Kompas Wiedzy - uruchomienie portable
rem  Nie zamykaj okien "Kompas - Ollama" ani tego okna podczas pracy.
rem ============================================================
setlocal
cd /d "%~dp0"

set OLLAMA_MODELS=%~dp0ollama\models
set OLLAMA_HOST=http://localhost:11435
set PORT=8080

rem --- start lokalnego serwisu modeli AI (osobny port, nie koliduje
rem --- z ewentualna zainstalowana Ollama na 11434)
start "Kompas - Ollama (nie zamykaj)" /min "%~dp0ollama\ollama.exe" serve

rem --- czekaj az Ollama odpowie
:wait
"%~dp0node.exe" -e "fetch('http://localhost:11435/api/tags').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>&1
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto wait
)

rem --- otworz aplikacje w przegladarce i wystaw serwer aplikacji
start "" http://localhost:8080
"%~dp0node.exe" server.mjs

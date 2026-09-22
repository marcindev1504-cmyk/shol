@echo off
echo Zatrzymywanie Kompas Wiedzy...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im ollama.exe >nul 2>&1
echo Zatrzymano.
timeout /t 3

@echo off
cd /d "%~dp0"
echo Starting AfterEffectsMCP Server in background...
start "" "%~dp0.venv\Scripts\python.exe" "%~dp0server\server.py"
echo Server launched. You can close this window.
timeout /t 2
exit

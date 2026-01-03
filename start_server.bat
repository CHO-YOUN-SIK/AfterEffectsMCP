@echo off
cd /d "%~dp0"
echo Starting AfterEffectsMCP Server...
".venv\Scripts\python.exe" "server\server.py"

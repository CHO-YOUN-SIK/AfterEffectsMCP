@echo off
cd /d "%~dp0"
echo Starting AfterEffectsMCP Server...
"%~dp0.venv\Scripts\python.exe" "%~dp0server\server.py"

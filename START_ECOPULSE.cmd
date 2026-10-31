@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
 echo First-time setup: python -m venv .venv
 echo Then run: .venv\Scripts\python.exe -m pip install -r requirements-ml.txt
 pause
 exit /b 1
)
.venv\Scripts\python.exe run_ecopulse.py
if errorlevel 1 pause

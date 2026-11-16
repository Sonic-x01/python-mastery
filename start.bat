@echo off
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo [X] Python is not installed or not on PATH.
  echo     Install it from https://www.python.org/downloads/ then try again.
  echo.
  pause
  exit /b 1
)

echo Starting Python Mastery...
python server.py

if errorlevel 1 (
  echo.
  echo The server stopped with an error.
  pause
)

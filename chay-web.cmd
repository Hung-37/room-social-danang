@echo off
cd /d "%~dp0"
call npm run serve
if errorlevel 1 pause

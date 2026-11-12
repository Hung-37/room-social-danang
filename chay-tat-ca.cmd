@echo off
cd /d "%~dp0"
call npm run stack:up
if errorlevel 1 pause

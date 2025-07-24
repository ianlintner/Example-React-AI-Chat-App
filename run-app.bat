@echo off
echo Opening new Command Prompt with fresh environment...
echo This will install dependencies and start the React AI Chat App.
echo.
start cmd /k "cd /d %~dp0 && setup-and-run.bat"

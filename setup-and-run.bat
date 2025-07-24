@echo off
echo Setting up React AI Chat App...
echo.

echo Checking Node.js installation...
node --version
if %errorlevel% neq 0 (
    echo Node.js not found in PATH. Please restart your terminal or computer.
    pause
    exit /b 1
)

echo Checking npm installation...
npm --version
if %errorlevel% neq 0 (
    echo npm not found in PATH. Please restart your terminal or computer.
    pause
    exit /b 1
)

echo.
echo Installing backend dependencies...
cd backend
npm install
if %errorlevel% neq 0 (
    echo Backend installation failed!
    pause
    exit /b 1
)

echo.
echo Installing frontend dependencies...
cd ..\frontend
npm install
if %errorlevel% neq 0 (
    echo Frontend installation failed!
    pause
    exit /b 1
)

echo.
echo Starting servers...
echo.
echo Starting backend server in new window...
cd ..\backend
start "Backend Server - AI Chat App" cmd /k "npm run dev"

echo.
echo Waiting 3 seconds before starting frontend...
timeout /t 3 /nobreak >nul

echo Starting frontend server in new window...
cd ..\frontend
start "Frontend Server - AI Chat App" cmd /k "npm run dev"

echo.
echo ========================================
echo Setup complete!
echo.
echo Backend server: http://localhost:5000
echo Frontend app: http://localhost:5173
echo.
echo Both servers are starting in separate windows.
echo Close this window when you're done.
echo ========================================
pause

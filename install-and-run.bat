@echo off
echo Installing dependencies and starting the React AI Chat App...
set PATH=C:\Program Files\nodejs;%PATH%

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
echo Starting frontend (mobile app) server...
cd ..\frontend
start "Frontend (Mobile App) Server" cmd /k "set PATH=C:\Program Files\nodejs;%PATH% && npm start"

echo.
echo Starting backend server...
cd ..\backend
start "Backend Server" cmd /k "set PATH=C:\Program Files\nodejs;%PATH% && npm run dev"

echo.
echo Both servers are starting...
echo Mobile app development server will start with Expo
echo Scan the QR code with Expo Go app on your mobile device
echo Backend API will be available at: http://localhost:5001
pause

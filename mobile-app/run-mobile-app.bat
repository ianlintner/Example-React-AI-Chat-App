@echo off
echo Starting React Native Mobile App...
echo.
echo Make sure you have:
echo 1. Backend server running on http://localhost:3001
echo 2. Android Studio or Expo Go app installed
echo 3. Android device/emulator connected
echo.

cd mobile-app
echo Installing dependencies...
npm install --legacy-peer-deps

echo.
echo Starting Expo development server...
npx expo start

pause

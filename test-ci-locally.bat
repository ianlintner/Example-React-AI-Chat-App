@echo off
echo Starting CI validation tests...
echo.

echo === Backend Tests ===
cd backend
echo Installing backend dependencies...
call npm ci
if %errorlevel% neq 0 (
    echo Backend dependency installation failed!
    exit /b 1
)

echo Running backend tests...
call npm test
if %errorlevel% neq 0 (
    echo Backend tests failed!
    exit /b 1
)

echo Building backend...
call npm run build
if %errorlevel% neq 0 (
    echo Backend build failed!
    exit /b 1
)

cd ..

echo === Frontend Tests ===
cd frontend
echo Installing frontend dependencies...
call npm ci
if %errorlevel% neq 0 (
    echo Frontend dependency installation failed!
    exit /b 1
)

echo Running frontend tests...
call npm run test:ci
if %errorlevel% neq 0 (
    echo Frontend tests failed!
    exit /b 1
)

echo Running frontend linting...
call npm run lint
if %errorlevel% neq 0 (
    echo Frontend linting failed!
    exit /b 1
)

echo Building frontend...
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed!
    exit /b 1
)

cd ..

echo.
echo === CI Validation Complete ===
echo All tests and builds passed successfully!
echo The project is ready for CI/CD deployment.

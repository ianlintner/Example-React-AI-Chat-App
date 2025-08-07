@echo off
echo ====================================
echo    Agent Test Bench Demo Script
echo ====================================
echo.

echo This script demonstrates the comprehensive test bench system
echo that has been created for all agents and features.
echo.

echo Starting backend server...
start "Backend Server" cmd /k "cd backend && npm run dev"

echo Waiting for backend to start...
timeout /t 5

echo.
echo ====================================
echo    Available Test Endpoints
echo ====================================
echo.

echo 1. Individual Agent Testing:
echo    POST /api/test-bench/agent/{agentType}/test
echo.

echo 2. Bulk Agent Testing:
echo    POST /api/test-bench/bulk-test
echo.

echo 3. Message Classification:
echo    POST /api/test-bench/classifier/test
echo.

echo 4. RAG Service Testing:
echo    POST /api/test-bench/rag/test
echo.

echo 5. Response Validation:
echo    POST /api/test-bench/validator/test
echo.

echo 6. Joke Learning System:
echo    POST /api/test-bench/joke-learning/test
echo.

echo 7. Goal-Seeking System:
echo    POST /api/test-bench/goal-seeking/test
echo.

echo 8. Conversation Manager:
echo    POST /api/test-bench/conversation-manager/test
echo.

echo 9. Comprehensive System Test:
echo    POST /api/test-bench/comprehensive/test
echo.

echo 10. System Health Check:
echo     GET /api/test-bench/health
echo.

echo 11. Available Agents List:
echo     GET /api/test-bench/agents/list
echo.

echo ====================================
echo    Supported Agent Types (14 total)
echo ====================================
echo.

echo 1.  general - General assistant
echo 2.  joke - Adaptive joke master
echo 3.  trivia - Trivia and facts
echo 4.  gif - Visual content master
echo 5.  account_support - Account issues
echo 6.  billing_support - Billing and payments
echo 7.  website_support - Technical web support
echo 8.  operator_support - Customer service
echo 9.  hold_agent - Hold experience management
echo 10. story_teller - Creative storytelling
echo 11. riddle_master - Riddles and puzzles
echo 12. quote_master - Inspirational quotes
echo 13. game_host - Interactive games
echo 14. music_guru - Music recommendations
echo.

echo ====================================
echo    Testing the API
echo ====================================
echo.

echo Testing system health...
curl -s http://localhost:5001/api/test-bench/health | jq .
echo.

echo Testing joke agent...
curl -s -X POST http://localhost:5001/api/test-bench/agent/joke/test ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"Tell me a funny joke!\", \"userId\": \"demo-user\"}" | jq .
echo.

echo Testing message classification...
curl -s -X POST http://localhost:5001/api/test-bench/classifier/test ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"I need billing support\"}" | jq .
echo.

echo ====================================
echo    OpenAPI Documentation
echo ====================================
echo.

echo Interactive API Documentation available at:
echo http://localhost:5001/docs/api-docs
echo.
echo API Documentation Landing Page:
echo http://localhost:5001/docs
echo.
echo OpenAPI Specification:
echo - JSON: http://localhost:5001/docs/openapi.json
echo - YAML: http://localhost:5001/docs/openapi.yaml
echo.

echo ====================================
echo    Frontend Test Bench Interface
echo ====================================
echo.

echo Starting mobile app development server...
start "Mobile App Server" cmd /k "cd frontend && npm start"

echo.
echo Waiting for mobile app to start...
timeout /t 8

echo.
echo Mobile App Test Bench started...
echo Use Expo Go app to scan QR code and test on mobile device
echo.
echo The mobile app provides:
echo - Chat interface for testing agent interactions
echo - Validation dashboard for monitoring response quality
echo - Real-time communication with backend
echo - Native mobile experience for testing
echo - Dark/Light theme support
echo.

echo ====================================
echo    Documentation
echo ====================================
echo.

echo Complete documentation available at:
echo - docs/test-bench-system.md - Complete system overview
echo - docs/test-bench-openapi.yaml - OpenAPI 3.0 specification
echo - http://localhost:5001/docs - Interactive API docs
echo - API reference with examples and testing interface
echo - Integration guidelines and best practices
echo.

echo ====================================
echo    Demo Complete
echo ====================================
echo.

echo The comprehensive test bench system is now running!
echo.
echo Backend API: http://localhost:5001/api/test-bench
echo Mobile App: Use Expo Go to scan QR code
echo.
echo Features created:
echo ✓ 11 test endpoints for all system components
echo ✓ 14 agent types fully testable
echo ✓ Native mobile interface for testing
echo ✓ Real-time results and performance metrics
echo ✓ Validation dashboard with quality monitoring
echo ✓ System health monitoring
echo ✓ Complete documentation
echo.

pause

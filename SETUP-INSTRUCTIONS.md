# React AI Chat App - Setup Instructions

## What We've Done

✅ **Node.js & npm**: Already installed on your system
✅ **Environment Files**: Created with your OpenAI API key
✅ **Project Structure**: Ready to run
✅ **Batch Scripts**: Created for easy startup

## How to Run the App

### Option 1: Use the Automated Script (Recommended)
1. Double-click `run-app.bat` in the project folder
2. This will open a new Command Prompt and automatically:
   - Install all dependencies
   - Start the backend server (http://localhost:5000)
   - Start the mobile app (http://localhost:8081 for web, or use mobile device/emulator)

### Option 2: Manual Setup
If the automated script doesn't work:

1. **Open a NEW Command Prompt** (important - needs fresh PATH)
2. Navigate to the project folder
3. Install backend dependencies:
   ```
   cd backend
   npm install
   ```
4. Install frontend dependencies:
   ```
   cd ../frontend
   npm install
   ```
5. Start backend (in one terminal):
   ```
   cd backend
   npm run dev
   ```
6. Start frontend (in another terminal):
   ```
   cd frontend
   npm run dev
   ```

## Important Notes

- **Your OpenAI API key** is already configured in `backend/.env`
- The app uses **in-memory storage** (no database required)
- **Frontend**: http://localhost:8081 (Expo web) or use mobile device/emulator
- **Backend**: http://localhost:5001
- Both servers need to be running for the chat to work

## Troubleshooting

If you get "node is not recognized" errors:
1. Close all terminals/command prompts
2. Open a NEW Command Prompt (this picks up the updated PATH)
3. Try running the commands again

## Files Created

- `run-app.bat` - Main startup script
- `setup-and-run.bat` - Detailed setup and run script
- `backend/.env` - Backend configuration with your API key
- `frontend/.env` - Frontend configuration
- Various other helper scripts

The app should now be ready to use! 🚀

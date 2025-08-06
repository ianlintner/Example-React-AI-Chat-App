# AI Chat Application with Goal-Seeking System

A full-featured AI chat application with native mobile interface built using Expo/React Native, featuring OpenAI integration, and an intelligent goal-seeking system that proactively entertains users and provides technical support.

> **📱 Mobile-First**: Native React Native/Expo application with mobile-first design and cross-platform support.

## Features

- 📱 **Native mobile interface** with React Native/Expo
- 💬 Real-time chat interface with AI
- 📊 **AI Response Validation Dashboard** for monitoring quality
- 🎯 **Goal-Seeking System**: Proactive AI that entertains users while on hold and provides technical support
- 🤖 **Multi-Agent System**: Intelligent agent selection based on message content
  - Technical Agent: Specialized in programming and development
  - General Agent: Handles casual conversation and general questions
  - Dad Joke Master: Provides humor and entertainment
  - Trivia Master: Shares fascinating facts and educational content
  - GIF Agent: Provides visual entertainment
- 📊 **Smart User State Tracking**: Monitors engagement, satisfaction, and user preferences
- ⚡ **Proactive Actions**: System-initiated messages based on user needs and context
- 🗂️ Multiple conversation management
- 🌙 **Dark/Light theme support**
- 💾 Conversation persistence
- 🔄 Real-time updates with Socket.io
- 📝 Markdown rendering for AI responses
- ⚡ TypeScript for type safety
- 🔄 **Auto-reconnection** and offline resilience

## Project Structure

```
ai-chat-app/
├── frontend/          # 📱 React Native/Expo mobile application
├── backend/           # Node.js backend server with Express & Socket.io
├── shared/            # Shared types and utilities
└── README.md          # This file
```

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- OpenAI API key
- **For Mobile Development:**
  - Expo CLI: `npm install -g @expo/cli`
  - Expo Go app on your mobile device (for testing)
  - Optional: Android Studio or Xcode for simulators

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd ai-chat-app
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables:**
   
   **Backend (.env file in backend directory):**
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   MONGODB_URI=mongodb://localhost:27017/ai-chat
   JWT_SECRET=your_jwt_secret_here
   PORT=3001
   ```

   **Frontend (.env file in frontend directory):**
   ```
   EXPO_PUBLIC_API_URL=http://localhost:3001
   ```

5. **Run the application:**
   
   **Start the backend:**
   ```bash
   cd backend
   npm run dev
   ```

   **Start the frontend (in a new terminal):**
   ```bash
   cd frontend
   npm start
   ```

6. **Open the app:**
   - Scan the QR code with Expo Go app on your phone
   - Press 'i' for iOS simulator or 'a' for Android emulator
   - Press 'w' to open in web browser (for development)

## Usage

1. Open the app on your mobile device or simulator
2. **Chat Tab**: Start conversations with the AI assistant
3. **Dashboard Tab**: Monitor AI response validation and quality metrics
4. Type your message and send to begin chatting
5. The AI will respond in real-time with intelligent agent selection
6. Enjoy proactive entertainment and support features
7. Switch between light and dark themes automatically based on device settings

## API Endpoints

- `POST /api/chat` - Send a message to the AI
- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Create a new conversation
- `DELETE /api/conversations/:id` - Delete a conversation

## Technologies Used

### Frontend (Mobile Application)
- React Native with Expo
- TypeScript
- Expo Router for navigation
- Socket.io-client for real-time communication
- React Native Paper for UI components
- Native gestures and interactions
- Automatic theme detection (light/dark)
- Cross-platform support (iOS, Android, Web)

### Backend
- Node.js with Express
- TypeScript
- Socket.io for real-time communication
- OpenAI API integration
- Response validation system
- Goal-seeking and proactive messaging
- Multi-agent architecture with intelligent routing
- Prometheus metrics and observability

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

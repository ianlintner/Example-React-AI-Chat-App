# AI Chat Application with Goal-Seeking System

A full-featured AI chat application with native mobile interface built using Expo/React Native, featuring OpenAI integration, and an intelligent goal-seeking system that proactively entertains users and provides technical support.

> **📱 Mobile-First**: The mobile app is now the primary interface. The web frontend is deprecated.

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
├── mobile-app/        # 📱 PRIMARY: React Native/Expo mobile app
├── backend/           # Node.js backend server
├── frontend/          # ⚠️ DEPRECATED: React web frontend 
├── shared/            # Shared types and utilities
└── README.md         # This file
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

3. **Install mobile app dependencies:**
   ```bash
   cd ../mobile-app
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

   **Mobile App (.env file in mobile-app directory):**
   ```
   EXPO_PUBLIC_API_URL=http://localhost:3001
   ```

5. **Run the application:**
   
   **Start the backend:**
   ```bash
   cd backend
   npm run dev
   ```

   **Start the mobile app (in a new terminal):**
   ```bash
   cd mobile-app
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

### Mobile App (Primary Interface)
- React Native with Expo
- TypeScript
- Expo Router for navigation
- Socket.io-client for real-time communication
- Native components and styling
- Pull-to-refresh and native interactions
- Automatic theme detection (light/dark)

### Backend
- Node.js
- Express
- TypeScript
- Socket.io
- OpenAI API
- Validation system for AI responses
- Goal-seeking and proactive messaging
- Multi-agent architecture

### Web Frontend (Deprecated)
- React 18
- Material-UI v5
- Socket.io-client
- **⚠️ No longer maintained**

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

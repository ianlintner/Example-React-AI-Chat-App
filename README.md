# AI Chat Application

A full-featured AI chat application built with React and Node.js, featuring a modern Material-UI interface and OpenAI integration.

## Features

- 💬 Real-time chat interface with AI
- 🗂️ Multiple conversation management
- 🎨 Material-UI design with dark/light theme
- 📱 Responsive design
- 💾 Conversation persistence
- 🔄 Real-time updates with Socket.io
- 📝 Markdown rendering for AI responses
- ⚡ TypeScript for type safety

## Project Structure

```
ai-chat-app/
├── frontend/          # React frontend with Material-UI
├── backend/           # Node.js BFF server
├── shared/            # Shared types and utilities
└── README.md         # This file
```

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

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
   Create a `.env` file in the backend directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   MONGODB_URI=mongodb://localhost:27017/ai-chat
   JWT_SECRET=your_jwt_secret_here
   PORT=5525
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
   npm run dev
   ```

6. **Open your browser and navigate to:**
   ```
   http://localhost:5173
   ```

## Usage

1. Start a new conversation by clicking the "New Chat" button
2. Type your message in the input field
3. Press Enter or click the send button
4. The AI will respond in real-time
5. Use the sidebar to manage multiple conversations
6. Toggle between light and dark themes

## API Endpoints

- `POST /api/chat` - Send a message to the AI
- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Create a new conversation
- `DELETE /api/conversations/:id` - Delete a conversation

## Technologies Used

### Frontend
- React 18
- TypeScript
- Material-UI v5
- Socket.io-client
- React Router
- Axios

### Backend
- Node.js
- Express
- TypeScript
- Socket.io
- OpenAI API
- MongoDB/Mongoose
- JWT Authentication

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

# AI Chat Application Documentation

Welcome to the comprehensive documentation for the AI Chat Application. This documentation covers all aspects of the application, from setup and development to architecture and deployment.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Documentation Structure](#documentation-structure)
4. [Getting Help](#getting-help)

## Overview

The AI Chat Application is a full-featured real-time chat application that integrates with OpenAI's GPT models. It provides a modern, responsive interface for conversing with AI assistants while maintaining conversation history and supporting multiple concurrent conversations.

### Key Features

- 💬 Real-time chat interface with AI
- 🗂️ Multiple conversation management
- 🎨 Material-UI design with dark/light theme
- 📱 Responsive design for mobile and desktop
- 💾 Persistent conversation storage
- 🔄 Real-time updates with Socket.io
- 📝 Markdown rendering for AI responses
- ⚡ Full TypeScript support
- 🔐 JWT-based authentication
- 🚀 Modern React 19 with Vite

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd ai-chat-app

# Install dependencies for both frontend and backend
cd backend && npm install
cd ../frontend && npm install

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start the application
cd backend && npm run dev    # Terminal 1
cd frontend && npm run dev   # Terminal 2
```

## Documentation Structure

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System architecture and design patterns |
| [API Documentation](./api.md) | REST API endpoints and WebSocket events |
| [Frontend Guide](./frontend.md) | React components and client-side architecture |
| [Backend Guide](./backend.md) | Server architecture and middleware |
| [Development](./development.md) | Development setup and workflows |
| [Deployment](./deployment.md) | Production deployment guide |
| [Testing](./testing.md) | Testing strategies and examples |
| [Troubleshooting](./troubleshooting.md) | Common issues and solutions |

## Getting Help

- **Issues**: Report bugs and feature requests via GitHub issues
- **Documentation**: Check the relevant documentation section
- **Code Examples**: See the `/examples` directory for usage examples
- **Architecture**: Review the architecture documentation for design decisions

## Technology Stack

### Frontend
- **React 19** - Modern React with latest features
- **TypeScript** - Type safety and better developer experience
- **Material-UI v7** - Comprehensive component library
- **Vite** - Fast build tool and development server
- **Socket.io Client** - Real-time communication
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **React Markdown** - Markdown rendering

### Backend
- **Node.js** - JavaScript runtime
- **Express 5** - Web framework
- **TypeScript** - Type safety
- **Socket.io** - Real-time WebSocket communication
- **MongoDB/Mongoose** - Database and ODM
- **OpenAI API** - AI model integration
- **JWT** - Authentication
- **bcrypt** - Password hashing

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Nodemon** - Development server auto-reload
- **TypeScript Compiler** - Type checking and compilation

## Project Structure

```
ai-chat-app/
├── docs/                 # Documentation
├── frontend/             # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API services
│   │   ├── theme/        # Material-UI theme
│   │   └── types.ts      # TypeScript types
│   ├── package.json
│   └── vite.config.ts
├── backend/              # Node.js backend
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── socket/       # WebSocket handlers
│   │   ├── storage/      # Data storage
│   │   └── index.ts      # Main server file
│   ├── package.json
│   └── tsconfig.json
├── shared/               # Shared types and utilities
│   └── types.ts
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the development guide
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

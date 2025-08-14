# Agentic Backend System

## Overview

The backend now features an intelligent agentic system that automatically routes user messages to specialized AI agents based on the content and context of their requests.

## Architecture

### Agent Types

The system includes two specialized agents:

1. **Technical Agent** (`⚙️ Technical Agent`)
   - Specializes in programming, software development, debugging, and technical questions
   - Uses lower temperature (0.3) for more precise, factual responses
   - Handles: code writing, debugging, technical documentation, system administration, databases, APIs, frameworks, etc.

2. **General Agent** (`💬 General Agent`)
   - Handles casual conversation, general questions, creative tasks, and everyday assistance
   - Uses higher temperature (0.7) for more creative, conversational responses
   - Handles: general knowledge, advice, creative writing, entertainment, non-technical topics

### Components

#### Message Classification (`backend/src/agents/classifier.ts`)

- Uses OpenAI API to intelligently classify incoming messages
- Falls back to keyword-based classification when API is unavailable
- Returns confidence scores for classification accuracy
- Analyzes message content to determine appropriate agent type

#### Agent Configuration (`backend/src/agents/config.ts`)

- Defines agent personalities, system prompts, and parameters
- Configures model settings (temperature, max tokens, etc.)
- Contains specialized prompts for each agent type

#### Agent Service (`backend/src/agents/agentService.ts`)

- Main orchestrator that processes messages through the appropriate agent
- Handles conversation history and context
- Supports forced agent selection for specific use cases
- Provides demo responses when API key is not available

## API Updates

### Enhanced Types

```typescript
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
  agentUsed?: 'technical' | 'general'; // New
  confidence?: number; // New
}

interface ChatRequest {
  message: string;
  conversationId?: string;
  stream?: boolean;
  forceAgent?: 'technical' | 'general'; // New
}

interface ChatResponse {
  message: Message;
  conversation: Conversation;
  agentUsed: 'technical' | 'general'; // New
  confidence: number; // New
}
```

### New Endpoints

- `GET /api/chat/agents` - Returns available agents and their descriptions

## Frontend Integration

### Message Display

- Messages now show which agent responded with visual indicators
- Confidence scores are displayed for transparency
- Different styling for technical vs general agent responses

### Agent Selection

- Users can optionally force a specific agent for their query
- Automatic classification happens by default
- Visual feedback shows which agent is being used

## Usage Examples

### Technical Questions

```
Input: "How do I fix this React component error?"
→ Routes to Technical Agent (⚙️)
→ Provides code examples and debugging steps
```

### General Questions

```
Input: "What's a good recipe for dinner?"
→ Routes to General Agent (💬)
→ Provides friendly, conversational cooking advice
```

### Classification Examples

**Technical Keywords Detected:**

- code, programming, debug, error, bug, api, database
- javascript, python, react, node, css, html
- function, variable, array, object, class, method
- framework, library, algorithm, deployment, git
- docker, kubernetes, aws, testing, ci/cd

**General Topics:**

- Casual conversation, creative writing, general knowledge
- Advice, recommendations, entertainment
- Non-technical questions and everyday assistance

## Benefits

1. **Specialized Responses**: Each agent is optimized for its domain
2. **Improved Accuracy**: Technical questions get technical responses
3. **Better User Experience**: Appropriate tone and style for each query type
4. **Transparency**: Users see which agent responded and confidence levels
5. **Flexibility**: Support for forced agent selection when needed

## Demo Mode

When no OpenAI API key is provided, the system operates in demo mode:

- Still classifies messages using keyword matching
- Provides simulated responses showing agent functionality
- Maintains all UI features and agent selection

## Single-Agent Control System

The system now implements single-agent control to ensure only one agent is active and talking at a time per user:

### How It Works

1. **Agent Activity Tracking**: Each user has their active agent tracked with timestamps
2. **Proactive Action Filtering**: Only one proactive action is executed at a time
3. **Action Queuing**: Additional proactive actions are queued when an agent is already active
4. **Sequential Processing**: Queued actions are processed after the current action completes

### Benefits

- **Prevents Agent Conflicts**: No multiple agents responding simultaneously
- **Maintains Conversation Flow**: Ensures coherent, single-threaded conversations
- **Reduces Confusion**: Users receive responses from one agent at a time
- **Preserves Context**: Maintains conversation context without interruption

### Implementation Details

- **30-Second Activity Window**: Agents are considered active for 30 seconds after their last response
- **Priority-Based Selection**: Higher priority actions (technical > entertainment > engagement) are processed first
- **Automatic Queuing**: Conflicting actions are automatically queued for later processing
- **Error Handling**: Graceful handling of agent conflicts with automatic retry

### Logging

The system provides detailed logging for debugging:

- `🎯` - Goal-seeking system actions
- `🚫` - Agent conflicts and filtering
- `⏳` - Queued actions
- `✅` - Successfully completed actions

## Future Enhancements

- Additional specialized agents (e.g., creative writing, data analysis)
- Dynamic agent selection based on conversation context
- Agent performance metrics and optimization
- Multi-agent collaboration for complex queries
- Enhanced priority-based action scheduling

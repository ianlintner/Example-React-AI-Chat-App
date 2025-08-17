# Goal-Seeking System Documentation

## Overview

The Goal-Seeking System is an intelligent, proactive chat assistant that dynamically adapts to user needs by pursuing specific goals. It's designed to entertain users while they're on hold and provide technical support when needed.

## Key Features

### 🎯 Goal-Driven Behavior

- **Entertainment Goals**: Keeps users engaged with jokes, trivia, and conversation while waiting
- **Technical Support Goals**: Provides comprehensive technical assistance for programming and development questions
- **Engagement Goals**: Maintains active conversation and prevents user abandonment

### 🧠 Intelligent Agent Selection

- **Technical Agent**: Specialized in programming, debugging, and technical problem-solving
- **Dad Joke Master**: Provides groan-worthy dad jokes and puns
- **Trivia Master**: Shares fascinating facts and educational content
- **General Agent**: Handles casual conversation and general assistance

### 🔄 Proactive Actions

- **Immediate Actions**: Instant responses to user state changes
- **Delayed Actions**: Scheduled interventions (e.g., checking in after inactivity)
- **Context-Aware**: Actions based on user preferences and current situation

## Architecture

### Core Components

#### 1. GoalSeekingSystem (`goalSeekingSystem.ts`)

The central orchestrator that manages user states and goal progression.

**Key Classes:**

- `GoalSeekingSystem`: Main system coordinator
- `UserState`: Tracks user context and preferences
- `Goal`: Defines objectives and success criteria
- `GoalAction`: Represents proactive interventions

#### 2. AgentService (`agentService.ts`)

Enhanced agent service with goal-seeking integration.

**Key Methods:**

- `processMessageWithGoalSeeking()`: Processes messages with goal awareness
- `executeProactiveAction()`: Executes system-generated actions
- `getUserGoalState()`: Retrieves user's current goal state

#### 3. Socket Integration (`socketHandlers.ts`)

Real-time communication with proactive message delivery.

**New Events:**

- `proactive_message`: Delivers system-initiated messages
- `proactive_error`: Handles proactive action failures

## User States

### Current State Types

- `on_hold`: User is waiting for support
- `waiting_for_help`: User has a specific problem to solve
- `active_conversation`: User is actively engaged
- `idle`: User is present but not actively communicating

### Entertainment Preferences

- `jokes`: Prefers humor and dad jokes
- `trivia`: Enjoys facts and educational content
- `general_chat`: Likes casual conversation
- `mixed`: Rotates between different entertainment types

### Metrics

- **Engagement Level** (0-1): How actively the user is participating
- **Satisfaction Level** (0-1): User's apparent satisfaction with responses
- **Technical Context**: Extracted technical information from messages

## Goal Types

### 1. Entertainment Goals

**Purpose**: Keep users entertained while waiting

**Activation Triggers:**

- User state is `on_hold`
- Engagement level < 0.6
- User mentions waiting, queue, or hold

**Success Criteria:**

- User responds positively to entertainment
- Engagement level > 0.7
- User remains in conversation

**Example Actions:**

```typescript
{
  type: 'proactive_message',
  agentType: 'dad_joke',
  message: "Time for a dad joke to brighten your wait!",
  timing: 'immediate'
}
```

### 2. Technical Support Goals

**Purpose**: Provide effective technical assistance

**Activation Triggers:**

- User state is `waiting_for_help`
- Technical context is detected
- User mentions code, error, bug, programming

**Success Criteria:**

- User problem is resolved
- Technical accuracy is maintained
- User satisfaction > 0.8

**Example Actions:**

```typescript
{
  type: 'technical_check',
  agentType: 'technical',
  message: "I'm here to help with your technical question. What specific issue can I assist you with?",
  timing: 'immediate'
}
```

### 3. Engagement Goals

**Purpose**: Maintain user engagement and prevent abandonment

**Activation Triggers:**

- Engagement level < 0.5
- Time since last interaction > 30 seconds
- User gives short responses

**Success Criteria:**

- User continues conversation
- Response time < 5 minutes
- User asks follow-up questions

**Example Actions:**

```typescript
{
  type: 'entertainment_offer',
  agentType: 'general',
  message: "Would you like me to entertain you with a joke, share some trivia, or help with a technical question?",
  timing: 'delayed',
  delayMs: 30000
}
```

## Implementation Details

### Message Processing Flow

1. **User Message Received**
   - Initialize user in goal-seeking system
   - Update user state based on message content
   - Activate relevant goals

2. **Agent Selection**
   - Process message with appropriate agent
   - Consider goal priorities and user preferences
   - Generate response with confidence scoring

3. **Goal Progress Update**
   - Analyze user response for satisfaction indicators
   - Update goal progress and user metrics
   - Adjust engagement and satisfaction levels

4. **Proactive Action Generation**
   - Generate actions based on active goals
   - Prioritize by goal importance and user needs
   - Schedule immediate or delayed execution

### Proactive Action Execution

```typescript
const executeProactiveAction = async (action: GoalAction, conversation: Conversation, socket: any, io: Server) => {
  // Execute action using agent service
  const response = await agentService.executeProactiveAction(userId, action, conversation.messages);

  // Create proactive message
  const proactiveMessage: Message = {
    // ... message properties
    isProactive: true, // Mark as system-initiated
  };

  // Emit to conversation
  io.to(conversationId).emit('proactive_message', {
    message: proactiveMessage,
    actionType: action.type,
    agentUsed: response.agentUsed,
  });
};
```

## Usage Examples

### Example 1: User Waiting for Support

```
User: "I'm waiting for support"
System: Activates entertainment goal
Agent: "I noticed you might be waiting - how about a dad joke to pass the time?"
Proactive Action: Offers entertainment options after 30 seconds
```

### Example 2: Technical Question

```
User: "I have a JavaScript error in my code"
System: Activates technical support goal
Agent: "I can help you with that JavaScript error. Can you share the error message?"
Proactive Action: Follows up if user doesn't respond within 2 minutes
```

### Example 3: Low Engagement

```
System: Detects user giving short responses
Goal: Engagement goal activates
Proactive Action: "Is there anything specific I can help you with today?"
```

## Frontend Integration

### Visual Indicators

- **Proactive Message Badge**: Messages initiated by the system show a "🎯 Proactive" badge
- **Agent Indicators**: Clear visual distinction between different agent types
- **Confidence Scoring**: Shows AI confidence levels for transparency

### Real-time Updates

- Proactive messages appear automatically
- Smooth integration with existing chat flow
- Error handling for failed proactive actions

## Configuration

### Goal Templates

Goals are defined with:

- `type`: Category of goal
- `priority`: Numerical priority (1-10)
- `success_criteria`: Array of success conditions
- `description`: Human-readable description

### User Cleanup

Inactive users are automatically cleaned up after 1 hour of inactivity to prevent memory leaks.

## Performance Considerations

### Memory Management

- User states are stored in-memory for fast access
- Automatic cleanup of inactive users
- Goal progress tracking is lightweight

### Scalability

- Stateless goal execution
- Efficient user state updates
- Minimal database impact

## Future Enhancements

1. **Machine Learning Integration**
   - Learn from user preferences over time
   - Predict optimal entertainment types
   - Improve goal success rates

2. **Advanced Scheduling**
   - More sophisticated timing algorithms
   - Context-aware scheduling
   - Priority-based action queuing

3. **Analytics Dashboard**
   - Goal success metrics
   - User satisfaction tracking
   - Agent performance analytics

4. **Custom Goal Types**
   - User-defined goals
   - Business-specific objectives
   - Dynamic goal creation

## Testing

### Demo Script

Run the demo to see the goal-seeking system in action:

```bash
cd backend
npm run demo:goals  # If script is added to package.json
# OR
npx ts-node src/demo/goalSeekingDemo.ts
```

### Testing Scenarios

1. **On-Hold Experience**: User says "I'm waiting"
2. **Technical Support**: User asks programming questions
3. **Entertainment Preferences**: User requests jokes or trivia
4. **Engagement Recovery**: User becomes less responsive

## Conclusion

The Goal-Seeking System transforms the chat experience from reactive to proactive, ensuring users are entertained while waiting and receive comprehensive technical support when needed. By intelligently managing multiple goals and adapting to user behavior, it creates a more engaging and effective chat assistant.

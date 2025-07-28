# Agent Test Bench System

## Overview

The Agent Test Bench System provides comprehensive testing capabilities for all AI agents and system features. It includes both API endpoints for programmatic testing and a developer-friendly web interface.

## Backend API Endpoints

All test bench endpoints are prefixed with `/api/test-bench`:

### Agent Testing

#### Test Individual Agent
- **Endpoint**: `POST /api/test-bench/agent/{agentType}/test`
- **Purpose**: Test a specific agent with a custom message
- **Request Body**:
  ```json
  {
    "message": "Hello, how are you?",
    "conversationHistory": [],
    "userId": "test-user"
  }
  ```

#### Bulk Test All Agents
- **Endpoint**: `POST /api/test-bench/bulk-test`
- **Purpose**: Test all agents with the same message
- **Request Body**:
  ```json
  {
    "message": "Tell me a joke",
    "agentTypes": ["joke", "general", "trivia"],
    "userId": "test-user"
  }
  ```

### Feature Testing

#### Message Classification
- **Endpoint**: `POST /api/test-bench/classifier/test`
- **Purpose**: Test message classification system
- **Request Body**:
  ```json
  {
    "message": "I need billing support"
  }
  ```

#### RAG Service
- **Endpoint**: `POST /api/test-bench/rag/test`
- **Purpose**: Test RAG (Retrieval-Augmented Generation) service
- **Request Body**:
  ```json
  {
    "agentType": "joke",
    "query": "dad jokes",
    "useFullSearch": false
  }
  ```

#### Response Validation
- **Endpoint**: `POST /api/test-bench/validator/test`
- **Purpose**: Test response validation system
- **Request Body**:
  ```json
  {
    "agentType": "joke",
    "userMessage": "Tell me a joke",
    "agentResponse": "Why did the chicken cross the road?",
    "conversationId": "test-conversation",
    "userId": "test-user",
    "isProactive": false
  }
  ```

#### Joke Learning System
- **Endpoint**: `POST /api/test-bench/joke-learning/test`
- **Purpose**: Test adaptive joke learning system
- **Request Body**:
  ```json
  {
    "userId": "test-user",
    "action": "record-reaction",
    "jokeId": "joke-123",
    "reactionType": "laugh",
    "jokeCategory": "dad_jokes",
    "jokeType": "pun"
  }
  ```

#### Goal-Seeking System
- **Endpoint**: `POST /api/test-bench/goal-seeking/test`
- **Purpose**: Test proactive goal-seeking behavior
- **Request Body**:
  ```json
  {
    "userId": "test-user",
    "action": "update-state",
    "message": "I'm having billing issues"
  }
  ```

#### Conversation Manager
- **Endpoint**: `POST /api/test-bench/conversation-manager/test`
- **Purpose**: Test conversation flow and agent handoffs
- **Request Body**:
  ```json
  {
    "userId": "test-user",
    "action": "process-message",
    "message": "Hello there!"
  }
  ```

#### Comprehensive System Test
- **Endpoint**: `POST /api/test-bench/comprehensive/test`
- **Purpose**: Test full system integration (goal-seeking + conversation management)
- **Request Body**:
  ```json
  {
    "userId": "test-user",
    "message": "I need entertainment while I wait",
    "conversationHistory": [],
    "forcedAgentType": "joke"
  }
  ```

### System Information

#### Get Available Agents
- **Endpoint**: `GET /api/test-bench/agents/list`
- **Purpose**: Retrieve list of all available agents
- **Response**: Returns agent metadata including names and descriptions

#### System Health Check
- **Endpoint**: `GET /api/test-bench/health`
- **Purpose**: Check health status of all system components
- **Response**: Returns operational status of each service

## Agent Types

The system supports the following 14 agent types:

1. **general** - General assistant for casual conversation and everyday tasks
2. **joke** - Adaptive joke master with learning capabilities
3. **trivia** - Trivia master for fascinating facts and knowledge
4. **gif** - GIF master for entertaining visual content
5. **account_support** - Account-related issues and authentication
6. **billing_support** - Billing, payments, and financial matters
7. **website_support** - Website functionality and technical issues
8. **operator_support** - General customer service coordination
9. **hold_agent** - Hold experience management with entertainment
10. **story_teller** - Creative storytelling and narratives
11. **riddle_master** - Riddles, puzzles, and brain teasers
12. **quote_master** - Inspirational quotes and wisdom
13. **game_host** - Interactive games and challenges
14. **music_guru** - Music recommendations and discussions

## Frontend Test Bench Interface

The Developer Test Bench provides a comprehensive web interface for testing all system components:

### Features

- **Tabbed Interface**: Organized testing panels for different system components
- **Real-time Results**: Live feedback with success/failure indicators
- **Execution Timing**: Performance metrics for each test
- **Result Export**: Download test results as JSON for analysis
- **System Health Dashboard**: Monitor component operational status
- **Agent Directory**: View all available agents and their capabilities

### Usage

1. **Access**: Navigate to the test bench interface in your development environment
2. **Select Test Type**: Choose from agent testing, classifier, system health, etc.
3. **Configure Test**: Set parameters like agent type, message, user ID
4. **Execute**: Run individual tests or bulk tests across all agents
5. **Review Results**: View detailed response data and execution metrics
6. **Export Data**: Download results for further analysis

### Test Categories

#### Agent Testing Tab
- Test individual agents with custom messages
- Bulk test all agents simultaneously
- Configure user ID and conversation history
- View agent-specific responses and confidence levels

#### Classifier Tab
- Test message classification accuracy
- See which agent type is selected for different messages
- View classification confidence and reasoning

#### System Health Tab
- Monitor operational status of all services
- View OpenAI API key configuration status
- Browse available agents and their descriptions
- Check system component health indicators

## Testing Best Practices

### 1. Agent Response Testing
```bash
# Test joke agent
curl -X POST http://localhost:5001/api/test-bench/agent/joke/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me a funny joke", "userId": "test-user"}'
```

### 2. Classification Testing
```bash
# Test message classification
curl -X POST http://localhost:5001/api/test-bench/classifier/test \
  -H "Content-Type: application/json" \
  -d '{"message": "I need help with my billing account"}'
```

### 3. System Health Check
```bash
# Check system health
curl -X GET http://localhost:5001/api/test-bench/health
```

### 4. Bulk Agent Testing
```bash
# Test all agents with same message
curl -X POST http://localhost:5001/api/test-bench/bulk-test \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how can you help me?", "userId": "test-user"}'
```

## Integration with CI/CD

The test bench can be integrated into continuous integration pipelines:

### Example Test Script
```javascript
// test-agents.js
const testAllAgents = async () => {
  const agents = ['general', 'joke', 'trivia', 'gif'];
  const results = [];
  
  for (const agent of agents) {
    const response = await fetch(`/api/test-bench/agent/${agent}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello, test message',
        userId: 'ci-test-user'
      })
    });
    
    const result = await response.json();
    results.push({ agent, success: result.success });
  }
  
  return results;
};
```

## Error Handling

All test endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "details": "Additional error details",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Performance Monitoring

The test bench tracks:
- Response times for each endpoint
- Success/failure rates
- Agent performance comparisons
- System resource utilization
- Error frequency and types

## Security Considerations

- Test endpoints are intended for development environments
- Production deployments should disable or restrict access
- Test data should not contain sensitive information
- User IDs in tests should be clearly marked as test accounts

## Development Workflow

1. **Feature Development**: Use individual agent tests during feature development
2. **Integration Testing**: Use comprehensive tests for full system validation
3. **Performance Testing**: Use bulk tests to identify performance bottlenecks
4. **Regression Testing**: Use automated test suites for continuous validation
5. **Debugging**: Use detailed test results to diagnose issues

This test bench system provides comprehensive coverage for all AI agents and system features, enabling developers to validate functionality, performance, and integration across the entire platform.

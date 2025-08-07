# Message Queue System

A flexible and scalable message queue system for the backend that supports both local testing (in-memory) and distributed deployments (Redis).

## Overview

The message queue system provides:

- **Flexible Backend**: Switch between in-memory (local testing) and Redis (distributed) providers
- **Priority Queuing**: Messages processed by priority (1-10, higher = more important)
- **Delayed Messages**: Schedule messages for future processing
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Handle permanently failed messages
- **Real-time Stats**: Monitor queue performance and health
- **Type Safety**: Full TypeScript support with typed payloads

## Quick Start

### Environment Configuration

Set the message queue provider in your `.env` file:

```bash
# Use in-memory provider (default - good for local testing)
MESSAGE_QUEUE_PROVIDER=memory

# Use Redis provider (for distributed systems)
MESSAGE_QUEUE_PROVIDER=redis
REDIS_URL=redis://localhost:6379
```

### Basic Usage

The system is automatically initialized when the server starts. You can interact with it through:

1. **Programmatically** - Using the `QueueService` in your code
2. **REST API** - Via HTTP endpoints for monitoring and testing
3. **Socket Events** - Automatic processing of queued messages

## API Endpoints

### Health & Monitoring

```bash
# Check queue health
GET /api/queue/health

# Get queue statistics
GET /api/queue/stats
GET /api/queue/stats?queueName=chat_messages

# Get queue size
GET /api/queue/size/chat_messages
```

### Message Operations

```bash
# Enqueue a chat message
POST /api/queue/enqueue/chat
{
  "userId": "user123",
  "conversationId": "conv456",
  "message": "Hello world!",
  "priority": 7
}

# Enqueue a proactive action
POST /api/queue/enqueue/proactive
{
  "actionType": "greeting",
  "agentType": "general",
  "message": "Welcome!",
  "userId": "user123",
  "conversationId": "conv456",
  "timing": "immediate",
  "priority": 8
}

# Demonstrate queue features
POST /api/queue/demo
{
  "userId": "user123",
  "conversationId": "conv456"
}
```

### Management Operations

```bash
# Purge a queue (remove all messages)
DELETE /api/queue/purge/chat_messages
```

## Queue Types

The system supports these pre-defined queues:

- `chat_messages` - User chat messages awaiting processing
- `agent_responses` - AI agent responses ready to send
- `proactive_actions` - Proactive actions triggered by goal-seeking
- `stream_chunks` - Real-time streaming message chunks
- `status_updates` - System status and agent state updates
- `validation_requests` - Message validation requests
- `goal_seeking_updates` - Goal-seeking system state changes
- `conversation_events` - Conversation lifecycle events

## Message Priority System

Messages are processed by priority (1-10):

- **Priority 10**: Critical system messages
- **Priority 9**: High-priority proactive actions
- **Priority 8**: Stream chunks (real-time feel)
- **Priority 7**: Proactive actions
- **Priority 6**: Agent responses
- **Priority 5**: Normal chat messages (default)
- **Priority 1-4**: Low priority background tasks

## Programmatic Usage

### Using QueueService

```typescript
import { getQueueService } from '../messageQueue/queueService';

// Get the queue service instance
const queueService = getQueueService();

// Enqueue a chat message
const messageId = await queueService.enqueueChatMessage(
  'user123',           // userId
  'conv456',          // conversationId
  'Hello!',           // message
  undefined,          // forceAgent (optional)
  7                   // priority (optional)
);

// Enqueue a delayed proactive action
const actionId = await queueService.enqueueProactiveAction(
  'reminder',         // actionType
  'general',          // agentType
  'Don\'t forget!',   // message
  'user123',          // userId
  'conv456',          // conversationId
  'delayed',          // timing
  5000,               // delayMs (5 seconds)
  8                   // priority
);

// Check queue stats
const stats = await queueService.getQueueStats();
console.log(`Total messages processed: ${stats.totalMessages}`);
```

### Creating Custom Queue Messages

```typescript
import { createMessageQueue, QUEUE_NAMES } from '../messageQueue/messageQueue';

const queue = createMessageQueue();

// Create a custom message
const customMessage = queue.createMessage(
  'custom_event',
  {
    eventType: 'user_login',
    userId: 'user123',
    timestamp: new Date()
  },
  {
    priority: 6,
    maxRetries: 5,
    userId: 'user123'
  }
);

// Enqueue the message
await queue.enqueue('custom_queue', customMessage);
```

## Provider Comparison

### In-Memory Provider
- **Best for**: Local development, testing, single-instance deployments
- **Pros**: No external dependencies, fast, simple setup
- **Cons**: Messages lost on restart, no persistence, single-instance only

### Redis Provider
- **Best for**: Production, distributed systems, high availability
- **Pros**: Persistent, scalable, supports multiple instances
- **Cons**: Requires Redis server, additional complexity

## Configuration Examples

### Local Development Setup

```bash
# .env file
MESSAGE_QUEUE_PROVIDER=memory
```

### Production Redis Setup

```bash
# .env file
MESSAGE_QUEUE_PROVIDER=redis
REDIS_URL=redis://your-redis-server:6379

# For Redis with auth
REDIS_URL=redis://:password@your-redis-server:6379

# For Redis Cluster
REDIS_URL=redis://node1:6379,redis://node2:6379,redis://node3:6379
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - MESSAGE_QUEUE_PROVIDER=redis
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

## Monitoring & Observability

### Health Checks

```bash
# Basic health check
curl http://localhost:5001/api/queue/health

# Response
{
  "healthy": true,
  "provider": "memory",
  "timestamp": "2025-01-06T20:10:00.000Z"
}
```

### Queue Statistics

```bash
# Get all queue stats
curl http://localhost:5001/api/queue/stats

# Response
{
  "totalMessages": 150,
  "pendingMessages": 5,
  "processingMessages": 2,
  "completedMessages": 140,
  "failedMessages": 3,
  "avgProcessingTime": 45.2,
  "queues": ["chat_messages", "agent_responses", "proactive_actions"],
  "provider": "memory",
  "healthy": true
}
```

### Real-time Socket Events

The system emits processed messages via Socket.IO:

```javascript
// Frontend - Listen for processed queue events
socket.on('queue_processed_chat', (data) => {
  console.log('Chat message processed:', data);
});

socket.on('queue_processed_agent_response', (data) => {
  console.log('Agent response processed:', data);
});

socket.on('queue_processed_proactive_action', (data) => {
  console.log('Proactive action processed:', data);
});
```

## Error Handling

### Retry Logic

Messages automatically retry with exponential backoff:
- **Attempt 1**: Immediate
- **Attempt 2**: 1 second delay
- **Attempt 3**: 2 second delay
- **Attempt 4**: 4 second delay (capped at 30 seconds)

### Dead Letter Queue

Failed messages emit a `deadLetter` event:

```typescript
queueService.messageQueue.on('deadLetter', ({ queueName, message, error }) => {
  console.error(`Dead letter in ${queueName}:`, message.id, error);
  
  // Send to monitoring system
  // Log to file
  // Send alert
});
```

## Testing

### Unit Tests

```typescript
import { createInMemoryQueue } from '../messageQueue/messageQueue';

describe('Message Queue', () => {
  test('should process messages by priority', async () => {
    const queue = createInMemoryQueue();
    await queue.connect();
    
    // Test priority ordering
    const highPriorityMsg = queue.createMessage('test', { data: 'high' }, { priority: 9 });
    const lowPriorityMsg = queue.createMessage('test', { data: 'low' }, { priority: 3 });
    
    await queue.enqueue('test_queue', lowPriorityMsg);
    await queue.enqueue('test_queue', highPriorityMsg);
    
    const firstMsg = await queue.dequeue('test_queue');
    expect(firstMsg?.payload.data).toBe('high');
  });
});
```

### Integration Tests

```bash
# Test the REST API
curl -X POST http://localhost:5001/api/queue/demo \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "conversationId": "test"}'

# Check the results
curl http://localhost:5001/api/queue/stats
```

## Best Practices

### Queue Design
- Use appropriate priorities (don't overuse high priority)
- Keep message payloads small and focused
- Use delayed messages for scheduled actions
- Set appropriate retry limits

### Error Handling
- Always handle dead letter queue events
- Log queue statistics regularly
- Monitor queue sizes to prevent backlog
- Set up alerts for queue health

### Performance
- Use Redis for high-throughput scenarios
- Monitor average processing times
- Scale consumers horizontally when needed
- Use message batching for bulk operations

### Security
- Validate message payloads
- Sanitize user data before queueing
- Use authentication for queue management endpoints
- Monitor for message queue flooding

## Troubleshooting

### Common Issues

**Queue not processing messages:**
- Check if queue service is initialized
- Verify subscribers are set up
- Check for errors in message handlers

**High memory usage with in-memory provider:**
- Check queue sizes with `/api/queue/stats`
- Purge unnecessary queues
- Consider switching to Redis

**Redis connection issues:**
- Verify Redis server is running
- Check REDIS_URL configuration
- Ensure network connectivity

**Messages failing repeatedly:**
- Check dead letter queue events
- Verify message handler logic
- Review retry configuration

### Debugging Commands

```bash
# Check queue health
curl http://localhost:5001/api/queue/health

# View queue statistics
curl http://localhost:5001/api/queue/stats

# Check specific queue size
curl http://localhost:5001/api/queue/size/chat_messages

# Test with demo messages
curl -X POST http://localhost:5001/api/queue/demo \
  -H "Content-Type: application/json" \
  -d '{"userId": "debug", "conversationId": "debug"}'
```

## Future Enhancements

Planned features:
- AWS SQS provider
- Message encryption
- Queue persistence for in-memory provider
- Message deduplication
- Priority queue partitioning
- Advanced routing rules
- Graphical queue monitoring dashboard

import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { ChatRequest, Message, Conversation, StreamChunk } from '../types';
import { storage } from '../storage/memoryStorage';
import { agentService } from '../agents/agentService';
import { GoalAction } from '../agents/goalSeekingSystem';

// Helper function to generate conversation title
const generateConversationTitle = (message: string): string => {
  const words = message.split(' ').slice(0, 6);
  return words.join(' ') + (words.length < message.split(' ').length ? '...' : '');
};

// Helper function to execute proactive actions
const executeProactiveAction = async (
  action: GoalAction,
  conversation: Conversation,
  socket: any,
  io: Server
) => {
  try {
    console.log(`🎯 Executing proactive action: ${action.type} with agent: ${action.agentType}`);
    
    // Execute the proactive action using the agent service
    const proactiveResponse = await agentService.executeProactiveAction(
      socket.id,
      action,
      conversation.messages
    );

    // Create a new AI message for the proactive response
    const proactiveMessageId = uuidv4();
    const proactiveMessage: Message = {
      id: proactiveMessageId,
      content: proactiveResponse.content,
      role: 'assistant',
      timestamp: new Date(),
      conversationId: conversation.id,
      agentUsed: proactiveResponse.agentUsed,
      confidence: proactiveResponse.confidence,
      isProactive: true // Mark as proactive message
    };

    // Add the proactive message to the conversation
    conversation.messages.push(proactiveMessage);
    conversation.updatedAt = new Date();

    // Emit the proactive message directly to the user's socket
    const proactiveData = {
      message: proactiveMessage,
      actionType: action.type,
      agentUsed: proactiveResponse.agentUsed,
      confidence: proactiveResponse.confidence
    };
    
    console.log(`📤 Emitting proactive_message to socket ${socket.id}:`, JSON.stringify(proactiveData, null, 2));
    socket.emit('proactive_message', proactiveData);

    console.log(`✅ Proactive action completed: ${action.type}`);
  } catch (error) {
    console.error('Error executing proactive action:', error);
    // Emit error to the specific user
    socket.emit('proactive_error', {
      message: 'Failed to execute proactive action',
      actionType: action.type,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const setupSocketHandlers = (io: Server) => {
  console.log('OpenAI API Key status:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Initialize user in goal-seeking system immediately
    agentService.initializeUserGoals(socket.id);

    // Initialize user state for goal-seeking system
    setTimeout(async () => {
      try {
        console.log(`🎯 Initializing user state for ${socket.id}`);
        
        // Set user state to on_hold and activate entertainment goal
        const userState = agentService.getUserGoalState(socket.id);
        if (userState) {
          userState.currentState = 'on_hold';
          userState.entertainmentPreference = 'mixed';
          
          // Activate entertainment goal
          const entertainmentGoal = userState.goals.find(g => g.type === 'entertainment');
          if (entertainmentGoal) {
            entertainmentGoal.active = true;
            entertainmentGoal.lastUpdated = new Date();
          }
        }

      } catch (error) {
        console.error('Error initializing user state:', error);
      }
    }, 500); // Initialize state quickly

    // Join a conversation room
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(conversationId);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Handle typing indicators
    socket.on('typing_start', (data: { conversationId: string; userName?: string }) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId: socket.id,
        userName: data.userName || 'Anonymous',
        isTyping: true
      });
    });

    socket.on('typing_stop', (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId: socket.id,
        isTyping: false
      });
    });

    // Handle message status updates
    socket.on('message_read', (data: { conversationId: string; messageId: string }) => {
      socket.to(data.conversationId).emit('message_status', {
        messageId: data.messageId,
        status: 'read',
        readBy: socket.id
      });
    });

    // Handle streaming chat messages
    socket.on('stream_chat', async (data: ChatRequest) => {
      console.log('🔄 Received stream_chat request:', { message: data.message, conversationId: data.conversationId, forceAgent: data.forceAgent });
      try {
        const { message, conversationId, forceAgent } = data;

        if (!message || message.trim() === '') {
          socket.emit('stream_error', {
            message: 'Message is required',
            code: 'INVALID_REQUEST'
          });
          return;
        }

        // Find or create conversation
        let conversation: Conversation;
        if (conversationId) {
          const foundConversation = storage.getConversation(conversationId);
          if (!foundConversation) {
            socket.emit('stream_error', {
              message: 'Conversation not found',
              code: 'CONVERSATION_NOT_FOUND'
            });
            return;
          }
          conversation = foundConversation;
        } else {
          // Create new conversation
          conversation = {
            id: uuidv4(),
            title: generateConversationTitle(message),
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          storage.addConversation(conversation);
          
          // Automatically join the socket to the new conversation room
          socket.join(conversation.id);
          console.log(`Socket ${socket.id} joined conversation ${conversation.id}`);
        }

        // Add user message
        const userMessage: Message = {
          id: uuidv4(),
          content: message,
          role: 'user',
          timestamp: new Date(),
          conversationId: conversation.id
        };
        conversation.messages.push(userMessage);

        // Emit user message to conversation room
        io.to(conversation.id).emit('new_message', userMessage);

        // Create AI message placeholder
        const aiMessageId = uuidv4();
        const aiMessage: Message = {
          id: aiMessageId,
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          conversationId: conversation.id
        };
        conversation.messages.push(aiMessage);

        // Emit AI message start
        io.to(conversation.id).emit('stream_start', {
          messageId: aiMessageId,
          conversationId: conversation.id
        });

        // Initialize user in goal-seeking system if not already done
        agentService.initializeUserGoals(socket.id);

        // Process message with goal-seeking system
        console.log('🤖 Processing message with goal-seeking system...');
        const agentResponse = await agentService.processMessageWithGoalSeeking(
          socket.id,
          message,
          conversation.messages.slice(0, -2), // Exclude the user message and AI placeholder we just added
          forceAgent
        );

        console.log(`✅ Goal-seeking system completed. Agent used: ${agentResponse.agentUsed}, Confidence: ${agentResponse.confidence}`);

        // Simulate streaming by sending the response in chunks
        const words = agentResponse.content.split(' ');
        let currentContent = '';
        
        for (let i = 0; i < words.length; i++) {
          currentContent += (i > 0 ? ' ' : '') + words[i];
          
          const chunk: StreamChunk = {
            id: uuidv4(),
            content: currentContent,
            conversationId: conversation.id,
            messageId: aiMessageId,
            isComplete: i === words.length - 1
          };

          io.to(conversation.id).emit('stream_chunk', chunk);
          
          // Add small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        // Update the message content and agent info
        aiMessage.content = agentResponse.content;
        aiMessage.agentUsed = agentResponse.agentUsed;
        aiMessage.confidence = agentResponse.confidence;

        // Update conversation timestamp
        conversation.updatedAt = new Date();

        // Emit stream complete with agent info
        io.to(conversation.id).emit('stream_complete', {
          messageId: aiMessageId,
          conversationId: conversation.id,
          conversation: conversation,
          agentUsed: agentResponse.agentUsed,
          confidence: agentResponse.confidence
        });

        // Handle proactive actions from goal-seeking system
        if (agentResponse.proactiveActions && agentResponse.proactiveActions.length > 0) {
          console.log(`🎯 Processing ${agentResponse.proactiveActions.length} proactive actions...`);
          
          for (const action of agentResponse.proactiveActions) {
            // Execute proactive action based on timing
            if (action.timing === 'immediate') {
              await executeProactiveAction(action, conversation, socket, io);
            } else if (action.timing === 'delayed' && action.delayMs) {
              // Schedule delayed action
              setTimeout(async () => {
                await executeProactiveAction(action, conversation, socket, io);
              }, action.delayMs);
            }
          }
        }

        // Get user's current goal state for debugging
        const userGoalState = agentService.getUserGoalState(socket.id);
        if (userGoalState) {
          console.log(`🎯 User ${socket.id} state: ${userGoalState.currentState}, engagement: ${userGoalState.engagementLevel}, satisfaction: ${userGoalState.satisfactionLevel}`);
          const activeGoals = userGoalState.goals.filter(g => g.active);
          if (activeGoals.length > 0) {
            console.log(`🎯 Active goals: ${activeGoals.map(g => g.type).join(', ')}`);
          }
        }

      } catch (error) {
        console.error('Stream chat error:', error);
        socket.emit('stream_error', {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error from ${socket.id}:`, error);
    });
  });

  // Helper function to emit message to conversation room
  const emitToConversation = (conversationId: string, event: string, data: any) => {
    io.to(conversationId).emit(event, data);
  };

  // Export helper functions for use in routes
  return {
    emitToConversation
  };
};

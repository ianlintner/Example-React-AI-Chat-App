import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { ChatRequest, Message, Conversation, StreamChunk } from '../types';
import { storage } from '../storage/memoryStorage';
import { agentService } from '../agents/agentService';
import { GoalAction } from '../agents/goalSeekingSystem';
import { metrics } from '../metrics/prometheus';
import {
  createConversationSpan,
  createAgentSpan,
  createGoalSeekingSpan,
  addSpanEvent,
  setSpanStatus,
  endSpan,
  context,
} from '../tracing/tracer';
import { tracingContextManager } from '../tracing/contextManager';

// Helper function to generate conversation title
const generateConversationTitle = (message: string): string => {
  const words = message.split(' ').slice(0, 6);
  return (
    words.join(' ') + (words.length < message.split(' ').length ? '...' : '')
  );
};

// Helper function to execute proactive actions with single-agent control
const executeProactiveAction = async (
  action: GoalAction,
  conversation: Conversation,
  socket: any,
  io: Server,
) => {
  try {
    console.log(
      `🎯 Executing proactive action: ${action.type} with agent: ${action.agentType}`,
    );

    // Execute the proactive action using the agent service with single-agent control
    const proactiveResponse = await agentService.executeProactiveAction(
      socket.id,
      action,
      conversation.messages,
    );

    // Validate the proactive response
    const validationResult = await import(
      '../validation/responseValidator'
    ).then(module =>
      module.responseValidator.validateResponse(
        proactiveResponse.agentUsed,
        action.message,
        proactiveResponse.content,
        conversation.id,
        socket.id,
        true, // This is a proactive message
      ),
    );

    // Log validation for proactive messages
    if (validationResult.issues.length > 0) {
      console.warn(
        `⚠️ Proactive validation issues for ${proactiveResponse.agentUsed}:`,
        validationResult.issues,
      );
    }

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
      isProactive: true, // Mark as proactive message
    };

    // Add the proactive message to the conversation
    conversation.messages.push(proactiveMessage);
    conversation.updatedAt = new Date();

    // Emit the proactive message directly to the user's socket
    const proactiveData = {
      message: proactiveMessage,
      actionType: action.type,
      agentUsed: proactiveResponse.agentUsed,
      confidence: proactiveResponse.confidence,
    };

    console.log(
      `📤 Emitting proactive_message to socket ${socket.id}:`,
      JSON.stringify(proactiveData, null, 2),
    );
    socket.emit('proactive_message', proactiveData);

    console.log(`✅ Proactive action completed: ${action.type}`);

    // Process any queued actions after a delay
    const processQueuedTimeout = setTimeout(async () => {
      try {
        const queuedActions = await agentService.getQueuedActions(socket.id);
        if (queuedActions && queuedActions.length > 0) {
          console.log(
            `🎯 Processing ${queuedActions.length} queued actions for user ${socket.id}`,
          );
          for (const queuedAction of queuedActions) {
            await executeProactiveAction(
              queuedAction,
              conversation,
              socket,
              io,
            );
          }
        }
      } catch (error) {
        console.error('Error processing queued actions:', error);
      }
    }, 2000); // 2 second delay to ensure current action is fully processed
    // Prevent keeping the event loop alive in tests
    (processQueuedTimeout as any).unref?.();
  } catch (error) {
    console.error('Error executing proactive action:', error);

    // Handle agent already active error
    if (error instanceof Error && error.message === 'Agent already active') {
      console.log(`⏳ Agent busy - action queued: ${action.type}`);
      // Action is already queued by the agent service, no need to emit error
      return;
    }

    // Emit error to the specific user for other errors
    socket.emit('proactive_error', {
      message: 'Failed to execute proactive action',
      actionType: action.type,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const setupSocketHandlers = (io: Server) => {
  console.log(
    'OpenAI API Key status:',
    process.env.OPENAI_API_KEY ? 'Present' : 'Missing',
  );

  io.on('connection', socket => {
    console.log(`Client connected: ${socket.id}`);

    // Track WebSocket connection metrics
    metrics.activeConnections.inc();

    // Initialize user in goal-seeking system immediately
    agentService.initializeUserGoals(socket.id);

    // Enhanced agent status with proactive context polling
    const sendAgentStatus = () => {
      const activeAgent = agentService.getActiveAgentInfo(socket.id);
      const conversationContext = agentService.getConversationContext(
        socket.id,
      );
      const goalState = agentService.getUserGoalState(socket.id);

      // Proactively update context if user has been idle
      if (conversationContext) {
        const timeSinceLastMessage =
          Date.now() - conversationContext.lastMessageTime.getTime();

        // If user has been idle for more than 2 minutes, gradually decrease satisfaction
        if (timeSinceLastMessage > 120000) {
          // 2 minutes
          conversationContext.userSatisfaction = Math.max(
            0.3,
            conversationContext.userSatisfaction - 0.02,
          );
        }

        // If user has been idle for more than 5 minutes with hold agent, suggest entertainment
        if (
          timeSinceLastMessage > 300000 &&
          conversationContext.currentAgent === 'hold_agent'
        ) {
          // 5 minutes
          if (!conversationContext.shouldHandoff) {
            conversationContext.shouldHandoff = true;
            conversationContext.handoffTarget = 'joke'; // Default entertainment
            conversationContext.handoffReason =
              'Extended idle time - offering entertainment while waiting';
            console.log(
              `🕐 Auto-triggering entertainment handoff for idle user ${socket.id} after 5 minutes`,
            );
          }
        }
      }

      // Update goal state based on time patterns
      if (goalState) {
        const currentHour = new Date().getHours();

        // Adjust entertainment preference based on time of day
        if (currentHour >= 9 && currentHour <= 17) {
          // Business hours
          goalState.entertainmentPreference = 'general_chat'; // Prefer lighter entertainment during work hours
        } else if (currentHour >= 18 && currentHour <= 22) {
          // Evening
          goalState.entertainmentPreference = 'mixed'; // Mixed entertainment in evening
        } else {
          // Late night/early morning
          goalState.entertainmentPreference = 'trivia'; // More engaging content for late night users
        }

        // Auto-activate entertainment goal if user seems bored (low engagement)
        if (goalState.engagementLevel < 0.4) {
          const entertainmentGoal = goalState.goals.find(
            g => g.type === 'entertainment',
          );
          if (entertainmentGoal && !entertainmentGoal.active) {
            entertainmentGoal.active = true;
            entertainmentGoal.lastUpdated = new Date();
            console.log(
              `🎯 Auto-activated entertainment goal for low-engagement user ${socket.id}`,
            );
          }
        }

        // Check for proactive opportunities based on context
        const timeSinceLastUpdate =
          Date.now() - (goalState.lastUpdated?.getTime() || 0);
        if (timeSinceLastUpdate > 180000) {
          // 3 minutes since last update
          // Gradually increase boredom/decrease engagement if no interaction
          goalState.engagementLevel = Math.max(
            0.1,
            goalState.engagementLevel - 0.05,
          );
          goalState.lastUpdated = new Date();
        }
      }

      const agentStatus = {
        currentAgent: conversationContext?.currentAgent || 'general',
        isActive: !!activeAgent,
        activeAgentInfo: activeAgent,
        conversationContext: conversationContext
          ? {
              currentAgent: conversationContext.currentAgent,
              conversationTopic: conversationContext.conversationTopic,
              conversationDepth: conversationContext.conversationDepth,
              userSatisfaction: conversationContext.userSatisfaction,
              agentPerformance: conversationContext.agentPerformance,
              shouldHandoff: conversationContext.shouldHandoff,
              handoffTarget: conversationContext.handoffTarget,
              handoffReason: conversationContext.handoffReason,
              timeSinceLastMessage:
                Date.now() - conversationContext.lastMessageTime.getTime(),
              idleTime: Math.floor(
                (Date.now() - conversationContext.lastMessageTime.getTime()) /
                  1000,
              ),
            }
          : null,
        goalState: goalState
          ? {
              currentState: goalState.currentState,
              engagementLevel: goalState.engagementLevel,
              satisfactionLevel: goalState.satisfactionLevel,
              entertainmentPreference: goalState.entertainmentPreference,
              activeGoals: goalState.goals
                .filter(g => g.active)
                .map(g => ({
                  type: g.type,
                  priority: g.priority,
                  progress: g.progress,
                  lastUpdated: g.lastUpdated,
                })),
              timeSinceLastUpdate:
                Date.now() - (goalState.lastUpdated?.getTime() || 0),
            }
          : null,
        serverTime: new Date(),
        timestamp: new Date(),
        availableAgents: agentService.getAvailableAgents(),
      };

      console.log(
        `📊 Polling agent status for ${socket.id}: Agent=${agentStatus.currentAgent}, Active=${agentStatus.isActive}, Satisfaction=${agentStatus.conversationContext?.userSatisfaction?.toFixed(2)}, Engagement=${agentStatus.goalState?.engagementLevel?.toFixed(2)}`,
      );

      socket.emit('agent_status_update', agentStatus);
    };

    // Track timeouts for cleanup
    const timeouts: NodeJS.Timeout[] = [];

    // Send initial status after connection
    const initialStatusTimeout = setTimeout(() => {
      sendAgentStatus();
    }, 500);
    // Prevent keeping the event loop alive in tests
    (initialStatusTimeout as any).unref?.();
    timeouts.push(initialStatusTimeout);

    // Set up periodic agent status updates (every 5 seconds)
    const statusInterval = setInterval(() => {
      sendAgentStatus();
    }, 5000);
    // Prevent keeping the event loop alive in tests
    (statusInterval as any).unref?.();

    // Store intervals for cleanup
    const intervals = [statusInterval];

    // Initialize user state for goal-seeking system and hold agent
    const initStateTimeout = setTimeout(async () => {
      try {
        console.log(`🎯 Initializing user state for ${socket.id}`);

        // Initialize conversation with hold agent as the starting agent
        agentService.initializeConversation(socket.id, 'hold_agent');

        // Set user state to on_hold and activate entertainment goal
        const userState = agentService.getUserGoalState(socket.id);
        if (userState) {
          userState.currentState = 'on_hold';
          userState.entertainmentPreference = 'mixed';

          // Activate entertainment goal
          const entertainmentGoal = userState.goals.find(
            g => g.type === 'entertainment',
          );
          if (entertainmentGoal) {
            entertainmentGoal.active = true;
            entertainmentGoal.lastUpdated = new Date();
          }
        }

        // Set up 10-minute hold updates
        const holdUpdateInterval = setInterval(
          async () => {
            try {
              const currentAgent = agentService.getCurrentAgent(socket.id);
              if (currentAgent === 'hold_agent') {
                // Send hold update message
                const holdUpdateMessage =
                  "Hi there! I wanted to give you a quick update on your wait time. Thank you for your patience - we're still working to connect you with a specialist. Would you like to continue with the entertainment options while you wait?";

                // Create a proactive hold update message
                const holdUpdateData = {
                  message: {
                    id: require('uuid').v4(),
                    content: holdUpdateMessage,
                    role: 'assistant',
                    timestamp: new Date(),
                    conversationId: 'hold',
                    agentUsed: 'hold_agent',
                    confidence: 1.0,
                    isProactive: true,
                  },
                  actionType: 'hold_update',
                  agentUsed: 'hold_agent',
                  confidence: 1.0,
                };

                console.log(`⏰ Sending 10-minute hold update to ${socket.id}`);
                socket.emit('proactive_message', holdUpdateData);
              } else {
                // User is no longer with hold agent, clear interval
                clearInterval(holdUpdateInterval);
                console.log(
                  `⏰ Clearing hold update interval for ${socket.id} - no longer with hold agent`,
                );
              }
            } catch (error) {
              console.error('Error sending hold update:', error);
            }
          },
          10 * 60 * 1000,
        ); // 10 minutes
        // Prevent keeping the event loop alive in tests
        (holdUpdateInterval as any).unref?.();

        // Store the holdUpdateInterval for cleanup
        intervals.push(holdUpdateInterval);
      } catch (error) {
        console.error('Error initializing user state:', error);
      }
    }, 500); // Initialize state quickly
    // Prevent keeping the event loop alive in tests
    (initStateTimeout as any).unref?.();
    timeouts.push(initStateTimeout);

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
    socket.on(
      'typing_start',
      (data: { conversationId: string; userName?: string }) => {
        socket.to(data.conversationId).emit('user_typing', {
          userId: socket.id,
          userName: data.userName || 'Anonymous',
          isTyping: true,
        });
      },
    );

    socket.on('typing_stop', (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId: socket.id,
        isTyping: false,
      });
    });

    // Handle message status updates
    socket.on(
      'message_read',
      (data: { conversationId: string; messageId: string }) => {
        socket.to(data.conversationId).emit('message_status', {
          messageId: data.messageId,
          status: 'read',
          readBy: socket.id,
        });
      },
    );

    // Handle streaming chat messages
    socket.on('stream_chat', async (data: ChatRequest) => {
      console.log('🔄 Received stream_chat request:', {
        message: data.message,
        conversationId: data.conversationId,
        forceAgent: data.forceAgent,
      });

      // Create conversation span for tracing with proper context
      const conversationSpan = createConversationSpan(
        data.conversationId || 'new',
        'stream_chat',
        socket.id,
      );

      // Use context manager to ensure proper trace propagation
      await tracingContextManager.withSpan(
        conversationSpan,
        async (span, traceContext) => {
          addSpanEvent(span, 'chat_request_received', {
            'user.socket_id': socket.id,
            'message.length': data.message?.length || 0,
            'conversation.has_id': !!data.conversationId,
            'agent.forced': data.forceAgent || 'none',
          });

          try {
            const { message, conversationId, forceAgent } = data;

            if (!message || message.trim() === '') {
              addSpanEvent(conversationSpan, 'validation_failed', {
                reason: 'empty_message',
              });
              setSpanStatus(conversationSpan, false, 'Empty message provided');
              endSpan(conversationSpan);

              socket.emit('stream_error', {
                message: 'Message is required',
                code: 'INVALID_REQUEST',
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
                  code: 'CONVERSATION_NOT_FOUND',
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
                updatedAt: new Date(),
              };
              storage.addConversation(conversation);

              // Automatically join the socket to the new conversation room
              socket.join(conversation.id);
              console.log(
                `Socket ${socket.id} joined conversation ${conversation.id}`,
              );
            }

            // Add user message
            const userMessage: Message = {
              id: uuidv4(),
              content: message,
              role: 'user',
              timestamp: new Date(),
              conversationId: conversation.id,
            };
            conversation.messages.push(userMessage);

            // Emit user message to conversation room (excluding sender since they do optimistic update)
            socket.to(conversation.id).emit('new_message', userMessage);

            // Create AI message placeholder
            const aiMessageId = uuidv4();
            const aiMessage: Message = {
              id: aiMessageId,
              content: '',
              role: 'assistant',
              timestamp: new Date(),
              conversationId: conversation.id,
            };
            conversation.messages.push(aiMessage);

            // Emit AI message start
            io.to(conversation.id).emit('stream_start', {
              messageId: aiMessageId,
              conversationId: conversation.id,
            });

            // Initialize user in goal-seeking system if not already done
            agentService.initializeUserGoals(socket.id);

            // Create goal-seeking span
            const userState = agentService.getUserGoalState(socket.id);
            const goalSeekingSpan = createGoalSeekingSpan(
              conversation.id,
              userState,
            );
            addSpanEvent(goalSeekingSpan, 'goal_seeking_started', {
              'user.socket_id': socket.id,
              'message.content':
                message.substring(0, 100) + (message.length > 100 ? '...' : ''),
              'conversation.message_count': conversation.messages.length - 2,
              'agent.forced': forceAgent || 'none',
            });

            // Process message with both conversation management and goal-seeking systems
            console.log(
              '🤖 Processing message with conversation management and goal-seeking systems...',
            );

            // Track chat message and agent response time
            const responseStart = Date.now();
            metrics.chatMessagesTotal.inc({
              type: 'user',
              agent_type: 'incoming',
            });

            const agentResponse =
              await agentService.processMessageWithBothSystems(
                socket.id,
                message,
                conversation.messages.slice(0, -2), // Exclude the user message and AI placeholder we just added
                conversation.id, // Pass conversation ID for validation
                forceAgent,
              );

            // Track agent response time and success
            const responseTime = (Date.now() - responseStart) / 1000;
            metrics.agentResponseTime.observe(
              { agent_type: agentResponse.agentUsed, success: 'true' },
              responseTime,
            );
            metrics.chatMessagesTotal.inc({
              type: 'assistant',
              agent_type: agentResponse.agentUsed,
            });

            addSpanEvent(goalSeekingSpan, 'dual_system_completed', {
              'agent.selected': agentResponse.agentUsed,
              'agent.confidence': agentResponse.confidence,
              'response.length': agentResponse.content.length,
              'proactive_actions.count':
                agentResponse.proactiveActions?.length || 0,
              handoff_pending: !!agentResponse.handoffInfo,
              handoff_target: agentResponse.handoffInfo?.target,
              handoff_reason: agentResponse.handoffInfo?.reason,
            });
            setSpanStatus(goalSeekingSpan, true);
            endSpan(goalSeekingSpan);

            console.log(
              `✅ Dual system processing completed. Agent used: ${agentResponse.agentUsed}, Confidence: ${agentResponse.confidence}`,
            );

            // Log conversation context if available
            if (agentResponse.conversationContext) {
              const ctx = agentResponse.conversationContext;
              console.log(
                `💬 Conversation context - Agent: ${ctx.currentAgent}, Topic: ${ctx.conversationTopic}, Depth: ${ctx.conversationDepth}, Satisfaction: ${ctx.userSatisfaction.toFixed(2)}, Performance: ${ctx.agentPerformance.toFixed(2)}`,
              );

              if (ctx.shouldHandoff) {
                console.log(
                  `🔄 Handoff needed: ${ctx.currentAgent} → ${ctx.handoffTarget} (${ctx.handoffReason})`,
                );
              }
            }

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
                isComplete: i === words.length - 1,
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
              confidence: agentResponse.confidence,
            });

            // Send agent status update after message processing
            const postProcessTimeout = setTimeout(() => {
              sendAgentStatus();
            }, 100);
            // Prevent keeping the event loop alive in tests
            (postProcessTimeout as any).unref?.();
            timeouts.push(postProcessTimeout);

            // Handle proactive actions from goal-seeking system
            if (
              agentResponse.proactiveActions &&
              agentResponse.proactiveActions.length > 0
            ) {
              console.log(
                `🎯 Processing ${agentResponse.proactiveActions.length} proactive actions...`,
              );

              addSpanEvent(conversationSpan, 'proactive_actions_started', {
                'actions.count': agentResponse.proactiveActions.length,
                'actions.types': agentResponse.proactiveActions.map(
                  a => a.type,
                ),
              });

              for (const action of agentResponse.proactiveActions) {
                // Execute proactive action based on timing
                if (action.timing === 'immediate') {
                  await executeProactiveAction(
                    action,
                    conversation,
                    socket,
                    io,
                  );
                } else if (action.timing === 'delayed' && action.delayMs) {
                  // Schedule delayed action
                  const delayedActionTimeout = setTimeout(async () => {
                    await executeProactiveAction(
                      action,
                      conversation,
                      socket,
                      io,
                    );
                  }, action.delayMs);
                  // Prevent keeping the event loop alive in tests
                  (delayedActionTimeout as any).unref?.();
                  timeouts.push(delayedActionTimeout);
                }
              }
            }

            // Get user's current goal state for debugging
            const userGoalState = agentService.getUserGoalState(socket.id);
            if (userGoalState) {
              console.log(
                `🎯 User ${socket.id} state: ${userGoalState.currentState}, engagement: ${userGoalState.engagementLevel}, satisfaction: ${userGoalState.satisfactionLevel}`,
              );
              const activeGoals = userGoalState.goals.filter(g => g.active);
              if (activeGoals.length > 0) {
                console.log(
                  `🎯 Active goals: ${activeGoals.map(g => g.type).join(', ')}`,
                );
              }
            }

            // Complete conversation span successfully
            addSpanEvent(conversationSpan, 'conversation_completed', {
              'final.agent': agentResponse.agentUsed,
              'final.confidence': agentResponse.confidence,
              'final.response_length': agentResponse.content.length,
              'user.state': userGoalState?.currentState || 'unknown',
              'user.engagement': userGoalState?.engagementLevel || 0,
              'user.satisfaction': userGoalState?.satisfactionLevel || 0,
            });
          } catch (error) {
            console.error('Stream chat error:', error);

            // Log error to tracing span
            addSpanEvent(span, 'conversation_error', {
              'error.message':
                error instanceof Error ? error.message : 'Unknown error',
              'error.stack': error instanceof Error ? error.stack : undefined,
            });
            setSpanStatus(
              span,
              false,
              error instanceof Error ? error.message : 'Unknown error',
            );

            socket.emit('stream_error', {
              message: 'Internal server error',
              code: 'INTERNAL_ERROR',
            });
          }
        },
      );
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);

      // Clear all intervals
      intervals.forEach(clearInterval);
      // Clear all timeouts
      timeouts.forEach(clearTimeout);

      // Track WebSocket disconnection metrics
      metrics.activeConnections.dec();
    });

    // Handle errors
    socket.on('error', error => {
      console.error(`Socket error from ${socket.id}:`, error);
    });
  });

  // Helper function to emit message to conversation room
  const emitToConversation = (
    conversationId: string,
    event: string,
    data: any,
  ) => {
    io.to(conversationId).emit(event, data);
  };

  // Export helper functions for use in routes
  return {
    emitToConversation,
  };
};

import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { ChatRequest, Message, Conversation, StreamChunk } from '../types';
import { storage } from '../storage/memoryStorage';
import { agentService } from '../agents/agentService';
import { GoalAction } from '../agents/goalSeekingSystem';
import { AgentType } from '../agents/types';
import { metrics } from '../metrics/prometheus';
import userStorage from '../storage/userStorage';
import {
  createConversationSpan,
  createGoalSeekingSpan,
  addSpanEvent,
  setSpanStatus,
  endSpan,
} from '../tracing/tracer';
import { tracingContextManager } from '../tracing/contextManager';

// Extend socket with user information
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

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
): Promise<void> => {
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

export const setupSocketHandlers = (
  io: Server,
): {
  emitToConversation: (
    conversationId: string,
    event: string,
    data: any,
  ) => void;
} => {
  console.log('[DEBUG] setupSocketHandlers called');
  console.log(
    'OpenAI API Key status:',
    process.env.OPENAI_API_KEY ? 'Present' : 'Missing',
  );
  console.log('[DEBUG] Registering io.use auth middleware...');

  // Authentication middleware for Socket.IO
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      // Check for oauth2-proxy headers first (passed through from Istio/oauth2-proxy)
      const proxyEmail = socket.handshake.headers['x-auth-request-email'] as
        | string
        | undefined;
      const proxyUser = socket.handshake.headers['x-auth-request-user'] as
        | string
        | undefined;

      // If oauth2-proxy headers are present, use them for authentication
      if (proxyEmail) {
        console.log(`Socket using oauth2-proxy auth for: ${proxyEmail}`);

        // Use the provider from headers or default to github (oauth2-proxy typically uses github)
        const providerHeader = (
          (socket.handshake.headers['x-auth-request-provider'] as string) ||
          'github'
        ).toLowerCase();
        const provider: 'github' | 'google' =
          providerHeader === 'google' ? 'google' : 'github';
        const providerId = proxyUser || proxyEmail;

        // Find or create user based on provider
        let user = await userStorage.getUserByProvider(provider, providerId);

        if (!user) {
          // Create a new user from oauth2-proxy authentication
          const displayName = proxyUser || proxyEmail.split('@')[0];
          console.log(`Creating new user from oauth2-proxy: ${proxyEmail}`);
          user = await userStorage.createUser({
            email: proxyEmail,
            name: displayName,
            provider,
            providerId,
          });
        }

        // Attach user info to socket
        socket.userId = user.id;
        socket.userEmail = user.email;

        console.log(
          `Socket authenticated via oauth2-proxy for user ${user.email} (${user.id})`,
        );
        return next();
      }

      // If OAuth headers are not present, but the oauth2-proxy cookie exists, allow connection
      // This supports cases where websocket path is skip-auth in oauth2-proxy but browser still sends session cookie
      const cookieHeader = socket.handshake.headers['cookie'] as string | undefined;
      if (cookieHeader && /_oauth2_proxy=/.test(cookieHeader)) {
        console.log('Socket allowing connection with oauth2-proxy session cookie present (no headers)');
        // Attach minimal identity (anonymous) - downstream features remain available for demo streaming
        socket.userId = socket.id;
        socket.userEmail = 'Anonymous';
        return next();
      }

      // Fall back to JWT token authentication
      if (!token) {
        console.warn(
          `Socket connection missing auth from ${socket.handshake.address} - allowing anonymous for demo`,
        );
        // Allow anonymous socket for demo fallback (no user storage record)
        socket.userId = socket.id;
        socket.userEmail = 'Anonymous';
        return next();
      }

      const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_here';

      // Verify JWT token
      const decoded = jwt.verify(token, jwtSecret) as {
        userId: string;
        email: string;
      };

      // Verify user exists in storage
      const user = await userStorage.getUser(decoded.userId);

      if (!user) {
        console.warn(
          `Socket connection rejected: User ${decoded.userId} not found`,
        );
        return next(new Error('User not found'));
      }

      // Attach user info to socket
      socket.userId = user.id;
      socket.userEmail = user.email;

      console.log(`Socket authenticated for user ${user.email} (${user.id})`);
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        console.warn(
          `Socket connection rejected: Invalid JWT - ${error.message}`,
        );
        return next(new Error('Invalid token'));
      }

      if (error instanceof jwt.TokenExpiredError) {
        console.warn('Socket connection rejected: Token expired');
        return next(new Error('Token expired'));
      }

      console.error('Socket authentication error:', error);
      return next(new Error('Authentication failed'));
    }
  });

  console.log('[DEBUG] Auth middleware registered, setting up connection handler...');
  
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log('[DEBUG] New connection event triggered');
    const userId = socket.userId || socket.id;
    console.log(
      `Client connected: ${socket.id} (User: ${socket.userEmail || 'Unknown'})`,
    );

    // Per-connection diagnostics correlation ID
    const correlationId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    console.log(`🧩 Socket diagnostics initialized: socketId=${socket.id}, userId=${userId}, correlationId=${correlationId}`);

    // Debug: log all incoming socket events to diagnose missing stream events
    try {
      socket.onAny((event: string, ...args: any[]) => {
        try {
          const preview =
            args && args.length > 0
              ? JSON.stringify(args[0]).slice(0, 200)
              : '';
          console.log(
            `📥 Socket event received: ${event} ${preview ? '- ' + preview : ''}`,
          );
        } catch {
          console.log(`📥 Socket event received: ${event}`);
        }
      });
    } catch {
      // ignore if onAny not available in tests
    }

    // Explicit listeners for key events to ensure visibility
    socket.on('stream_chat', (payload: unknown) => {
      try {
        const preview = payload && typeof payload === 'object' ? JSON.stringify(payload).slice(0, 200) : String(payload ?? '').slice(0, 200);
        console.log(`📥 [${correlationId}] stream_chat received on ${socket.id} - payload=${preview}`);
      } catch {
        console.log(`📥 [${correlationId}] stream_chat received on ${socket.id}`);
      }
    });
    socket.on('error', (err: unknown) => {
      console.error(`⚠️ [${correlationId}] Socket error on ${socket.id}:`, err);
    });
    socket.on('disconnect', (reason: unknown) => {
      console.log(`🔌 [${correlationId}] Socket disconnected ${socket.id} - reason=${String(reason)}`);
    });

    // Track WebSocket connection metrics
    metrics.activeConnections.inc();

    // Initialize user in goal-seeking system with actual user ID
    agentService.initializeUserGoals(userId);

    // Enhanced agent status with proactive context polling
    const sendAgentStatus = (): void => {
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

        // Create a real conversation for this hold session so subsequent messages use the same conversation
        const initialConversation: Conversation = {
          id: uuidv4(),
          title: 'On hold',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        storage.addConversation(initialConversation);
        socket.join(initialConversation.id);

        // Send initial hold greeting proactively, then immediately hand off to an entertainment agent
        const holdGreeting =
          "You're on hold for a moment while we connect you. In the meantime, we'll bring in something fun to keep you entertained!";
        const holdGreetingData = {
          message: {
            id: require('uuid').v4(),
            content: holdGreeting,
            role: 'assistant',
            timestamp: new Date(),
            conversationId: initialConversation.id,
            agentUsed: 'hold_agent',
            confidence: 1.0,
            isProactive: true,
          },
          actionType: 'hold_greeting',
          agentUsed: 'hold_agent',
          confidence: 1.0,
        };
        socket.emit('proactive_message', holdGreetingData);

        // After a short delay, hand off to an entertainment agent and send a message
        const entertainmentInitTimeout = setTimeout(async () => {
          try {
            const entertainmentAgents: AgentType[] = [
              'joke',
              'trivia',
              'gif',
              'story_teller',
              'riddle_master',
              'quote_master',
              'game_host',
              'music_guru',
              'dnd_master',
            ];
            const target =
              entertainmentAgents[
                Math.floor(Math.random() * entertainmentAgents.length)
              ];

            // Set the current conversation agent to the selected entertainment agent
            agentService.initializeConversation(socket.id, target);
            agentService.forceAgentHandoff(
              socket.id,
              target,
              'Automatic entertainment on hold',
            );
            // Push a status update reflecting the handoff immediately
            sendAgentStatus();

            const getEntertainmentMessage = (agentType: AgentType): string => {
              switch (agentType) {
                case 'joke':
                  return 'Tell me a joke right now. I want to hear one of your best ones!';
                case 'trivia':
                  return 'Share a fascinating trivia fact with me right now. I want to learn something interesting!';
                case 'gif':
                  return 'Show me an entertaining GIF right now. I want to see something fun!';
                case 'story_teller':
                  return 'Tell me an engaging short story right now. I want to hear something captivating!';
                case 'riddle_master':
                  return 'Give me a brain teaser or riddle right now. I want to challenge my mind!';
                case 'quote_master':
                  return 'Share an inspiring or entertaining quote with me right now. I want some wisdom or humor!';
              // (diagnostic listeners are set up at connection time)
                case 'game_host':
                  return 'Start a fun interactive game with me right now. I want to play something engaging!';
                case 'music_guru':
                  return 'Give me a personalized music recommendation right now. I want to discover something great!';
                case 'dnd_master':
                  return 'Let’s start a quick D&D mini-adventure! Give me a hook or roll some dice to begin.';
                default:
                  return 'Entertain me right now with your specialty!';
              }
            };

            const initialAction: GoalAction = {
              type: 'proactive_message',
              agentType: target,
              message: getEntertainmentMessage(target),
              timing: 'immediate',
            };

            await executeProactiveAction(
              initialAction,
              initialConversation,
              socket,
              io,
            );
          } catch (err) {
            console.error('Error sending initial entertainment message:', err);
          }
        }, 250);
        (entertainmentInitTimeout as any).unref?.();
        timeouts.push(entertainmentInitTimeout);

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
                    conversationId: initialConversation.id,
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
        async (span, _traceContext) => {
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
            // Temporary conversation IDs (temp-*) from frontend are treated as "create new"
            const isTemporaryId = conversationId?.startsWith('temp-');
            let conversation: Conversation;
            if (conversationId && !isTemporaryId) {
              const foundConversation = storage.getConversation(conversationId);
              if (!foundConversation) {
                socket.emit('stream_error', {
                  message: 'Conversation not found',
                  code: 'CONVERSATION_NOT_FOUND',
                });
                return;
              }
              conversation = foundConversation;
              // Ensure the socket is in the conversation room for streaming events
              socket.join(conversation.id);
              console.log(
                `Socket ${socket.id} joined conversation ${conversation.id}`,
              );
            } else {
              // Create new conversation (or replace temporary ID with a real one)
              console.log(`Creating new conversation (temp ID was: ${conversationId || 'none'})`);
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
  ): void => {
    io.to(conversationId).emit(event, data);
  };

  console.log('[DEBUG] setupSocketHandlers completed successfully');
  
  // Export helper functions for use in routes
  return {
    emitToConversation,
  };
};

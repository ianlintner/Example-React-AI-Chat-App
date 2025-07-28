import OpenAI from 'openai';
import { classifyMessage } from './classifier';
import { getAgent } from './config';
import { AgentResponse, AgentType } from './types';
import { Message } from '../types';
import { GoalSeekingSystem, GoalAction } from './goalSeekingSystem';
import { responseValidator } from '../validation/responseValidator';
import { jokeLearningSystem } from './jokeLearningSystem';
import { ConversationManager, ConversationContext } from './conversationManager';
import { ragService } from './ragService';

export class AgentService {
  private goalSeekingSystem: GoalSeekingSystem;
  private conversationManager: ConversationManager;
  private activeAgents: Map<string, { agentType: AgentType; timestamp: Date }> = new Map();
  private actionQueue: Map<string, GoalAction[]> = new Map();
  private processingQueue: Set<string> = new Set();

  constructor() {
    this.goalSeekingSystem = new GoalSeekingSystem(this);
    this.conversationManager = new ConversationManager();
  }

  // Check if an agent is currently active for a user
  private isAgentActive(userId: string): boolean {
    const activeAgent = this.activeAgents.get(userId);
    if (!activeAgent) return false;
    
    // Consider an agent inactive after 30 seconds of no activity
    const thirtySecondsAgo = Date.now() - 30000;
    return activeAgent.timestamp.getTime() > thirtySecondsAgo;
  }

  // Set an agent as active for a user
  private setAgentActive(userId: string, agentType: AgentType): void {
    this.activeAgents.set(userId, {
      agentType,
      timestamp: new Date()
    });
  }

  // Clear active agent for a user
  private clearActiveAgent(userId: string): void {
    this.activeAgents.delete(userId);
  }

  // Add action to queue for later processing
  private queueAction(userId: string, action: GoalAction): void {
    if (!this.actionQueue.has(userId)) {
      this.actionQueue.set(userId, []);
    }
    this.actionQueue.get(userId)!.push(action);
  }

  // Process queued actions for a user
  private async processQueuedActions(userId: string): Promise<GoalAction[]> {
    if (this.processingQueue.has(userId)) {
      return []; // Already processing queue for this user
    }

    const queue = this.actionQueue.get(userId) || [];
    if (queue.length === 0) {
      return [];
    }

    this.processingQueue.add(userId);
    this.actionQueue.set(userId, []); // Clear queue

    try {
      // Only return the first action to ensure sequential processing
      return queue.slice(0, 1);
    } finally {
      this.processingQueue.delete(userId);
    }
  }

  async processMessage(
    message: string, 
    conversationHistory: Message[] = [],
    forcedAgentType?: AgentType,
    conversationId?: string,
    userId?: string
  ): Promise<AgentResponse> {
    // Classify the message to determine which agent to use
    let agentType: AgentType;
    let confidence: number;
    
    if (forcedAgentType) {
      agentType = forcedAgentType;
      confidence = 1.0;
    } else {
      const classification = await classifyMessage(message);
      agentType = classification.agentType;
      confidence = classification.confidence;
      
      console.log(`Message classified as ${agentType} with confidence ${confidence}: ${classification.reasoning}`);
    }

    // Get the appropriate agent
    const agent = getAgent(agentType);

    // For joke agent, use adaptive prompt based on user learning data
    let systemPrompt = agent.systemPrompt;
    if (agentType === 'joke' && userId) {
      systemPrompt = jokeLearningSystem.generateAdaptivePrompt(userId, agent.systemPrompt);
    }

    // Prepare the conversation history for the agent
    const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add conversation history (limit to last 10 messages to avoid token limits)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    }

    // Add the current message
    messages.push({
      role: 'user',
      content: message
    });

    // Generate response using the agent
    let responseContent: string;
    
    try {
      if (!process.env.OPENAI_API_KEY) {
        // Demo response when no API key is provided
        responseContent = this.generateDemoResponse(agent.name, message);
      } else {
        // Create OpenAI client at runtime to ensure env vars are loaded
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const completion = await openai.chat.completions.create({
          model: agent.model,
          messages: messages,
          max_tokens: agent.maxTokens,
          temperature: agent.temperature,
        });

        responseContent = completion.choices[0]?.message?.content || 
          `I apologize, but I encountered an error while processing your request. Please try again.`;
      }
    } catch (error) {
      console.error(`Error calling OpenAI API with ${agent.name}:`, error);
      responseContent = `I apologize, but I encountered an error while processing your request. Please try again.`;
    }

    // Validate the response if conversationId and userId are provided
    if (conversationId && userId) {
      const validationResult = responseValidator.validateResponse(
        agentType,
        message,
        responseContent,
        conversationId,
        userId,
        false // Not a proactive message
      );
      
      // Log validation issues if any
      if (validationResult.issues.length > 0) {
        console.warn(`⚠️ Validation issues for ${agentType} response:`, validationResult.issues);
      }
      
      // For high-severity issues, you might want to regenerate the response
      // or provide a fallback response
      if (validationResult.issues.some(issue => issue.severity === 'high')) {
        console.error(`❌ High severity validation issues detected for ${agentType} response`);
        // Could implement fallback logic here
      }
    }

    return {
      content: responseContent,
      agentUsed: agentType,
      confidence: confidence
    };
  }

  private generateDemoResponse(agentName: string, message: string): string {
    if (agentName === 'Technical Assistant') {
      return `**Technical Assistant Response** (Demo Mode)

I would help you with your technical question: "${message}"

Since this is demo mode, here's what I would typically do:
- Analyze your technical problem
- Provide code examples and solutions
- Explain best practices
- Offer debugging assistance
- Suggest relevant documentation

To get real AI responses, please set your OPENAI_API_KEY environment variable.`;
    } else if (agentName === 'Adaptive Joke Master') {
      // Use RAG service for curated jokes
      const ragContent = ragService.searchForAgent('joke', message, true);
      if (ragContent) {
        return `${ragContent.content} 😄

🎭 *Learning from your reaction...* Want to hear another one? I'm adapting my humor based on what makes you laugh!

📚 *From curated joke collection* - I have access to quality-rated jokes that are consistently entertaining!

(This is demo mode with RAG - to get fresh AI-generated adaptive jokes, please set your OPENAI_API_KEY environment variable)`;
      } else {
        return `**Adaptive Joke Master Response** (Demo Mode)

I'm your intelligent comedy companion with access to a curated joke database! I learn from your reactions and tailor my humor just for you.

🎯 *I'm watching for your reaction to learn what makes you laugh!*

In demo mode with RAG, I:
- Use curated, quality-rated jokes from my database
- Learn from your reactions (laughs, groans, etc.)
- Adapt my joke style based on your preferences
- Remember what works and avoid what doesn't
- Access different joke categories: dad jokes, wordplay, tech humor, etc.

To get real AI responses with adaptive learning, please set your OPENAI_API_KEY environment variable.`;
      }
    } else if (agentName === 'Trivia Master') {
      // Use RAG service for curated trivia
      const ragContent = ragService.searchForAgent('trivia', message, true);
      if (ragContent) {
        return `${ragContent.content}

Isn't that incredible? Want to hear another fascinating fact?

📚 *From curated trivia collection* - I have access to quality-rated facts that are consistently mind-blowing!

(This is demo mode with RAG - to get fresh AI-generated trivia, please set your OPENAI_API_KEY environment variable)`;
      } else {
        return `**Trivia Master Response** (Demo Mode)

I'm your source for amazing facts with access to a curated trivia database! I love sharing knowledge that will blow your mind.

📚 *From curated collection* - I have fascinating facts about science, history, nature, and more!

In demo mode with RAG, I:
- Share quality-rated facts from my curated database
- Cover topics from space to culture to human achievements
- Make facts engaging and memorable  
- Encourage curiosity and learning
- Access different categories: animals, science, history, space, etc.

To get real AI responses with fresh trivia, please set your OPENAI_API_KEY environment variable.`;
      }
    } else if (agentName === 'GIF Master') {
      // Use RAG service for curated GIFs
      const ragContent = ragService.searchForAgent('gif', message, true);
      if (ragContent) {
        return `Here's a perfect GIF for you! 🎬

![${ragContent.metadata?.alt || 'Animated GIF'}](${ragContent.content})

*${ragContent.metadata?.description || 'Entertaining animated content'}*

📚 *From curated GIF collection* - I have access to quality, entertaining GIFs that are consistently delightful!

Want another one? I have GIFs for every mood and situation!

(This is demo mode with RAG - to get fresh AI-selected GIFs, please set your OPENAI_API_KEY environment variable)`;
      } else {
        return `**GIF Master Response** (Demo Mode)

I'm your source for entertaining GIFs with access to a curated visual database! I brighten your day with perfect animated reactions.

🎬 *From curated collection* - I have quality GIFs for every mood and situation!

In demo mode with RAG, I:
- Share quality-curated GIFs from my database
- Provide perfect visual reactions for any situation
- Cover different categories: funny, cute, excited, surprised, etc.
- Make conversations more engaging with visual entertainment
- Access GIFs for celebrations, reactions, emotions, and more

To get real AI responses with fresh GIF selections, please set your OPENAI_API_KEY environment variable.`;
      }
    } else {
      return `**General Assistant Response** (Demo Mode)

Thanks for your message: "${message}"

I'm here to help with general questions, casual conversation, creative tasks, and everyday assistance. In demo mode, I would:
- Engage in natural conversation
- Answer general knowledge questions
- Provide helpful advice and recommendations
- Assist with creative and everyday tasks

To get real AI responses, please set your OPENAI_API_KEY environment variable.`;
    }
  }

  // Method to get available agents info
  getAvailableAgents() {
    return [
      {
        id: 'technical',
        name: 'Technical Assistant',
        description: 'Specialized in programming, software development, debugging, and technical questions'
      },
      {
        id: 'general',
        name: 'General Assistant',
        description: 'Helpful for casual conversation, general questions, creative tasks, and everyday assistance'
      },
      {
        id: 'joke',
        name: 'Adaptive Joke Master',
        description: 'An intelligent joke agent that learns from your reactions and tailors humor to your preferences'
      },
      {
        id: 'trivia',
        name: 'Trivia Master',
        description: 'Your source for fascinating random facts, trivia, and interesting knowledge from around the world'
      },
      {
        id: 'gif',
        name: 'GIF Master',
        description: 'Provides entertaining GIFs and animated reactions to brighten your day'
      },
      {
        id: 'account_support',
        name: 'Account Support Specialist',
        description: 'Specialized in account-related issues, user authentication, profile management, and account security'
      },
      {
        id: 'billing_support',
        name: 'Billing Support Specialist',
        description: 'Expert in billing, payments, subscriptions, refunds, and all financial account matters'
      },
      {
        id: 'website_support',
        name: 'Website Issues Specialist',
        description: 'Specialized in website functionality, browser issues, performance problems, and technical web support'
      },
      {
        id: 'operator_support',
        name: 'Customer Service Operator',
        description: 'General customer service operator for unknown issues, routing, and comprehensive support coordination'
      },
      {
        id: 'hold_agent',
        name: 'Hold Agent',
        description: 'Manages customer hold experiences with wait time updates and entertainment coordination'
      }
    ];
  }

  // Goal-seeking system integration methods
  async processMessageWithGoalSeeking(
    userId: string,
    message: string,
    conversationHistory: Message[] = [],
    forcedAgentType?: AgentType,
    conversationId?: string
  ): Promise<AgentResponse & { proactiveActions?: GoalAction[] }> {
    // Set current agent as active for this user
    const agentType = forcedAgentType || (await classifyMessage(message)).agentType;
    this.setAgentActive(userId, agentType);

    // Update user state based on their message
    this.goalSeekingSystem.updateUserState(userId, message);

    // Activate goals based on current user state
    const activatedGoals = this.goalSeekingSystem.activateGoals(userId);
    
    // Process the message normally with validation
    const response = await this.processMessage(
      message, 
      conversationHistory, 
      forcedAgentType, 
      conversationId, 
      userId
    );

    // Update goal progress based on the response
    this.goalSeekingSystem.updateGoalProgress(userId, message, response.content);

    // Generate proactive actions if goals are active
    const rawProactiveActions = await this.goalSeekingSystem.generateProactiveActions(userId);

    // Filter proactive actions to ensure single agent control
    const proactiveActions = this.filterProactiveActions(userId, rawProactiveActions);

    // Clear active agent after processing
    this.clearActiveAgent(userId);

    return {
      ...response,
      proactiveActions: proactiveActions.length > 0 ? proactiveActions : undefined
    };
  }

  // Execute a proactive action with single-agent control
  async executeProactiveAction(
    userId: string,
    action: GoalAction,
    conversationHistory: Message[] = []
  ): Promise<AgentResponse> {
    // Check if an agent is already active for this user
    if (this.isAgentActive(userId)) {
      console.log(`🚫 Agent ${this.activeAgents.get(userId)?.agentType} is already active for user ${userId}. Queueing action: ${action.type}`);
      this.queueAction(userId, action);
      throw new Error('Agent already active');
    }

    // Set this agent as active
    this.setAgentActive(userId, action.agentType);

    try {
      // Use the message from the goal-seeking system directly
      const proactiveMessage = action.message;

      // Process the proactive message using the specified agent
      const response = await this.processMessage(
        proactiveMessage,
        conversationHistory,
        action.agentType
      );

      console.log(`✅ Proactive action executed successfully for user ${userId} with agent ${action.agentType}`);
      return response;
    } finally {
      // Clear active agent after processing
      this.clearActiveAgent(userId);
      
      // Process any queued actions
      setTimeout(async () => {
        const queuedActions = await this.processQueuedActions(userId);
        if (queuedActions.length > 0) {
          console.log(`🎯 Processing ${queuedActions.length} queued actions for user ${userId}`);
          // Note: The actual execution of queued actions should be handled by the socket handler
        }
      }, 1000); // Small delay to ensure current action is fully processed
    }
  }

  // Filter proactive actions to ensure single agent control
  private filterProactiveActions(userId: string, actions: GoalAction[]): GoalAction[] {
    if (actions.length === 0) return actions;

    // Sort actions by priority (immediate first, then by type priority)
    const sortedActions = actions.sort((a, b) => {
      if (a.timing === 'immediate' && b.timing !== 'immediate') return -1;
      if (a.timing !== 'immediate' && b.timing === 'immediate') return 1;
      
      // Priority order: technical_support > entertainment > engagement
      const priorityOrder: Record<string, number> = { 
        'technical_check': 3, 
        'entertainment_offer': 2, 
        'proactive_message': 1, 
        'agent_switch': 1,
        'status_update': 0 
      };
      return (priorityOrder[b.type] || 0) - (priorityOrder[a.type] || 0);
    });

    // Only return the highest priority action to ensure single agent control
    const selectedAction = sortedActions[0];
    console.log(`🎯 Selected single proactive action for user ${userId}: ${selectedAction.type} (${selectedAction.agentType})`);
    
    if (sortedActions.length > 1) {
      console.log(`🚫 Filtered out ${sortedActions.length - 1} additional proactive actions to maintain single agent control`);
    }

    return [selectedAction];
  }

  // Get queued actions for a user (for socket handler to process)
  async getQueuedActions(userId: string): Promise<GoalAction[]> {
    return this.processQueuedActions(userId);
  }

  // Check if agent is active for a user (public method)
  isUserAgentActive(userId: string): boolean {
    return this.isAgentActive(userId);
  }

  // Get active agent info for a user
  getActiveAgentInfo(userId: string): { agentType: AgentType; timestamp: Date } | null {
    return this.activeAgents.get(userId) || null;
  }

  // Get user's current state and goals
  getUserGoalState(userId: string) {
    return this.goalSeekingSystem.getUserState(userId);
  }

  // Get user's active goals
  getUserActiveGoals(userId: string) {
    return this.goalSeekingSystem.getActiveGoals(userId);
  }

  // Initialize a new user in the goal-seeking system
  initializeUserGoals(userId: string) {
    return this.goalSeekingSystem.initializeUser(userId);
  }

  // Clean up inactive users
  cleanupInactiveUsers(maxInactiveTime?: number) {
    this.goalSeekingSystem.cleanupInactiveUsers(maxInactiveTime);
    this.conversationManager.cleanup(maxInactiveTime);
  }

  // ===== CONVERSATION MANAGEMENT METHODS =====

  // Enhanced message processing with conversation continuity and intelligent handoffs
  async processMessageWithConversation(
    userId: string,
    message: string,
    conversationHistory: Message[] = [],
    conversationId?: string
  ): Promise<AgentResponse & { handoffInfo?: { target: AgentType; reason: string; message: string } }> {
    // Get or initialize conversation context
    let context = this.conversationManager.getContext(userId);
    if (!context) {
      // Start with general agent if no context exists
      context = this.conversationManager.initializeContext(userId, 'general');
    }

    // Current agent from conversation context
    let currentAgent = context.currentAgent;
    
    // Check if we need to handoff before processing
    const handoffInfo = this.conversationManager.getHandoffInfo(userId);
    if (handoffInfo) {
      console.log(`🔄 Agent handoff detected for user ${userId}: ${context.currentAgent} → ${handoffInfo.target} (${handoffInfo.reason})`);
      
      // Complete the handoff
      context = this.conversationManager.completeHandoff(userId, handoffInfo.target);
      currentAgent = handoffInfo.target;
      
      // Return handoff message first
      return {
        content: handoffInfo.message,
        agentUsed: 'general', // Handoff messages come from general agent
        confidence: 1.0,
        handoffInfo
      };
    }

    // Process message with current agent
    const response = await this.processMessage(
      message,
      conversationHistory,
      currentAgent,
      conversationId,
      userId
    );

    // Update conversation context with the interaction
    this.conversationManager.updateContext(userId, message, response.content, currentAgent);

    // Check if handoff is now needed after this interaction
    const newHandoffInfo = this.conversationManager.getHandoffInfo(userId);
    
    return {
      ...response,
      handoffInfo: newHandoffInfo || undefined
    };
  }

  // Get conversation context for a user
  getConversationContext(userId: string): ConversationContext | null {
    return this.conversationManager.getContext(userId);
  }

  // Force agent handoff (manual override)
  forceAgentHandoff(userId: string, targetAgent: AgentType, reason: string = 'Manual override'): void {
    const context = this.conversationManager.getContext(userId);
    if (context) {
      context.shouldHandoff = true;
      context.handoffTarget = targetAgent;
      context.handoffReason = reason;
    }
  }

  // Get current agent for a user based on conversation context
  getCurrentAgent(userId: string): AgentType {
    const context = this.conversationManager.getContext(userId);
    return context?.currentAgent || 'general';
  }

  // Initialize conversation for a user with specific agent
  initializeConversation(userId: string, initialAgent: AgentType = 'general'): ConversationContext {
    return this.conversationManager.initializeContext(userId, initialAgent);
  }

  // Combined method that handles both goal-seeking and conversation management
  async processMessageWithBothSystems(
    userId: string,
    message: string,
    conversationHistory: Message[] = [],
    conversationId?: string,
    forcedAgentType?: AgentType
  ): Promise<AgentResponse & { 
    proactiveActions?: GoalAction[];
    handoffInfo?: { target: AgentType; reason: string; message: string };
    conversationContext?: ConversationContext;
  }> {
    // If agent is forced, use goal-seeking system primarily
    if (forcedAgentType) {
      const goalSeekingResponse = await this.processMessageWithGoalSeeking(
        userId, 
        message, 
        conversationHistory, 
        forcedAgentType, 
        conversationId
      );
      
      // Still update conversation context
      const context = this.conversationManager.updateContext(
        userId, 
        message, 
        goalSeekingResponse.content, 
        forcedAgentType
      );
      
      return {
        ...goalSeekingResponse,
        conversationContext: context
      };
    }

    // Use conversation management for natural flow
    const conversationResponse = await this.processMessageWithConversation(
      userId,
      message,
      conversationHistory,
      conversationId
    );

    // If no handoff is happening, also process with goal-seeking for proactive actions
    if (!conversationResponse.handoffInfo) {
      // Update goal-seeking system
      this.goalSeekingSystem.updateUserState(userId, message);
      this.goalSeekingSystem.activateGoals(userId);
      this.goalSeekingSystem.updateGoalProgress(userId, message, conversationResponse.content);
      
      // Generate proactive actions
      const rawProactiveActions = await this.goalSeekingSystem.generateProactiveActions(userId);
      const proactiveActions = this.filterProactiveActions(userId, rawProactiveActions);
      
      return {
        ...conversationResponse,
        proactiveActions: proactiveActions.length > 0 ? proactiveActions : undefined,
        conversationContext: this.conversationManager.getContext(userId) || undefined
      };
    }

    return {
      ...conversationResponse,
      conversationContext: this.conversationManager.getContext(userId) || undefined
    };
  }

  // Get comprehensive user state (both systems)
  getComprehensiveUserState(userId: string) {
    return {
      conversationContext: this.conversationManager.getContext(userId),
      goalState: this.goalSeekingSystem.getUserState(userId),
      activeGoals: this.goalSeekingSystem.getActiveGoals(userId),
      activeAgent: this.getActiveAgentInfo(userId)
    };
  }
}

export const agentService = new AgentService();

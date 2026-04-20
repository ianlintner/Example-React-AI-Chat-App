import { AgentType } from './types';
import { Message } from '../types';

/**
 * Tracks per-user conversation state.
 *
 * NOTE: handoff decisions are no longer stored here. They are computed
 * pre-dispatch by `router.ts` on every incoming message, which keeps the
 * state machine simpler and fixes the "handoff one turn late" bug.
 */
export interface ConversationContext {
  userId: string;
  currentAgent: AgentType;
  conversationTopic: string;
  lastMessageTime: Date;
  messageCount: number;
  conversationDepth: number; // How deep the conversation is with current agent
  userSatisfaction: number; // 0-1 scale
  agentPerformance: number; // 0-1 scale based on user responses
}

export class ConversationManager {
  private contexts: Map<string, ConversationContext> = new Map();
  private conversationHistory: Map<string, Message[]> = new Map();

  // Initialize conversation context for a user
  initializeContext(
    userId: string,
    initialAgent: AgentType = 'general',
  ): ConversationContext {
    const context: ConversationContext = {
      userId,
      currentAgent: initialAgent,
      conversationTopic: 'general',
      lastMessageTime: new Date(),
      messageCount: 0,
      conversationDepth: 0,
      userSatisfaction: 0.7, // Start with neutral satisfaction
      agentPerformance: 0.7, // Start with neutral performance
    };

    this.contexts.set(userId, context);
    return context;
  }

  // Update conversation context based on user message. This no longer
  // performs handoff detection — the router handles that pre-dispatch.
  updateContext(
    userId: string,
    userMessage: string,
    agentResponse: string,
    currentAgent: AgentType,
  ): ConversationContext {
    let context = this.contexts.get(userId);
    if (!context) {
      context = this.initializeContext(userId, currentAgent);
    }

    // If the router selected a different agent than what context had, make
    // sure we track that — but do NOT reset depth here; `completeHandoff`
    // is the dedicated call site for that.
    if (context.currentAgent !== currentAgent) {
      context.currentAgent = currentAgent;
    }

    // Update basic metrics
    context.lastMessageTime = new Date();
    context.messageCount++;
    context.conversationDepth++;

    // Analyze message for topic and satisfaction
    this.analyzeMessage(context, userMessage, agentResponse);

    this.contexts.set(userId, context);
    return context;
  }

  // Analyze user message and agent response for satisfaction and performance
  private analyzeMessage(
    context: ConversationContext,
    userMessage: string,
    _agentResponse: string,
  ): void {
    const lowerMessage = userMessage.toLowerCase();

    // Update topic detection
    if (
      lowerMessage.includes('code') ||
      lowerMessage.includes('programming') ||
      lowerMessage.includes('bug')
    ) {
      context.conversationTopic = 'technical';
    } else if (
      lowerMessage.includes('joke') ||
      lowerMessage.includes('funny') ||
      lowerMessage.includes('laugh')
    ) {
      context.conversationTopic = 'humor';
    } else if (
      lowerMessage.includes('fact') ||
      lowerMessage.includes('trivia') ||
      lowerMessage.includes('learn')
    ) {
      context.conversationTopic = 'educational';
    } else if (
      lowerMessage.includes('gif') ||
      lowerMessage.includes('meme') ||
      lowerMessage.includes('visual')
    ) {
      context.conversationTopic = 'visual_entertainment';
    }

    // Analyze user satisfaction based on response patterns
    const positiveIndicators = [
      'thanks',
      'great',
      'awesome',
      'perfect',
      'love',
      'amazing',
      'helpful',
      'good',
      'nice',
    ];
    const negativeIndicators = [
      'no',
      'stop',
      'boring',
      'not helpful',
      'wrong',
      'bad',
      'annoying',
      'stupid',
    ];

    const positiveCount = positiveIndicators.filter(word =>
      lowerMessage.includes(word),
    ).length;
    const negativeCount = negativeIndicators.filter(word =>
      lowerMessage.includes(word),
    ).length;

    if (positiveCount > negativeCount) {
      context.userSatisfaction = Math.min(1, context.userSatisfaction + 0.1);
      context.agentPerformance = Math.min(1, context.agentPerformance + 0.1);
    } else if (negativeCount > positiveCount) {
      context.userSatisfaction = Math.max(0, context.userSatisfaction - 0.2);
      context.agentPerformance = Math.max(0, context.agentPerformance - 0.2);
    }

    // Detect conversation stagnation
    if (context.conversationDepth > 5 && context.userSatisfaction < 0.5) {
      context.agentPerformance = Math.max(0, context.agentPerformance - 0.1);
    }
  }

  // Complete the handoff and reset context
  completeHandoff(userId: string, newAgent: AgentType): ConversationContext {
    const context = this.contexts.get(userId);
    if (!context) {
      return this.initializeContext(userId, newAgent);
    }

    // Update agent and reset per-agent metrics
    context.currentAgent = newAgent;
    context.conversationDepth = 0; // Reset depth for new agent
    context.agentPerformance = 0.7; // Reset performance for new agent

    this.contexts.set(userId, context);
    return context;
  }

  // Get current context for a user
  getContext(userId: string): ConversationContext | null {
    return this.contexts.get(userId) || null;
  }

  // Clean up old contexts
  cleanup(maxAge = 3600000): void {
    // 1 hour default
    const now = Date.now();
    for (const [userId, context] of this.contexts) {
      if (now - context.lastMessageTime.getTime() > maxAge) {
        this.contexts.delete(userId);
        this.conversationHistory.delete(userId);
      }
    }
  }
}

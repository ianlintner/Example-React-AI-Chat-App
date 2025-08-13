import { AgentType } from './types';
import { Message } from '../types';

export interface ConversationContext {
  userId: string;
  currentAgent: AgentType;
  conversationTopic: string;
  lastMessageTime: Date;
  messageCount: number;
  conversationDepth: number; // How deep the conversation is with current agent
  userSatisfaction: number; // 0-1 scale
  agentPerformance: number; // 0-1 scale based on user responses
  shouldHandoff: boolean;
  handoffReason?: string;
  handoffTarget?: AgentType;
}

export interface HandoffTrigger {
  type:
    | 'explicit_request'
    | 'topic_shift'
    | 'performance_decline'
    | 'expertise_mismatch'
    | 'conversation_stagnation';
  confidence: number;
  targetAgent?: AgentType;
  reason: string;
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
      shouldHandoff: false,
    };

    this.contexts.set(userId, context);
    return context;
  }

  // Update conversation context based on user message
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

    // Update basic metrics
    context.lastMessageTime = new Date();
    context.messageCount++;
    context.conversationDepth++;

    // Analyze message for topic and satisfaction
    this.analyzeMessage(context, userMessage, agentResponse);

    // Check for handoff triggers
    const handoffTrigger = this.detectHandoffTriggers(
      context,
      userMessage,
      currentAgent,
    );
    if (handoffTrigger) {
      context.shouldHandoff = true;
      context.handoffReason = handoffTrigger.reason;
      context.handoffTarget = handoffTrigger.targetAgent;
    }

    this.contexts.set(userId, context);
    return context;
  }

  // Analyze user message and agent response for satisfaction and performance
  private analyzeMessage(
    context: ConversationContext,
    userMessage: string,
    agentResponse: string,
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

  // Detect when an agent should hand off to another
  private detectHandoffTriggers(
    context: ConversationContext,
    userMessage: string,
    currentAgent: AgentType,
  ): HandoffTrigger | null {
    const lowerMessage = userMessage.toLowerCase();

    // **AUTOMATIC ENTERTAINMENT HANDOFF**: If this is the first message TO hold_agent, immediately handoff to random entertainment
    // This triggers handoff during the initial message processing, not after
    // HIGHEST PRIORITY - this overrides all other detections for hold_agent
    if (currentAgent === 'hold_agent' && context.conversationDepth === 1) {
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
      const randomAgent =
        entertainmentAgents[
          Math.floor(Math.random() * entertainmentAgents.length)
        ];

      console.log(
        `🎲 AUTOMATIC ENTERTAINMENT HANDOFF: Selected random agent '${randomAgent}' from ${entertainmentAgents.length} available entertainment agents`,
      );

      return {
        type: 'explicit_request',
        confidence: 1.0,
        targetAgent: randomAgent,
        reason: `No specialists available - automatically connecting you to our ${randomAgent} agent for entertainment while you wait`,
      };
    }

    // Explicit requests for different agent types (only for non-hold agents)
    if (lowerMessage.includes('tell me a joke') && currentAgent !== 'joke') {
      return {
        type: 'explicit_request',
        confidence: 0.9,
        targetAgent: 'joke',
        reason: 'User explicitly requested humor',
      };
    }

    if (
      (lowerMessage.includes('fact') ||
        lowerMessage.includes('trivia') ||
        lowerMessage.includes('learn')) &&
      currentAgent !== 'trivia'
    ) {
      return {
        type: 'explicit_request',
        confidence: 0.8,
        targetAgent: 'trivia',
        reason: 'User requested educational content',
      };
    }

    if (
      (lowerMessage.includes('gif') ||
        lowerMessage.includes('meme') ||
        lowerMessage.includes('visual')) &&
      currentAgent !== 'gif'
    ) {
      return {
        type: 'explicit_request',
        confidence: 0.8,
        targetAgent: 'gif',
        reason: 'User requested visual entertainment',
      };
    }

    if (
      (lowerMessage.includes('youtube') ||
        lowerMessage.includes('video') ||
        lowerMessage.includes('viral') ||
        lowerMessage.includes('show me something funny') ||
        lowerMessage.includes('entertaining video')) &&
      currentAgent !== 'youtube_guru'
    ) {
      return {
        type: 'explicit_request',
        confidence: 0.9,
        targetAgent: 'youtube_guru',
        reason: 'User requested YouTube videos or viral content',
      };
    }

    if (
      (lowerMessage.includes('d&d') ||
        lowerMessage.includes('dnd') ||
        lowerMessage.includes('dungeons and dragons') ||
        lowerMessage.includes('rpg') ||
        lowerMessage.includes('dice') ||
        lowerMessage.includes('character') ||
        lowerMessage.includes('adventure') ||
        lowerMessage.includes('dungeon master') ||
        lowerMessage.includes('roll dice')) &&
      currentAgent !== 'dnd_master'
    ) {
      return {
        type: 'explicit_request',
        confidence: 0.9,
        targetAgent: 'dnd_master',
        reason: 'User requested D&D RPG experience',
      };
    }

    // Topic shift detection
    const topicMismatch = this.detectTopicMismatch(context, currentAgent);
    if (topicMismatch) {
      return topicMismatch;
    }

    // Performance-based handoff
    if (context.agentPerformance < 0.4 && context.conversationDepth > 3) {
      return {
        type: 'performance_decline',
        confidence: 0.7,
        targetAgent: this.suggestBetterAgent(context, currentAgent),
        reason: 'Current agent performance declining, suggesting alternative',
      };
    }

    // Conversation stagnation
    if (context.conversationDepth > 8 && context.userSatisfaction < 0.6) {
      return {
        type: 'conversation_stagnation',
        confidence: 0.6,
        targetAgent: this.suggestRefreshAgent(currentAgent),
        reason: 'Conversation needs fresh perspective',
      };
    }

    return null;
  }

  // Detect if current topic doesn't match current agent's expertise
  private detectTopicMismatch(
    context: ConversationContext,
    currentAgent: AgentType,
  ): HandoffTrigger | null {
    const topicAgentMap: Record<string, AgentType> = {
      technical: 'website_support',
      humor: 'joke',
      educational: 'trivia',
      visual_entertainment: 'gif',
    };

    const idealAgent = topicAgentMap[context.conversationTopic];
    if (
      idealAgent &&
      idealAgent !== currentAgent &&
      context.conversationDepth > 2
    ) {
      return {
        type: 'expertise_mismatch',
        confidence: 0.8,
        targetAgent: idealAgent,
        reason: `Topic '${context.conversationTopic}' better handled by ${idealAgent} agent`,
      };
    }

    return null;
  }

  // Suggest a better agent based on context
  private suggestBetterAgent(
    context: ConversationContext,
    currentAgent: AgentType,
  ): AgentType {
    // Based on conversation topic
    if (context.conversationTopic === 'technical') return 'website_support';
    if (context.conversationTopic === 'humor') return 'joke';
    if (context.conversationTopic === 'educational') return 'trivia';
    if (context.conversationTopic === 'visual_entertainment') return 'gif';

    // Default fallback to general agent if current agent isn't performing well
    return currentAgent === 'general' ? 'joke' : 'general';
  }

  // Suggest a different agent to refresh conversation
  private suggestRefreshAgent(currentAgent: AgentType): AgentType {
    const refreshOptions: Record<AgentType, AgentType> = {
      general: 'joke',
      joke: 'trivia',
      trivia: 'gif',
      gif: 'riddle_master',
      account_support: 'hold_agent',
      billing_support: 'hold_agent',
      website_support: 'hold_agent',
      operator_support: 'hold_agent',
      hold_agent: 'joke',
      story_teller: 'riddle_master',
      riddle_master: 'quote_master',
      quote_master: 'game_host',
      game_host: 'music_guru',
      music_guru: 'youtube_guru',
      youtube_guru: 'story_teller',
      dnd_master: 'story_teller',
    };

    return refreshOptions[currentAgent] || 'hold_agent';
  }

  // Generate handoff message for smooth transition
  generateHandoffMessage(context: ConversationContext): string | null {
    if (!context.shouldHandoff || !context.handoffTarget) return null;

    const handoffMessages: Record<string, Record<AgentType, string>> = {
      explicit_request: {
        website_support:
          "I can see you're having technical or website issues! Let me connect you with our Website Issues Specialist who can help with browser and functionality problems.",
        joke: "I can tell you're looking for some laughs! Let me bring in our Adaptive Joke Master - they learn your sense of humor and get better at making you laugh over time.",
        trivia:
          "You're curious about fascinating facts! Our Trivia Master has an amazing collection of knowledge to share with you.",
        gif: 'For visual entertainment and fun GIFs, our GIF Master is perfect for that!',
        general:
          'Let me connect you with our General Assistant who can help with a wide range of topics.',
        account_support:
          'I can see you have an account-related question! Let me connect you with our Account Support Specialist who handles login, profile, and security issues.',
        billing_support:
          'This looks like a billing or payment question! Our Billing Support Specialist is the expert for subscription, payment, and refund matters.',
        operator_support:
          'Let me connect you with our Customer Service Operator who can coordinate multiple departments and handle complex issues.',
        hold_agent:
          'Let me connect you with our Hold Agent who will keep you updated on wait times and coordinate entertainment while you wait for specialist assistance.',
        story_teller:
          'Let me bring in our Story Teller who can craft engaging short stories to entertain you!',
        riddle_master:
          'Our Riddle Master has fascinating brain teasers and puzzles to challenge your mind!',
        quote_master:
          'Our Quote Master has inspirational and entertaining quotes to share with you!',
        game_host:
          'Let me connect you with our Game Host who can start fun interactive games to pass the time!',
        music_guru:
          'Our Music Guru can provide personalized music recommendations and discuss your favorite artists!',
        youtube_guru:
          'Let me bring in our YouTube Guru who has amazing funny videos and viral content to entertain you!',
        dnd_master:
          'Let me bring in our D&D Master who can run an interactive RPG lite experience with dice rolling, character creation, and random encounters!',
      },
      expertise_mismatch: {
        joke: 'I think our Adaptive Joke Master would be perfect for bringing some humor to this conversation!',
        trivia:
          'Our Trivia Master would love to share some fascinating knowledge with you about this topic!',
        gif: 'Let me bring in our GIF Master to add some visual fun to this conversation!',
        general:
          'Our General Assistant might have a fresh perspective on this topic.',
        account_support:
          'This appears to be account-related. Our Account Support Specialist would be better equipped to handle this securely and efficiently.',
        billing_support:
          'This sounds like a billing matter. Our Billing Support Specialist has the expertise and access needed for financial inquiries.',
        website_support:
          'This seems to be a website functionality issue. Our Website Issues Specialist can provide targeted technical troubleshooting.',
        operator_support:
          "This looks like a complex issue that would benefit from our Customer Service Operator's coordination expertise.",
        hold_agent:
          'Let me connect you with our Hold Agent who specializes in managing wait times and coordinating appropriate entertainment while you wait.',
        story_teller:
          'This seems perfect for our Story Teller who can craft engaging narratives on this topic!',
        riddle_master:
          'Our Riddle Master would love to create mind-bending puzzles around this theme!',
        quote_master:
          'Our Quote Master has relevant wisdom and quotes that would perfectly address this topic!',
        game_host:
          'Our Game Host could turn this into an interactive and engaging experience!',
        music_guru:
          'Our Music Guru has perfect musical knowledge and recommendations for this topic!',
        youtube_guru:
          'Our YouTube Guru has amazing funny videos and viral content perfect for this topic!',
        dnd_master:
          'Our D&D Master would be perfect for turning this topic into an interactive RPG adventure with dice, characters, and storytelling!',
      },
      performance_decline: {
        joke: 'How about we lighten the mood? Our Adaptive Joke Master is great at turning things around with some personalized humor!',
        trivia:
          'Maybe our Trivia Master can share something interesting that might be more helpful?',
        gif: "Let's try something different! Our GIF Master can add some visual entertainment to brighten things up.",
        general:
          'Let me bring in our General Assistant for a fresh approach to your question.',
        account_support:
          'Let me connect you with our Account Support Specialist who might have better solutions for your account concerns.',
        billing_support:
          'Our Billing Support Specialist might be able to provide better assistance with your financial inquiry.',
        website_support:
          'Let me bring in our Website Issues Specialist who might have different troubleshooting approaches for your technical issue.',
        operator_support:
          'Our Customer Service Operator might be able to coordinate a better solution for your complex inquiry.',
        hold_agent:
          'Let me connect you with our Hold Agent who can provide better hold management and entertainment coordination while you wait.',
        story_teller:
          'How about a fresh story approach? Our Story Teller might have exactly what you need!',
        riddle_master:
          "Let's try some brain teasers! Our Riddle Master could help engage your mind differently!",
        quote_master:
          'Our Quote Master might have the perfect inspirational words to help!',
        game_host:
          "Let's make this more interactive! Our Game Host can turn this into an engaging experience!",
        music_guru:
          'Our Music Guru might have the perfect musical perspective to help brighten things up!',
        youtube_guru:
          "Let's try our YouTube Guru - they have amazing funny videos that might be exactly what you need!",
        dnd_master:
          'How about we try something completely different? Our D&D Master can create an immersive RPG experience with dice rolling and adventures that might be exactly what you need!',
      },
      conversation_stagnation: {
        joke: 'How about we shake things up with some humor? Our Adaptive Joke Master is great at refreshing conversations!',
        trivia:
          'Maybe our Trivia Master can share something fascinating to spark new ideas?',
        gif: "Let's add some visual fun! Our GIF Master can definitely liven up our conversation.",
        general:
          'Our General Assistant might bring a fresh perspective to keep our conversation engaging.',
        account_support:
          'Let me bring in our Account Support Specialist for a fresh approach to your account-related concerns.',
        billing_support:
          'Our Billing Support Specialist might have different options to explore for your billing inquiry.',
        website_support:
          "Let's try our Website Issues Specialist - they might have alternative solutions for your technical problem.",
        operator_support:
          'Our Customer Service Operator can bring fresh coordination and multiple-department expertise to help resolve this.',
        hold_agent:
          'Let me connect you with our Hold Agent who can provide fresh updates on your wait status and coordinate different entertainment options.',
        story_teller:
          "Let's shake things up with some storytelling! Our Story Teller can bring fresh narrative energy to our conversation!",
        riddle_master:
          'How about we challenge your mind differently? Our Riddle Master has fresh puzzles to reinvigorate our chat!',
        quote_master:
          'Our Quote Master has inspiring words that might spark new directions for our conversation!',
        game_host:
          "Let's try something completely different! Our Game Host can bring interactive fun to refresh our discussion!",
        music_guru:
          'Our Music Guru can bring a whole new vibe with music recommendations and discussions to liven things up!',
        youtube_guru:
          "Let's try our YouTube Guru! They have incredible funny videos and viral content that can completely transform our conversation energy!",
        dnd_master:
          "Let's completely reinvent our conversation! Our D&D Master can transform this into an epic interactive RPG adventure with dice rolling, character creation, and immersive storytelling!",
      },
    };

    const reasonCategory = context.handoffReason?.includes('explicit')
      ? 'explicit_request'
      : context.handoffReason?.includes('expertise')
        ? 'expertise_mismatch'
        : context.handoffReason?.includes('performance')
          ? 'performance_decline'
          : 'conversation_stagnation';

    return (
      handoffMessages[reasonCategory]?.[context.handoffTarget] ||
      `Let me connect you with a different assistant who might be better suited to help you.`
    );
  }

  // Complete the handoff and reset context
  completeHandoff(userId: string, newAgent: AgentType): ConversationContext {
    const context = this.contexts.get(userId);
    if (!context) {
      return this.initializeContext(userId, newAgent);
    }

    // Reset handoff flags and update agent
    context.currentAgent = newAgent;
    context.shouldHandoff = false;
    context.handoffReason = undefined;
    context.handoffTarget = undefined;
    context.conversationDepth = 0; // Reset depth for new agent
    context.agentPerformance = 0.7; // Reset performance for new agent

    this.contexts.set(userId, context);
    return context;
  }

  // Get current context for a user
  getContext(userId: string): ConversationContext | null {
    return this.contexts.get(userId) || null;
  }

  // Check if handoff is needed
  shouldHandoff(userId: string): boolean {
    const context = this.contexts.get(userId);
    return context?.shouldHandoff || false;
  }

  // Get handoff information
  getHandoffInfo(
    userId: string,
  ): { target: AgentType; reason: string; message: string } | null {
    const context = this.contexts.get(userId);
    if (!context?.shouldHandoff || !context.handoffTarget) return null;

    return {
      target: context.handoffTarget,
      reason: context.handoffReason || 'Unknown reason',
      message:
        this.generateHandoffMessage(context) || 'Switching to better agent',
    };
  }

  // Clean up old contexts
  cleanup(maxAge: number = 3600000): void {
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

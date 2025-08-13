import { AgentService } from './agentService';
import { AgentType } from './types';
import { Message } from '../types';

export interface Goal {
  id: string;
  type: 'entertainment' | 'technical_support' | 'engagement';
  priority: number;
  description: string;
  success_criteria: string[];
  active: boolean;
  progress: number; // 0-1
  lastUpdated: Date;
}

export interface UserState {
  userId: string;
  currentState: 'on_hold' | 'active_conversation' | 'idle' | 'waiting_for_help';
  lastInteractionTime: Date;
  lastUpdated?: Date;
  entertainmentPreference?: 'jokes' | 'trivia' | 'general_chat' | 'mixed';
  technicalContext?: string;
  satisfactionLevel: number; // 0-1
  engagementLevel: number; // 0-1
  goals: Goal[];
}

export interface GoalAction {
  type:
    | 'proactive_message'
    | 'agent_switch'
    | 'entertainment_offer'
    | 'technical_check'
    | 'status_update';
  agentType: AgentType;
  message: string;
  timing: 'immediate' | 'delayed';
  delayMs?: number;
}

export class GoalSeekingSystem {
  private agentService: AgentService;
  private userStates: Map<string, UserState> = new Map();
  private goalTemplates: Goal[] = [
    {
      id: 'entertain_on_hold',
      type: 'entertainment',
      priority: 8,
      description: 'Keep user entertained while waiting for support',
      success_criteria: [
        'User responds positively to entertainment',
        'Engagement level > 0.7',
        'User remains in conversation',
      ],
      active: false,
      progress: 0,
      lastUpdated: new Date(),
    },
    {
      id: 'provide_technical_support',
      type: 'technical_support',
      priority: 10,
      description: 'Answer technical questions effectively',
      success_criteria: [
        'User problem is resolved',
        'Technical accuracy is maintained',
        'User satisfaction > 0.8',
      ],
      active: false,
      progress: 0,
      lastUpdated: new Date(),
    },
    {
      id: 'maintain_engagement',
      type: 'engagement',
      priority: 6,
      description: 'Keep user engaged and prevent abandonment',
      success_criteria: [
        'User continues conversation',
        'Response time < 5 minutes',
        'User asks follow-up questions',
      ],
      active: false,
      progress: 0,
      lastUpdated: new Date(),
    },
  ];

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  // Initialize user state when they first connect
  initializeUser(userId: string): UserState {
    const userState: UserState = {
      userId,
      currentState: 'idle',
      lastInteractionTime: new Date(),
      satisfactionLevel: 0.5,
      engagementLevel: 0.5,
      goals: this.goalTemplates.map(template => ({
        ...template,
        id: `${userId}_${template.id}`,
        lastUpdated: new Date(),
      })),
    };

    this.userStates.set(userId, userState);
    return userState;
  }

  // Update user state based on their message and context
  updateUserState(userId: string, message: string, context?: any): UserState {
    const userState =
      this.userStates.get(userId) || this.initializeUser(userId);

    // Update basic state
    userState.lastInteractionTime = new Date();

    // Analyze message to determine user state
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('waiting') ||
      lowerMessage.includes('hold') ||
      lowerMessage.includes('queue')
    ) {
      userState.currentState = 'on_hold';
    } else if (
      lowerMessage.includes('help') ||
      lowerMessage.includes('problem') ||
      lowerMessage.includes('error') ||
      lowerMessage.includes('bug')
    ) {
      userState.currentState = 'waiting_for_help';
    } else {
      userState.currentState = 'active_conversation';
    }

    // Determine entertainment preference
    if (lowerMessage.includes('joke') || lowerMessage.includes('funny')) {
      userState.entertainmentPreference = 'jokes';
    } else if (
      lowerMessage.includes('trivia') ||
      lowerMessage.includes('fact') ||
      lowerMessage.includes('learn')
    ) {
      userState.entertainmentPreference = 'trivia';
    } else if (lowerMessage.includes('chat') || lowerMessage.includes('talk')) {
      userState.entertainmentPreference = 'general_chat';
    } else if (!userState.entertainmentPreference) {
      userState.entertainmentPreference = 'mixed';
    }

    // Extract technical context
    if (
      lowerMessage.includes('code') ||
      lowerMessage.includes('programming') ||
      lowerMessage.includes('javascript') ||
      lowerMessage.includes('react') ||
      lowerMessage.includes('bug') ||
      lowerMessage.includes('error')
    ) {
      userState.technicalContext = message;
    }

    // Update engagement level based on message characteristics
    if (
      message.length > 50 &&
      (message.includes('?') || message.includes('help'))
    ) {
      userState.engagementLevel = Math.min(1, userState.engagementLevel + 0.2);
    } else if (message.length < 10) {
      userState.engagementLevel = Math.max(0, userState.engagementLevel - 0.1);
    }

    this.userStates.set(userId, userState);
    return userState;
  }

  // Activate goals based on user state
  // Entertainment goals should primarily activate when user is on hold with hold agent
  activateGoals(userId: string): Goal[] {
    const userState = this.userStates.get(userId);
    if (!userState) return [];

    // Check if user is currently with the hold agent
    const activeAgentInfo = (this.agentService as any).getActiveAgentInfo(
      userId,
    );
    const isWithHoldAgent = activeAgentInfo?.agentType === 'hold_agent';

    const activatedGoals: Goal[] = [];

    userState.goals.forEach(goal => {
      let shouldActivate = false;

      switch (goal.type) {
        case 'entertainment':
          // Entertainment goals should only activate when user is with hold agent and on hold
          shouldActivate =
            isWithHoldAgent &&
            (userState.currentState === 'on_hold' ||
              userState.engagementLevel < 0.6);
          break;
        case 'technical_support':
          shouldActivate =
            userState.currentState === 'waiting_for_help' ||
            userState.technicalContext !== undefined;
          break;
        case 'engagement':
          // Engagement goals should only activate when user is with hold agent
          shouldActivate =
            isWithHoldAgent &&
            (userState.engagementLevel < 0.5 ||
              Date.now() - userState.lastInteractionTime.getTime() > 30000);
          break;
      }

      if (shouldActivate && !goal.active) {
        goal.active = true;
        goal.lastUpdated = new Date();
        activatedGoals.push(goal);
        console.log(
          `🎯 Goal activated for user ${userId}: ${goal.type} (with hold agent: ${isWithHoldAgent})`,
        );
      }
    });

    return activatedGoals;
  }

  // Generate proactive actions based on active goals
  // ONLY generate proactive actions when user is with the hold agent
  async generateProactiveActions(userId: string): Promise<GoalAction[]> {
    const userState = this.userStates.get(userId);
    if (!userState) return [];

    // Check if user is currently with the hold agent
    const activeAgentInfo = (this.agentService as any).getActiveAgentInfo(
      userId,
    );
    const isWithHoldAgent = activeAgentInfo?.agentType === 'hold_agent';

    // If not with hold agent, don't generate any proactive actions
    if (!isWithHoldAgent) {
      console.log(
        `🚫 Proactive actions skipped for user ${userId} - not with hold agent (current: ${activeAgentInfo?.agentType || 'none'})`,
      );
      return [];
    }

    console.log(
      `✅ User ${userId} is with hold agent - generating proactive actions`,
    );

    const actions: GoalAction[] = [];
    const activeGoals = userState.goals.filter(g => g.active);

    // Sort by priority (higher priority first)
    activeGoals.sort((a, b) => b.priority - a.priority);

    for (const goal of activeGoals) {
      const action = await this.generateActionForGoal(goal, userState);
      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  private async generateActionForGoal(
    goal: Goal,
    userState: UserState,
  ): Promise<GoalAction | null> {
    switch (goal.type) {
      case 'entertainment':
        return this.generateEntertainmentAction(userState);
      case 'technical_support':
        return this.generateTechnicalSupportAction(userState);
      case 'engagement':
        return this.generateEngagementAction(userState);
      default:
        return null;
    }
  }

  private async generateEntertainmentAction(
    userState: UserState,
  ): Promise<GoalAction> {
    const preference = userState.entertainmentPreference || 'mixed';
    let agentType: AgentType;
    let message: string;

    // Calculate appropriate delay based on how long user has been waiting
    const timeSinceLastInteraction =
      Date.now() - userState.lastInteractionTime.getTime();
    let delayMs = 15000; // Default 15 seconds

    // If user has been waiting longer, reduce delay
    if (timeSinceLastInteraction > 60000) {
      // 1 minute
      delayMs = 5000; // 5 seconds
    } else if (timeSinceLastInteraction > 30000) {
      // 30 seconds
      delayMs = 10000; // 10 seconds
    }

    // All available entertainment agents - ONLY entertainment agents can be proactive
    const entertainmentAgents: AgentType[] = [
      'joke',
      'trivia',
      'gif',
      'story_teller',
      'riddle_master',
      'quote_master',
      'game_host',
      'music_guru',
    ];

    switch (preference) {
      case 'jokes':
        agentType = 'joke';
        message =
          'Tell me a joke right now. I want to hear one of your best ones!';
        break;
      case 'trivia':
        agentType = 'trivia';
        message =
          'Share a fascinating trivia fact with me right now. I want to learn something interesting!';
        break;
      case 'general_chat':
        // Changed from general agent to random entertainment agent
        const randomChatIndex = Math.floor(
          Math.random() * entertainmentAgents.length,
        );
        agentType = entertainmentAgents[randomChatIndex];
        message = this.getEntertainmentMessage(agentType);
        break;
      default:
        // AUTOMATIC RANDOM ENTERTAINMENT HANDOFF
        // Select a random entertainment agent from all available options
        const randomIndex = Math.floor(
          Math.random() * entertainmentAgents.length,
        );
        agentType = entertainmentAgents[randomIndex];
        message = this.getEntertainmentMessage(agentType);

        console.log(
          `🎲 AUTOMATIC ENTERTAINMENT HANDOFF: Selected random agent '${agentType}' from ${entertainmentAgents.length} available entertainment agents`,
        );
    }

    return {
      type: 'proactive_message',
      agentType,
      message,
      timing: 'delayed',
      delayMs,
    };
  }

  // Helper method to get appropriate message for each entertainment agent
  private getEntertainmentMessage(agentType: AgentType): string {
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
      case 'game_host':
        return 'Start a fun interactive game with me right now. I want to play something engaging!';
      case 'music_guru':
        return 'Give me a personalized music recommendation right now. I want to discover something great!';
      default:
        return 'Entertain me right now with your specialty!';
    }
  }

  private async generateTechnicalSupportAction(
    userState: UserState,
  ): Promise<GoalAction> {
    let message = "I'm here to help with your technical question. ";

    if (userState.technicalContext) {
      message +=
        'I can see you mentioned something technical - let me assist you with that.';
    } else {
      message += 'What technical issue can I help you solve today?';
    }

    return {
      type: 'technical_check',
      agentType: 'website_support',
      message,
      timing: 'immediate',
    };
  }

  private async generateEngagementAction(
    userState: UserState,
  ): Promise<GoalAction> {
    // REMOVED ALL GENERAL AGENT PROACTIVE ACTIONS - Only entertainment agents should be proactive
    // Instead of general agent status updates, let entertainment agents handle engagement

    const entertainmentAgents: AgentType[] = [
      'joke',
      'trivia',
      'gif',
      'story_teller',
      'riddle_master',
      'quote_master',
      'game_host',
      'music_guru',
    ];
    const randomAgent =
      entertainmentAgents[
        Math.floor(Math.random() * entertainmentAgents.length)
      ];

    return {
      type: 'proactive_message',
      agentType: randomAgent,
      message: this.getEntertainmentMessage(randomAgent),
      timing: 'delayed',
      delayMs: 30000, // 30 seconds delay for engagement through entertainment
    };
  }

  // Process user response and update goal progress
  updateGoalProgress(
    userId: string,
    userResponse: string,
    agentResponse: string,
  ): void {
    const userState = this.userStates.get(userId);
    if (!userState) return;

    const lowerResponse = userResponse.toLowerCase();
    const positiveIndicators = [
      'thanks',
      'great',
      'good',
      'nice',
      'awesome',
      'helpful',
      'perfect',
    ];
    const negativeIndicators = [
      'no',
      'stop',
      'boring',
      'annoying',
      'not helpful',
    ];

    userState.goals.forEach(goal => {
      if (!goal.active) return;

      switch (goal.type) {
        case 'entertainment':
          if (
            positiveIndicators.some(indicator =>
              lowerResponse.includes(indicator),
            )
          ) {
            goal.progress = Math.min(1, goal.progress + 0.3);
            userState.satisfactionLevel = Math.min(
              1,
              userState.satisfactionLevel + 0.1,
            );
          } else if (
            negativeIndicators.some(indicator =>
              lowerResponse.includes(indicator),
            )
          ) {
            goal.progress = Math.max(0, goal.progress - 0.2);
            userState.satisfactionLevel = Math.max(
              0,
              userState.satisfactionLevel - 0.1,
            );
          }
          break;

        case 'technical_support':
          if (
            lowerResponse.includes('solved') ||
            lowerResponse.includes('works') ||
            lowerResponse.includes('fixed')
          ) {
            goal.progress = 1;
            userState.satisfactionLevel = Math.min(
              1,
              userState.satisfactionLevel + 0.2,
            );
          } else if (
            lowerResponse.includes('help') ||
            lowerResponse.includes('more')
          ) {
            goal.progress = Math.min(1, goal.progress + 0.1);
          }
          break;

        case 'engagement':
          if (userResponse.length > 20) {
            goal.progress = Math.min(1, goal.progress + 0.2);
            userState.engagementLevel = Math.min(
              1,
              userState.engagementLevel + 0.1,
            );
          }
          break;
      }

      goal.lastUpdated = new Date();
    });

    this.userStates.set(userId, userState);
  }

  // Get user state for monitoring
  getUserState(userId: string): UserState | null {
    return this.userStates.get(userId) || null;
  }

  // Get all active goals for a user
  getActiveGoals(userId: string): Goal[] {
    const userState = this.userStates.get(userId);
    return userState ? userState.goals.filter(g => g.active) : [];
  }

  // Clean up inactive users
  cleanupInactiveUsers(maxInactiveTime: number = 3600000): void {
    // 1 hour default
    const now = Date.now();

    for (const [userId, userState] of this.userStates) {
      if (now - userState.lastInteractionTime.getTime() > maxInactiveTime) {
        this.userStates.delete(userId);
      }
    }
  }
}

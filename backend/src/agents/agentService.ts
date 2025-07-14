import OpenAI from 'openai';
import { classifyMessage } from './classifier';
import { getAgent } from './config';
import { AgentResponse, AgentType } from './types';
import { Message } from '../types';
import { GoalSeekingSystem, GoalAction } from './goalSeekingSystem';

export class AgentService {
  private goalSeekingSystem: GoalSeekingSystem;

  constructor() {
    this.goalSeekingSystem = new GoalSeekingSystem(this);
  }

  async processMessage(
    message: string, 
    conversationHistory: Message[] = [],
    forcedAgentType?: AgentType
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

    // Prepare the conversation history for the agent
    const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [
      {
        role: 'system',
        content: agent.systemPrompt
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
    } else if (agentName === 'Dad Joke Master') {
      return `**Dad Joke Master Response** (Demo Mode)

Oh, you want some dad jokes? I've got plenty! Here's a classic for you:

Why don't scientists trust atoms?
Because they make up everything! 😄

*slaps knee* Gets me every time! 

In demo mode, I would normally:
- Share groan-worthy dad jokes and puns
- Make terrible wordplay about anything
- Bring that classic dad energy to every conversation
- Turn everyday situations into joke opportunities

To get real AI responses with fresh dad jokes, please set your OPENAI_API_KEY environment variable.`;
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
        id: 'dad_joke',
        name: 'Dad Joke Master',
        description: 'Your go-to source for groan-worthy dad jokes and puns that will make you laugh (or cringe)'
      }
    ];
  }

  // Goal-seeking system integration methods
  async processMessageWithGoalSeeking(
    userId: string,
    message: string,
    conversationHistory: Message[] = [],
    forcedAgentType?: AgentType
  ): Promise<AgentResponse & { proactiveActions?: GoalAction[] }> {
    // Update user state based on their message
    this.goalSeekingSystem.updateUserState(userId, message);

    // Activate goals based on current user state
    const activatedGoals = this.goalSeekingSystem.activateGoals(userId);
    
    // Process the message normally
    const response = await this.processMessage(message, conversationHistory, forcedAgentType);

    // Update goal progress based on the response
    this.goalSeekingSystem.updateGoalProgress(userId, message, response.content);

    // Generate proactive actions if goals are active
    const proactiveActions = await this.goalSeekingSystem.generateProactiveActions(userId);

    return {
      ...response,
      proactiveActions: proactiveActions.length > 0 ? proactiveActions : undefined
    };
  }

  // Execute a proactive action
  async executeProactiveAction(
    userId: string,
    action: GoalAction,
    conversationHistory: Message[] = []
  ): Promise<AgentResponse> {
    let proactiveMessage: string;

    // Generate appropriate proactive content based on agent type
    if (action.agentType === 'dad_joke') {
      proactiveMessage = "I thought I'd share a dad joke to brighten your wait! Here's one of my favorites:";
    } else if (action.agentType === 'trivia') {
      proactiveMessage = "While you're waiting, here's a fascinating fact I'd love to share with you:";
    } else {
      proactiveMessage = action.message;
    }

    // Process the proactive message using the specified agent
    return await this.processMessage(
      proactiveMessage,
      conversationHistory,
      action.agentType
    );
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
  }
}

export const agentService = new AgentService();

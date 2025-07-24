export interface UserReaction {
  messageId: string;
  userId: string;
  reactionType: 'laugh' | 'groan' | 'love' | 'meh' | 'dislike';
  timestamp: Date;
  jokeType?: string;
  jokeCategory?: string;
}

export interface JokePerformance {
  jokeId: string;
  content: string;
  category: string;
  type: string;
  totalShows: number;
  positiveReactions: number;
  negativeReactions: number;
  neutralReactions: number;
  successRate: number;
  lastUsed: Date;
  userSpecificPerformance: Map<string, {
    shows: number;
    positiveReactions: number;
    negativeReactions: number;
    successRate: number;
  }>;
}

export interface UserJokeProfile {
  userId: string;
  preferredCategories: string[];
  preferredTypes: string[];
  dislikedCategories: string[];
  dislikedTypes: string[];
  humorStyle: 'witty' | 'silly' | 'clever' | 'absurd' | 'mixed';
  reactionHistory: UserReaction[];
  lastInteraction: Date;
  totalJokesHeard: number;
  averageReactionScore: number;
}

export interface JokeCategory {
  name: string;
  description: string;
  examples: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  appropriateness: 'family' | 'adult' | 'workplace';
}

export interface LearningMetrics {
  totalJokesGenerated: number;
  totalReactions: number;
  overallSuccessRate: number;
  categoryPerformance: Map<string, number>;
  userSatisfactionTrend: number[];
  adaptationAccuracy: number;
}

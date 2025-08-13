import {
  UserReaction,
  JokePerformance,
  UserJokeProfile,
  JokeCategory,
  LearningMetrics,
} from './learningTypes';

export class JokeLearningSystem {
  private userProfiles: Map<string, UserJokeProfile> = new Map();
  private jokePerformance: Map<string, JokePerformance> = new Map();
  private learningMetrics: LearningMetrics;
  private jokeCategories: JokeCategory[] = [
    {
      name: 'dad_jokes',
      description: 'Classic groan-worthy puns and wordplay',
      examples: [
        "Why don't scientists trust atoms? Because they make up everything!",
      ],
      difficulty: 'easy',
      appropriateness: 'family',
    },
    {
      name: 'observational',
      description: 'Humor about everyday situations and life',
      examples: ["Why do they call it rush hour when nobody's moving?"],
      difficulty: 'medium',
      appropriateness: 'family',
    },
    {
      name: 'wordplay',
      description: 'Clever puns and linguistic humor',
      examples: ['I used to be a banker, but I lost interest.'],
      difficulty: 'medium',
      appropriateness: 'family',
    },
    {
      name: 'absurd',
      description: 'Surreal and unexpected humor',
      examples: [
        'A man walks into a library and asks for books on paranoia. The librarian whispers, "They\'re right behind you!"',
      ],
      difficulty: 'hard',
      appropriateness: 'family',
    },
    {
      name: 'self_deprecating',
      description: 'Humor that pokes fun at oneself',
      examples: [
        'I told my wife she was drawing her eyebrows too high. She looked surprised.',
      ],
      difficulty: 'medium',
      appropriateness: 'family',
    },
    {
      name: 'tech_humor',
      description: 'Jokes about technology and programming',
      examples: [
        'Why do programmers prefer dark mode? Because light attracts bugs!',
      ],
      difficulty: 'medium',
      appropriateness: 'workplace',
    },
  ];

  constructor() {
    this.learningMetrics = {
      totalJokesGenerated: 0,
      totalReactions: 0,
      overallSuccessRate: 0,
      categoryPerformance: new Map(),
      userSatisfactionTrend: [],
      adaptationAccuracy: 0,
    };

    // Initialize category performance tracking
    this.jokeCategories.forEach(category => {
      this.learningMetrics.categoryPerformance.set(category.name, 0.5);
    });
  }

  // Record user reaction to a joke
  recordReaction(reaction: UserReaction): void {
    // Update user profile
    let userProfile = this.userProfiles.get(reaction.userId);
    if (!userProfile) {
      userProfile = this.initializeUserProfile(reaction.userId);
    }

    userProfile.reactionHistory.push(reaction);
    userProfile.lastInteraction = reaction.timestamp;
    userProfile.totalJokesHeard++;

    // Update average reaction score
    const reactionScore = this.getReactionScore(reaction.reactionType);
    const totalScore =
      userProfile.averageReactionScore * (userProfile.totalJokesHeard - 1) +
      reactionScore;
    userProfile.averageReactionScore = totalScore / userProfile.totalJokesHeard;

    // Update preferences based on reaction
    this.updateUserPreferences(userProfile, reaction);

    this.userProfiles.set(reaction.userId, userProfile);

    // Update joke performance
    if (reaction.jokeCategory && reaction.jokeType) {
      this.updateJokePerformance(reaction);
    }

    // Update learning metrics
    this.updateLearningMetrics(reaction);
  }

  // Get personalized joke recommendation for user
  getPersonalizedJokeRecommendation(userId: string): {
    category: string;
    type: string;
    style: string;
    avoidCategories: string[];
  } {
    const userProfile = this.userProfiles.get(userId);

    if (!userProfile || userProfile.reactionHistory.length < 3) {
      // New user or insufficient data - use balanced approach
      return {
        category: 'dad_jokes',
        type: 'pun',
        style: 'mixed',
        avoidCategories: [],
      };
    }

    // Analyze user's reaction patterns
    const categoryScores = new Map<string, number>();
    const typeScores = new Map<string, number>();

    userProfile.reactionHistory.forEach(reaction => {
      const score = this.getReactionScore(reaction.reactionType);

      if (reaction.jokeCategory) {
        const currentScore = categoryScores.get(reaction.jokeCategory) || 0;
        categoryScores.set(reaction.jokeCategory, currentScore + score);
      }

      if (reaction.jokeType) {
        const currentScore = typeScores.get(reaction.jokeType) || 0;
        typeScores.set(reaction.jokeType, currentScore + score);
      }
    });

    // Find best performing categories and types
    const bestCategory = this.getBestPerforming(
      categoryScores,
      userProfile.preferredCategories,
    );
    const bestType = this.getBestPerforming(
      typeScores,
      userProfile.preferredTypes,
    );

    return {
      category: bestCategory || 'dad_jokes',
      type: bestType || 'pun',
      style: userProfile.humorStyle,
      avoidCategories: userProfile.dislikedCategories,
    };
  }

  // Generate adaptive system prompt based on user preferences and performance
  generateAdaptivePrompt(userId: string, basePrompt: string): string {
    const recommendation = this.getPersonalizedJokeRecommendation(userId);
    const userProfile = this.userProfiles.get(userId);

    let adaptivePrompt = basePrompt;

    // Add personalization instructions
    adaptivePrompt += `\n\nPERSONALIZATION INSTRUCTIONS:
- Focus on ${recommendation.category} category jokes
- Use ${recommendation.type} style humor
- Adapt to ${recommendation.style} humor style
- User's average satisfaction: ${userProfile?.averageReactionScore.toFixed(2) || 'unknown'}`;

    if (recommendation.avoidCategories.length > 0) {
      adaptivePrompt += `\n- AVOID these categories: ${recommendation.avoidCategories.join(', ')}`;
    }

    if (userProfile && userProfile.preferredCategories.length > 0) {
      adaptivePrompt += `\n- User enjoys: ${userProfile.preferredCategories.join(', ')}`;
    }

    // Add performance-based adjustments
    const overallPerformance = this.learningMetrics.overallSuccessRate;
    if (overallPerformance < 0.6) {
      adaptivePrompt += `\n- Current performance is low (${(overallPerformance * 100).toFixed(1)}%), try different approaches`;
    } else if (overallPerformance > 0.8) {
      adaptivePrompt += `\n- Performance is excellent (${(overallPerformance * 100).toFixed(1)}%), maintain current style`;
    }

    // Add learning goals
    adaptivePrompt += `\n\nLEARNING GOALS:
- Maximize user entertainment and satisfaction
- Adapt jokes based on user reactions
- Learn from successful joke patterns
- Avoid repeating unsuccessful joke types for this user`;

    return adaptivePrompt;
  }

  // Get user's joke profile
  getUserProfile(userId: string): UserJokeProfile | null {
    return this.userProfiles.get(userId) || null;
  }

  // Get overall learning metrics
  getLearningMetrics(): LearningMetrics {
    return { ...this.learningMetrics };
  }

  // Get joke categories
  getJokeCategories(): JokeCategory[] {
    return [...this.jokeCategories];
  }

  // Private helper methods
  private initializeUserProfile(userId: string): UserJokeProfile {
    return {
      userId,
      preferredCategories: [],
      preferredTypes: [],
      dislikedCategories: [],
      dislikedTypes: [],
      humorStyle: 'mixed',
      reactionHistory: [],
      lastInteraction: new Date(),
      totalJokesHeard: 0,
      averageReactionScore: 0.5,
    };
  }

  private getReactionScore(reactionType: string): number {
    switch (reactionType) {
      case 'love':
        return 1.0;
      case 'laugh':
        return 0.8;
      case 'groan':
        return 0.6; // Groans are actually positive for dad jokes!
      case 'meh':
        return 0.4;
      case 'dislike':
        return 0.1;
      default:
        return 0.5;
    }
  }

  private updateUserPreferences(
    profile: UserJokeProfile,
    reaction: UserReaction,
  ): void {
    const score = this.getReactionScore(reaction.reactionType);

    if (reaction.jokeCategory) {
      if (score >= 0.7) {
        // Positive reaction - add to preferred
        if (!profile.preferredCategories.includes(reaction.jokeCategory)) {
          profile.preferredCategories.push(reaction.jokeCategory);
        }
        // Remove from disliked if present
        profile.dislikedCategories = profile.dislikedCategories.filter(
          cat => cat !== reaction.jokeCategory,
        );
      } else if (score <= 0.3) {
        // Negative reaction - add to disliked
        if (!profile.dislikedCategories.includes(reaction.jokeCategory)) {
          profile.dislikedCategories.push(reaction.jokeCategory);
        }
        // Remove from preferred if present
        profile.preferredCategories = profile.preferredCategories.filter(
          cat => cat !== reaction.jokeCategory,
        );
      }
    }

    if (reaction.jokeType) {
      if (score >= 0.7) {
        if (!profile.preferredTypes.includes(reaction.jokeType)) {
          profile.preferredTypes.push(reaction.jokeType);
        }
        profile.dislikedTypes = profile.dislikedTypes.filter(
          type => type !== reaction.jokeType,
        );
      } else if (score <= 0.3) {
        if (!profile.dislikedTypes.includes(reaction.jokeType)) {
          profile.dislikedTypes.push(reaction.jokeType);
        }
        profile.preferredTypes = profile.preferredTypes.filter(
          type => type !== reaction.jokeType,
        );
      }
    }

    // Update humor style based on reaction patterns
    this.updateHumorStyle(profile);
  }

  private updateHumorStyle(profile: UserJokeProfile): void {
    if (profile.reactionHistory.length < 5) return;

    const recentReactions = profile.reactionHistory.slice(-10);
    const categoryPreferences = new Map<string, number>();

    recentReactions.forEach(reaction => {
      if (reaction.jokeCategory) {
        const score = this.getReactionScore(reaction.reactionType);
        const current = categoryPreferences.get(reaction.jokeCategory) || 0;
        categoryPreferences.set(reaction.jokeCategory, current + score);
      }
    });

    // Determine humor style based on preferred categories
    const topCategories = Array.from(categoryPreferences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(entry => entry[0]);

    if (
      topCategories.includes('wordplay') ||
      topCategories.includes('tech_humor')
    ) {
      profile.humorStyle = 'clever';
    } else if (topCategories.includes('absurd')) {
      profile.humorStyle = 'absurd';
    } else if (topCategories.includes('dad_jokes')) {
      profile.humorStyle = 'silly';
    } else if (topCategories.includes('observational')) {
      profile.humorStyle = 'witty';
    } else {
      profile.humorStyle = 'mixed';
    }
  }

  private updateJokePerformance(reaction: UserReaction): void {
    const jokeId = `${reaction.jokeCategory}_${reaction.jokeType}_${reaction.messageId}`;
    let performance = this.jokePerformance.get(jokeId);

    if (!performance) {
      performance = {
        jokeId,
        content: '', // Would be filled from the actual joke content
        category: reaction.jokeCategory || 'unknown',
        type: reaction.jokeType || 'unknown',
        totalShows: 0,
        positiveReactions: 0,
        negativeReactions: 0,
        neutralReactions: 0,
        successRate: 0,
        lastUsed: new Date(),
        userSpecificPerformance: new Map(),
      };
    }

    performance.totalShows++;
    performance.lastUsed = reaction.timestamp;

    const score = this.getReactionScore(reaction.reactionType);
    if (score >= 0.7) {
      performance.positiveReactions++;
    } else if (score <= 0.3) {
      performance.negativeReactions++;
    } else {
      performance.neutralReactions++;
    }

    performance.successRate =
      performance.positiveReactions / performance.totalShows;

    // Update user-specific performance
    let userPerf = performance.userSpecificPerformance.get(reaction.userId);
    if (!userPerf) {
      userPerf = {
        shows: 0,
        positiveReactions: 0,
        negativeReactions: 0,
        successRate: 0,
      };
    }

    userPerf.shows++;
    if (score >= 0.7) {
      userPerf.positiveReactions++;
    } else if (score <= 0.3) {
      userPerf.negativeReactions++;
    }
    userPerf.successRate = userPerf.positiveReactions / userPerf.shows;

    performance.userSpecificPerformance.set(reaction.userId, userPerf);
    this.jokePerformance.set(jokeId, performance);
  }

  private updateLearningMetrics(reaction: UserReaction): void {
    this.learningMetrics.totalReactions++;

    const score = this.getReactionScore(reaction.reactionType);
    const totalScore =
      this.learningMetrics.overallSuccessRate *
        (this.learningMetrics.totalReactions - 1) +
      score;
    this.learningMetrics.overallSuccessRate =
      totalScore / this.learningMetrics.totalReactions;

    // Update category performance
    if (reaction.jokeCategory) {
      const currentPerf =
        this.learningMetrics.categoryPerformance.get(reaction.jokeCategory) ||
        0.5;
      const newPerf = currentPerf * 0.9 + score * 0.1; // Weighted average
      this.learningMetrics.categoryPerformance.set(
        reaction.jokeCategory,
        newPerf,
      );
    }

    // Update satisfaction trend (keep last 100 reactions)
    this.learningMetrics.userSatisfactionTrend.push(score);
    if (this.learningMetrics.userSatisfactionTrend.length > 100) {
      this.learningMetrics.userSatisfactionTrend.shift();
    }
  }

  private getBestPerforming(
    scores: Map<string, number>,
    preferences: string[],
  ): string | null {
    if (scores.size === 0) return null;

    // Prefer user's known preferences
    for (const pref of preferences) {
      if (scores.has(pref) && scores.get(pref)! > 0.6) {
        return pref;
      }
    }

    // Otherwise, return highest scoring
    return Array.from(scores.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  // Clean up old data
  cleanupOldData(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    // 30 days default
    const cutoff = new Date(Date.now() - maxAge);

    // Clean up user profiles
    for (const [userId, profile] of this.userProfiles) {
      if (profile.lastInteraction < cutoff) {
        this.userProfiles.delete(userId);
      } else {
        // Clean up old reactions
        profile.reactionHistory = profile.reactionHistory.filter(
          reaction => reaction.timestamp > cutoff,
        );
      }
    }

    // Clean up joke performance data
    for (const [jokeId, performance] of this.jokePerformance) {
      if (performance.lastUsed < cutoff) {
        this.jokePerformance.delete(jokeId);
      }
    }
  }
}

export const jokeLearningSystem = new JokeLearningSystem();

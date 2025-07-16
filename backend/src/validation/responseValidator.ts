import { AgentType } from '../agents/types';
import { Message } from '../types';

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-1 quality score
  issues: ValidationIssue[];
  metrics: ValidationMetrics;
}

export interface ValidationIssue {
  type: 'content' | 'technical' | 'appropriateness' | 'length' | 'coherence';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion?: string;
}

export interface ValidationMetrics {
  responseLength: number;
  sentenceCount: number;
  readabilityScore: number;
  technicalAccuracy: number;
  appropriatenessScore: number;
  coherenceScore: number;
}

export interface ValidationLog {
  id: string;
  timestamp: Date;
  agentType: AgentType;
  userMessage: string;
  aiResponse: string;
  validationResult: ValidationResult;
  conversationId: string;
  userId: string;
  isProactive: boolean;
}

export class ResponseValidator {
  private validationLogs: ValidationLog[] = [];
  private readonly maxLogSize = 1000; // Keep last 1000 validations

  // Main validation method
  validateResponse(
    agentType: AgentType,
    userMessage: string,
    aiResponse: string,
    conversationId: string,
    userId: string,
    isProactive: boolean = false
  ): ValidationResult {
    const issues: ValidationIssue[] = [];
    const metrics = this.calculateMetrics(aiResponse);

    // Content validation
    this.validateContent(aiResponse, issues);
    
    // Technical accuracy validation
    this.validateTechnicalAccuracy(agentType, userMessage, aiResponse, issues);
    
    // Appropriateness validation
    this.validateAppropriateness(aiResponse, issues);
    
    // Length validation
    this.validateLength(aiResponse, agentType, issues);
    
    // Coherence validation
    this.validateCoherence(aiResponse, issues);

    // Calculate overall score
    const score = this.calculateOverallScore(metrics, issues);

    const validationResult: ValidationResult = {
      isValid: score >= 0.7 && !issues.some(i => i.severity === 'high'),
      score,
      issues,
      metrics
    };

    // Log the validation
    this.logValidation({
      id: this.generateId(),
      timestamp: new Date(),
      agentType,
      userMessage,
      aiResponse,
      validationResult,
      conversationId,
      userId,
      isProactive
    });

    return validationResult;
  }

  private calculateMetrics(response: string): ValidationMetrics {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = response.split(/\s+/).filter(w => w.length > 0);
    
    return {
      responseLength: response.length,
      sentenceCount: sentences.length,
      readabilityScore: this.calculateReadabilityScore(response),
      technicalAccuracy: this.calculateTechnicalAccuracy(response),
      appropriatenessScore: this.calculateAppropriatenessScore(response),
      coherenceScore: this.calculateCoherenceScore(response)
    };
  }

  private validateContent(response: string, issues: ValidationIssue[]): void {
    // Check for empty or too short responses
    if (response.trim().length < 10) {
      issues.push({
        type: 'content',
        severity: 'high',
        message: 'Response is too short or empty',
        suggestion: 'Ensure response provides meaningful content'
      });
    }

    // Check for repetitive content
    const words = response.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const repeatedWords = Array.from(wordCounts.entries())
      .filter(([word, count]) => count > 5 && word.length > 3);

    if (repeatedWords.length > 0) {
      issues.push({
        type: 'content',
        severity: 'medium',
        message: `Excessive repetition of words: ${repeatedWords.map(([word]) => word).join(', ')}`,
        suggestion: 'Vary vocabulary to avoid repetition'
      });
    }
  }

  private validateTechnicalAccuracy(
    agentType: AgentType,
    userMessage: string,
    aiResponse: string,
    issues: ValidationIssue[]
  ): void {
    // Check for technical context
    const technicalKeywords = [
      'error', 'bug', 'code', 'javascript', 'react', 'api', 'database',
      'function', 'variable', 'syntax', 'debugging', 'programming'
    ];

    const hasTechnicalContent = technicalKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword) || 
      aiResponse.toLowerCase().includes(keyword)
    );

    if (hasTechnicalContent && agentType !== 'technical') {
      // Check if non-technical agent is attempting technical support
      const technicalClaims = [
        'here\'s the code', 'try this solution', 'the bug is',
        'compile', 'syntax error', 'debug this'
      ];

      const makesTechnicalClaims = technicalClaims.some(claim =>
        aiResponse.toLowerCase().includes(claim)
      );

      if (makesTechnicalClaims) {
        issues.push({
          type: 'technical',
          severity: 'high',
          message: 'Non-technical agent providing technical solutions',
          suggestion: 'Redirect to technical support instead of providing technical advice'
        });
      }
    }
  }

  private validateAppropriateness(response: string, issues: ValidationIssue[]): void {
    // Check for inappropriate content
    const inappropriatePatterns = [
      /\b(stupid|dumb|idiot|moron)\b/i,
      /\b(shut up|go away)\b/i,
      /\b(hate|awful|terrible)\b.*\b(you|user|customer)\b/i
    ];

    inappropriatePatterns.forEach(pattern => {
      if (pattern.test(response)) {
        issues.push({
          type: 'appropriateness',
          severity: 'high',
          message: 'Response contains inappropriate language',
          suggestion: 'Use professional and respectful language'
        });
      }
    });

    // Check for overly casual tone in support context
    const overlyFamiliarPatterns = [
      /\b(bro|dude|buddy|mate)\b/i,
      /\b(totally|awesome|cool)\b/i
    ];

    let casualCount = 0;
    overlyFamiliarPatterns.forEach(pattern => {
      if (pattern.test(response)) {
        casualCount++;
      }
    });

    if (casualCount > 2) {
      issues.push({
        type: 'appropriateness',
        severity: 'medium',
        message: 'Response tone may be too casual for support context',
        suggestion: 'Maintain professional yet friendly tone'
      });
    }
  }

  private validateLength(response: string, agentType: AgentType, issues: ValidationIssue[]): void {
    const expectedLengths: Record<AgentType, { min: number; max: number }> = {
      'dad_joke': { min: 20, max: 200 },
      'trivia': { min: 50, max: 300 },
      'technical': { min: 100, max: 1000 },
      'general': { min: 30, max: 500 },
      'gif': { min: 10, max: 100 } // GIF responses are typically short descriptions
    };

    const expected = expectedLengths[agentType];
    const length = response.length;

    if (length < expected.min) {
      issues.push({
        type: 'length',
        severity: 'medium',
        message: `Response too short for ${agentType} agent (${length} chars, expected min ${expected.min})`,
        suggestion: 'Provide more detailed response'
      });
    } else if (length > expected.max) {
      issues.push({
        type: 'length',
        severity: 'low',
        message: `Response may be too long for ${agentType} agent (${length} chars, expected max ${expected.max})`,
        suggestion: 'Consider making response more concise'
      });
    }
  }

  private validateCoherence(response: string, issues: ValidationIssue[]): void {
    // Check for incomplete sentences
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const incompleteSentences = sentences.filter(sentence => {
      const trimmed = sentence.trim();
      return trimmed.length > 0 && !trimmed.match(/^[A-Z]/) && !trimmed.match(/^[a-z].*[.!?]$/);
    });

    if (incompleteSentences.length > 0) {
      issues.push({
        type: 'coherence',
        severity: 'medium',
        message: 'Response contains incomplete or malformed sentences',
        suggestion: 'Ensure all sentences are complete and properly formatted'
      });
    }

    // Check for logical flow (basic check)
    if (sentences.length > 1) {
      let hasLogicalFlow = true;
      for (let i = 1; i < sentences.length; i++) {
        const current = sentences[i].trim().toLowerCase();
        const previous = sentences[i - 1].trim().toLowerCase();
        
        // Very basic contradiction check
        if (current.includes('no') && previous.includes('yes') ||
            current.includes('wrong') && previous.includes('correct')) {
          hasLogicalFlow = false;
          break;
        }
      }

      if (!hasLogicalFlow) {
        issues.push({
          type: 'coherence',
          severity: 'high',
          message: 'Response contains logical contradictions',
          suggestion: 'Ensure response maintains logical consistency'
        });
      }
    }
  }

  private calculateReadabilityScore(response: string): number {
    // Simplified readability score (0-1)
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = response.split(/\s+/).filter(w => w.length > 0);
    
    if (sentences.length === 0 || words.length === 0) return 0;
    
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = words.reduce((sum, word) => sum + this.countSyllables(word), 0) / words.length;
    
    // Simplified Flesch Reading Ease calculation (normalized to 0-1)
    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    return Math.max(0, Math.min(1, score / 100));
  }

  private countSyllables(word: string): number {
    // Simple syllable counting
    const vowels = 'aeiouAEIOU';
    let count = 0;
    let prevWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !prevWasVowel) {
        count++;
      }
      prevWasVowel = isVowel;
    }
    
    return Math.max(1, count);
  }

  private calculateTechnicalAccuracy(response: string): number {
    // Basic technical accuracy check (0-1)
    const technicalTerms = [
      'javascript', 'react', 'node', 'api', 'database', 'function',
      'variable', 'object', 'array', 'string', 'number', 'boolean'
    ];

    const foundTerms = technicalTerms.filter(term => 
      response.toLowerCase().includes(term)
    );

    // If no technical terms, assume non-technical response is accurate
    if (foundTerms.length === 0) return 1;

    // Simple check - if technical terms are used, assume reasonable accuracy
    // In a real system, this would be more sophisticated
    return 0.8;
  }

  private calculateAppropriatenessScore(response: string): number {
    // Check for professional tone indicators
    const professionalIndicators = [
      'please', 'thank you', 'i\'m here to help', 'feel free',
      'i understand', 'i apologize', 'certainly', 'absolutely'
    ];

    const inappropriateIndicators = [
      'stupid', 'dumb', 'whatever', 'don\'t care', 'not my problem'
    ];

    const professionalCount = professionalIndicators.filter(indicator =>
      response.toLowerCase().includes(indicator)
    ).length;

    const inappropriateCount = inappropriateIndicators.filter(indicator =>
      response.toLowerCase().includes(indicator)
    ).length;

    // Score based on professional vs inappropriate content
    const score = Math.max(0, (professionalCount - inappropriateCount * 2) / 5);
    return Math.min(1, score + 0.5); // Base score of 0.5
  }

  private calculateCoherenceScore(response: string): number {
    // Basic coherence scoring
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) return 0;
    if (sentences.length === 1) return 1;

    let coherenceScore = 1;
    
    // Check for transition words/phrases
    const transitions = [
      'however', 'therefore', 'additionally', 'furthermore', 'also',
      'in addition', 'for example', 'specifically', 'meanwhile'
    ];

    const hasTransitions = transitions.some(transition =>
      response.toLowerCase().includes(transition)
    );

    if (hasTransitions) coherenceScore += 0.1;

    // Penalize for very long sentences (may indicate run-on)
    const avgSentenceLength = response.length / sentences.length;
    if (avgSentenceLength > 150) coherenceScore -= 0.2;

    return Math.max(0, Math.min(1, coherenceScore));
  }

  private calculateOverallScore(metrics: ValidationMetrics, issues: ValidationIssue[]): number {
    // Weight the metrics
    const baseScore = (
      metrics.readabilityScore * 0.2 +
      metrics.technicalAccuracy * 0.2 +
      metrics.appropriatenessScore * 0.3 +
      metrics.coherenceScore * 0.3
    );

    // Apply penalties for issues
    let penalty = 0;
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'high':
          penalty += 0.3;
          break;
        case 'medium':
          penalty += 0.1;
          break;
        case 'low':
          penalty += 0.05;
          break;
      }
    });

    return Math.max(0, Math.min(1, baseScore - penalty));
  }

  private logValidation(log: ValidationLog): void {
    this.validationLogs.push(log);
    
    // Keep only the most recent logs
    if (this.validationLogs.length > this.maxLogSize) {
      this.validationLogs = this.validationLogs.slice(-this.maxLogSize);
    }

    // Console log for monitoring
    console.log(`🔍 Validation Result [${log.agentType}] Score: ${log.validationResult.score.toFixed(2)}, Valid: ${log.validationResult.isValid}`);
    
    if (log.validationResult.issues.length > 0) {
      console.log(`⚠️  Issues found:`, log.validationResult.issues.map(i => `${i.severity}: ${i.message}`));
    }
  }

  private generateId(): string {
    return `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for accessing validation data
  getValidationLogs(): ValidationLog[] {
    return [...this.validationLogs];
  }

  getValidationStats(): {
    totalValidations: number;
    averageScore: number;
    validationRate: number;
    issueBreakdown: { [key: string]: number };
  } {
    if (this.validationLogs.length === 0) {
      return {
        totalValidations: 0,
        averageScore: 0,
        validationRate: 0,
        issueBreakdown: {}
      };
    }

    const totalValidations = this.validationLogs.length;
    const averageScore = this.validationLogs.reduce((sum, log) => sum + log.validationResult.score, 0) / totalValidations;
    const validValidations = this.validationLogs.filter(log => log.validationResult.isValid).length;
    const validationRate = validValidations / totalValidations;

    const issueBreakdown: { [key: string]: number } = {};
    this.validationLogs.forEach(log => {
      log.validationResult.issues.forEach(issue => {
        const key = `${issue.type}_${issue.severity}`;
        issueBreakdown[key] = (issueBreakdown[key] || 0) + 1;
      });
    });

    return {
      totalValidations,
      averageScore,
      validationRate,
      issueBreakdown
    };
  }

  clearLogs(): void {
    this.validationLogs = [];
  }
}

export const responseValidator = new ResponseValidator();

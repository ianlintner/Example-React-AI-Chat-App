import { ResponseValidator, ValidationResult, ValidationIssue } from '../responseValidator';
import { AgentType } from '../../agents/types';
import * as tracer from '../../tracing/tracer';
import { tracingContextManager } from '../../tracing/contextManager';

// Mock dependencies
jest.mock('../../tracing/tracer');
jest.mock('../../tracing/contextManager');

describe('ResponseValidator', () => {
  let validator: ResponseValidator;
  let mockSpan: any;

  beforeEach(() => {
    validator = new ResponseValidator();
    
    // Mock span
    mockSpan = {
      setAttributes: jest.fn(),
    };

    // Mock tracer functions
    (tracer.createValidationSpan as jest.Mock).mockReturnValue(mockSpan);
    (tracer.addSpanEvent as jest.Mock).mockImplementation();
    (tracer.setSpanStatus as jest.Mock).mockImplementation();
    (tracer.endSpan as jest.Mock).mockImplementation();

    // Mock tracing context manager
    (tracingContextManager.withSpan as jest.Mock).mockImplementation(
      async (span, callback) => {
        return await callback(span, {});
      }
    );

    // Clear any existing logs
    validator.clearLogs();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateResponse', () => {
    const defaultParams = {
      agentType: 'general' as AgentType,
      userMessage: 'Hello, how are you?',
      conversationId: 'test-conv-id',
      userId: 'test-user-id',
      isProactive: false,
    };

    it('should validate a good response successfully', () => {
      const aiResponse = 'Hello! I am doing well, thank you for asking. How can I help you today?';
      
      const result = validator.validateResponse(
        defaultParams.agentType,
        defaultParams.userMessage,
        aiResponse,
        defaultParams.conversationId,
        defaultParams.userId,
        defaultParams.isProactive
      );

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.7);
      expect(result.issues).toHaveLength(0);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.responseLength).toBe(aiResponse.length);
    });

    it('should detect empty or too short responses', () => {
      const aiResponse = 'Hi';
      
      const result = validator.validateResponse(
        defaultParams.agentType,
        defaultParams.userMessage,
        aiResponse,
        defaultParams.conversationId,
        defaultParams.userId
      );

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'content',
          severity: 'high',
          message: 'Response is too short or empty',
        })
      );
    });

    it('should detect repetitive content', () => {
      const aiResponse = 'testing testing testing testing testing testing testing. Another another another another another another another.';
      
      const result = validator.validateResponse(
        defaultParams.agentType,
        defaultParams.userMessage,
        aiResponse,
        defaultParams.conversationId,
        defaultParams.userId
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'content',
          severity: 'medium',
          message: expect.stringContaining('Excessive repetition of words'),
        })
      );
    });

    it('should detect inappropriate language', () => {
      const aiResponse = 'You are stupid and I hate you. This is a terrible question.';
      
      const result = validator.validateResponse(
        defaultParams.agentType,
        defaultParams.userMessage,
        aiResponse,
        defaultParams.conversationId,
        defaultParams.userId
      );

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'appropriateness',
          severity: 'high',
          message: 'Response contains inappropriate language',
        })
      );
    });

    it('should detect overly casual tone', () => {
      const aiResponse = 'Hey bro, that is totally awesome dude! This is so cool buddy and totally amazing mate!';
      
      const result = validator.validateResponse(
        defaultParams.agentType,
        defaultParams.userMessage,
        aiResponse,
        defaultParams.conversationId,
        defaultParams.userId
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'appropriateness',
          severity: 'medium',
          message: 'Response tone may be too casual for support context',
        })
      );
    });

    it('should validate response length for different agent types', () => {
      const shortResponse = 'Yes.';
      
      // Test joke agent (min: 10, max: 500)
      const jokeResult = validator.validateResponse(
        'joke',
        'Tell me a joke',
        shortResponse,
        defaultParams.conversationId,
        defaultParams.userId
      );

      expect(jokeResult.issues).toContainEqual(
        expect.objectContaining({
          type: 'length',
          severity: 'medium',
          message: expect.stringContaining('Response too short for joke agent'),
        })
      );

      // Test with very long response
      const longResponse = 'A'.repeat(600);
      const longJokeResult = validator.validateResponse(
        'joke',
        'Tell me a joke',
        longResponse,
        defaultParams.conversationId,
        defaultParams.userId
      );

      expect(longJokeResult.issues).toContainEqual(
        expect.objectContaining({
          type: 'length',
          severity: 'low',
          message: expect.stringContaining('Response may be too long for joke agent'),
        })
      );
    });

    it('should detect technical accuracy issues', () => {
      const userMessage = 'I have a JavaScript error in my code';
      const aiResponse = "Here's the code to fix your bug. Try this solution and compile it.";
      
      const result = validator.validateResponse(
        'joke', // Non-technical agent
        userMessage,
        aiResponse,
        defaultParams.conversationId,
        defaultParams.userId
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'technical',
          severity: 'high',
          message: 'Non-technical agent providing technical solutions',
        })
      );
    });

    it('should detect coherence issues', () => {
      const aiResponse = 'this is a sentence without proper capitalization and punctuation';
      
      const result = validator.validateResponse(
        defaultParams.agentType,
        defaultParams.userMessage,
        aiResponse,
        defaultParams.conversationId,
        defaultParams.userId
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'coherence',
          severity: 'medium',
          message: 'Response contains incomplete or malformed sentences',
        })
      );
    });

    it('should detect logical contradictions', () => {
      const aiResponse = 'Yes, that is correct. No, you are wrong about that.';
      
      const result = validator.validateResponse(
        defaultParams.agentType,
        defaultParams.userMessage,
        aiResponse,
        defaultParams.conversationId,
        defaultParams.userId
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'coherence',
          severity: 'high',
          message: 'Response contains logical contradictions',
        })
      );
    });

    it('should handle validation errors gracefully', () => {
      // Mock an error in the validation process
      const originalCalculateMetrics = (validator as any).calculateMetrics;
      (validator as any).calculateMetrics = jest.fn(() => {
        throw new Error('Test validation error');
      });

      const result = validator.validateResponse(
        defaultParams.agentType,
        defaultParams.userMessage,
        'Test response',
        defaultParams.conversationId,
        defaultParams.userId
      );

      expect(result.isValid).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'technical',
          severity: 'high',
          message: 'Validation system error',
        })
      );

      // Restore original method
      (validator as any).calculateMetrics = originalCalculateMetrics;
    });

    it('should create proper tracing spans', () => {
      const aiResponse = 'This is a test response.';
      
      validator.validateResponse(
        defaultParams.agentType,
        defaultParams.userMessage,
        aiResponse,
        defaultParams.conversationId,
        defaultParams.userId,
        defaultParams.isProactive
      );

      expect(tracer.createValidationSpan).toHaveBeenCalledWith(
        defaultParams.conversationId,
        defaultParams.agentType,
        defaultParams.userId
      );

      expect(tracer.addSpanEvent).toHaveBeenCalledWith(
        mockSpan,
        'validation.start',
        expect.objectContaining({
          'agent.type': defaultParams.agentType,
          'user.id': defaultParams.userId,
          'conversation.id': defaultParams.conversationId,
        })
      );

      expect(tracer.setSpanStatus).toHaveBeenCalledWith(mockSpan, true);
      expect(tracer.endSpan).toHaveBeenCalledWith(mockSpan);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate basic metrics correctly', () => {
      const response = 'This is a test response. It has multiple sentences.';
      const result = validator.validateResponse(
        'general',
        'Test message',
        response,
        'test-conv',
        'test-user'
      );

      expect(result.metrics.responseLength).toBe(response.length);
      expect(result.metrics.sentenceCount).toBe(2);
      expect(result.metrics.readabilityScore).toBeGreaterThan(0);
      expect(result.metrics.technicalAccuracy).toBeGreaterThan(0);
      expect(result.metrics.appropriatenessScore).toBeGreaterThan(0);
      expect(result.metrics.coherenceScore).toBeGreaterThan(0);
    });

    it('should handle empty responses in metrics', () => {
      const result = validator.validateResponse(
        'general',
        'Test message',
        '',
        'test-conv',
        'test-user'
      );

      expect(result.metrics.responseLength).toBe(0);
      expect(result.metrics.sentenceCount).toBe(0);
      expect(result.metrics.readabilityScore).toBe(0);
    });
  });

  describe('Scoring System', () => {
    it('should calculate higher scores for better responses', () => {
      const goodResponse = 'Thank you for your question. I am here to help you with any concerns you may have.';
      const badResponse = 'stupid question dude whatever';

      const goodResult = validator.validateResponse(
        'general',
        'Can you help me?',
        goodResponse,
        'test-conv',
        'test-user'
      );

      const badResult = validator.validateResponse(
        'general',
        'Can you help me?',
        badResponse,
        'test-conv',
        'test-user'
      );

      expect(goodResult.score).toBeGreaterThan(badResult.score);
      expect(goodResult.isValid).toBe(true);
      expect(badResult.isValid).toBe(false);
    });

    it('should penalize responses with high severity issues', () => {
      const responseWithHighSeverityIssue = 'You are stupid and I hate you.';
      
      const result = validator.validateResponse(
        'general',
        'Test message',
        responseWithHighSeverityIssue,
        'test-conv',
        'test-user'
      );

      expect(result.score).toBeLessThan(0.7);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Validation Logging', () => {
    it('should log validation results', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      validator.validateResponse(
        'general',
        'Test message',
        'Test response',
        'test-conv',
        'test-user'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Validation Result [general]')
      );

      consoleSpy.mockRestore();
    });

    it('should maintain validation logs', () => {
      validator.validateResponse(
        'general',
        'Test message 1',
        'Test response 1',
        'test-conv-1',
        'test-user-1'
      );

      validator.validateResponse(
        'joke',
        'Test message 2',
        'Test response 2',
        'test-conv-2',
        'test-user-2'
      );

      const logs = validator.getValidationLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].agentType).toBe('general');
      expect(logs[1].agentType).toBe('joke');
    });

    it('should limit log size', () => {
      // Set a smaller max log size for testing
      const originalMaxLogSize = (validator as any).maxLogSize;
      (validator as any).maxLogSize = 3;

      // Add more logs than the limit
      for (let i = 0; i < 5; i++) {
        validator.validateResponse(
          'general',
          `Test message ${i}`,
          `Test response ${i}`,
          `test-conv-${i}`,
          `test-user-${i}`
        );
      }

      const logs = validator.getValidationLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].userMessage).toBe('Test message 2'); // Should keep the last 3

      // Restore original max log size
      (validator as any).maxLogSize = originalMaxLogSize;
    });
  });

  describe('Validation Statistics', () => {
    beforeEach(() => {
      validator.clearLogs();
    });

    it('should return empty stats when no validations', () => {
      const stats = validator.getValidationStats();
      
      expect(stats.totalValidations).toBe(0);
      expect(stats.averageScore).toBe(0);
      expect(stats.validationRate).toBe(0);
      expect(stats.issueBreakdown).toEqual({});
    });

    it('should calculate validation statistics correctly', () => {
      // Add some validation results
      validator.validateResponse(
        'general',
        'Good message',
        'Thank you for your question. I am happy to help.',
        'test-conv-1',
        'test-user-1'
      );

      validator.validateResponse(
        'general',
        'Bad message',
        'stupid',
        'test-conv-2',
        'test-user-2'
      );

      const stats = validator.getValidationStats();
      
      expect(stats.totalValidations).toBe(2);
      expect(stats.averageScore).toBeGreaterThan(0);
      expect(stats.validationRate).toBeLessThan(1); // Should be less than 1 due to the bad response
      expect(Object.keys(stats.issueBreakdown).length).toBeGreaterThan(0);
    });

    it('should track issue breakdown correctly', () => {
      validator.validateResponse(
        'general',
        'Test',
        'You are stupid', // Should create appropriateness_high issue
        'test-conv',
        'test-user'
      );

      const stats = validator.getValidationStats();
      expect(stats.issueBreakdown['appropriateness_high']).toBe(1);
    });
  });

  describe('Helper Methods', () => {
    it('should count syllables correctly', () => {
      const countSyllables = (validator as any).countSyllables.bind(validator);
      
      expect(countSyllables('hello')).toBe(2);
      expect(countSyllables('cat')).toBe(1);
      expect(countSyllables('beautiful')).toBe(3);
      expect(countSyllables('a')).toBe(1); // Minimum 1 syllable
    });

    it('should calculate readability score', () => {
      const calculateReadabilityScore = (validator as any).calculateReadabilityScore.bind(validator);
      
      const simpleText = 'This is simple. Easy to read.';
      const complexText = 'This extraordinarily complicated sentence demonstrates sophisticated vocabulary utilization.';
      
      const simpleScore = calculateReadabilityScore(simpleText);
      const complexScore = calculateReadabilityScore(complexText);
      
      expect(simpleScore).toBeGreaterThan(complexScore);
      expect(simpleScore).toBeGreaterThanOrEqual(0);
      expect(simpleScore).toBeLessThanOrEqual(1);
    });

    it('should calculate technical accuracy score', () => {
      const calculateTechnicalAccuracy = (validator as any).calculateTechnicalAccuracy.bind(validator);
      
      const nonTechnicalText = 'Hello, how are you today?';
      const technicalText = 'The JavaScript function returns an array of objects.';
      
      const nonTechnicalScore = calculateTechnicalAccuracy(nonTechnicalText);
      const technicalScore = calculateTechnicalAccuracy(technicalText);
      
      expect(nonTechnicalScore).toBe(1); // Non-technical should be 1
      expect(technicalScore).toBe(0.8); // Technical should be 0.8
    });

    it('should calculate appropriateness score', () => {
      const calculateAppropriatenessScore = (validator as any).calculateAppropriatenessScore.bind(validator);
      
      const professionalText = 'Thank you for your question. I am here to help.';
      const inappropriateText = 'This is stupid and I don\'t care.';
      
      const professionalScore = calculateAppropriatenessScore(professionalText);
      const inappropriateScore = calculateAppropriatenessScore(inappropriateText);
      
      expect(professionalScore).toBeGreaterThan(inappropriateScore);
      expect(professionalScore).toBeGreaterThanOrEqual(0);
      expect(professionalScore).toBeLessThanOrEqual(1);
    });

    it('should calculate coherence score', () => {
      const calculateCoherenceScore = (validator as any).calculateCoherenceScore.bind(validator);
      
      const coherentText = 'This is a coherent response. However, it also flows well and makes sense. Therefore, it should score higher.';
      const incoherentText = 'This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long sentence without any proper structure or transitions and it just goes on and on and on without making much sense or having any logical flow which makes it very hard to read and understand.';
      
      const coherentScore = calculateCoherenceScore(coherentText);
      const incoherentScore = calculateCoherenceScore(incoherentText);
      
      expect(coherentScore).toBeGreaterThan(incoherentScore);
      expect(coherentScore).toBeGreaterThanOrEqual(0);
      expect(coherentScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Clear Logs', () => {
    it('should clear validation logs', () => {
      validator.validateResponse(
        'general',
        'Test message',
        'Test response',
        'test-conv',
        'test-user'
      );

      expect(validator.getValidationLogs()).toHaveLength(1);
      
      validator.clearLogs();
      
      expect(validator.getValidationLogs()).toHaveLength(0);
    });
  });
});

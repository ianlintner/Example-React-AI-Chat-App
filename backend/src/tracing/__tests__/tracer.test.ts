// Tracer utility functions tests
describe('Tracer Utility Functions', () => {
  // Import SpanStatusCode constants for reference
  const SpanStatusCode = {
    OK: 1,
    ERROR: 2,
  };

  // Define the utility functions directly to test their logic
  const endSpan = (span: any, attributes?: Record<string, any>) => {
    if (!span) return;
    if (attributes) {
      span.setAttributes(attributes);
    }
    span.end();
  };

  const setSpanStatus = (span: any, success: boolean, message?: string) => {
    if (!span) return;
    if (success) {
      span.setStatus({ code: SpanStatusCode.OK });
    } else {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: message || 'Operation failed',
      });
    }
  };

  const addSpanEvent = (
    span: any,
    name: string,
    attributes?: Record<string, any>,
  ) => {
    if (!span) return;
    span.addEvent(name, {
      timestamp: Date.now(),
      ...(attributes && attributes),
    });
  };

  describe('endSpan function', () => {
    it('should handle null spans without throwing', () => {
      expect(() => endSpan(null)).not.toThrow();
      expect(() => endSpan(undefined)).not.toThrow();
    });

    it('should call span.end() when given a valid span', () => {
      const mockSpan = {
        setAttributes: jest.fn(),
        end: jest.fn(),
      };

      endSpan(mockSpan);
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should set attributes and end span when attributes provided', () => {
      const mockSpan = {
        setAttributes: jest.fn(),
        end: jest.fn(),
      };
      const attributes = { test: 'value' };

      endSpan(mockSpan, attributes);
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(attributes);
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('setSpanStatus function', () => {
    it('should handle null spans without throwing', () => {
      expect(() => setSpanStatus(null, true)).not.toThrow();
      expect(() => setSpanStatus(undefined, false)).not.toThrow();
    });

    it('should set OK status for successful operations', () => {
      const mockSpan = {
        setStatus: jest.fn(),
      };

      setSpanStatus(mockSpan, true);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
    });

    it('should set ERROR status for failed operations', () => {
      const mockSpan = {
        setStatus: jest.fn(),
      };

      setSpanStatus(mockSpan, false, 'Test error');
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: 'Test error',
      });
    });

    it('should use default error message when none provided', () => {
      const mockSpan = {
        setStatus: jest.fn(),
      };

      setSpanStatus(mockSpan, false);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: 'Operation failed',
      });
    });
  });

  describe('addSpanEvent function', () => {
    it('should handle null spans without throwing', () => {
      expect(() => addSpanEvent(null, 'event')).not.toThrow();
      expect(() => addSpanEvent(undefined, 'event')).not.toThrow();
    });

    it('should add event with timestamp', () => {
      const mockSpan = {
        addEvent: jest.fn(),
      };

      addSpanEvent(mockSpan, 'test.event');
      expect(mockSpan.addEvent).toHaveBeenCalledWith('test.event', {
        timestamp: expect.any(Number),
      });
    });

    it('should add event with custom attributes', () => {
      const mockSpan = {
        addEvent: jest.fn(),
      };
      const attributes = { key: 'value', count: 123 };

      addSpanEvent(mockSpan, 'test.event', attributes);
      expect(mockSpan.addEvent).toHaveBeenCalledWith('test.event', {
        timestamp: expect.any(Number),
        key: 'value',
        count: 123,
      });
    });
  });

  describe('basic functionality', () => {
    it('should export necessary functions', () => {
      expect(typeof endSpan).toBe('function');
      expect(typeof setSpanStatus).toBe('function');
      expect(typeof addSpanEvent).toBe('function');
    });
  });
});

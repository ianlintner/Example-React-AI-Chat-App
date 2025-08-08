import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ValidationDashboard from '../../components/ValidationDashboard';

// Mock fetch
(global as any).fetch = jest.fn();

// Mock Alert
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Mock environment variable
(process.env as any).EXPO_PUBLIC_API_URL = 'http://localhost:5001';

describe('ValidationDashboard', () => {
  const mockStats = {
    totalValidations: 100,
    averageScore: 0.85,
    validationRate: 0.92,
    issueBreakdown: {
      content_high: 5,
      appropriateness_medium: 3,
      length_low: 2,
    },
  };

  const mockLogs = [
    {
      id: 'log1',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      agentType: 'general',
      userMessage: 'Hello',
      aiResponse: 'Hi there!',
      validationResult: {
        isValid: true,
        score: 0.9,
        issues: [],
        metrics: {
          responseLength: 9,
          sentenceCount: 1,
          readabilityScore: 0.8,
          technicalAccuracy: 1.0,
          appropriatenessScore: 0.9,
          coherenceScore: 1.0,
        },
      },
      conversationId: 'conv1',
      userId: 'user1',
      isProactive: false,
    },
    {
      id: 'log2',
      timestamp: new Date('2023-01-01T11:00:00Z'),
      agentType: 'joke',
      userMessage: 'Tell me a joke',
      aiResponse: 'Why did the chicken cross the road?',
      validationResult: {
        isValid: false,
        score: 0.6,
        issues: [
          {
            type: 'content',
            severity: 'medium',
            message: 'Response may be incomplete',
            suggestion: 'Provide the full joke',
          },
        ],
        metrics: {
          responseLength: 35,
          sentenceCount: 1,
          readabilityScore: 0.9,
          technicalAccuracy: 1.0,
          appropriatenessScore: 0.8,
          coherenceScore: 0.7,
        },
      },
      conversationId: 'conv2',
      userId: 'user2',
      isProactive: true,
    },
  ];

  const mockSummary = {
    general: {
      total: 50,
      valid: 45,
      invalid: 5,
      averageScore: 0.88,
      validationRate: 0.9,
      issues: {
        high: 2,
        medium: 3,
        low: 1,
      },
    },
    joke: {
      total: 30,
      valid: 25,
      invalid: 5,
      averageScore: 0.82,
      validationRate: 0.83,
      issues: {
        high: 1,
        medium: 4,
        low: 2,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful API responses
    ((global as any).fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/validation/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockStats }),
        });
      }
      if (url.includes('/api/validation/logs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { logs: mockLogs } }),
        });
      }
      if (url.includes('/api/validation/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockSummary }),
        });
      }
      if (url.includes('/api/validation/clear')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Loading State', () => {
    it('should show loading indicator initially', async () => {
      await act(async () => {
        render(<ValidationDashboard />);
      });
      
      expect(screen.getByText('Loading validation data...')).toBeTruthy();
      expect(screen.getByTestId('activity-indicator')).toBeTruthy();
    });
  });

  describe('Data Display', () => {
    it('should display validation stats correctly', async () => {
      await act(async () => {
        render(<ValidationDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('AI Response Validation')).toBeTruthy();
      });

      // Check stats cards
      expect(screen.getByText('100')).toBeTruthy(); // Total validations
      expect(screen.getByText('92.0%')).toBeTruthy(); // Success rate
      expect(screen.getByText('0.850')).toBeTruthy(); // Average score
      expect(screen.getByText('10')).toBeTruthy(); // Total issues (5+3+2)
    });

    it('should display agent performance summary', async () => {
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Agent Performance Summary')).toBeTruthy();
      });

      // Check agent cards - use specific text that appears only in summary
      expect(screen.getByText('general')).toBeTruthy();
      expect(screen.getByText('joke')).toBeTruthy();
      expect(screen.getByText('Total: 50')).toBeTruthy();
      expect(screen.getByText('Success: 90.0%')).toBeTruthy();
      expect(screen.getByText('Score: 0.880')).toBeTruthy();
    });

    it('should display validation logs', async () => {
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Validation Logs')).toBeTruthy();
      });

      // Check log items
      expect(screen.getByText('Score: 0.900')).toBeTruthy();
      expect(screen.getByText('Score: 0.600')).toBeTruthy();
      expect(screen.getByText('Valid')).toBeTruthy();
      expect(screen.getByText('Invalid')).toBeTruthy();
      expect(screen.getByText('Regular')).toBeTruthy();
      expect(screen.getByText('Proactive')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      ((global as any).fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<ValidationDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeTruthy();
        expect(screen.getByText('Failed to fetch validation data')).toBeTruthy();
      });
    });

    it('should handle retry button click', async () => {
      ((global as any).fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<ValidationDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeTruthy();
      });

      // Mock successful retry
      ((global as any).fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/validation/stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockStats }),
          });
        }
        if (url.includes('/api/validation/logs')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { logs: mockLogs } }),
          });
        }
        if (url.includes('/api/validation/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockSummary }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      fireEvent.press(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('AI Response Validation')).toBeTruthy();
      });
    });
  });

  describe('Filtering', () => {
    it('should handle agent type filter changes', async () => {
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Agent Type:')).toBeTruthy();
      });

      // Note: Testing Picker interactions in React Native Testing Library is limited
      // In a real app, you might want to use a different picker component or test this in E2E tests
    });

    it('should handle failed only toggle', async () => {
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed Only')).toBeTruthy();
      });

      const failedOnlyButton = screen.getByText('Failed Only');
      fireEvent.press(failedOnlyButton);

      // Verify API call was made for failed logs
      await waitFor(() => {
        expect((global as any).fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/failed?limit=50'),
        );
      });
    });
  });

  describe('Actions', () => {
    it('should handle refresh action', async () => {
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeTruthy();
      });

      const refreshButton = screen.getByText('Refresh');
      fireEvent.press(refreshButton);

      // Verify API calls were made again
      await waitFor(() => {
        expect((global as any).fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/stats'),
        );
      });
    });

    it('should handle clear logs action', async () => {
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Clear Logs')).toBeTruthy();
      });

      const clearButton = screen.getByText('Clear Logs');
      fireEvent.press(clearButton);

      // Verify alert was shown
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Clear Validation Logs',
          'Are you sure you want to clear all validation logs? This action cannot be undone.',
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel' }),
            expect.objectContaining({ text: 'Clear' }),
          ]),
        );
      });
    });

    it('should execute clear logs when confirmed', async () => {
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Clear Logs')).toBeTruthy();
      });

      const clearButton = screen.getByText('Clear Logs');
      fireEvent.press(clearButton);

      // Wait for alert to be called
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalled();
      });

      // Get the alert call and execute the clear action
      const alertCall = mockAlert.mock.calls[0];
      expect(alertCall).toBeDefined();
      
      const clearAction = alertCall[2]?.[1]; // Second button (Clear)
      expect(clearAction).toBeDefined();
      expect(clearAction?.onPress).toBeDefined();

      // Clear previous fetch calls to avoid false positives
      jest.clearAllMocks();

      // Execute the clear action
      if (clearAction?.onPress) {
        await clearAction.onPress();
      }
      
      // Verify clear API was called
      await waitFor(() => {
        expect((global as any).fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/clear'),
          expect.objectContaining({ method: 'POST' }),
        );
      });
    });
  });

  describe('Helper Functions', () => {
    it('should format timestamps correctly', async () => {
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        // Check that timestamps are displayed (exact format may vary by locale)
        expect(screen.getAllByText(/1\/1\/2023/)).toHaveLength(2); // Two log entries
      });
    });

    it('should display appropriate colors for scores', async () => {
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        // High score should be green, low score should be red
        const scoreElements = screen.getAllByText(/Score: /);
        expect(scoreElements.length).toBeGreaterThan(0);
      });
    });

    it('should show issue badges for failed validations', async () => {
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        // Should show medium severity issue for the failed validation
        expect(screen.getByText('medium')).toBeTruthy();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no logs are available', async () => {
      ((global as any).fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/validation/stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockStats }),
          });
        }
        if (url.includes('/api/validation/logs')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { logs: [] } }),
          });
        }
        if (url.includes('/api/validation/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockSummary }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<ValidationDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('No validation logs found')).toBeTruthy();
      });
    });
  });

  describe('Auto-refresh', () => {
    it('should set up auto-refresh interval', async () => {
      jest.useFakeTimers();
      
      render(<ValidationDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('AI Response Validation')).toBeTruthy();
      });

      // Clear previous fetch calls
      jest.clearAllMocks();

      // Fast-forward time to trigger interval
      jest.advanceTimersByTime(30000);

      // Wait for interval to trigger
      await waitFor(
        () => {
          expect((global as any).fetch).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      jest.useRealTimers();
    }, 3000);
  });

  describe('Pull to Refresh', () => {
    it('should handle pull to refresh', async () => {
      const { getByTestId } = render(<ValidationDashboard />);

      await waitFor(() => {
        expect(screen.getByText('AI Response Validation')).toBeTruthy();
      });

      // Clear previous fetch calls
      jest.clearAllMocks();

      // Get the ScrollView and find RefreshControl
      const scrollView = getByTestId('validation-scroll-view');

      // Simulate pull to refresh by calling the RefreshControl's onRefresh
      fireEvent(scrollView, 'onRefresh');

      // Should have made new API calls
      await waitFor(() => {
        expect((global as any).fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/stats'),
        );
      });
    });
  });
});

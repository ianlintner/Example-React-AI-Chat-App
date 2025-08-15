import React from 'react';
import { render, act } from '@testing-library/react-native';
import AgentStatusBar from '../../components/AgentStatusBar';
import { socketService } from '../../services/socketService';
import type { AgentStatus } from '../../types';

jest.mock('../../services/socketService');

const mockSocketService = socketService as jest.Mocked<typeof socketService>;

describe('AgentStatusBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when agent is inactive', () => {
    const { queryByTestId } = render(<AgentStatusBar />);
    expect(queryByTestId('agent-status-bar')).toBeNull();
  });

  it('should render when agent is active', async () => {
    const mockStatus: AgentStatus = {
      currentAgent: 'general',
      isActive: true,
      activeAgentInfo: {
        agentType: 'general',
        timestamp: new Date(),
      },
      conversationContext: null,
      goalState: null,
      timestamp: new Date(),
      availableAgents: [],
    };

    let statusCallback: ((status: AgentStatus) => void) | undefined;
    mockSocketService.onAgentStatusUpdate.mockImplementation(callback => {
      statusCallback = callback;
      return () => {};
    });

    const { getByText } = render(<AgentStatusBar />);

    await act(async () => {
      if (statusCallback) {
        statusCallback(mockStatus);
      }
    });

    // Check for the actual text that appears in the component
    expect(getByText('🤖 General Agent')).toBeTruthy();
    expect(getByText('N/A')).toBeTruthy(); // satisfaction value
    expect(getByText('Idle')).toBeTruthy(); // goal state
  });
});

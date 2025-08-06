import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Chip, Badge } from 'react-native-paper';
import { socketService } from '../services/socketService';
import type { AgentStatus, AgentType } from '../types';

interface AgentStatusBarProps {
  isVisible?: boolean;
}

const AgentStatusBar: React.FC<AgentStatusBarProps> = ({ isVisible = true }) => {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Handle agent status updates
    const handleAgentStatusUpdate = (status: AgentStatus) => {
      setAgentStatus(status);
      
      // Trigger slide animation when status changes
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    };

    // Set up socket listeners
    socketService.onAgentStatusUpdate(handleAgentStatusUpdate);

    // Check connection status
    setIsConnected(socketService.isSocketConnected());

    return () => {
      socketService.removeListener('agent_status_update');
    };
  }, [slideAnim]);

  // Pulse animation for active agents
  useEffect(() => {
    if (agentStatus?.isActive) {
      const startPulse = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };
      startPulse();
    } else {
      pulseAnim.setValue(1);
    }
  }, [agentStatus?.isActive, pulseAnim]);

  const getAgentColor = (agentType: AgentType): string => {
    switch (agentType) {
      case 'hold_agent': return '#FF9800';
      case 'account_support': return '#2196F3';
      case 'billing_support': return '#4CAF50';
      case 'website_support': return '#9C27B0';
      case 'operator_support': return '#607D8B';
      case 'joke': return '#FF5722';
      case 'trivia': return '#795548';
      case 'gif': return '#E91E63';
      case 'story_teller': return '#3F51B5';
      case 'riddle_master': return '#FF9800';
      case 'quote_master': return '#009688';
      case 'game_host': return '#8BC34A';
      case 'music_guru': return '#673AB7';
      default: return '#757575';
    }
  };

  const getAgentIcon = (agentType: AgentType): string => {
    switch (agentType) {
      case 'hold_agent': return '⏳';
      case 'account_support': return '👤';
      case 'billing_support': return '💳';
      case 'website_support': return '🌐';
      case 'operator_support': return '📞';
      case 'joke': return '🎭';
      case 'trivia': return '🧠';
      case 'gif': return '🎬';
      case 'story_teller': return '📖';
      case 'riddle_master': return '🧩';
      case 'quote_master': return '💭';
      case 'game_host': return '🎮';
      case 'music_guru': return '🎵';
      default: return '🤖';
    }
  };

  const getAgentDisplayName = (agentType: AgentType): string => {
    switch (agentType) {
      case 'hold_agent': return 'Hold Agent';
      case 'account_support': return 'Account Support';
      case 'billing_support': return 'Billing Support';
      case 'website_support': return 'Website Support';
      case 'operator_support': return 'Customer Service';
      case 'joke': return 'Joke Master';
      case 'trivia': return 'Trivia Master';
      case 'gif': return 'GIF Master';
      case 'story_teller': return 'Story Teller';
      case 'riddle_master': return 'Riddle Master';
      case 'quote_master': return 'Quote Master';
      case 'game_host': return 'Game Host';
      case 'music_guru': return 'Music Guru';
      default: return 'General Agent';
    }
  };

  if (!isVisible || !agentStatus) {
    return null;
  }

  const agentColor = getAgentColor(agentStatus.currentAgent);
  const agentIcon = getAgentIcon(agentStatus.currentAgent);
  const agentName = getAgentDisplayName(agentStatus.currentAgent);

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -5]
              })
            },
            { scale: pulseAnim }
          ]
        }
      ]}
    >
      <View style={styles.statusContainer}>
        {/* Current Agent Display */}
        <View style={styles.agentInfo}>
          <Chip
            mode="flat"
            textStyle={styles.chipText}
            style={[styles.agentChip, { backgroundColor: agentColor + '20', borderColor: agentColor }]}
          >
            {agentIcon} {agentName}
          </Chip>
          
          {/* Active Status Badge */}
          {agentStatus.isActive && (
            <Badge 
              style={[styles.activeBadge, { backgroundColor: '#4CAF50' }]}
              size={8}
            />
          )}
        </View>

        {/* Status Details */}
        <View style={styles.statusDetails}>
          {/* Connection Status */}
          <View style={styles.connectionStatus}>
            <View style={[
              styles.connectionDot, 
              { backgroundColor: isConnected ? '#4CAF50' : '#f44336' }
            ]} />
            <Text style={styles.connectionText}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>

          {/* Goal State */}
          {agentStatus.goalState && (
            <View style={styles.goalInfo}>
              <Text style={styles.goalStateText}>
                State: {agentStatus.goalState.currentState}
              </Text>
              {agentStatus.goalState.activeGoals.length > 0 && (
                <Badge 
                  style={styles.goalBadge}
                  size={16}
                >
                  {agentStatus.goalState.activeGoals.length}
                </Badge>
              )}
            </View>
          )}

          {/* Conversation Context */}
          {agentStatus.conversationContext && (
            <View style={styles.contextInfo}>
              <Text style={styles.contextText}>
                Satisfaction: {Math.round(agentStatus.conversationContext.userSatisfaction * 100)}%
              </Text>
              <Text style={styles.contextText}>
                Depth: {agentStatus.conversationContext.conversationDepth}
              </Text>
            </View>
          )}

          {/* Handoff Indicator */}
          {agentStatus.conversationContext?.shouldHandoff && (
            <Chip
              mode="outlined"
              compact
              textStyle={styles.handoffText}
              style={styles.handoffChip}
            >
              🔄 Handoff to {getAgentDisplayName(agentStatus.conversationContext.handoffTarget!)}
            </Chip>
          )}
        </View>

        {/* Last Updated */}
        <Text style={styles.timestamp}>
          Updated: {new Date(agentStatus.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          })}
        </Text>
      </View>
    </Animated.View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusContainer: {
    padding: 12,
  },
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  agentChip: {
    height: 32,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
  },
  statusDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  connectionText: {
    fontSize: 10,
    color: '#666',
  },
  goalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalStateText: {
    fontSize: 10,
    color: '#666',
    marginRight: 4,
  },
  goalBadge: {
    backgroundColor: '#2196F3',
  },
  contextInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextText: {
    fontSize: 10,
    color: '#666',
  },
  handoffChip: {
    height: 24,
    borderColor: '#FF9800',
  },
  handoffText: {
    fontSize: 10,
    color: '#FF9800',
  },
  timestamp: {
    fontSize: 9,
    color: '#999',
    textAlign: 'right',
  },
});

export default AgentStatusBar;

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { ForestColors } from '../constants/Colors';
import { socketService } from '../services/socketService';
import type { AgentStatus, AgentType } from '../types';

interface AgentStatusBarProps {
  isVisible?: boolean;
}

const AgentStatusBar: React.FC<AgentStatusBarProps> = ({
  isVisible = true,
}) => {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const collapseAnim = useRef(new Animated.Value(1)).current;

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
        }),
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
          ]),
        ).start();
      };
      startPulse();
    } else {
      pulseAnim.setValue(1);
    }
  }, [agentStatus?.isActive, pulseAnim]);

  const toggleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);

    Animated.timing(collapseAnim, {
      toValue: newCollapsedState ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const _getAgentColor = (agentType: AgentType): string => {
    switch (agentType) {
      case 'hold_agent':
        return '#FF9800';
      case 'account_support':
        return '#2196F3';
      case 'billing_support':
        return '#4CAF50';
      case 'website_support':
        return '#9C27B0';
      case 'operator_support':
        return '#607D8B';
      case 'joke':
        return '#FF5722';
      case 'trivia':
        return '#795548';
      case 'gif':
        return '#E91E63';
      case 'story_teller':
        return '#3F51B5';
      case 'riddle_master':
        return '#FF9800';
      case 'quote_master':
        return '#009688';
      case 'game_host':
        return '#8BC34A';
      case 'music_guru':
        return '#673AB7';
      default:
        return '#757575';
    }
  };

  const getAgentIcon = (agentType: AgentType): string => {
    switch (agentType) {
      case 'hold_agent':
        return '⏳';
      case 'account_support':
        return '👤';
      case 'billing_support':
        return '💳';
      case 'website_support':
        return '🌐';
      case 'operator_support':
        return '📞';
      case 'joke':
        return '🎭';
      case 'trivia':
        return '🧠';
      case 'gif':
        return '🎬';
      case 'story_teller':
        return '📖';
      case 'riddle_master':
        return '🧩';
      case 'quote_master':
        return '💭';
      case 'game_host':
        return '🎮';
      case 'music_guru':
        return '🎵';
      default:
        return '🤖';
    }
  };

  const getAgentDisplayName = (agentType: AgentType): string => {
    switch (agentType) {
      case 'hold_agent':
        return 'Hold Agent';
      case 'account_support':
        return 'Account Support';
      case 'billing_support':
        return 'Billing Support';
      case 'website_support':
        return 'Website Support';
      case 'operator_support':
        return 'Customer Service';
      case 'joke':
        return 'Joke Master';
      case 'trivia':
        return 'Trivia Master';
      case 'gif':
        return 'GIF Master';
      case 'story_teller':
        return 'Story Teller';
      case 'riddle_master':
        return 'Riddle Master';
      case 'quote_master':
        return 'Quote Master';
      case 'game_host':
        return 'Game Host';
      case 'music_guru':
        return 'Music Guru';
      default:
        return 'General Agent';
    }
  };

  if (!isVisible || !agentStatus) {
    return null;
  }

  const agentIcon = getAgentIcon(agentStatus.currentAgent);
  const agentName = getAgentDisplayName(agentStatus.currentAgent);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      {/* Ultra-Compact Header */}
      <TouchableOpacity
        style={styles.compactHeader}
        onPress={toggleCollapse}
        activeOpacity={0.7}
      >
        {/* Status Pulse Indicator */}
        <Animated.View
          style={[
            styles.statusPulse,
            {
              backgroundColor: agentStatus.isActive
                ? ForestColors.success
                : ForestColors.textMuted,
              transform: [{ scale: agentStatus.isActive ? pulseAnim : 1 }],
            },
          ]}
        />

        {/* Agent Info */}
        <Text style={styles.compactAgentName} numberOfLines={1}>
          {agentIcon} {agentName}
        </Text>

        {/* Connection & Expand Indicator */}
        <View style={styles.rightControls}>
          <View
            style={[
              styles.connectionIndicator,
              {
                backgroundColor: isConnected
                  ? ForestColors.success
                  : ForestColors.error,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.expandIcon,
              {
                transform: [
                  {
                    rotate: collapseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.chevronText}>⌃</Text>
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Smart Expandable Content */}
      <Animated.View
        style={[
          styles.expandedContent,
          {
            opacity: collapseAnim,
            transform: [
              {
                scaleY: collapseAnim,
              },
            ],
          },
          isCollapsed && styles.expandedContentCollapsed,
        ]}
      >
        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {agentStatus.conversationContext
                ? `${Math.round(agentStatus.conversationContext.userSatisfaction * 100)}%`
                : 'N/A'}
            </Text>
            <Text style={styles.metricLabel}>SATISFACTION</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metric}>
            <View style={styles.goalMetric}>
              <Text style={styles.metricValue}>
                {agentStatus.goalState?.currentState || 'Idle'}
              </Text>
              {agentStatus.goalState?.activeGoals &&
                agentStatus.goalState.activeGoals.length > 0 && (
                  <View style={styles.goalCount}>
                    <Text style={styles.goalCountText}>
                      {agentStatus.goalState.activeGoals.length}
                    </Text>
                  </View>
                )}
            </View>
            <Text style={styles.metricLabel}>STATE</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {agentStatus.conversationContext?.conversationDepth || 0}
            </Text>
            <Text style={styles.metricLabel}>DEPTH</Text>
          </View>
        </View>

        {/* Handoff Alert */}
        {agentStatus.conversationContext?.shouldHandoff && (
          <View style={styles.handoffAlert}>
            <Text style={styles.handoffAlertText}>
              →{' '}
              {getAgentDisplayName(
                agentStatus.conversationContext.handoffTarget as AgentType,
              )}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Dynamic Accent Line */}
      <Animated.View
        style={[
          styles.accentLine,
          {
            backgroundColor: agentStatus.isActive
              ? ForestColors.brandPrimary
              : ForestColors.borderLight,
            scaleX: collapseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
          },
        ]}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Modern Mobile-First Container
  container: {
    backgroundColor: ForestColors.backgroundSecondary,
    borderBottomWidth: 0.5,
    borderBottomColor: ForestColors.borderLight,
    shadowColor: ForestColors.backgroundTertiary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
    minHeight: 36,
  },

  // Ultra-Compact Header (Mobile Optimized)
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },

  // Animated Status Pulse
  statusPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    opacity: 0.8,
  },

  // Compact Agent Name
  compactAgentName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: ForestColors.textNormal,
    letterSpacing: 0.2,
  },

  // Right Side Controls
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Minimal Connection Indicator
  connectionIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Modern Expand Icon
  expandIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: ForestColors.backgroundAccent,
  },

  chevronText: {
    fontSize: 12,
    color: ForestColors.textMuted,
    fontWeight: '600',
  },

  // Smart Expandable Content
  expandedContent: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    overflow: 'hidden',
    height: 54,
  },

  expandedContentCollapsed: {
    height: 0,
  },

  // Metrics Grid Layout
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  metric: {
    flex: 1,
    alignItems: 'center',
  },

  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: ForestColors.textNormal,
    marginBottom: 2,
  },

  metricLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: ForestColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Elegant Dividers
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: ForestColors.borderLight,
    marginHorizontal: 8,
    opacity: 0.5,
  },

  // Goal Metric Container
  goalMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  goalCount: {
    backgroundColor: ForestColors.brandPrimary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  goalCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },

  // Inline Handoff Alert
  handoffAlert: {
    backgroundColor: ForestColors.loadingBackground,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'center',
  },

  handoffAlertText: {
    fontSize: 10,
    fontWeight: '600',
    color: ForestColors.warning,
    textAlign: 'center',
  },

  // Dynamic Accent Line
  accentLine: {
    height: 1.5,
    backgroundColor: ForestColors.brandPrimary,
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    borderRadius: 1,
  },
});

export default AgentStatusBar;

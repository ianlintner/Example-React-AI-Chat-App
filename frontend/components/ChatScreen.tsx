import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Avatar, Chip } from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import * as WebBrowser from 'expo-web-browser';
import { ForestColors } from '../constants/Colors';
import { socketService } from '../services/socketService';
import type { Conversation, Message, AgentStatus, AgentType } from '../types';

interface ChatScreenProps {
  conversation: Conversation | null;
}

// YouTube Embed Component
const YouTubeEmbed: React.FC<{
  videoId: string;
  title: string;
  duration: string;
}> = ({ videoId, title, duration }) => {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const handlePress = async () => {
    await WebBrowser.openBrowserAsync(youtubeUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  };

  return (
    <TouchableOpacity
      style={styles.youtubeContainer}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.youtubeHeader}>
        <Text style={styles.youtubeTitle} numberOfLines={2}>
          🎬 {title}
        </Text>
        <Text style={styles.youtubeDuration}>⏱️ {duration}</Text>
      </View>
      <View style={styles.youtubeThumbnailContainer}>
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.youtubeThumbnailImage}
          resizeMode='cover'
        />
        <View style={styles.youtubeOverlay}>
          <View style={styles.youtubePlayButton}>
            <Text style={styles.youtubePlayIcon}>▶</Text>
          </View>
          <View style={styles.youtubeDurationBadge}>
            <Text style={styles.youtubeDurationBadgeText}>{duration}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Function to parse YouTube embeds from message content
const parseMessageContent = (content: string) => {
  const youtubeRegex = /```youtube\n([^\n]+)\n([^\n]+)\n([^\n]+)\n```/g;
  const parts: Array<{
    type: 'text' | 'youtube';
    content: string;
    videoData?: { id: string; title: string; duration: string };
  }> = [];

  let lastIndex = 0;
  let match;

  while ((match = youtubeRegex.exec(content)) !== null) {
    // Add text before YouTube embed
    if (match.index > lastIndex) {
      const textContent = content.substring(lastIndex, match.index);
      if (textContent.trim()) {
        parts.push({ type: 'text', content: textContent });
      }
    }

    // Add YouTube embed
    const [, videoId, title, duration] = match;
    parts.push({
      type: 'youtube',
      content: match[0],
      videoData: { id: videoId, title, duration },
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.substring(lastIndex);
    if (textContent.trim()) {
      parts.push({ type: 'text', content: textContent });
    }
  }

  // If no YouTube embeds found, return original content as text
  if (parts.length === 0) {
    return [{ type: 'text' as const, content }];
  }

  return parts;
};

const ChatScreen: React.FC<ChatScreenProps> = ({ conversation }) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const headerAnimValue = useRef(new Animated.Value(1)).current;

  // Combined Agent Status & Menu Integration
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const agentPulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (conversation?.messages.length) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation?.messages]);

  // Combined Agent Status & Menu Setup
  useEffect(() => {
    const handleAgentStatusUpdate = (status: AgentStatus) => {
      setAgentStatus(status);

      // Trigger slide animation when agent status changes
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

    socketService.onAgentStatusUpdate(handleAgentStatusUpdate);
    setIsConnected(socketService.isSocketConnected());

    return () => {
      socketService.removeListener('agent_status_update');
    };
  }, [slideAnim]);

  // Enhanced agent pulse animation
  useEffect(() => {
    if (agentStatus?.isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(agentPulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(agentPulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      agentPulseAnim.setValue(1);
    }
  }, [agentStatus?.isActive, agentPulseAnim]);

  // Pulsing animation for streaming messages
  useEffect(() => {
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
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

    const hasStreamingMessage = conversation?.messages.some(
      m => m.status === 'streaming' || m.status === 'pending'
    );

    if (hasStreamingMessage) {
      startPulse();
    }

    return () => {
      pulseAnim.stopAnimation();
    };
  }, [conversation?.messages, pulseAnim]);

  const toggleHeaderCollapse = () => {
    const newCollapsedState = !isHeaderCollapsed;
    setIsHeaderCollapsed(newCollapsedState);

    Animated.timing(headerAnimValue, {
      toValue: newCollapsedState ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAgentInfo = (agentUsed?: string) => {
    switch (agentUsed) {
      case 'hold_agent':
        return {
          name: 'Hold Agent',
          avatar: 'clock-outline',
          color: '#FF9800',
        };
      case 'account_support':
        return {
          name: 'Account Support',
          avatar: 'account-circle',
          color: '#2196F3',
        };
      case 'billing_support':
        return {
          name: 'Billing Support',
          avatar: 'credit-card',
          color: '#4CAF50',
        };
      case 'website_support':
        return {
          name: 'Website Support',
          avatar: 'web',
          color: '#9C27B0',
        };
      case 'operator_support':
        return {
          name: 'Customer Service',
          avatar: 'headphones',
          color: '#607D8B',
        };
      case 'joke':
        return {
          name: 'Comedy Bot',
          avatar: 'emoticon-happy',
          color: '#FF5722',
        };
      case 'trivia':
        return {
          name: 'Trivia Master',
          avatar: 'head-question',
          color: '#795548',
        };
      case 'gif':
        return {
          name: 'GIF Master',
          avatar: 'movie',
          color: '#E91E63',
        };
      case 'story_teller':
        return {
          name: 'Story Teller',
          avatar: 'book-open',
          color: '#3F51B5',
        };
      case 'riddle_master':
        return {
          name: 'Riddle Master',
          avatar: 'puzzle',
          color: '#FF9800',
        };
      case 'quote_master':
        return {
          name: 'Quote Master',
          avatar: 'format-quote-close',
          color: '#009688',
        };
      case 'game_host':
        return {
          name: 'Game Host',
          avatar: 'controller-classic',
          color: '#8BC34A',
        };
      case 'music_guru':
        return {
          name: 'Music Guru',
          avatar: 'music',
          color: '#673AB7',
        };
      case 'youtube_guru':
        return {
          name: 'YouTube Guru',
          avatar: 'youtube',
          color: '#FF0000',
        };
      case 'dnd_master':
        return {
          name: 'D&D Master',
          avatar: 'dice-6',
          color: '#6B46C1',
        };
      case 'general':
        return {
          name: 'AI Assistant',
          avatar: 'robot',
          color: '#4CAF50',
        };
      default:
        return {
          name: 'AI Assistant',
          avatar: 'robot',
          color: '#757575',
        };
    }
  };

  const MessageBubble: React.FC<{
    message: Message;
    isStreamingMessage?: boolean;
  }> = ({ message, isStreamingMessage = false }) => {
    const isUser = message.role === 'user';
    const agentInfo =
      !isUser && message.agentUsed ? getAgentInfo(message.agentUsed) : null;

    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isUser
            ? styles.userMessageContainer
            : styles.assistantMessageContainer,
        ]}
      >
        <Avatar.Icon
          size={40}
          icon={isUser ? 'account' : agentInfo?.avatar || 'robot'}
          style={[
            styles.avatar,
            {
              backgroundColor: isUser
                ? ForestColors.brandTertiary
                : agentInfo?.color || ForestColors.brandPrimary,
            },
          ]}
        />

        <View
          style={[
            styles.messageContentContainer,
            isUser ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
          ]}
        >
          <Animated.View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.assistantBubble,
              isStreamingMessage &&
                !isUser && {
                  transform: [{ scale: pulseAnim }],
                  shadowOpacity: 0.3,
                  elevation: 5,
                },
            ]}
          >
            {/* Agent indicator for assistant messages */}
            {!isUser &&
              message.agentUsed &&
              (() => {
                const agentInfo = getAgentInfo(message.agentUsed);
                return (
                  <View style={styles.agentIndicatorContainer}>
                    <Text style={styles.agentName}>{agentInfo.name}</Text>
                    {message.isProactive && (
                      <Chip
                        mode='flat'
                        compact
                        textStyle={styles.chipText}
                        style={styles.proactiveChip}
                      >
                        🎯 Proactive
                      </Chip>
                    )}
                    {message.confidence && (
                      <Text style={styles.confidenceText}>
                        {Math.round(message.confidence * 100)}% confidence
                      </Text>
                    )}
                  </View>
                );
              })()}

            {isUser ? (
              <Text style={[styles.messageText, styles.userMessageText]}>
                {message.content}
              </Text>
            ) : isStreamingMessage ? (
              <View style={styles.markdownContainer}>
                {message.content ? (
                  (() => {
                    const parsedContent = parseMessageContent(message.content);

                    return parsedContent.map((part, index) => {
                      if (part.type === 'youtube' && part.videoData) {
                        return (
                          <YouTubeEmbed
                            key={index}
                            videoId={part.videoData.id}
                            title={part.videoData.title}
                            duration={part.videoData.duration}
                          />
                        );
                      } else if (part.type === 'text' && part.content.trim()) {
                        return (
                          <Markdown key={index} style={markdownStyles}>
                            {part.content}
                          </Markdown>
                        );
                      }
                      return null;
                    });
                  })()
                ) : (
                  <View style={styles.thinkingContainer}>
                    <ActivityIndicator
                      size='small'
                      color={
                        message.status === 'pending'
                          ? ForestColors.loadingPrimary
                          : ForestColors.loadingSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.thinkingText,
                        {
                          color:
                            message.status === 'pending'
                              ? ForestColors.textMuted
                              : ForestColors.textFaint,
                        },
                      ]}
                    >
                      {message.status === 'pending'
                        ? 'Processing your request...'
                        : 'Generating response...'}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.markdownContainer}>
                {(() => {
                  const parsedContent = parseMessageContent(message.content);

                  return parsedContent.map((part, index) => {
                    if (part.type === 'youtube' && part.videoData) {
                      return (
                        <YouTubeEmbed
                          key={index}
                          videoId={part.videoData.id}
                          title={part.videoData.title}
                          duration={part.videoData.duration}
                        />
                      );
                    } else if (part.type === 'text' && part.content.trim()) {
                      return (
                        <Markdown key={index} style={markdownStyles}>
                          {part.content}
                        </Markdown>
                      );
                    }
                    return null;
                  });
                })()}
              </View>
            )}
          </Animated.View>

          <Text
            style={[
              styles.timestamp,
              isUser ? styles.userTimestamp : styles.assistantTimestamp,
            ]}
          >
            {formatTimestamp(message.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  if (!conversation) {
    return (
      <View style={styles.emptyContainer}>
        <Avatar.Icon size={64} icon='robot' style={styles.emptyAvatar} />
        <Text style={styles.emptyTitle}>Welcome to AI Chat Assistant</Text>
        <Text style={styles.emptySubtitle}>
          Start a conversation by typing a message below. I&apos;m here to help
          you with anything you need!
        </Text>
        <View style={styles.chipContainer}>
          <Chip mode='outlined' style={styles.featureChip}>
            Ask questions
          </Chip>
          <Chip mode='outlined' style={styles.featureChip}>
            Get coding help
          </Chip>
          <Chip mode='outlined' style={styles.featureChip}>
            Creative writing
          </Chip>
          <Chip mode='outlined' style={styles.featureChip}>
            Analysis & research
          </Chip>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Minimal Mobile Header */}
      <Animated.View
        style={[
          styles.header,
          {
            height: headerAnimValue.interpolate({
              inputRange: [0, 1],
              outputRange: [48, 72],
            }),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerTouchable}
          onPress={toggleHeaderCollapse}
          activeOpacity={0.7}
        >
          <View style={styles.headerMain}>
            <View style={styles.headerLeft}>
              {/* Single status indicator combining connection and activity */}
              <View
                style={[
                  styles.statusIndicator,
                  {
                    backgroundColor: !isConnected
                      ? ForestColors.error
                      : agentStatus?.isActive
                        ? ForestColors.success
                        : ForestColors.textMuted,
                  },
                ]}
              />

              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {conversation.title}
                </Text>
                <Animated.View
                  style={{
                    opacity: headerAnimValue,
                    height: headerAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 16],
                    }),
                  }}
                >
                  <Text style={styles.headerSubtitle}>
                    {agentStatus
                      ? getAgentInfo(agentStatus.currentAgent).name
                      : 'AI Assistant'}
                  </Text>
                </Animated.View>
              </View>
            </View>

            <View style={styles.headerRight}>
              <Animated.View
                style={[
                  styles.expandToggle,
                  {
                    transform: [
                      {
                        rotate: headerAnimValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '180deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.chevronSymbol}>⌄</Text>
              </Animated.View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Simplified Expanded Info */}
        <Animated.View
          style={[
            styles.expandedInfo,
            {
              opacity: headerAnimValue,
              height: headerAnimValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 24],
              }),
            },
          ]}
        >
          <View style={styles.expandedContent}>
            <Text style={styles.expandedText}>
              {conversation.messages.length} messages
            </Text>
            {agentStatus?.isActive && (
              <Text style={styles.statusText}>• Active</Text>
            )}
          </View>
        </Animated.View>

        {/* Subtle bottom accent */}
        <View
          style={[
            styles.bottomAccent,
            {
              backgroundColor: agentStatus?.isActive
                ? ForestColors.success
                : ForestColors.borderLight,
            },
          ]}
        />
      </Animated.View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {conversation.messages.map(message => {
          const isStreaming = message.status === 'streaming';
          const isPending = message.status === 'pending';

          return (
            <MessageBubble
              key={message.id}
              message={message}
              isStreamingMessage={isStreaming || isPending}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ForestColors.backgroundPrimary,
  },
  header: {
    backgroundColor: ForestColors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: ForestColors.borderMedium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    overflow: 'hidden',
  },
  headerTouchable: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    backgroundColor: ForestColors.brandPrimary,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ForestColors.headerPrimary,
    lineHeight: 22,
  },
  headerSubtitle: {
    fontSize: 12,
    color: ForestColors.headerSecondary,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 2,
  },
  // Modern Mobile Header Elements
  activityPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ForestColors.success,
    marginRight: 8,
    opacity: 0.8,
  },
  connectionDot: {
    marginRight: 8,
  },
  connectionIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageBadge: {
    backgroundColor: ForestColors.brandPrimary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  messageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  expandToggle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ForestColors.backgroundAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronSymbol: {
    fontSize: 12,
    color: ForestColors.textMuted,
    fontWeight: '600',
  },
  // New minimal header styles
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  expandedInfo: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  expandedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedText: {
    fontSize: 12,
    color: ForestColors.headerSecondary,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 12,
    color: ForestColors.success,
    fontWeight: '500',
    marginLeft: 4,
  },
  bottomAccent: {
    height: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  progressAccent: {
    height: 2,
    backgroundColor: ForestColors.brandPrimary,
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    borderRadius: 1,
  },

  // Expanded Metrics Section
  expandedMetrics: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    overflow: 'hidden',
  },

  metricsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  metric: {
    flex: 1,
    alignItems: 'center',
  },

  metricValue: {
    fontSize: 12,
    fontWeight: '700',
    color: ForestColors.textNormal,
    marginBottom: 1,
  },

  metricLabel: {
    fontSize: 7,
    fontWeight: '600',
    color: ForestColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  metricDivider: {
    width: 1,
    height: 16,
    backgroundColor: ForestColors.borderLight,
    marginHorizontal: 6,
    opacity: 0.5,
  },

  goalMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  goalCount: {
    backgroundColor: ForestColors.brandPrimary,
    borderRadius: 6,
    minWidth: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 3,
  },

  goalCountText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#fff',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 2,
    marginBottom: 2,
    minHeight: 44,
  },
  userMessageContainer: {
    backgroundColor: 'transparent',
  },
  assistantMessageContainer: {
    backgroundColor: 'transparent',
  },
  avatar: {
    marginRight: 16,
    marginTop: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  messageContentContainer: {
    flex: 1,
    paddingTop: 2,
  },
  messageBubble: {
    backgroundColor: 'transparent',
  },
  userBubble: {
    backgroundColor: 'transparent',
  },
  assistantBubble: {
    backgroundColor: 'transparent',
  },
  agentIndicatorContainer: {
    marginBottom: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  agentChip: {
    height: 24,
    backgroundColor: ForestColors.backgroundAccent,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  proactiveChip: {
    height: 20,
    backgroundColor: ForestColors.brandPrimary,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    color: ForestColors.textNormal,
  },
  confidenceText: {
    fontSize: 10,
    color: ForestColors.textMuted,
    marginLeft: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: ForestColors.textNormal,
    fontWeight: '400',
    marginBottom: 2,
  },
  userMessageText: {
    color: ForestColors.textNormal,
  },
  markdownContainer: {
    minHeight: 22,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    opacity: 0.8,
  },
  thinkingText: {
    marginLeft: 8,
    fontSize: 14,
    color: ForestColors.textMuted,
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 11,
    color: ForestColors.textMuted,
    marginTop: 2,
    marginLeft: 0,
    opacity: 0.6,
  },
  userTimestamp: {
    textAlign: 'left',
  },
  assistantTimestamp: {
    textAlign: 'left',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: ForestColors.backgroundPrimary,
  },
  emptyAvatar: {
    backgroundColor: ForestColors.brandPrimary,
    marginBottom: 24,
    width: 80,
    height: 80,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: ForestColors.headerPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: ForestColors.headerSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  featureChip: {
    backgroundColor: ForestColors.backgroundSecondary,
    borderColor: ForestColors.borderLight,
    marginHorizontal: 0,
  },
  agentAvatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  agentName: {
    fontSize: 13,
    fontWeight: '600',
    color: ForestColors.headerPrimary,
  },

  // YouTube Embed Styles
  youtubeContainer: {
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: ForestColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: ForestColors.borderLight,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 320,
    alignSelf: 'flex-start',
  },
  youtubeHeader: {
    padding: 12,
    backgroundColor: ForestColors.backgroundTertiary,
    borderBottomWidth: 1,
    borderBottomColor: ForestColors.borderLight,
  },
  youtubeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: ForestColors.headerPrimary,
    marginBottom: 4,
  },
  youtubeDuration: {
    fontSize: 12,
    color: ForestColors.textMuted,
    fontWeight: '500',
  },
  youtubeThumbnailContainer: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
    alignSelf: 'flex-start',
  },
  youtubeThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  youtubeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  youtubePlayButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  youtubePlayIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 3, // Slight offset for visual centering
  },
  youtubeDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youtubeDurationBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

const markdownStyles = {
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: ForestColors.textNormal,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
    color: ForestColors.textNormal,
  },
  strong: {
    fontWeight: 'bold' as const,
    color: ForestColors.headerPrimary,
  },
  em: {
    fontStyle: 'italic' as const,
    color: ForestColors.textNormal,
  },
  code_inline: {
    backgroundColor: ForestColors.backgroundSecondary,
    color: ForestColors.textNormal,
    padding: 4,
    borderRadius: 3,
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 14,
  },
  code_block: {
    backgroundColor: ForestColors.backgroundTertiary,
    color: ForestColors.textNormal,
    padding: 12,
    borderRadius: 4,
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 14,
    borderWidth: 1,
    borderColor: ForestColors.borderLight,
    marginVertical: 4,
  },
  text: {
    color: ForestColors.textNormal,
  },
  link: {
    color: ForestColors.brandPrimary,
    textDecorationLine: 'underline' as const,
  },
  heading1: {
    color: ForestColors.headerPrimary,
    fontSize: 20,
    fontWeight: 'bold' as const,
    marginBottom: 8,
    marginTop: 16,
  },
  heading2: {
    color: ForestColors.headerPrimary,
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 6,
    marginTop: 12,
  },
  heading3: {
    color: ForestColors.headerPrimary,
    fontSize: 16,
    fontWeight: 'bold' as const,
    marginBottom: 4,
    marginTop: 8,
  },
  list_item: {
    color: ForestColors.textNormal,
    marginBottom: 4,
  },
  blockquote: {
    backgroundColor: ForestColors.backgroundTertiary,
    borderLeftWidth: 4,
    borderLeftColor: ForestColors.borderLight,
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 4,
    fontStyle: 'italic' as const,
  },
  image: {
    width: Math.min(width - 160, 150), // Set specific width for GIFs
    height: 100, // Set specific height to prevent UI issues with large GIFs
    borderRadius: 8,
    marginVertical: 8,
    resizeMode: 'contain' as const,
  },
};

export default ChatScreen;

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Avatar, Chip } from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import type { Conversation, Message } from '../types';

interface ChatScreenProps {
  conversation: Conversation | null;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ conversation }) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (conversation?.messages.length) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation?.messages]);

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

  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAgentColor = (agentUsed?: string) => {
    switch (agentUsed) {
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
      case 'general': return '#4CAF50';
      default: return '#757575';
    }
  };

  const getAgentLabel = (agentUsed?: string) => {
    switch (agentUsed) {
      case 'hold_agent': return '⏳ Hold Agent';
      case 'account_support': return '👤 Account Support';
      case 'billing_support': return '💳 Billing Support';
      case 'website_support': return '🌐 Website Support';
      case 'operator_support': return '📞 Customer Service';
      case 'joke': return '🎭 Adaptive Joke Master';
      case 'trivia': return '🧠 Trivia Master';
      case 'gif': return '🎬 GIF Master';
      case 'story_teller': return '📖 Story Teller';
      case 'riddle_master': return '🧩 Riddle Master';
      case 'quote_master': return '💭 Quote Master';
      case 'game_host': return '🎮 Game Host';
      case 'music_guru': return '🎵 Music Guru';
      case 'general': return '💬 General Agent';
      default: return '🤖 AI Agent';
    }
  };

  const MessageBubble: React.FC<{ 
    message: Message; 
    isStreamingMessage?: boolean;
  }> = ({ message, isStreamingMessage = false }) => {
    const isUser = message.role === 'user';
    
    return (
      <View style={[
        styles.messageBubbleContainer,
        isUser ? styles.userMessageContainer : styles.assistantMessageContainer
      ]}>
        <Avatar.Icon
          size={32}
          icon={isUser ? 'account' : 'robot'}
          style={[
            styles.avatar,
            { backgroundColor: isUser ? '#2196F3' : '#4CAF50' }
          ]}
        />
        
        <View style={styles.messageContentContainer}>
          <Animated.View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.assistantBubble,
              isStreamingMessage && !isUser && {
                transform: [{ scale: pulseAnim }],
                shadowOpacity: 0.3,
                elevation: 5,
              }
            ]}
          >
            {/* Agent indicator for assistant messages */}
            {!isUser && message.agentUsed && (
              <View style={styles.agentIndicatorContainer}>
                <Chip
                  mode="outlined"
                  compact
                  textStyle={styles.chipText}
                  style={[styles.agentChip, { borderColor: getAgentColor(message.agentUsed) }]}
                >
                  {getAgentLabel(message.agentUsed)}
                </Chip>
                {message.isProactive && (
                  <Chip
                    mode="flat"
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
            )}
            
            {isUser ? (
              <Text style={[styles.messageText, styles.userMessageText]}>
                {message.content}
              </Text>
            ) : isStreamingMessage ? (
              <View style={styles.markdownContainer}>
                {message.content ? (
                  <Markdown style={markdownStyles}>
                    {message.content}
                  </Markdown>
                ) : (
                  <View style={styles.thinkingContainer}>
                    <ActivityIndicator size="small" color="#666" />
                    <Text style={styles.thinkingText}>AI is thinking...</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.markdownContainer}>
                <Markdown style={markdownStyles}>
                  {message.content}
                </Markdown>
              </View>
            )}
          </Animated.View>
          
          <Text style={[
            styles.timestamp,
            isUser ? styles.userTimestamp : styles.assistantTimestamp
          ]}>
            {formatTimestamp(message.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  if (!conversation) {
    return (
      <View style={styles.emptyContainer}>
        <Avatar.Icon size={64} icon="robot" style={styles.emptyAvatar} />
        <Text style={styles.emptyTitle}>Welcome to AI Chat Assistant</Text>
        <Text style={styles.emptySubtitle}>
          Start a conversation by typing a message below. I&apos;m here to help you with anything you need!
        </Text>
        <View style={styles.chipContainer}>
          <Chip mode="outlined" style={styles.featureChip}>Ask questions</Chip>
          <Chip mode="outlined" style={styles.featureChip}>Get coding help</Chip>
          <Chip mode="outlined" style={styles.featureChip}>Creative writing</Chip>
          <Chip mode="outlined" style={styles.featureChip}>Analysis & research</Chip>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Conversation Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{conversation.title}</Text>
        <Text style={styles.headerSubtitle}>
          {conversation.messages.length} messages
        </Text>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {conversation.messages.map((message) => {
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    marginHorizontal: 8,
  },
  messageContentContainer: {
    flex: 1,
    maxWidth: width * 0.7,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  userBubble: {
    backgroundColor: '#2196F3',
    borderTopRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  agentIndicatorContainer: {
    marginBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  agentChip: {
    height: 24,
  },
  proactiveChip: {
    height: 20,
    backgroundColor: '#2196F3',
  },
  chipText: {
    fontSize: 10,
  },
  confidenceText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  markdownContainer: {
    minHeight: 20,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  thinkingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginHorizontal: 4,
  },
  userTimestamp: {
    textAlign: 'right',
  },
  assistantTimestamp: {
    textAlign: 'left',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
  },
  emptyAvatar: {
    backgroundColor: '#4CAF50',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  featureChip: {
    marginHorizontal: 2,
  },
});

const markdownStyles = {
  body: {
    fontSize: 16,
    lineHeight: 20,
    color: '#333',
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  strong: {
    fontWeight: 'bold' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  code_inline: {
    backgroundColor: '#f0f0f0',
    padding: 2,
    borderRadius: 3,
    fontFamily: 'monospace',
  },
  code_block: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 6,
    fontFamily: 'monospace',
  },
};

export default ChatScreen;

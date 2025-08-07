import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { IconButton, ActivityIndicator } from 'react-native-paper';
import { DiscordColors } from '../constants/Colors';
import { socketService } from '../services/socketService';
import type { Conversation, ChatRequest, Message } from '../types';

interface MessageInputProps {
  conversationId?: string;
  onMessageSent: (message: Message) => void;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  onMessageSent,
  disabled = false,
}) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textInputRef = useRef<TextInput>(null);
  const lastSendTime = useRef(0);

  const handleSend = async () => {
    const now = Date.now();
    if (now - lastSendTime.current < 500) {
      return;
    }
    lastSendTime.current = now;
    if (!message.trim() || isLoading || disabled) return;

    const messageToSend = message.trim();
    setMessage('');
    setIsLoading(true);

    try {
      const request: ChatRequest = {
        message: messageToSend,
        conversationId,
        stream: true,
      };

      // Send message via socket
      socketService.sendStreamingMessage(request);

      // Create user message for immediate UI update
      const userMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: messageToSend,
        role: 'user' as const,
        timestamp: new Date(),
        conversationId: conversationId || `temp-${Date.now()}`,
        status: 'complete' as const,
      };

      onMessageSent(userMessage);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
      // Auto-focus the input for easy multiple message sending
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  const handleTyping = (text: string) => {
    setMessage(text);
    
    // Send typing indicators
    if (conversationId) {
      if (text.length > 0) {
        socketService.startTyping(conversationId);
      } else {
        socketService.stopTyping(conversationId);
      }
    }
  };

  const handleButtonPress = () => {
    handleSend();
  };

  const canSend = message.trim().length > 0 && !isLoading && !disabled;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoidingView}
    >
      <View style={styles.container}>
        <View style={styles.inputContainer}>
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            placeholder="Message #ai-assistant"
            placeholderTextColor={DiscordColors.inputPlaceholder}
            value={message}
            onChangeText={handleTyping}
            multiline
            maxLength={2000}
            editable={!disabled && !isLoading}
            onSubmitEditing={handleSend}
            blurOnSubmit={true}
            returnKeyType="send"
          />
          
          <View style={styles.sendButtonContainer}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#2196F3" />
            ) : (
              <IconButton
                icon="send"
                size={24}
                iconColor={canSend ? '#2196F3' : '#ccc'}
                style={[
                  styles.sendButton,
                  canSend && styles.sendButtonEnabled
                ]}
                onPress={handleButtonPress}
                disabled={!canSend}
              />
            )}
          </View>
        </View>
        
        {/* Character count */}
        {message.length > 1800 && (
          <View style={styles.characterCount}>
            <Text style={[
              styles.characterCountText,
              message.length >= 2000 && styles.characterCountWarning
            ]}>
              {message.length}/2000
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    backgroundColor: DiscordColors.backgroundPrimary,
  },
  container: {
    backgroundColor: DiscordColors.backgroundPrimary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: DiscordColors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: DiscordColors.textNormal,
    maxHeight: 120,
    paddingVertical: 10,
    paddingHorizontal: 4,
    textAlignVertical: 'center',
  },
  sendButtonContainer: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    margin: 0,
    backgroundColor: 'transparent',
  },
  sendButtonEnabled: {
    backgroundColor: DiscordColors.brandExperiment,
    borderRadius: 20,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  characterCountText: {
    fontSize: 12,
    color: DiscordColors.textMuted,
  },
  characterCountWarning: {
    color: DiscordColors.red,
  },
});

export default MessageInput;

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { IconButton, ActivityIndicator } from 'react-native-paper';
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
        id: `user-${Date.now()}`,
        content: messageToSend,
        role: 'user' as const,
        timestamp: new Date(),
        conversationId: conversationId || `new-${Date.now()}`,
        status: 'complete' as const,
      };

      onMessageSent(userMessage);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
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
            placeholder="Type your message..."
            placeholderTextColor="#999"
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
    backgroundColor: '#fff',
  },
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: '#333',
    maxHeight: 120,
    paddingVertical: 8,
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
    backgroundColor: '#e3f2fd',
  },
  characterCount: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  characterCountText: {
    fontSize: 12,
    color: '#666',
  },
  characterCountWarning: {
    color: '#f44336',
  },
});

export default MessageInput;

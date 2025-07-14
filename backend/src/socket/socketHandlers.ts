import { Server } from 'socket.io';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { ChatRequest, Message, Conversation, StreamChunk } from '../types';
import { storage } from '../storage/memoryStorage';

// Helper function to generate conversation title
const generateConversationTitle = (message: string): string => {
  const words = message.split(' ').slice(0, 6);
  return words.join(' ') + (words.length < message.split(' ').length ? '...' : '');
};

export const setupSocketHandlers = (io: Server) => {
  // Initialize OpenAI client (only if API key is provided)
  console.log('OpenAI API Key status:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
  const openai = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }) : null;
  console.log('OpenAI client initialized:', openai ? 'Yes' : 'No');

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a conversation room
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(conversationId);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Handle typing indicators
    socket.on('typing_start', (data: { conversationId: string; userName?: string }) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId: socket.id,
        userName: data.userName || 'Anonymous',
        isTyping: true
      });
    });

    socket.on('typing_stop', (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId: socket.id,
        isTyping: false
      });
    });

    // Handle message status updates
    socket.on('message_read', (data: { conversationId: string; messageId: string }) => {
      socket.to(data.conversationId).emit('message_status', {
        messageId: data.messageId,
        status: 'read',
        readBy: socket.id
      });
    });

    // Handle streaming chat messages
    socket.on('stream_chat', async (data: ChatRequest) => {
      console.log('🔄 Received stream_chat request:', { message: data.message, conversationId: data.conversationId });
      try {
        const { message, conversationId } = data;

        if (!message || message.trim() === '') {
          socket.emit('stream_error', {
            message: 'Message is required',
            code: 'INVALID_REQUEST'
          });
          return;
        }

        // Find or create conversation
        let conversation: Conversation;
        if (conversationId) {
          const foundConversation = storage.getConversation(conversationId);
          if (!foundConversation) {
            socket.emit('stream_error', {
              message: 'Conversation not found',
              code: 'CONVERSATION_NOT_FOUND'
            });
            return;
          }
          conversation = foundConversation;
        } else {
          // Create new conversation
          conversation = {
            id: uuidv4(),
            title: generateConversationTitle(message),
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          storage.addConversation(conversation);
        }

        // Add user message
        const userMessage: Message = {
          id: uuidv4(),
          content: message,
          role: 'user',
          timestamp: new Date(),
          conversationId: conversation.id
        };
        conversation.messages.push(userMessage);

        // Emit user message to conversation room
        io.to(conversation.id).emit('new_message', userMessage);

        // Create AI message placeholder
        const aiMessageId = uuidv4();
        const aiMessage: Message = {
          id: aiMessageId,
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          conversationId: conversation.id
        };
        conversation.messages.push(aiMessage);

        // Emit AI message start
        socket.emit('stream_start', {
          messageId: aiMessageId,
          conversationId: conversation.id
        });

        // Prepare messages for OpenAI
        const openAIMessages = conversation.messages
          .filter(msg => msg.content.trim() !== '') // Filter out empty messages
          .map(msg => ({
            role: msg.role,
            content: msg.content
          }));

        // Stream response from OpenAI
        if (!process.env.OPENAI_API_KEY || !openai) {
          // Demo streaming response when no API key is provided
          const demoResponse = `This is a demo streaming response to: "${message}". To get real AI responses, please set your OPENAI_API_KEY environment variable.`;
          
          // Simulate streaming by sending chunks
          const words = demoResponse.split(' ');
          let currentContent = '';
          
          for (let i = 0; i < words.length; i++) {
            currentContent += (i > 0 ? ' ' : '') + words[i];
            
            const chunk: StreamChunk = {
              id: uuidv4(),
              content: currentContent,
              conversationId: conversation.id,
              messageId: aiMessageId,
              isComplete: i === words.length - 1
            };

            io.to(conversation.id).emit('stream_chunk', chunk);
            
            // Add small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Update the message content
          aiMessage.content = currentContent;
        } else {
          try {
            console.log('🤖 Starting OpenAI streaming request...');
            const stream = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: openAIMessages,
              max_tokens: 1000,
              temperature: 0.7,
              stream: true,
            });

            console.log('✅ OpenAI stream created successfully');
            let fullContent = '';
            let chunkCount = 0;

            for await (const chunk of stream) {
              chunkCount++;
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                
                const streamChunk: StreamChunk = {
                  id: uuidv4(),
                  content: fullContent,
                  conversationId: conversation.id,
                  messageId: aiMessageId,
                  isComplete: false
                };

                console.log(`📡 Sending chunk ${chunkCount}: "${content.substring(0, 20)}..."`);
                socket.emit('stream_chunk', streamChunk);
              }
            }

            console.log(`🏁 OpenAI streaming completed. Total chunks: ${chunkCount}, Full content length: ${fullContent.length}`);

            // Send final chunk
            const finalChunk: StreamChunk = {
              id: uuidv4(),
              content: fullContent,
              conversationId: conversation.id,
              messageId: aiMessageId,
              isComplete: true
            };

            socket.emit('stream_chunk', finalChunk);

            // Update the message content
            aiMessage.content = fullContent || 'I apologize, but I could not generate a response.';
          } catch (error) {
            console.error('❌ OpenAI streaming error:', error);
            const errorContent = 'I apologize, but I encountered an error while processing your request. Please try again.';
            
            const errorChunk: StreamChunk = {
              id: uuidv4(),
              content: errorContent,
              conversationId: conversation.id,
              messageId: aiMessageId,
              isComplete: true
            };

            socket.emit('stream_chunk', errorChunk);
            aiMessage.content = errorContent;
          }
        }

        // Update conversation timestamp
        conversation.updatedAt = new Date();

        // Emit stream complete
        socket.emit('stream_complete', {
          messageId: aiMessageId,
          conversationId: conversation.id,
          conversation: conversation
        });

      } catch (error) {
        console.error('Stream chat error:', error);
        socket.emit('stream_error', {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error from ${socket.id}:`, error);
    });
  });

  // Helper function to emit message to conversation room
  const emitToConversation = (conversationId: string, event: string, data: any) => {
    io.to(conversationId).emit(event, data);
  };

  // Export helper functions for use in routes
  return {
    emitToConversation
  };
};

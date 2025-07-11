import { Server } from 'socket.io';

export const setupSocketHandlers = (io: Server) => {
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

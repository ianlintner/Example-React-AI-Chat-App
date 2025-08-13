import { MemoryStorage } from '../memoryStorage';
import { Conversation, Message } from '../../types';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    // Reset singleton instance before each test
    (MemoryStorage as any).instance = undefined;
    storage = MemoryStorage.getInstance();
  });

  const createMockConversation = (
    id: string,
    title: string = 'Test Conversation',
  ): Conversation => ({
    id,
    title,
    messages: [],
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  });

  const createMockMessage = (
    id: string,
    conversationId: string,
    content: string = 'Test message',
  ): Message => ({
    id,
    content,
    role: 'user' as const,
    timestamp: new Date('2023-01-01'),
    conversationId,
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MemoryStorage.getInstance();
      const instance2 = MemoryStorage.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Conversation Management', () => {
    describe('addConversation', () => {
      it('should add a new conversation', () => {
        const conversation = createMockConversation('conv-1');

        storage.addConversation(conversation);

        const conversations = storage.getConversations();
        expect(conversations).toHaveLength(1);
        expect(conversations[0]).toEqual(conversation);
      });

      it('should add multiple conversations', () => {
        const conv1 = createMockConversation('conv-1', 'First');
        const conv2 = createMockConversation('conv-2', 'Second');

        storage.addConversation(conv1);
        storage.addConversation(conv2);

        const conversations = storage.getConversations();
        expect(conversations).toHaveLength(2);
        expect(conversations).toContain(conv1);
        expect(conversations).toContain(conv2);
      });
    });

    describe('getConversations', () => {
      it('should return empty array when no conversations exist', () => {
        const conversations = storage.getConversations();
        expect(conversations).toEqual([]);
      });

      it('should return all conversations', () => {
        const conv1 = createMockConversation('conv-1');
        const conv2 = createMockConversation('conv-2');

        storage.addConversation(conv1);
        storage.addConversation(conv2);

        const conversations = storage.getConversations();
        expect(conversations).toHaveLength(2);
      });
    });

    describe('getConversation', () => {
      it('should return conversation by id', () => {
        const conversation = createMockConversation('conv-1');
        storage.addConversation(conversation);

        const found = storage.getConversation('conv-1');
        expect(found).toEqual(conversation);
      });

      it('should return undefined for non-existent conversation', () => {
        const found = storage.getConversation('nonexistent');
        expect(found).toBeUndefined();
      });
    });

    describe('updateConversation', () => {
      it('should update existing conversation', () => {
        const conversation = createMockConversation('conv-1', 'Original Title');
        storage.addConversation(conversation);

        const updated = storage.updateConversation('conv-1', {
          title: 'Updated Title',
          updatedAt: new Date('2023-01-02'),
        });

        expect(updated).not.toBeNull();
        expect(updated!.title).toBe('Updated Title');
        expect(updated!.updatedAt).toEqual(new Date('2023-01-02'));

        // Verify the conversation in storage is updated
        const stored = storage.getConversation('conv-1');
        expect(stored!.title).toBe('Updated Title');
      });

      it('should return null for non-existent conversation', () => {
        const updated = storage.updateConversation('nonexistent', {
          title: 'New Title',
        });
        expect(updated).toBeNull();
      });

      it('should partially update conversation', () => {
        const conversation = createMockConversation('conv-1', 'Original');
        conversation.messages = [createMockMessage('msg-1', 'conv-1')];
        storage.addConversation(conversation);

        const updated = storage.updateConversation('conv-1', {
          title: 'Updated Only Title',
        });

        expect(updated).not.toBeNull();
        expect(updated!.title).toBe('Updated Only Title');
        expect(updated!.messages).toHaveLength(1); // Messages should remain unchanged
        expect(updated!.createdAt).toEqual(conversation.createdAt); // CreatedAt should remain unchanged
      });
    });

    describe('deleteConversation', () => {
      it('should delete existing conversation', () => {
        const conversation = createMockConversation('conv-1');
        storage.addConversation(conversation);

        const deleted = storage.deleteConversation('conv-1');
        expect(deleted).toBe(true);

        const found = storage.getConversation('conv-1');
        expect(found).toBeUndefined();

        const conversations = storage.getConversations();
        expect(conversations).toHaveLength(0);
      });

      it('should return false for non-existent conversation', () => {
        const deleted = storage.deleteConversation('nonexistent');
        expect(deleted).toBe(false);
      });

      it('should not affect other conversations when deleting one', () => {
        const conv1 = createMockConversation('conv-1');
        const conv2 = createMockConversation('conv-2');
        storage.addConversation(conv1);
        storage.addConversation(conv2);

        const deleted = storage.deleteConversation('conv-1');
        expect(deleted).toBe(true);

        const conversations = storage.getConversations();
        expect(conversations).toHaveLength(1);
        expect(conversations[0]).toEqual(conv2);
      });
    });
  });

  describe('Helper Methods', () => {
    describe('getSortedConversations', () => {
      it('should return conversations sorted by updatedAt (newest first)', () => {
        const conv1 = createMockConversation('conv-1', 'First');
        conv1.updatedAt = new Date('2023-01-01');

        const conv2 = createMockConversation('conv-2', 'Second');
        conv2.updatedAt = new Date('2023-01-03');

        const conv3 = createMockConversation('conv-3', 'Third');
        conv3.updatedAt = new Date('2023-01-02');

        storage.addConversation(conv1);
        storage.addConversation(conv2);
        storage.addConversation(conv3);

        const sorted = storage.getSortedConversations();
        expect(sorted).toHaveLength(3);
        expect(sorted[0]).toEqual(conv2); // 2023-01-03 (newest)
        expect(sorted[1]).toEqual(conv3); // 2023-01-02
        expect(sorted[2]).toEqual(conv1); // 2023-01-01 (oldest)
      });

      it('should return empty array when no conversations exist', () => {
        const sorted = storage.getSortedConversations();
        expect(sorted).toEqual([]);
      });

      it('should not modify original conversations array', () => {
        const conv1 = createMockConversation('conv-1');
        conv1.updatedAt = new Date('2023-01-01');

        const conv2 = createMockConversation('conv-2');
        conv2.updatedAt = new Date('2023-01-02');

        storage.addConversation(conv1);
        storage.addConversation(conv2);

        const original = storage.getConversations();
        const sorted = storage.getSortedConversations();

        expect(original[0]).toBe(conv1); // Original order preserved
        expect(sorted[0]).toBe(conv2); // Sorted order (newest first)
      });
    });

    describe('getConversationWithLastMessage', () => {
      it('should return conversation with only the last message', () => {
        const conversation = createMockConversation('conv-1');
        const msg1 = createMockMessage('msg-1', 'conv-1', 'First message');
        const msg2 = createMockMessage('msg-2', 'conv-1', 'Second message');
        const msg3 = createMockMessage('msg-3', 'conv-1', 'Last message');

        conversation.messages = [msg1, msg2, msg3];
        storage.addConversation(conversation);

        const result = storage.getConversationWithLastMessage('conv-1');

        expect(result).not.toBeNull();
        expect(result!.messages).toHaveLength(1);
        expect(result!.messages[0]).toEqual(msg3);
        expect(result!.id).toBe('conv-1');
        expect(result!.title).toBe(conversation.title);
      });

      it('should return conversation with empty messages array if no messages exist', () => {
        const conversation = createMockConversation('conv-1');
        storage.addConversation(conversation);

        const result = storage.getConversationWithLastMessage('conv-1');

        expect(result).not.toBeNull();
        expect(result!.messages).toEqual([]);
      });

      it('should return null for non-existent conversation', () => {
        const result = storage.getConversationWithLastMessage('nonexistent');
        expect(result).toBeNull();
      });
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data integrity across operations', () => {
      // Add initial conversation
      const conversation = createMockConversation('conv-1', 'Test');
      storage.addConversation(conversation);

      // Add messages
      const msg1 = createMockMessage('msg-1', 'conv-1', 'Hello');
      const msg2 = createMockMessage('msg-2', 'conv-1', 'World');
      conversation.messages.push(msg1, msg2);

      // Update conversation
      const updated = storage.updateConversation('conv-1', {
        title: 'Updated Test',
        updatedAt: new Date('2023-01-02'),
      });

      expect(updated).not.toBeNull();
      expect(updated!.messages).toHaveLength(2);
      expect(updated!.messages[0]).toEqual(msg1);
      expect(updated!.messages[1]).toEqual(msg2);

      // Verify through different access methods
      const direct = storage.getConversation('conv-1');
      const withLastMessage = storage.getConversationWithLastMessage('conv-1');

      expect(direct!.title).toBe('Updated Test');
      expect(withLastMessage!.title).toBe('Updated Test');
      expect(withLastMessage!.messages[0]).toEqual(msg2);
    });
  });
});

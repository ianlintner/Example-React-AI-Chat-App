import { Conversation } from '../types';

// In-memory storage for demo purposes
// In a real application, this would be replaced with a database
export class MemoryStorage {
  private static instance: MemoryStorage;
  private conversations: Conversation[] = [];

  private constructor() {}

  static getInstance(): MemoryStorage {
    if (!MemoryStorage.instance) {
      MemoryStorage.instance = new MemoryStorage();
    }
    return MemoryStorage.instance;
  }

  // Conversation methods
  getConversations(): Conversation[] {
    return this.conversations;
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.find(c => c.id === id);
  }

  addConversation(conversation: Conversation): void {
    this.conversations.push(conversation);
  }

  updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Conversation | null {
    const index = this.conversations.findIndex(c => c.id === id);
    if (index === -1) return null;

    this.conversations[index] = { ...this.conversations[index], ...updates };
    return this.conversations[index];
  }

  deleteConversation(id: string): boolean {
    const index = this.conversations.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.conversations.splice(index, 1);
    return true;
  }

  // Helper methods
  getSortedConversations(): Conversation[] {
    return [...this.conversations].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  getConversationWithLastMessage(id: string): Conversation | null {
    const conversation = this.getConversation(id);
    if (!conversation) return null;

    return {
      ...conversation,
      messages: conversation.messages.slice(-1),
    };
  }
}

export const storage = MemoryStorage.getInstance();

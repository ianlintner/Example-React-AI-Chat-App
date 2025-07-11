import axios from 'axios';
import type { ChatRequest, ChatResponse, Conversation } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Chat API
export const chatApi = {
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    try {
      const response = await api.post('/api/chat', request);
      return response.data;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to send message');
    }
  },
};

// Conversations API
export const conversationsApi = {
  getAll: async (): Promise<Conversation[]> => {
    try {
      const response = await api.get('/api/conversations');
      return response.data;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch conversations');
    }
  },

  getById: async (id: string): Promise<Conversation> => {
    try {
      const response = await api.get(`/api/conversations/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch conversation');
    }
  },

  create: async (title: string): Promise<Conversation> => {
    try {
      const response = await api.post('/api/conversations', { title });
      return response.data;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create conversation');
    }
  },

  update: async (id: string, title: string): Promise<Conversation> => {
    try {
      const response = await api.put(`/api/conversations/${id}`, { title });
      return response.data;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update conversation');
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/api/conversations/${id}`);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to delete conversation');
    }
  },
};

// Health check
export const healthApi = {
  check: async (): Promise<{ status: string; timestamp: string }> => {
    try {
      const response = await api.get('/api/health');
      return response.data;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Health check failed');
    }
  },
};

export default api;

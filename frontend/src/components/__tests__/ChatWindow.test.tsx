import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import ChatWindow from '../ChatWindow'
import type { Conversation, Message } from '../../types'

const theme = createTheme()

// Wrapper component for MUI theme
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)

const mockMessage: Message = {
  id: '1',
  content: 'Hello, how can I help you?',
  role: 'assistant',
  timestamp: new Date('2024-01-01T10:00:00Z'),
  conversationId: 'conv-1',
  agentUsed: 'general',
  confidence: 0.95,
  status: 'complete',
}

const mockConversation: Conversation = {
  id: 'conv-1',
  title: 'Test Conversation',
  messages: [mockMessage],
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
}

describe('ChatWindow', () => {
  it('renders welcome message when no conversation is provided', () => {
    render(
      <TestWrapper>
        <ChatWindow conversation={null} />
      </TestWrapper>
    )

    expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument()
    expect(screen.getByText(/Start a conversation by typing a message below/)).toBeInTheDocument()
  })

  it('renders conversation title and message count', () => {
    render(
      <TestWrapper>
        <ChatWindow conversation={mockConversation} />
      </TestWrapper>
    )

    expect(screen.getByText('Test Conversation')).toBeInTheDocument()
    expect(screen.getByText('1 messages')).toBeInTheDocument()
  })

  it('renders messages correctly', () => {
    render(
      <TestWrapper>
        <ChatWindow conversation={mockConversation} />
      </TestWrapper>
    )

    expect(screen.getByText('Hello, how can I help you?')).toBeInTheDocument()
  })

  it('displays agent indicator for assistant messages', () => {
    render(
      <TestWrapper>
        <ChatWindow conversation={mockConversation} />
      </TestWrapper>
    )

    expect(screen.getByText('💬 General Agent')).toBeInTheDocument()
    expect(screen.getByText('95% confidence')).toBeInTheDocument()
  })

  it('renders user messages without agent indicators', () => {
    const userMessage: Message = {
      id: '2',
      content: 'Hello there!',
      role: 'user',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      conversationId: 'conv-1',
      status: 'complete',
    }

    const conversationWithUser: Conversation = {
      ...mockConversation,
      messages: [userMessage],
    }

    render(
      <TestWrapper>
        <ChatWindow conversation={conversationWithUser} />
      </TestWrapper>
    )

    expect(screen.getByText('Hello there!')).toBeInTheDocument()
    expect(screen.queryByText('💬 General Agent')).not.toBeInTheDocument()
  })

  it('displays correct agent types', () => {
    const jokeMessage: Message = {
      ...mockMessage,
      id: '2',
      content: 'Why did the chicken cross the road?',
      agentUsed: 'joke',
    }

    const conversationWithJoke: Conversation = {
      ...mockConversation,
      messages: [jokeMessage],
    }

    render(
      <TestWrapper>
        <ChatWindow conversation={conversationWithJoke} />
      </TestWrapper>
    )

    expect(screen.getByText('🎭 Adaptive Joke Master')).toBeInTheDocument()
  })

  it('shows proactive indicator when message is proactive', () => {
    const proactiveMessage: Message = {
      ...mockMessage,
      id: '3',
      isProactive: true,
    }

    const conversationWithProactive: Conversation = {
      ...mockConversation,
      messages: [proactiveMessage],
    }

    render(
      <TestWrapper>
        <ChatWindow conversation={conversationWithProactive} />
      </TestWrapper>
    )

    expect(screen.getByText('🎯 Proactive')).toBeInTheDocument()
  })

  it('formats timestamps correctly', () => {
    render(
      <TestWrapper>
        <ChatWindow conversation={mockConversation} />
      </TestWrapper>
    )

    // Check that timestamp is displayed (format may vary by locale)
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument()
  })

  it('handles streaming messages', () => {
    const streamingMessage: Message = {
      ...mockMessage,
      id: '4',
      content: 'This is streaming...',
      status: 'streaming',
    }

    const conversationWithStreaming: Conversation = {
      ...mockConversation,
      messages: [streamingMessage],
    }

    render(
      <TestWrapper>
        <ChatWindow conversation={conversationWithStreaming} />
      </TestWrapper>
    )

    expect(screen.getByText('This is streaming...')).toBeInTheDocument()
  })

  it('handles pending messages', () => {
    const pendingMessage: Message = {
      ...mockMessage,
      id: '5',
      content: '',
      status: 'pending',
    }

    const conversationWithPending: Conversation = {
      ...mockConversation,
      messages: [pendingMessage],
    }

    render(
      <TestWrapper>
        <ChatWindow conversation={conversationWithPending} />
      </TestWrapper>
    )

    expect(screen.getByText('AI is thinking...')).toBeInTheDocument()
  })
})

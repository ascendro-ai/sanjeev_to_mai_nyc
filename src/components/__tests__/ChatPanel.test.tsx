/**
 * ChatPanel Component Tests
 * Tests for the chat panel component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock dependencies
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { user: { id: 'user-123' } } },
        })
      ),
    },
  })),
}))

vi.mock('@/hooks/useConversations', () => ({
  useConversations: vi.fn(() => ({
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi! How can I help you?',
        timestamp: '2024-01-01T10:00:01Z',
      },
    ],
    isLoading: false,
    sendMessage: vi.fn(),
    error: null,
  })),
}))

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render chat panel', async () => {
      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    })

    it('should render message input', async () => {
      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should render send button', async () => {
      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
    })

    it('should render existing messages', async () => {
      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('Hi! How can I help you?')).toBeInTheDocument()
    })
  })

  describe('message display', () => {
    it('should differentiate user and assistant messages', async () => {
      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      const userMessage = screen.getByText('Hello').closest('[data-role]')
      const assistantMessage = screen
        .getByText('Hi! How can I help you?')
        .closest('[data-role]')

      expect(userMessage).toHaveAttribute('data-role', 'user')
      expect(assistantMessage).toHaveAttribute('data-role', 'assistant')
    })

    it('should display timestamps', async () => {
      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" showTimestamps />)

      // Should show time
      expect(screen.getByText(/10:00/)).toBeInTheDocument()
    })

    it('should scroll to latest message', async () => {
      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      const messagesContainer = screen.getByTestId('messages-container')
      expect(messagesContainer.scrollTop).toBeDefined()
    })
  })

  describe('sending messages', () => {
    it('should send message on button click', async () => {
      const user = userEvent.setup()
      const { useConversations } = await import('@/hooks/useConversations')
      const sendMessage = vi.fn()
      vi.mocked(useConversations).mockReturnValue({
        messages: [],
        isLoading: false,
        sendMessage,
        error: null,
      })

      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      fireEvent.click(screen.getByRole('button', { name: /send/i }))

      expect(sendMessage).toHaveBeenCalledWith('Test message')
    })

    it('should send message on enter key', async () => {
      const user = userEvent.setup()
      const { useConversations } = await import('@/hooks/useConversations')
      const sendMessage = vi.fn()
      vi.mocked(useConversations).mockReturnValue({
        messages: [],
        isLoading: false,
        sendMessage,
        error: null,
      })

      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message{enter}')

      expect(sendMessage).toHaveBeenCalledWith('Test message')
    })

    it('should clear input after sending', async () => {
      const user = userEvent.setup()
      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      const input = screen.getByRole('textbox') as HTMLInputElement
      await user.type(input, 'Test message')
      fireEvent.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        expect(input.value).toBe('')
      })
    })

    it('should disable send for empty input', async () => {
      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).toBeDisabled()
    })
  })

  describe('loading state', () => {
    it('should show loading indicator when sending', async () => {
      const { useConversations } = await import('@/hooks/useConversations')
      vi.mocked(useConversations).mockReturnValue({
        messages: [],
        isLoading: true,
        sendMessage: vi.fn(),
        error: null,
      })

      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })

    it('should disable input while loading', async () => {
      const { useConversations } = await import('@/hooks/useConversations')
      vi.mocked(useConversations).mockReturnValue({
        messages: [],
        isLoading: true,
        sendMessage: vi.fn(),
        error: null,
      })

      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      expect(screen.getByRole('textbox')).toBeDisabled()
    })
  })

  describe('error handling', () => {
    it('should display error message', async () => {
      const { useConversations } = await import('@/hooks/useConversations')
      vi.mocked(useConversations).mockReturnValue({
        messages: [],
        isLoading: false,
        sendMessage: vi.fn(),
        error: new Error('Failed to send message'),
      })

      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      expect(screen.getByText(/Failed to send message/)).toBeInTheDocument()
    })

    it('should allow retry on error', async () => {
      const sendMessage = vi.fn()
      const { useConversations } = await import('@/hooks/useConversations')
      vi.mocked(useConversations).mockReturnValue({
        messages: [],
        isLoading: false,
        sendMessage,
        error: new Error('Failed'),
      })

      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(sendMessage).toHaveBeenCalled()
    })
  })

  describe('empty state', () => {
    it('should show empty state for no messages', async () => {
      const { useConversations } = await import('@/hooks/useConversations')
      vi.mocked(useConversations).mockReturnValue({
        messages: [],
        isLoading: false,
        sendMessage: vi.fn(),
        error: null,
      })

      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" />)

      expect(screen.getByText(/Start a conversation/i)).toBeInTheDocument()
    })
  })

  describe('suggestions', () => {
    it('should show quick action suggestions', async () => {
      const { useConversations } = await import('@/hooks/useConversations')
      vi.mocked(useConversations).mockReturnValue({
        messages: [],
        isLoading: false,
        sendMessage: vi.fn(),
        error: null,
      })

      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" showSuggestions />)

      expect(screen.getByText(/Suggest/i)).toBeInTheDocument()
    })

    it('should send suggestion on click', async () => {
      const sendMessage = vi.fn()
      const { useConversations } = await import('@/hooks/useConversations')
      vi.mocked(useConversations).mockReturnValue({
        messages: [],
        isLoading: false,
        sendMessage,
        error: null,
      })

      const { ChatPanel } = await import('../ChatPanel')
      render(<ChatPanel workflowId="workflow-123" showSuggestions />)

      const suggestion = screen.getAllByRole('button')[0]
      fireEvent.click(suggestion)

      expect(sendMessage).toHaveBeenCalled()
    })
  })
})

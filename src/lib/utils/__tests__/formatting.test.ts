/**
 * Formatting Utilities Tests
 * Tests for formatting utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Formatting Utilities', () => {
  describe('formatConversationHistory', () => {
    it('should format messages with sender labels', async () => {
      const { formatConversationHistory } = await import('../formatting')
      const messages = [
        { sender: 'user', text: 'Hello' },
        { sender: 'assistant', text: 'Hi there!' },
        { sender: 'user', text: 'How are you?' },
      ]

      const result = formatConversationHistory(messages)

      expect(result).toContain('User: Hello')
      expect(result).toContain('Assistant: Hi there!')
      expect(result).toContain('User: How are you?')
    })

    it('should separate messages with newlines', async () => {
      const { formatConversationHistory } = await import('../formatting')
      const messages = [
        { sender: 'user', text: 'First' },
        { sender: 'assistant', text: 'Second' },
      ]

      const result = formatConversationHistory(messages)

      expect(result).toBe('User: First\nAssistant: Second')
    })

    it('should handle empty messages array', async () => {
      const { formatConversationHistory } = await import('../formatting')

      const result = formatConversationHistory([])

      expect(result).toBe('')
    })

    it('should handle single message', async () => {
      const { formatConversationHistory } = await import('../formatting')
      const messages = [{ sender: 'user', text: 'Only message' }]

      const result = formatConversationHistory(messages)

      expect(result).toBe('User: Only message')
    })
  })

  describe('formatDate', () => {
    it('should format Date object', async () => {
      const { formatDate } = await import('../formatting')
      const date = new Date('2024-01-15T10:30:00Z')

      const result = formatDate(date)

      expect(result).toMatch(/Jan/)
      expect(result).toMatch(/15/)
      expect(result).toMatch(/2024/)
    })

    it('should format date string', async () => {
      const { formatDate } = await import('../formatting')

      const result = formatDate('2024-06-20T15:00:00Z')

      expect(result).toMatch(/Jun/)
      expect(result).toMatch(/20/)
      expect(result).toMatch(/2024/)
    })

    it('should handle ISO date strings', async () => {
      const { formatDate } = await import('../formatting')

      const result = formatDate('2024-12-25')

      expect(result).toMatch(/Dec/)
      expect(result).toMatch(/25/)
    })
  })

  describe('formatTime', () => {
    it('should format time from Date object', async () => {
      const { formatTime } = await import('../formatting')
      const date = new Date('2024-01-15T14:30:00')

      const result = formatTime(date)

      // Should contain hour and minute
      expect(result).toMatch(/\d{1,2}:\d{2}/)
    })

    it('should format time from string', async () => {
      const { formatTime } = await import('../formatting')

      const result = formatTime('2024-01-15T09:15:00')

      expect(result).toMatch(/\d{1,2}:\d{2}/)
    })
  })

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return "just now" for very recent times', async () => {
      const { formatRelativeTime } = await import('../formatting')
      const date = new Date('2024-01-15T11:59:30Z') // 30 seconds ago

      const result = formatRelativeTime(date)

      expect(result).toBe('just now')
    })

    it('should format minutes ago', async () => {
      const { formatRelativeTime } = await import('../formatting')
      const date = new Date('2024-01-15T11:45:00Z') // 15 minutes ago

      const result = formatRelativeTime(date)

      expect(result).toBe('15m ago')
    })

    it('should format hours ago', async () => {
      const { formatRelativeTime } = await import('../formatting')
      const date = new Date('2024-01-15T09:00:00Z') // 3 hours ago

      const result = formatRelativeTime(date)

      expect(result).toBe('3h ago')
    })

    it('should format days ago', async () => {
      const { formatRelativeTime } = await import('../formatting')
      const date = new Date('2024-01-13T12:00:00Z') // 2 days ago

      const result = formatRelativeTime(date)

      expect(result).toBe('2d ago')
    })

    it('should fall back to date format for old dates', async () => {
      const { formatRelativeTime } = await import('../formatting')
      const date = new Date('2024-01-01T12:00:00Z') // 14 days ago

      const result = formatRelativeTime(date)

      expect(result).toMatch(/Jan/)
    })

    it('should handle string input', async () => {
      const { formatRelativeTime } = await import('../formatting')

      const result = formatRelativeTime('2024-01-15T11:00:00Z') // 1 hour ago

      expect(result).toBe('1h ago')
    })
  })

  describe('truncate', () => {
    it('should truncate long text', async () => {
      const { truncate } = await import('../formatting')
      const text = 'This is a very long string that needs to be truncated'

      const result = truncate(text, 20)

      expect(result).toBe('This is a very lo...')
      expect(result.length).toBe(20)
    })

    it('should not truncate short text', async () => {
      const { truncate } = await import('../formatting')
      const text = 'Short text'

      const result = truncate(text, 20)

      expect(result).toBe('Short text')
    })

    it('should handle exact length text', async () => {
      const { truncate } = await import('../formatting')
      const text = 'Exactly twenty chars'

      const result = truncate(text, 20)

      expect(result).toBe('Exactly twenty chars')
    })

    it('should handle empty string', async () => {
      const { truncate } = await import('../formatting')

      const result = truncate('', 10)

      expect(result).toBe('')
    })

    it('should handle text shorter than ellipsis', async () => {
      const { truncate } = await import('../formatting')

      const result = truncate('Hi', 5)

      expect(result).toBe('Hi')
    })
  })
})

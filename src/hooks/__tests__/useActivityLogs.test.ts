/*
 * useActivityLogs Hook Tests
 * Uncomment when tests are enabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useActivityLogs } from '../useActivityLogs'
import { createActivityLog } from '@/__tests__/factories'
import { mockSupabaseClient } from '@/__mocks__/supabase'

describe('useActivityLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('activityLogs query', () => {
    it('should fetch recent activity logs', async () => {
      const logs = [
        createActivityLog({ eventType: 'workflow_started' }),
        createActivityLog({ eventType: 'step_completed' }),
        createActivityLog({ eventType: 'review_requested' }),
      ]
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: logs, error: null }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await waitFor(() => {
        expect(result.current.logs).toHaveLength(3)
      })
    })

    it('should limit to specified count', async () => {
      const logs = Array(10).fill(null).map(() => createActivityLog())
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((count) => {
          expect(count).toBe(10)
          return { data: logs.slice(0, count), error: null }
        }),
      })

      const { result } = renderHook(() => useActivityLogs({ limit: 10 }))

      await waitFor(() => {
        expect(result.current.logs).toHaveLength(10)
      })
    })

    it('should order by created_at descending', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      renderHook(() => useActivityLogs())

      await waitFor(() => {
        expect(mockSupabaseClient.from().order).toHaveBeenCalledWith('created_at', { ascending: false })
      })
    })

    it('should return empty array when no logs exist', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await waitFor(() => {
        expect(result.current.logs).toEqual([])
      })
    })

    it('should handle fetch errors gracefully', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: new Error('Fetch failed') }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })

    it('should filter by event type when specified', async () => {
      const logs = [createActivityLog({ eventType: 'workflow_started' })]
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: logs, error: null }),
      })

      const { result } = renderHook(() => useActivityLogs({ eventType: 'workflow_started' }))

      await waitFor(() => {
        expect(result.current.logs).toHaveLength(1)
        expect(result.current.logs[0].eventType).toBe('workflow_started')
      })
    })
  })

  describe('addActivityLog mutation', () => {
    it('should create log with correct event type', async () => {
      const newLog = createActivityLog({ eventType: 'workflow_completed' })
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newLog, error: null }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await result.current.addActivityLog.mutateAsync({
        eventType: 'workflow_completed',
        actorType: 'system',
        actorName: 'System',
        metadata: { workflowId: 'wf-123' },
      })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('activity_logs')
    })

    it('should include actor and metadata', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockImplementation((data) => {
          expect(data.actor_type).toBe('user')
          expect(data.actor_id).toBe('user-123')
          expect(data.actor_name).toBe('John Doe')
          expect(data.metadata).toEqual({ action: 'approved' })
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createActivityLog(), error: null }),
          }
        }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await result.current.addActivityLog.mutateAsync({
        eventType: 'review_completed',
        actorType: 'user',
        actorId: 'user-123',
        actorName: 'John Doe',
        metadata: { action: 'approved' },
      })
    })

    it('should include execution and workflow references', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockImplementation((data) => {
          expect(data.execution_id).toBe('exec-123')
          expect(data.workflow_id).toBe('wf-123')
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createActivityLog(), error: null }),
          }
        }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await result.current.addActivityLog.mutateAsync({
        eventType: 'step_completed',
        actorType: 'ai',
        actorName: 'Email Bot',
        executionId: 'exec-123',
        workflowId: 'wf-123',
        metadata: {},
      })
    })

    it('should handle errors when creating log', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Insert failed') }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await expect(result.current.addActivityLog.mutateAsync({
        eventType: 'workflow_started',
        actorType: 'system',
        actorName: 'System',
        metadata: {},
      })).rejects.toThrow()
    })

    it('should invalidate activity logs query on success', async () => {
      // Test query invalidation
    })
  })

  describe('log event types', () => {
    it('should handle workflow_started event', async () => {
      const log = createActivityLog({ eventType: 'workflow_started' })
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [log], error: null }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await waitFor(() => {
        expect(result.current.logs[0].eventType).toBe('workflow_started')
      })
    })

    it('should handle step_completed event', async () => {
      const log = createActivityLog({ eventType: 'step_completed' })
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [log], error: null }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await waitFor(() => {
        expect(result.current.logs[0].eventType).toBe('step_completed')
      })
    })

    it('should handle review_requested event', async () => {
      const log = createActivityLog({ eventType: 'review_requested' })
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [log], error: null }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await waitFor(() => {
        expect(result.current.logs[0].eventType).toBe('review_requested')
      })
    })

    it('should handle workflow_completed event', async () => {
      const log = createActivityLog({ eventType: 'workflow_completed' })
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [log], error: null }),
      })

      const { result } = renderHook(() => useActivityLogs())

      await waitFor(() => {
        expect(result.current.logs[0].eventType).toBe('workflow_completed')
      })
    })
  })
})

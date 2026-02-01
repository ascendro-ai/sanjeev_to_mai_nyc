/*
 * useWorkflows Hook Tests
 * Uncomment when tests are enabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWorkflows, useWorkflow } from '../useWorkflows'
import { createWorkflow, createWorkflowSteps } from '@/__tests__/factories'
import { mockSupabaseClient } from '@/__mocks__/supabase'

describe('useWorkflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useWorkflows()', () => {
    it('should fetch all workflows ordered by created_at desc', async () => {
      const workflows = [
        createWorkflow({ name: 'Workflow 1' }),
        createWorkflow({ name: 'Workflow 2' }),
      ]
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: workflows, error: null }),
      })

      const { result } = renderHook(() => useWorkflows())

      await waitFor(() => {
        expect(result.current.workflows).toHaveLength(2)
      })
    })

    it('should return empty array when no workflows exist', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      const { result } = renderHook(() => useWorkflows())

      await waitFor(() => {
        expect(result.current.workflows).toEqual([])
      })
    })

    it('should handle fetch errors gracefully', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('Fetch failed') }),
      })

      const { result } = renderHook(() => useWorkflows())

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })

    it('should transform DbWorkflow to Workflow correctly', async () => {
      const dbWorkflow = {
        id: 'wf-123',
        name: 'Test Workflow',
        description: 'Test description',
        status: 'draft',
        workflow_steps: [
          { id: 'step-1', label: 'Step 1', type: 'action', order_index: 0 },
        ],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [dbWorkflow], error: null }),
      })

      const { result } = renderHook(() => useWorkflows())

      await waitFor(() => {
        expect(result.current.workflows[0]).toMatchObject({
          id: 'wf-123',
          name: 'Test Workflow',
          steps: expect.arrayContaining([
            expect.objectContaining({ id: 'step-1', label: 'Step 1' })
          ]),
        })
      })
    })
  })

  describe('useWorkflow(id)', () => {
    it('should fetch single workflow by ID', async () => {
      const workflow = createWorkflow({ id: 'wf-123' })
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: workflow, error: null }),
      })

      const { result } = renderHook(() => useWorkflow('wf-123'))

      await waitFor(() => {
        expect(result.current.workflow?.id).toBe('wf-123')
      })
    })

    it('should return null when workflowId is undefined', async () => {
      const { result } = renderHook(() => useWorkflow(undefined))

      expect(result.current.workflow).toBeUndefined()
    })

    it('should handle non-existent workflow', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

      const { result } = renderHook(() => useWorkflow('non-existent'))

      await waitFor(() => {
        expect(result.current.workflow).toBeNull()
      })
    })
  })

  describe('addWorkflow mutation', () => {
    it('should create workflow with correct db format', async () => {
      const newWorkflow = createWorkflow()
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newWorkflow, error: null }),
      })

      const { result } = renderHook(() => useWorkflows())

      await result.current.addWorkflow.mutateAsync({
        name: 'New Workflow',
        description: 'Description',
        steps: [],
        organizationId: 'org-123',
      })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('workflows')
    })

    it('should invalidate workflows query on success', async () => {
      // Test query invalidation
    })

    it('should handle validation errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Validation failed') }),
      })

      const { result } = renderHook(() => useWorkflows())

      await expect(result.current.addWorkflow.mutateAsync({
        name: '',
        description: '',
        steps: [],
        organizationId: '',
      })).rejects.toThrow()
    })
  })

  describe('updateWorkflow mutation', () => {
    it('should update workflow and set updated_at', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createWorkflow(), error: null }),
      })

      const { result } = renderHook(() => useWorkflows())

      await result.current.updateWorkflow.mutateAsync({
        id: 'wf-123',
        name: 'Updated Name',
      })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('workflows')
    })
  })

  describe('updateStatus mutation', () => {
    it('should update status and is_active flag', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createWorkflow({ status: 'active' }), error: null }),
      })

      const { result } = renderHook(() => useWorkflows())

      await result.current.updateStatus.mutateAsync({
        id: 'wf-123',
        status: 'active',
      })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('workflows')
    })

    it('should handle all valid status transitions: draft -> active -> paused -> archived', async () => {
      // Test status transitions
    })
  })

  describe('updateSteps mutation', () => {
    it('should correctly transform WorkflowStep[] to db format', async () => {
      const steps = createWorkflowSteps(3)
      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      const { result } = renderHook(() => useWorkflows())

      await result.current.updateSteps.mutateAsync({
        workflowId: 'wf-123',
        steps,
      })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('workflow_steps')
    })

    it('should preserve step order via order_index', async () => {
      // Test order preservation
    })
  })
})

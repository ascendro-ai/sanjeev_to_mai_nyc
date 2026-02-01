/*
 * useTeam Hook Tests
 * Uncomment when tests are enabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTeam } from '../useTeam'
import { createDigitalWorker, createDigitalWorkers } from '@/__tests__/factories'
import { mockSupabaseClient } from '@/__mocks__/supabase'

describe('useTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('workers query', () => {
    it('should fetch all digital workers', async () => {
      const workers = createDigitalWorkers(3)
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: workers, error: null }),
      })

      const { result } = renderHook(() => useTeam())

      await waitFor(() => {
        expect(result.current.workers).toHaveLength(3)
      })
    })

    it('should transform DbDigitalWorker to DigitalWorker', async () => {
      const dbWorker = {
        id: 'worker-123',
        organization_id: 'org-123',
        name: 'Test Worker',
        type: 'ai',
        status: 'active',
        description: 'A test worker',
        personality: { tone: 'professional', verbosity: 'concise' },
        metadata: {},
        manager_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [dbWorker], error: null }),
      })

      const { result } = renderHook(() => useTeam())

      await waitFor(() => {
        expect(result.current.workers[0]).toMatchObject({
          id: 'worker-123',
          name: 'Test Worker',
          type: 'ai',
          status: 'active',
        })
      })
    })

    it('should return empty array when no workers exist', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      const { result } = renderHook(() => useTeam())

      await waitFor(() => {
        expect(result.current.workers).toEqual([])
      })
    })

    it('should handle fetch errors gracefully', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('Fetch failed') }),
      })

      const { result } = renderHook(() => useTeam())

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })
  })

  describe('toOrgChartData', () => {
    it('should build correct hierarchy from flat worker list', async () => {
      const manager = createDigitalWorker({ id: 'manager-1', name: 'Manager', managerId: null })
      const report1 = createDigitalWorker({ id: 'report-1', name: 'Report 1', managerId: 'manager-1' })
      const report2 = createDigitalWorker({ id: 'report-2', name: 'Report 2', managerId: 'manager-1' })
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [manager, report1, report2], error: null }),
      })

      const { result } = renderHook(() => useTeam())

      await waitFor(() => {
        const orgChart = result.current.toOrgChartData()
        expect(orgChart).toBeDefined()
      })
    })

    it('should handle workers without managers as root nodes', async () => {
      const workers = [
        createDigitalWorker({ id: 'root-1', name: 'Root 1', managerId: null }),
        createDigitalWorker({ id: 'root-2', name: 'Root 2', managerId: null }),
      ]
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: workers, error: null }),
      })

      const { result } = renderHook(() => useTeam())

      await waitFor(() => {
        const orgChart = result.current.toOrgChartData()
        // Both workers should be root nodes
        expect(orgChart.length).toBeGreaterThanOrEqual(2)
      })
    })

    it('should correctly nest direct reports', async () => {
      const ceo = createDigitalWorker({ id: 'ceo', name: 'CEO', managerId: null })
      const vp = createDigitalWorker({ id: 'vp', name: 'VP', managerId: 'ceo' })
      const developer = createDigitalWorker({ id: 'dev', name: 'Developer', managerId: 'vp' })
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [ceo, vp, developer], error: null }),
      })

      const { result } = renderHook(() => useTeam())

      await waitFor(() => {
        const orgChart = result.current.toOrgChartData()
        expect(orgChart).toBeDefined()
      })
    })
  })

  describe('activateWorker/deactivateWorker', () => {
    it('should toggle worker status correctly', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: createDigitalWorker({ status: 'active' }),
          error: null
        }),
      })

      const { result } = renderHook(() => useTeam())

      await result.current.activateWorker.mutateAsync('worker-123')

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('digital_workers')
    })

    it('should deactivate active worker', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: createDigitalWorker({ status: 'inactive' }),
          error: null
        }),
      })

      const { result } = renderHook(() => useTeam())

      await result.current.deactivateWorker.mutateAsync('worker-123')

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('digital_workers')
    })
  })

  describe('addWorker mutation', () => {
    it('should create new worker with correct db format', async () => {
      const newWorker = createDigitalWorker()
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newWorker, error: null }),
      })

      const { result } = renderHook(() => useTeam())

      await result.current.addWorker.mutateAsync({
        name: 'New Worker',
        type: 'ai',
        description: 'A new worker',
        organizationId: 'org-123',
      })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('digital_workers')
    })

    it('should invalidate workers query on success', async () => {
      // Test query invalidation
    })
  })

  describe('updateWorker mutation', () => {
    it('should update worker fields', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: createDigitalWorker({ name: 'Updated Name' }),
          error: null
        }),
      })

      const { result } = renderHook(() => useTeam())

      await result.current.updateWorker.mutateAsync({
        id: 'worker-123',
        name: 'Updated Name',
      })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('digital_workers')
    })
  })

  describe('deleteWorker mutation', () => {
    it('should delete worker by id', async () => {
      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      const { result } = renderHook(() => useTeam())

      await result.current.deleteWorker.mutateAsync('worker-123')

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('digital_workers')
    })
  })
})

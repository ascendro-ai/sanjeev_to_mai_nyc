import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../activate/route'

// Mock dependencies
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
    })),
  })),
}))

vi.mock('@/lib/n8n/client', () => ({
  n8nClient: {
    createWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    activateWorkflow: vi.fn(),
    deactivateWorkflow: vi.fn(),
  },
  convertToN8NWorkflow: vi.fn(() => ({
    name: 'Test Workflow',
    nodes: [],
    connections: {},
    settings: {},
  })),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import { n8nClient, convertToN8NWorkflow } from '@/lib/n8n/client'

const mockSupabaseClient = createAdminClient as jest.Mock

function createMockRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/n8n/activate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/n8n/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('request validation', () => {
    it('should reject missing workflowId', async () => {
      const request = createMockRequest({ action: 'activate' })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('Missing')
    })

    it('should reject missing action', async () => {
      const request = createMockRequest({ workflowId: 'wf-123' })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('Missing')
    })

    it('should reject invalid action', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'wf-123',
            name: 'Test Workflow',
            organization_id: 'org-1',
            steps: [{ id: 'step-1', label: 'Start', type: 'trigger', order_index: 0 }],
          },
          error: null,
        }),
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      const request = createMockRequest({
        workflowId: 'wf-123',
        action: 'invalid',
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Invalid action')
    })
  })

  describe('workflow activation', () => {
    it('should activate inactive workflow', async () => {
      const mockWorkflow = {
        id: 'wf-123',
        name: 'Test Workflow',
        organization_id: 'org-1',
        status: 'draft',
        n8n_workflow_id: null,
        steps: [{ id: 'step-1', label: 'Start', type: 'trigger', order_index: 0 }],
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkflow, error: null }),
        update: vi.fn().mockReturnThis(),
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      vi.mocked(n8nClient.createWorkflow).mockResolvedValue({
        id: 'n8n-wf-1',
        name: 'Test Workflow',
        active: false,
      } as any)
      vi.mocked(n8nClient.activateWorkflow).mockResolvedValue({
        id: 'n8n-wf-1',
        active: true,
      } as any)

      const request = createMockRequest({
        workflowId: 'wf-123',
        action: 'activate',
      })
      const response = await POST(request)

      // Should create workflow in n8n
      expect(n8nClient.createWorkflow).toHaveBeenCalled()
      expect(n8nClient.activateWorkflow).toHaveBeenCalledWith('n8n-wf-1')
    })

    it('should update existing n8n workflow', async () => {
      const mockWorkflow = {
        id: 'wf-123',
        name: 'Test Workflow',
        organization_id: 'org-1',
        status: 'paused',
        n8n_workflow_id: 'existing-n8n-wf',
        steps: [{ id: 'step-1', label: 'Start', type: 'trigger', order_index: 0 }],
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkflow, error: null }),
        update: vi.fn().mockReturnThis(),
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      vi.mocked(n8nClient.updateWorkflow).mockResolvedValue({
        id: 'existing-n8n-wf',
        name: 'Test Workflow',
        active: false,
      } as any)
      vi.mocked(n8nClient.activateWorkflow).mockResolvedValue({
        id: 'existing-n8n-wf',
        active: true,
      } as any)

      const request = createMockRequest({
        workflowId: 'wf-123',
        action: 'activate',
      })
      await POST(request)

      // Should update existing workflow, not create new
      expect(n8nClient.updateWorkflow).toHaveBeenCalledWith('existing-n8n-wf', expect.any(Object))
    })

    it('should create new workflow if update fails', async () => {
      const mockWorkflow = {
        id: 'wf-123',
        name: 'Test Workflow',
        organization_id: 'org-1',
        status: 'paused',
        n8n_workflow_id: 'deleted-n8n-wf',
        steps: [{ id: 'step-1', label: 'Start', type: 'trigger', order_index: 0 }],
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkflow, error: null }),
        update: vi.fn().mockReturnThis(),
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      // Update fails (workflow was deleted in n8n)
      vi.mocked(n8nClient.updateWorkflow).mockRejectedValue(new Error('Workflow not found'))
      vi.mocked(n8nClient.createWorkflow).mockResolvedValue({
        id: 'new-n8n-wf',
        name: 'Test Workflow',
        active: false,
      } as any)
      vi.mocked(n8nClient.activateWorkflow).mockResolvedValue({
        id: 'new-n8n-wf',
        active: true,
      } as any)

      const request = createMockRequest({
        workflowId: 'wf-123',
        action: 'activate',
      })
      await POST(request)

      // Should fallback to create
      expect(n8nClient.createWorkflow).toHaveBeenCalled()
    })

    it('should reject workflow with no steps', async () => {
      const mockWorkflow = {
        id: 'wf-123',
        name: 'Empty Workflow',
        organization_id: 'org-1',
        status: 'draft',
        steps: [],
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkflow, error: null }),
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      const request = createMockRequest({
        workflowId: 'wf-123',
        action: 'activate',
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('no steps')
    })
  })

  describe('workflow deactivation', () => {
    it('should deactivate active workflow', async () => {
      const mockWorkflow = {
        id: 'wf-123',
        name: 'Test Workflow',
        organization_id: 'org-1',
        status: 'active',
        n8n_workflow_id: 'n8n-wf-1',
        steps: [{ id: 'step-1', label: 'Start', type: 'trigger', order_index: 0 }],
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkflow, error: null }),
        update: vi.fn().mockReturnThis(),
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      vi.mocked(n8nClient.deactivateWorkflow).mockResolvedValue({
        id: 'n8n-wf-1',
        active: false,
      } as any)

      const request = createMockRequest({
        workflowId: 'wf-123',
        action: 'deactivate',
      })
      await POST(request)

      expect(n8nClient.deactivateWorkflow).toHaveBeenCalledWith('n8n-wf-1')
    })

    it('should handle n8n deactivation failure gracefully', async () => {
      const mockWorkflow = {
        id: 'wf-123',
        name: 'Test Workflow',
        organization_id: 'org-1',
        status: 'active',
        n8n_workflow_id: 'n8n-wf-1',
        steps: [{ id: 'step-1', label: 'Start', type: 'trigger', order_index: 0 }],
      }

      const updateMock = vi.fn().mockReturnThis()
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkflow, error: null }),
        update: updateMock,
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      // n8n deactivation fails
      vi.mocked(n8nClient.deactivateWorkflow).mockRejectedValue(
        new Error('Workflow already deactivated')
      )

      const request = createMockRequest({
        workflowId: 'wf-123',
        action: 'deactivate',
      })
      await POST(request)

      // Should still update database
      expect(updateMock).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return 404 for non-existent workflow', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      const request = createMockRequest({
        workflowId: 'non-existent',
        action: 'activate',
      })
      const response = await POST(request)

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toContain('not found')
    })

    it('should return 500 for database errors', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'wf-123',
            name: 'Test',
            organization_id: 'org-1',
            steps: [{ id: 'step-1', label: 'Start', type: 'trigger', order_index: 0 }],
          },
          error: null,
        }),
        update: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
        })),
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      vi.mocked(n8nClient.createWorkflow).mockResolvedValue({ id: 'n8n-1' } as any)
      vi.mocked(n8nClient.activateWorkflow).mockResolvedValue({ id: 'n8n-1', active: true } as any)

      const request = createMockRequest({
        workflowId: 'wf-123',
        action: 'activate',
      })
      const response = await POST(request)

      expect(response.status).toBe(500)
    })

    it('should handle n8n service errors', async () => {
      const mockWorkflow = {
        id: 'wf-123',
        name: 'Test Workflow',
        organization_id: 'org-1',
        status: 'draft',
        n8n_workflow_id: null,
        steps: [{ id: 'step-1', label: 'Start', type: 'trigger', order_index: 0 }],
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkflow, error: null }),
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      vi.mocked(n8nClient.createWorkflow).mockRejectedValue(new Error('n8n connection refused'))

      const request = createMockRequest({
        workflowId: 'wf-123',
        action: 'activate',
      })
      const response = await POST(request)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toContain('n8n')
    })
  })

  describe('workflow conversion', () => {
    it('should convert workflow to n8n format', async () => {
      const mockWorkflow = {
        id: 'wf-123',
        name: 'Test Workflow',
        organization_id: 'org-1',
        status: 'draft',
        n8n_workflow_id: null,
        steps: [
          { id: 'step-1', label: 'Start', type: 'trigger', order_index: 0 },
          {
            id: 'step-2',
            label: 'Process',
            type: 'action',
            order_index: 1,
            assigned_to_type: 'ai',
            assigned_to_name: 'Agent',
          },
        ],
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkflow, error: null }),
        update: vi.fn().mockReturnThis(),
      }))
      mockSupabaseClient.mockReturnValue({ from: mockFrom })

      vi.mocked(n8nClient.createWorkflow).mockResolvedValue({ id: 'n8n-1' } as any)
      vi.mocked(n8nClient.activateWorkflow).mockResolvedValue({ id: 'n8n-1', active: true } as any)

      const request = createMockRequest({
        workflowId: 'wf-123',
        action: 'activate',
      })
      await POST(request)

      expect(convertToN8NWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'wf-123',
          name: 'Test Workflow',
        }),
        expect.any(String)
      )
    })
  })
})

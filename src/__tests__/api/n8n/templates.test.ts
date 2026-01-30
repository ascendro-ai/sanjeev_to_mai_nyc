import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase
const mockUser = { id: 'user-123', email: 'test@example.com' }
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
  },
  from: vi.fn(),
  rpc: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('Templates API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock responses
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { organization_id: 'org-123' },
            error: null,
          }),
        }
      }
      if (table === 'workflow_templates') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'template-1',
                name: 'Email Triage',
                description: 'Automatically sort emails',
                category: 'communication',
                tags: ['email', 'automation'],
                is_public: true,
                is_featured: true,
                use_count: 150,
                created_at: new Date().toISOString(),
              },
              {
                id: 'template-2',
                name: 'Data Sync',
                description: 'Sync data between systems',
                category: 'data',
                tags: ['sync', 'integration'],
                is_public: true,
                is_featured: false,
                use_count: 75,
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'template-1',
              name: 'Email Triage',
              description: 'Automatically sort emails',
              category: 'communication',
              workflow_definition: {
                name: 'Email Triage',
                steps: [
                  { id: 'step-1', label: 'Trigger', type: 'trigger' },
                  { id: 'step-2', label: 'Categorize', type: 'action' },
                ],
              },
              use_count: 150,
            },
            error: null,
          }),
        }
      }
      if (table === 'workflows') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'wf-new',
              name: 'New Workflow',
              steps: [],
            },
            error: null,
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    mockSupabaseClient.rpc.mockResolvedValue({ error: null })
  })

  describe('GET /api/n8n/templates', () => {
    it('should return public templates for unauthenticated users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { GET } = await import('@/app/api/n8n/templates/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/templates')

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.templates).toBeDefined()
      expect(Array.isArray(data.templates)).toBe(true)
    })

    it('should return single template when id provided', async () => {
      const { GET } = await import('@/app/api/n8n/templates/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/templates?id=template-1'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.template).toBeDefined()
      expect(data.template.id).toBe('template-1')
    })

    it('should filter templates by category', async () => {
      const { GET } = await import('@/app/api/n8n/templates/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/templates?category=communication'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.templates).toBeDefined()
    })

    it('should filter featured templates', async () => {
      const { GET } = await import('@/app/api/n8n/templates/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/templates?featured=true'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)
    })

    it('should search templates by name and description', async () => {
      const { GET } = await import('@/app/api/n8n/templates/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/templates?search=email'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)
    })

    it('should return categories list', async () => {
      const { GET } = await import('@/app/api/n8n/templates/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/templates')

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.categories).toBeDefined()
      expect(Array.isArray(data.categories)).toBe(true)
    })
  })

  describe('POST /api/n8n/templates', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { POST } = await import('@/app/api/n8n/templates/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/templates', {
        method: 'POST',
        body: JSON.stringify({ action: 'useTemplate', templateId: 'template-1' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    describe('useTemplate action', () => {
      it('should create workflow from template', async () => {
        const { POST } = await import('@/app/api/n8n/templates/route')
        const request = new NextRequest('http://localhost:3000/api/n8n/templates', {
          method: 'POST',
          body: JSON.stringify({
            action: 'useTemplate',
            templateId: 'template-1',
            workflowName: 'My Email Workflow',
          }),
        })

        const response = await POST(request)
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.workflow).toBeDefined()
        expect(data.message).toContain('created from template')
      })

      it('should return 400 when templateId missing', async () => {
        const { POST } = await import('@/app/api/n8n/templates/route')
        const request = new NextRequest('http://localhost:3000/api/n8n/templates', {
          method: 'POST',
          body: JSON.stringify({ action: 'useTemplate' }),
        })

        const response = await POST(request)
        expect(response.status).toBe(400)
      })

      it('should return 404 when template not found', async () => {
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { organization_id: 'org-123' },
                error: null,
              }),
            }
          }
          if (table === 'workflow_templates') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        })

        const { POST } = await import('@/app/api/n8n/templates/route')
        const request = new NextRequest('http://localhost:3000/api/n8n/templates', {
          method: 'POST',
          body: JSON.stringify({
            action: 'useTemplate',
            templateId: 'not-found',
          }),
        })

        const response = await POST(request)
        expect(response.status).toBe(404)
      })

      it('should increment template use count', async () => {
        const { POST } = await import('@/app/api/n8n/templates/route')
        const request = new NextRequest('http://localhost:3000/api/n8n/templates', {
          method: 'POST',
          body: JSON.stringify({
            action: 'useTemplate',
            templateId: 'template-1',
          }),
        })

        await POST(request)
        expect(mockSupabaseClient.rpc).toHaveBeenCalled()
      })
    })

    describe('createTemplate action', () => {
      beforeEach(() => {
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { organization_id: 'org-123' },
                error: null,
              }),
            }
          }
          if (table === 'workflows') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'wf-123',
                  name: 'My Workflow',
                  description: 'A workflow',
                  steps: [{ id: 's1', label: 'Step 1', type: 'trigger' }],
                },
                error: null,
              }),
            }
          }
          if (table === 'workflow_templates') {
            return {
              select: vi.fn().mockReturnThis(),
              insert: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'template-new',
                  name: 'New Template',
                  category: 'custom',
                },
                error: null,
              }),
            }
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        })
      })

      it('should create template from workflow', async () => {
        const { POST } = await import('@/app/api/n8n/templates/route')
        const request = new NextRequest('http://localhost:3000/api/n8n/templates', {
          method: 'POST',
          body: JSON.stringify({
            action: 'createTemplate',
            workflowId: 'wf-123',
            name: 'My Template',
            category: 'custom',
          }),
        })

        const response = await POST(request)
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.template).toBeDefined()
      })

      it('should return 400 when required fields missing', async () => {
        const { POST } = await import('@/app/api/n8n/templates/route')
        const request = new NextRequest('http://localhost:3000/api/n8n/templates', {
          method: 'POST',
          body: JSON.stringify({
            action: 'createTemplate',
            workflowId: 'wf-123',
            // Missing name and category
          }),
        })

        const response = await POST(request)
        expect(response.status).toBe(400)
      })
    })

    describe('direct template creation', () => {
      it('should create template with workflow definition', async () => {
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { organization_id: 'org-123' },
                error: null,
              }),
            }
          }
          if (table === 'workflow_templates') {
            return {
              select: vi.fn().mockReturnThis(),
              insert: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'template-new',
                  name: 'Direct Template',
                  category: 'custom',
                },
                error: null,
              }),
            }
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        })

        const { POST } = await import('@/app/api/n8n/templates/route')
        const request = new NextRequest('http://localhost:3000/api/n8n/templates', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Direct Template',
            category: 'custom',
            workflowDefinition: {
              name: 'Direct',
              steps: [{ id: 's1', label: 'Start', type: 'trigger' }],
            },
          }),
        })

        const response = await POST(request)
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)
      })
    })
  })

  describe('DELETE /api/n8n/templates', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { DELETE } = await import('@/app/api/n8n/templates/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/templates?id=template-1',
        { method: 'DELETE' }
      )

      const response = await DELETE(request)
      expect(response.status).toBe(401)
    })

    it('should return 400 when id not provided', async () => {
      const { DELETE } = await import('@/app/api/n8n/templates/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/templates', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      expect(response.status).toBe(400)
    })

    it('should delete template successfully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      const { DELETE } = await import('@/app/api/n8n/templates/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/templates?id=template-1',
        { method: 'DELETE' }
      )

      const response = await DELETE(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })
})

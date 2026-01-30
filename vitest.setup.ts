import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock environment variables
vi.stubEnv('N8N_API_URL', 'http://localhost:5678/api/v1')
vi.stubEnv('N8N_API_KEY', 'test-api-key')
vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key')
vi.stubEnv('INTERNAL_API_KEY', 'test-internal-key')
vi.stubEnv('CREDENTIAL_ENCRYPTION_KEY', 'test-encryption-key-32chars!')

// MSW handlers for n8n API
export const n8nHandlers = [
  // Workflow CRUD
  http.get('http://localhost:5678/api/v1/workflows', () => {
    return HttpResponse.json({
      data: [
        { id: 'wf-1', name: 'Test Workflow', active: false },
        { id: 'wf-2', name: 'Active Workflow', active: true },
      ],
    })
  }),

  http.get('http://localhost:5678/api/v1/workflows/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test Workflow',
      nodes: [],
      connections: {},
      active: false,
    })
  }),

  http.post('http://localhost:5678/api/v1/workflows', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: 'wf-new',
      ...body,
      active: false,
    })
  }),

  http.patch('http://localhost:5678/api/v1/workflows/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: params.id,
      ...body,
    })
  }),

  http.delete('http://localhost:5678/api/v1/workflows/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Workflow activation
  http.post('http://localhost:5678/api/v1/workflows/:id/activate', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test Workflow',
      active: true,
    })
  }),

  http.post('http://localhost:5678/api/v1/workflows/:id/deactivate', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test Workflow',
      active: false,
    })
  }),

  // Executions
  http.post('http://localhost:5678/api/v1/workflows/:id/execute', ({ params }) => {
    return HttpResponse.json({
      id: 'exec-1',
      workflowId: params.id,
      status: 'running',
      finished: false,
      mode: 'manual',
      startedAt: new Date().toISOString(),
    })
  }),

  http.get('http://localhost:5678/api/v1/executions/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      workflowId: 'wf-1',
      status: 'success',
      finished: true,
      mode: 'manual',
      startedAt: new Date().toISOString(),
      stoppedAt: new Date().toISOString(),
    })
  }),

  http.get('http://localhost:5678/api/v1/executions', () => {
    return HttpResponse.json({
      data: [
        { id: 'exec-1', workflowId: 'wf-1', status: 'success', finished: true },
        { id: 'exec-2', workflowId: 'wf-1', status: 'failed', finished: true },
      ],
    })
  }),

  http.post('http://localhost:5678/api/v1/executions/:id/stop', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: 'stopped',
      finished: true,
    })
  }),

  // Credentials
  http.post('http://localhost:5678/api/v1/credentials', async ({ request }) => {
    const body = (await request.json()) as { name: string; type: string }
    return HttpResponse.json({
      id: 'cred-new',
      name: body.name,
      type: body.type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }),

  http.patch('http://localhost:5678/api/v1/credentials/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: params.id,
      ...body,
      updatedAt: new Date().toISOString(),
    })
  }),

  http.delete('http://localhost:5678/api/v1/credentials/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),
]

// Gemini API handlers
export const geminiHandlers = [
  http.post('https://generativelanguage.googleapis.com/v1beta/models/*', () => {
    return HttpResponse.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: 'Test analysis',
                  rootCause: 'Test root cause',
                  affectedStep: 'Step 1',
                  suggestedFixes: ['Fix 1', 'Fix 2'],
                  preventionTips: ['Tip 1'],
                  severity: 'medium',
                  category: 'configuration',
                }),
              },
            ],
          },
        },
      ],
    })
  }),
]

// Create MSW server
export const server = setupServer(...n8nHandlers, ...geminiHandlers)

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Close server after all tests
afterAll(() => server.close())

// Mock crypto.randomUUID
if (!globalThis.crypto) {
  globalThis.crypto = {} as Crypto
}
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = (): `${string}-${string}-${string}-${string}-${string}` =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    }) as `${string}-${string}-${string}-${string}-${string}`
}

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  })),
}))

// Global test cleanup
afterEach(() => {
  vi.clearAllMocks()
})

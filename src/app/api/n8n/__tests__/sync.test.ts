/*
 * n8n Sync API Route Tests
 * Uncomment when tests are enabled
 */

// import { describe, it, expect, vi, beforeEach } from 'vitest'
// import { POST, GET } from '../sync/route'
// import { mockSupabaseClient } from '@/__mocks__/supabase'
// import { mockN8nClient, mockN8nWorkflow } from '@/__mocks__/n8n'
// import { createWorkflow } from '@/__tests__/factories'

// // Mock dependencies
// vi.mock('@/lib/supabase/server', () => ({
//   createClient: async () => mockSupabaseClient
// }))

// vi.mock('@/lib/n8n/client', () => ({
//   n8nClient: mockN8nClient
// }))

// describe('POST /api/n8n/sync', () => {
//   beforeEach(() => {
//     vi.clearAllMocks()
//   })

//   it('should sync workflow data with n8n', async () => {
//     const workflow = createWorkflow()
//     mockSupabaseClient.from.mockReturnValue({
//       select: vi.fn().mockReturnThis(),
//       eq: vi.fn().mockReturnThis(),
//       single: vi.fn().mockResolvedValue({ data: workflow, error: null }),
//     })
//     mockN8nClient.createWorkflow.mockResolvedValue(mockN8nWorkflow)

//     const request = new Request('http://localhost/api/n8n/sync', {
//       method: 'POST',
//       body: JSON.stringify({ workflowId: workflow.id }),
//     })

//     const response = await POST(request)
//     expect(response.status).toBe(200)
//   })

//   it('should update n8n_workflow_id on success', async () => {
//     const workflow = createWorkflow()
//     mockSupabaseClient.from.mockReturnValueOnce({
//       select: vi.fn().mockReturnThis(),
//       eq: vi.fn().mockReturnThis(),
//       single: vi.fn().mockResolvedValue({ data: workflow, error: null }),
//     })
//     mockSupabaseClient.from.mockReturnValue({
//       update: vi.fn().mockImplementation((data) => {
//         expect(data.n8n_workflow_id).toBe('n8n-workflow-123')
//         return {
//           eq: vi.fn().mockReturnThis(),
//           single: vi.fn().mockResolvedValue({ data: {}, error: null }),
//         }
//       }),
//     })
//     mockN8nClient.createWorkflow.mockResolvedValue({ ...mockN8nWorkflow, id: 'n8n-workflow-123' })

//     const request = new Request('http://localhost/api/n8n/sync', {
//       method: 'POST',
//       body: JSON.stringify({ workflowId: workflow.id }),
//     })

//     await POST(request)
//   })

//   it('should return 400 when workflowId is missing', async () => {
//     const request = new Request('http://localhost/api/n8n/sync', {
//       method: 'POST',
//       body: JSON.stringify({}),
//     })

//     const response = await POST(request)
//     expect(response.status).toBe(400)
//   })

//   it('should return 404 when workflow not found', async () => {
//     mockSupabaseClient.from.mockReturnValue({
//       select: vi.fn().mockReturnThis(),
//       eq: vi.fn().mockReturnThis(),
//       single: vi.fn().mockResolvedValue({ data: null, error: null }),
//     })

//     const request = new Request('http://localhost/api/n8n/sync', {
//       method: 'POST',
//       body: JSON.stringify({ workflowId: 'non-existent' }),
//     })

//     const response = await POST(request)
//     expect(response.status).toBe(404)
//   })

//   it('should update existing n8n workflow if already synced', async () => {
//     const workflow = createWorkflow({ n8nWorkflowId: 'existing-n8n-id' })
//     mockSupabaseClient.from.mockReturnValue({
//       select: vi.fn().mockReturnThis(),
//       eq: vi.fn().mockReturnThis(),
//       single: vi.fn().mockResolvedValue({ data: workflow, error: null }),
//     })
//     mockN8nClient.updateWorkflow.mockResolvedValue(mockN8nWorkflow)

//     const request = new Request('http://localhost/api/n8n/sync', {
//       method: 'POST',
//       body: JSON.stringify({ workflowId: workflow.id }),
//     })

//     await POST(request)

//     expect(mockN8nClient.updateWorkflow).toHaveBeenCalledWith('existing-n8n-id', expect.any(Object))
//   })

//   it('should handle n8n API errors', async () => {
//     const workflow = createWorkflow()
//     mockSupabaseClient.from.mockReturnValue({
//       select: vi.fn().mockReturnThis(),
//       eq: vi.fn().mockReturnThis(),
//       single: vi.fn().mockResolvedValue({ data: workflow, error: null }),
//     })
//     mockN8nClient.createWorkflow.mockRejectedValue(new Error('n8n API error'))

//     const request = new Request('http://localhost/api/n8n/sync', {
//       method: 'POST',
//       body: JSON.stringify({ workflowId: workflow.id }),
//     })

//     const response = await POST(request)
//     expect(response.status).toBe(500)
//   })
// })

// describe('GET /api/n8n/sync', () => {
//   beforeEach(() => {
//     vi.clearAllMocks()
//   })

//   it('should return synced workflows', async () => {
//     mockN8nClient.getWorkflows.mockResolvedValue([mockN8nWorkflow])

//     const request = new Request('http://localhost/api/n8n/sync', {
//       method: 'GET',
//     })

//     const response = await GET(request)
//     const data = await response.json()

//     expect(response.status).toBe(200)
//     expect(data.workflows).toHaveLength(1)
//   })

//   it('should handle n8n API errors gracefully', async () => {
//     mockN8nClient.getWorkflows.mockRejectedValue(new Error('n8n unreachable'))

//     const request = new Request('http://localhost/api/n8n/sync', {
//       method: 'GET',
//     })

//     const response = await GET(request)
//     expect(response.status).toBe(500)
//   })
// })

export {}

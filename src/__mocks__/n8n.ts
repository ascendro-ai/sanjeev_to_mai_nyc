/*
 * n8n API Mock
 * Uncomment when tests are enabled
 */

// import { vi } from 'vitest'

// export const mockN8nWorkflow = {
//   id: 'n8n-workflow-123',
//   name: 'Test Workflow',
//   active: false,
//   nodes: [],
//   connections: {},
//   createdAt: new Date().toISOString(),
//   updatedAt: new Date().toISOString(),
// }

// export const mockN8nExecution = {
//   id: 'exec-123',
//   status: 'running',
//   startedAt: new Date().toISOString(),
//   workflowId: 'n8n-workflow-123',
// }

// export const mockN8nClient = {
//   createWorkflow: vi.fn().mockResolvedValue(mockN8nWorkflow),
//   getWorkflow: vi.fn().mockResolvedValue(mockN8nWorkflow),
//   updateWorkflow: vi.fn().mockResolvedValue(mockN8nWorkflow),
//   deleteWorkflow: vi.fn().mockResolvedValue({ success: true }),
//   getWorkflows: vi.fn().mockResolvedValue([mockN8nWorkflow]),
//   listWorkflows: vi.fn().mockResolvedValue({ data: [mockN8nWorkflow] }),
//   executeWorkflow: vi.fn().mockResolvedValue(mockN8nExecution),
//   getExecution: vi.fn().mockResolvedValue({ ...mockN8nExecution, status: 'success' }),
//   listExecutions: vi.fn().mockResolvedValue({ data: [mockN8nExecution] }),
//   stopExecution: vi.fn().mockResolvedValue({ ...mockN8nExecution, status: 'stopped' }),
//   activateWorkflow: vi.fn().mockResolvedValue({ ...mockN8nWorkflow, active: true }),
//   deactivateWorkflow: vi.fn().mockResolvedValue({ ...mockN8nWorkflow, active: false }),
//   convertToN8NWorkflow: vi.fn().mockReturnValue(mockN8nWorkflow),
//   getWorkflowWebhookUrl: vi.fn().mockReturnValue('http://localhost:5678/webhook/test'),
//   getWorkflowTestWebhookUrl: vi.fn().mockReturnValue('http://localhost:5678/webhook-test/test'),
// }

// export const n8nRequest = vi.fn()
// export const convertToN8NWorkflow = vi.fn().mockReturnValue(mockN8nWorkflow)

// // Helper to reset mocks
// export function resetN8nMocks() {
//   vi.clearAllMocks()
// }

// // Helper to mock specific workflow data
// export function mockN8nWorkflowData(overrides: Partial<typeof mockN8nWorkflow>) {
//   const workflow = { ...mockN8nWorkflow, ...overrides }
//   mockN8nClient.getWorkflow.mockResolvedValueOnce(workflow)
//   return workflow
// }

export {}

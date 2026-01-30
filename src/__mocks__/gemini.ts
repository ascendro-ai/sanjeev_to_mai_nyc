/*
 * Gemini AI Mock
 * Uncomment when tests are enabled
 */

// import { vi } from 'vitest'

// export const mockGeminiResponse = {
//   workflowName: 'Test Workflow',
//   description: 'A test workflow for email automation',
//   steps: [
//     { id: 'step-1', label: 'Receive Email', type: 'trigger', order: 0, assignedTo: { type: 'ai', agentName: 'Email Bot' } },
//     { id: 'step-2', label: 'Analyze Content', type: 'action', order: 1, assignedTo: { type: 'ai', agentName: 'AI Analyzer' } },
//     { id: 'step-3', label: 'Review Response', type: 'action', order: 2, assignedTo: { type: 'human', agentName: 'Support Team' } },
//     { id: 'step-4', label: 'Send Reply', type: 'end', order: 3, assignedTo: { type: 'ai', agentName: 'Email Bot' } },
//   ]
// }

// export const mockConsultResponse = {
//   response: 'Tell me more about your workflow requirements...',
//   isComplete: false,
// }

// export const mockGeminiModel = {
//   generateContent: vi.fn().mockResolvedValue({
//     response: {
//       text: () => JSON.stringify(mockGeminiResponse)
//     }
//   })
// }

// export const getModel = vi.fn(() => mockGeminiModel)

// // Helper to mock specific responses
// export function mockGeminiExtract(response: typeof mockGeminiResponse) {
//   mockGeminiModel.generateContent.mockResolvedValueOnce({
//     response: { text: () => JSON.stringify(response) }
//   })
// }

// export function mockGeminiConsult(response: typeof mockConsultResponse) {
//   mockGeminiModel.generateContent.mockResolvedValueOnce({
//     response: { text: () => JSON.stringify(response) }
//   })
// }

// export function mockGeminiError(errorMessage: string) {
//   mockGeminiModel.generateContent.mockRejectedValueOnce(new Error(errorMessage))
// }

export {}

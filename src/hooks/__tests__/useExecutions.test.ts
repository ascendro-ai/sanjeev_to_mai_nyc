/*
 * useExecutions Hook Tests
 * Uncomment when tests are enabled
 */

// import { describe, it, expect, vi, beforeEach } from 'vitest'
// import { renderHook, waitFor } from '@testing-library/react'
// import { useExecutions, useExecution } from '../useExecutions'
// import { createExecution } from '@/__tests__/factories'
// import { mockSupabaseClient } from '@/__mocks__/supabase'

// describe('useExecutions', () => {
//   beforeEach(() => {
//     vi.clearAllMocks()
//   })

//   describe('executions query', () => {
//     it('should fetch all executions with workflow data', async () => {
//       const executions = [
//         createExecution({ workflowName: 'Workflow 1' }),
//         createExecution({ workflowName: 'Workflow 2' }),
//       ]
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: executions, error: null }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await waitFor(() => {
//         expect(result.current.executions).toHaveLength(2)
//       })
//     })

//     it('should order by started_at descending', async () => {
//       const executions = [
//         createExecution({ startedAt: new Date('2024-01-02') }),
//         createExecution({ startedAt: new Date('2024-01-01') }),
//       ]
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: executions, error: null }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await waitFor(() => {
//         expect(mockSupabaseClient.from().order).toHaveBeenCalledWith('started_at', { ascending: false })
//       })
//     })

//     it('should return empty array when no executions exist', async () => {
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: [], error: null }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await waitFor(() => {
//         expect(result.current.executions).toEqual([])
//       })
//     })

//     it('should handle fetch errors gracefully', async () => {
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: null, error: new Error('Fetch failed') }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await waitFor(() => {
//         expect(result.current.isError).toBe(true)
//       })
//     })
//   })

//   describe('executionSteps query', () => {
//     it('should fetch steps for specific execution', async () => {
//       const steps = [
//         { id: 'step-1', executionId: 'exec-1', status: 'completed' },
//         { id: 'step-2', executionId: 'exec-1', status: 'running' },
//       ]
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: steps, error: null }),
//       })

//       const { result } = renderHook(() => useExecution('exec-1'))

//       await waitFor(() => {
//         expect(result.current.steps).toHaveLength(2)
//       })
//     })

//     it('should order by started_at ascending', async () => {
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: [], error: null }),
//       })

//       renderHook(() => useExecution('exec-1'))

//       await waitFor(() => {
//         expect(mockSupabaseClient.from().order).toHaveBeenCalledWith('started_at', { ascending: true })
//       })
//     })

//     it('should not fetch when executionId is undefined', async () => {
//       const { result } = renderHook(() => useExecution(undefined))

//       expect(result.current.steps).toBeUndefined()
//     })
//   })

//   describe('startExecution mutation', () => {
//     it('should create execution with running status', async () => {
//       const newExecution = createExecution({ status: 'running' })
//       mockSupabaseClient.from.mockReturnValue({
//         insert: vi.fn().mockReturnThis(),
//         select: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: newExecution, error: null }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await result.current.startExecution.mutateAsync({
//         workflowId: 'wf-123',
//         triggerType: 'manual',
//         triggerData: {},
//       })

//       expect(mockSupabaseClient.from).toHaveBeenCalledWith('executions')
//     })

//     it('should set trigger type correctly', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         insert: vi.fn().mockImplementation((data) => {
//           expect(data.trigger_type).toBe('scheduled')
//           return {
//             select: vi.fn().mockReturnThis(),
//             single: vi.fn().mockResolvedValue({ data: createExecution(), error: null }),
//           }
//         }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await result.current.startExecution.mutateAsync({
//         workflowId: 'wf-123',
//         triggerType: 'scheduled',
//         triggerData: { schedule: '0 9 * * *' },
//       })
//     })

//     it('should handle errors when starting execution', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         insert: vi.fn().mockReturnThis(),
//         select: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: null, error: new Error('Failed to start') }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await expect(result.current.startExecution.mutateAsync({
//         workflowId: 'wf-123',
//         triggerType: 'manual',
//         triggerData: {},
//       })).rejects.toThrow()
//     })
//   })

//   describe('updateExecutionStatus mutation', () => {
//     it('should update status and set completed_at when finished', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockImplementation((data) => {
//           if (data.status === 'completed') {
//             expect(data.completed_at).toBeDefined()
//           }
//           return {
//             eq: vi.fn().mockReturnThis(),
//             select: vi.fn().mockReturnThis(),
//             single: vi.fn().mockResolvedValue({ data: createExecution({ status: 'completed' }), error: null }),
//           }
//         }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await result.current.updateExecutionStatus.mutateAsync({
//         executionId: 'exec-123',
//         status: 'completed',
//       })
//     })

//     it('should update status to failed with error info', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         select: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({
//           data: createExecution({ status: 'failed' }),
//           error: null
//         }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await result.current.updateExecutionStatus.mutateAsync({
//         executionId: 'exec-123',
//         status: 'failed',
//         error: 'Step 3 failed',
//       })

//       expect(mockSupabaseClient.from).toHaveBeenCalledWith('executions')
//     })
//   })

//   describe('updateStep mutation', () => {
//     it('should update step status', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         select: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({
//           data: { id: 'step-1', status: 'completed' },
//           error: null
//         }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await result.current.updateStep.mutateAsync({
//         stepId: 'step-1',
//         status: 'completed',
//         output: { result: 'success' },
//       })

//       expect(mockSupabaseClient.from).toHaveBeenCalledWith('execution_steps')
//     })

//     it('should store step output data', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockImplementation((data) => {
//           expect(data.output).toEqual({ message: 'Email sent' })
//           return {
//             eq: vi.fn().mockReturnThis(),
//             select: vi.fn().mockReturnThis(),
//             single: vi.fn().mockResolvedValue({ data: {}, error: null }),
//           }
//         }),
//       })

//       const { result } = renderHook(() => useExecutions())

//       await result.current.updateStep.mutateAsync({
//         stepId: 'step-1',
//         status: 'completed',
//         output: { message: 'Email sent' },
//       })
//     })
//   })
// })

export {}

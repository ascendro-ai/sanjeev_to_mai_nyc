/*
 * useRealtime Hook Tests
 * Uncomment when tests are enabled
 */

// import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// import { renderHook, act } from '@testing-library/react'
// import { useRealtime, useControlRoomRealtime } from '../useRealtime'
// import { mockSupabaseClient } from '@/__mocks__/supabase'

// describe('useRealtime', () => {
//   let mockChannel: any
//   let mockSubscription: any

//   beforeEach(() => {
//     vi.clearAllMocks()
//     mockSubscription = { unsubscribe: vi.fn() }
//     mockChannel = {
//       on: vi.fn().mockReturnThis(),
//       subscribe: vi.fn().mockReturnValue(mockSubscription),
//     }
//     mockSupabaseClient.channel.mockReturnValue(mockChannel)
//   })

//   afterEach(() => {
//     vi.clearAllMocks()
//   })

//   describe('useRealtime()', () => {
//     it('should subscribe to specified tables on mount', () => {
//       renderHook(() => useRealtime({
//         tables: ['workflows', 'executions'],
//         onInsert: vi.fn(),
//       }))

//       expect(mockSupabaseClient.channel).toHaveBeenCalled()
//       expect(mockChannel.on).toHaveBeenCalledWith(
//         'postgres_changes',
//         expect.objectContaining({ table: 'workflows' }),
//         expect.any(Function)
//       )
//       expect(mockChannel.on).toHaveBeenCalledWith(
//         'postgres_changes',
//         expect.objectContaining({ table: 'executions' }),
//         expect.any(Function)
//       )
//     })

//     it('should unsubscribe on unmount', () => {
//       const { unmount } = renderHook(() => useRealtime({
//         tables: ['workflows'],
//         onInsert: vi.fn(),
//       }))

//       unmount()

//       expect(mockSupabaseClient.removeChannel).toHaveBeenCalled()
//     })

//     it('should invalidate correct query keys on change events', () => {
//       const onInsert = vi.fn()
//       renderHook(() => useRealtime({
//         tables: ['workflows'],
//         onInsert,
//       }))

//       // Simulate a change event
//       const onCall = mockChannel.on.mock.calls[0]
//       const changeHandler = onCall[2]
//       changeHandler({ eventType: 'INSERT', new: { id: 'new-wf' } })

//       expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({
//         eventType: 'INSERT',
//         new: { id: 'new-wf' }
//       }))
//     })

//     it('should call custom callbacks with payload', () => {
//       const onUpdate = vi.fn()
//       const onDelete = vi.fn()

//       renderHook(() => useRealtime({
//         tables: ['workflows'],
//         onUpdate,
//         onDelete,
//       }))

//       // Get the change handler
//       const calls = mockChannel.on.mock.calls
//       const updateHandler = calls.find(c => c[1].event === 'UPDATE')?.[2]
//       const deleteHandler = calls.find(c => c[1].event === 'DELETE')?.[2]

//       if (updateHandler) {
//         updateHandler({ eventType: 'UPDATE', new: { id: 'updated' } })
//         expect(onUpdate).toHaveBeenCalled()
//       }

//       if (deleteHandler) {
//         deleteHandler({ eventType: 'DELETE', old: { id: 'deleted' } })
//         expect(onDelete).toHaveBeenCalled()
//       }
//     })
//   })

//   describe('useControlRoomRealtime()', () => {
//     it('should subscribe to executions, execution_steps, review_requests, activity_logs', () => {
//       renderHook(() => useControlRoomRealtime())

//       expect(mockSupabaseClient.channel).toHaveBeenCalled()

//       const subscribedTables = mockChannel.on.mock.calls.map(call => call[1].table)
//       expect(subscribedTables).toContain('executions')
//       expect(subscribedTables).toContain('review_requests')
//       expect(subscribedTables).toContain('activity_logs')
//     })

//     it('should invalidate control room queries on changes', () => {
//       // This test would verify that React Query caches are invalidated
//       renderHook(() => useControlRoomRealtime())

//       // Simulate changes and verify query invalidation
//       expect(mockChannel.subscribe).toHaveBeenCalled()
//     })
//   })
// })

export {}

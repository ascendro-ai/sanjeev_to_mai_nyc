/*
 * useConversations Hook Tests
 * Uncomment when tests are enabled
 */

// import { describe, it, expect, vi, beforeEach } from 'vitest'
// import { renderHook, waitFor } from '@testing-library/react'
// import { useConversations, useConversation } from '../useConversations'
// import { createConversationMessage } from '@/__tests__/factories'
// import { mockSupabaseClient } from '@/__mocks__/supabase'

// describe('useConversations', () => {
//   beforeEach(() => {
//     vi.clearAllMocks()
//   })

//   describe('conversations query', () => {
//     it('should fetch all conversations', async () => {
//       const conversations = [
//         { id: 'conv-1', messages: [createConversationMessage()], created_at: '2024-01-01' },
//         { id: 'conv-2', messages: [createConversationMessage()], created_at: '2024-01-02' },
//       ]
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: conversations, error: null }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await waitFor(() => {
//         expect(result.current.conversations).toHaveLength(2)
//       })
//     })

//     it('should transform messages correctly', async () => {
//       const conversation = {
//         id: 'conv-1',
//         messages: [
//           { sender: 'user', text: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
//           { sender: 'system', text: 'Hi there!', timestamp: '2024-01-01T00:00:01Z' },
//         ],
//         created_at: '2024-01-01T00:00:00Z',
//       }
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: [conversation], error: null }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await waitFor(() => {
//         expect(result.current.conversations[0].messages).toHaveLength(2)
//         expect(result.current.conversations[0].messages[0].sender).toBe('user')
//         expect(result.current.conversations[0].messages[1].sender).toBe('system')
//       })
//     })

//     it('should return empty array when no conversations exist', async () => {
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: [], error: null }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await waitFor(() => {
//         expect(result.current.conversations).toEqual([])
//       })
//     })

//     it('should handle fetch errors gracefully', async () => {
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: null, error: new Error('Fetch failed') }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await waitFor(() => {
//         expect(result.current.isError).toBe(true)
//       })
//     })
//   })

//   describe('useConversation(id)', () => {
//     it('should fetch single conversation by ID', async () => {
//       const conversation = {
//         id: 'conv-123',
//         messages: [createConversationMessage()],
//         created_at: '2024-01-01T00:00:00Z',
//       }
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: conversation, error: null }),
//       })

//       const { result } = renderHook(() => useConversation('conv-123'))

//       await waitFor(() => {
//         expect(result.current.conversation?.id).toBe('conv-123')
//       })
//     })

//     it('should return undefined when conversationId is undefined', async () => {
//       const { result } = renderHook(() => useConversation(undefined))

//       expect(result.current.conversation).toBeUndefined()
//     })

//     it('should handle non-existent conversation', async () => {
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: null, error: null }),
//       })

//       const { result } = renderHook(() => useConversation('non-existent'))

//       await waitFor(() => {
//         expect(result.current.conversation).toBeNull()
//       })
//     })
//   })

//   describe('addMessage mutation', () => {
//     it('should append message to existing conversation', async () => {
//       const existingConversation = {
//         id: 'conv-123',
//         messages: [{ sender: 'user', text: 'Hello' }],
//       }
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: existingConversation, error: null }),
//       })
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         select: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({
//           data: {
//             ...existingConversation,
//             messages: [...existingConversation.messages, { sender: 'system', text: 'Hi!' }],
//           },
//           error: null,
//         }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await result.current.addMessage.mutateAsync({
//         conversationId: 'conv-123',
//         message: { sender: 'system', text: 'Hi!' },
//       })

//       expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversations')
//     })

//     it('should create new conversation if none exists', async () => {
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: null, error: null }),
//       })
//       mockSupabaseClient.from.mockReturnValue({
//         insert: vi.fn().mockReturnThis(),
//         select: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({
//           data: { id: 'new-conv', messages: [{ sender: 'user', text: 'Hello' }] },
//           error: null,
//         }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await result.current.createConversation.mutateAsync({
//         message: { sender: 'user', text: 'Hello' },
//       })

//       expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversations')
//     })

//     it('should include timestamp in message', async () => {
//       const existingConversation = { id: 'conv-123', messages: [] }
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: existingConversation, error: null }),
//       })
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockImplementation((data) => {
//           expect(data.messages[0].timestamp).toBeDefined()
//           return {
//             eq: vi.fn().mockReturnThis(),
//             select: vi.fn().mockReturnThis(),
//             single: vi.fn().mockResolvedValue({ data: existingConversation, error: null }),
//           }
//         }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await result.current.addMessage.mutateAsync({
//         conversationId: 'conv-123',
//         message: { sender: 'user', text: 'Hello' },
//       })
//     })
//   })

//   describe('clearConversation mutation', () => {
//     it('should delete conversation by ID', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         delete: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockResolvedValue({ error: null }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await result.current.clearConversation.mutateAsync('conv-123')

//       expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversations')
//     })

//     it('should handle errors when deleting', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         delete: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockResolvedValue({ error: new Error('Delete failed') }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await expect(result.current.clearConversation.mutateAsync('conv-123')).rejects.toThrow()
//     })

//     it('should invalidate conversations query on success', async () => {
//       // Test query invalidation
//     })
//   })

//   describe('message types', () => {
//     it('should handle user messages', async () => {
//       const conversation = {
//         id: 'conv-1',
//         messages: [{ sender: 'user', text: 'Hello' }],
//         created_at: '2024-01-01',
//       }
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: [conversation], error: null }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await waitFor(() => {
//         expect(result.current.conversations[0].messages[0].sender).toBe('user')
//       })
//     })

//     it('should handle system messages', async () => {
//       const conversation = {
//         id: 'conv-1',
//         messages: [{ sender: 'system', text: 'Welcome!' }],
//         created_at: '2024-01-01',
//       }
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: [conversation], error: null }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await waitFor(() => {
//         expect(result.current.conversations[0].messages[0].sender).toBe('system')
//       })
//     })

//     it('should handle assistant messages', async () => {
//       const conversation = {
//         id: 'conv-1',
//         messages: [{ sender: 'assistant', text: 'How can I help?' }],
//         created_at: '2024-01-01',
//       }
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: [conversation], error: null }),
//       })

//       const { result } = renderHook(() => useConversations())

//       await waitFor(() => {
//         expect(result.current.conversations[0].messages[0].sender).toBe('assistant')
//       })
//     })
//   })
// })

export {}

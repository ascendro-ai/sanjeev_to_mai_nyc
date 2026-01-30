/*
 * useReviewRequests Hook Tests
 * Uncomment when tests are enabled
 */

// import { describe, it, expect, vi, beforeEach } from 'vitest'
// import { renderHook, waitFor } from '@testing-library/react'
// import { usePendingReviews, useReviewRequests } from '../useReviewRequests'
// import { createReviewRequest } from '@/__tests__/factories'
// import { mockSupabaseClient } from '@/__mocks__/supabase'

// describe('useReviewRequests', () => {
//   beforeEach(() => {
//     vi.clearAllMocks()
//   })

//   describe('pendingReviews query', () => {
//     it('should fetch only pending status reviews', async () => {
//       const pendingReviews = [
//         createReviewRequest({ status: 'pending' }),
//         createReviewRequest({ status: 'pending' }),
//       ]
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: pendingReviews, error: null }),
//       })

//       const { result } = renderHook(() => usePendingReviews())

//       await waitFor(() => {
//         expect(result.current.pendingReviews).toHaveLength(2)
//         expect(result.current.pendingReviews.every(r => r.status === 'pending')).toBe(true)
//       })
//     })

//     it('should order by created_at ascending (oldest first)', async () => {
//       const reviews = [
//         createReviewRequest({ createdAt: new Date('2024-01-01') }),
//         createReviewRequest({ createdAt: new Date('2024-01-02') }),
//       ]
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         order: vi.fn().mockResolvedValue({ data: reviews, error: null }),
//       })

//       const { result } = renderHook(() => usePendingReviews())

//       await waitFor(() => {
//         expect(mockSupabaseClient.from().order).toHaveBeenCalledWith('created_at', { ascending: true })
//       })
//     })
//   })

//   describe('approveReview mutation', () => {
//     it('should set status to approved with reviewer info', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         select: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({
//           data: createReviewRequest({ status: 'approved' }),
//           error: null
//         }),
//       })

//       const { result } = renderHook(() => useReviewRequests())

//       await result.current.approveReview.mutateAsync({
//         reviewId: 'review-123',
//         reviewerId: 'user-123',
//       })

//       expect(mockSupabaseClient.from).toHaveBeenCalledWith('review_requests')
//     })

//     it('should set reviewed_at timestamp', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockImplementation((data) => {
//           expect(data.reviewed_at).toBeDefined()
//           return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) }
//         }),
//         eq: vi.fn().mockReturnThis(),
//       })

//       const { result } = renderHook(() => useReviewRequests())

//       await result.current.approveReview.mutateAsync({
//         reviewId: 'review-123',
//         reviewerId: 'user-123',
//       })
//     })
//   })

//   describe('rejectReview mutation', () => {
//     it('should require feedback for rejection', async () => {
//       const { result } = renderHook(() => useReviewRequests())

//       await expect(result.current.rejectReview.mutateAsync({
//         reviewId: 'review-123',
//         reviewerId: 'user-123',
//         feedback: '', // Empty feedback
//       })).rejects.toThrow('Feedback required for rejection')
//     })

//     it('should set status to rejected', async () => {
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         select: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({
//           data: createReviewRequest({ status: 'rejected' }),
//           error: null
//         }),
//       })

//       const { result } = renderHook(() => useReviewRequests())

//       await result.current.rejectReview.mutateAsync({
//         reviewId: 'review-123',
//         reviewerId: 'user-123',
//         feedback: 'Please revise the email tone',
//       })

//       expect(mockSupabaseClient.from).toHaveBeenCalledWith('review_requests')
//     })
//   })

//   describe('addChatMessage mutation', () => {
//     it('should append to existing chat_history', async () => {
//       const existingReview = createReviewRequest({
//         chatHistory: [{ sender: 'user', text: 'Hello' }],
//       })
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: existingReview, error: null }),
//       })
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         select: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: existingReview, error: null }),
//       })

//       const { result } = renderHook(() => useReviewRequests())

//       await result.current.addChatMessage.mutateAsync({
//         reviewId: 'review-123',
//         message: { sender: 'agent', text: 'Hi there!' },
//       })

//       expect(mockSupabaseClient.from).toHaveBeenCalledWith('review_requests')
//     })

//     it('should handle empty initial chat_history', async () => {
//       const existingReview = createReviewRequest({ chatHistory: [] })
//       mockSupabaseClient.from.mockReturnValueOnce({
//         select: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: existingReview, error: null }),
//       })
//       mockSupabaseClient.from.mockReturnValue({
//         update: vi.fn().mockReturnThis(),
//         eq: vi.fn().mockReturnThis(),
//         select: vi.fn().mockReturnThis(),
//         single: vi.fn().mockResolvedValue({ data: existingReview, error: null }),
//       })

//       const { result } = renderHook(() => useReviewRequests())

//       await result.current.addChatMessage.mutateAsync({
//         reviewId: 'review-123',
//         message: { sender: 'user', text: 'First message' },
//       })

//       expect(mockSupabaseClient.from).toHaveBeenCalledWith('review_requests')
//     })
//   })
// })

export {}

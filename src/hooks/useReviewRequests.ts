'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ReviewRequest } from '@/types'

// Database types matching Supabase schema
interface DbReviewRequest {
  id: string
  execution_id: string | null
  step_id: string | null
  step_index: number | null
  assigned_to: string | null
  worker_name: string | null
  status: string
  action_type: string
  action_payload: Record<string, unknown> | null
  reviewer_id: string | null
  reviewed_at: string | null
  feedback: string | null
  edited_data: Record<string, unknown> | null
  chat_history: Array<{ sender: string; text: string; timestamp: string }> | null
  needs_guidance: boolean | null
  timeout_at: string | null
  created_at: string | null
}

// Transform database review request to app review request
function toReviewRequest(db: DbReviewRequest): ReviewRequest {
  return {
    id: db.id,
    executionId: db.execution_id || '',
    stepId: db.step_id || '',
    stepIndex: db.step_index ?? 0,
    assignedTo: db.assigned_to || undefined,
    workerName: db.worker_name || undefined,
    status: db.status as ReviewRequest['status'],
    reviewType: db.action_type as ReviewRequest['reviewType'],
    reviewData: db.action_payload || {},
    reviewerId: db.reviewer_id || undefined,
    reviewedAt: db.reviewed_at ? new Date(db.reviewed_at) : undefined,
    feedback: db.feedback || undefined,
    editedData: db.edited_data || undefined,
    chatHistory: db.chat_history?.map(msg => ({
      sender: msg.sender as 'user' | 'agent',
      text: msg.text,
      timestamp: new Date(msg.timestamp),
    })),
    needsGuidance: db.needs_guidance || undefined,
    timeoutAt: db.timeout_at ? new Date(db.timeout_at) : undefined,
    createdAt: db.created_at ? new Date(db.created_at) : undefined,
  }
}

export function useReviewRequests() {
  // Memoize Supabase client to prevent recreation on every render (6.5 fix)
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  // Fetch all pending review requests
  const {
    data: pendingReviews = [],
    isLoading: pendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['review-requests', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data as DbReviewRequest[]).map(toReviewRequest)
    },
  })

  // Fetch all review requests (with optional filters)
  const useAllReviewRequests = (filters?: { status?: string; executionId?: string }) => {
    return useQuery({
      queryKey: ['review-requests', filters],
      queryFn: async () => {
        let query = supabase
          .from('review_requests')
          .select('*')
          .order('created_at', { ascending: false })

        if (filters?.status) {
          query = query.eq('status', filters.status)
        }
        if (filters?.executionId) {
          query = query.eq('execution_id', filters.executionId)
        }

        const { data, error } = await query

        if (error) throw error
        return (data as DbReviewRequest[]).map(toReviewRequest)
      },
    })
  }

  // Fetch a single review request by ID
  const useReviewRequest = (reviewId: string | undefined) => {
    return useQuery({
      queryKey: ['review-requests', reviewId],
      queryFn: async () => {
        if (!reviewId) return null
        const { data, error } = await supabase
          .from('review_requests')
          .select('*')
          .eq('id', reviewId)
          .single()

        if (error) throw error
        return toReviewRequest(data as DbReviewRequest)
      },
      enabled: !!reviewId,
    })
  }

  // Create a new review request
  const createReviewRequest = useMutation({
    mutationFn: async (review: {
      executionId?: string
      stepId?: string
      stepIndex?: number
      workerName?: string
      reviewType: string
      reviewData: Record<string, unknown>
      assignedTo?: string
      timeoutHours?: number
    }) => {
      const { data, error } = await supabase
        .from('review_requests')
        .insert({
          execution_id: review.executionId || null,
          step_id: review.stepId || null,
          step_index: review.stepIndex ?? null,
          worker_name: review.workerName || null,
          status: 'pending',
          action_type: review.reviewType,
          action_payload: review.reviewData,
          assigned_to: review.assignedTo || null,
          chat_history: [],
          needs_guidance: false,
          timeout_at: review.timeoutHours
            ? new Date(Date.now() + review.timeoutHours * 60 * 60 * 1000).toISOString()
            : null,
        })
        .select()
        .single()

      if (error) throw error
      return toReviewRequest(data as DbReviewRequest)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-requests'] })
    },
  })

  // Approve a review request (calls API to resume n8n workflow)
  const approveReview = useMutation({
    mutationFn: async ({
      reviewId,
      reviewerId,
      feedback,
    }: {
      reviewId: string
      reviewerId: string
      feedback?: string
    }) => {
      // Call the API endpoint which handles both DB update and n8n workflow resume
      const response = await fetch('/api/n8n/review-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          status: 'approved',
          reviewerId,
          feedback,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve review')
      }

      // Fetch updated review from database
      const { data, error } = await supabase
        .from('review_requests')
        .select('*')
        .eq('id', reviewId)
        .single()

      if (error) throw error
      return toReviewRequest(data as DbReviewRequest)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['review-requests'] })
      queryClient.invalidateQueries({ queryKey: ['review-requests', data.id] })
      queryClient.invalidateQueries({ queryKey: ['executions'] })
    },
  })

  // Reject a review request (calls API to stop n8n workflow)
  const rejectReview = useMutation({
    mutationFn: async ({
      reviewId,
      reviewerId,
      feedback,
    }: {
      reviewId: string
      reviewerId: string
      feedback: string
    }) => {
      // Call the API endpoint which handles both DB update and n8n workflow stop
      const response = await fetch('/api/n8n/review-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          status: 'rejected',
          reviewerId,
          feedback,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reject review')
      }

      // Fetch updated review from database
      const { data, error } = await supabase
        .from('review_requests')
        .select('*')
        .eq('id', reviewId)
        .single()

      if (error) throw error
      return toReviewRequest(data as DbReviewRequest)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['review-requests'] })
      queryClient.invalidateQueries({ queryKey: ['review-requests', data.id] })
      queryClient.invalidateQueries({ queryKey: ['executions'] })
    },
  })

  // Edit and approve a review request (calls API to resume n8n workflow with edited data)
  const editAndApprove = useMutation({
    mutationFn: async ({
      reviewId,
      reviewerId,
      editedData,
      feedback,
    }: {
      reviewId: string
      reviewerId: string
      editedData: Record<string, unknown>
      feedback?: string
    }) => {
      // Call the API endpoint which handles both DB update and n8n workflow resume
      const response = await fetch('/api/n8n/review-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          status: 'edited',
          reviewerId,
          editedData,
          feedback,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to edit and approve review')
      }

      // Fetch updated review from database
      const { data, error } = await supabase
        .from('review_requests')
        .select('*')
        .eq('id', reviewId)
        .single()

      if (error) throw error
      return toReviewRequest(data as DbReviewRequest)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['review-requests'] })
      queryClient.invalidateQueries({ queryKey: ['review-requests', data.id] })
      queryClient.invalidateQueries({ queryKey: ['executions'] })
    },
  })

  // Add message to chat history
  const addChatMessage = useMutation({
    mutationFn: async ({
      reviewId,
      sender,
      text,
    }: {
      reviewId: string
      sender: 'user' | 'agent'
      text: string
    }) => {
      // First get current chat history
      const { data: current, error: fetchError } = await supabase
        .from('review_requests')
        .select('chat_history')
        .eq('id', reviewId)
        .single()

      if (fetchError) throw fetchError

      const currentHistory = (current as { chat_history: Array<{ sender: string; text: string; timestamp: string }> | null }).chat_history || []
      const newHistory = [
        ...currentHistory,
        { sender, text, timestamp: new Date().toISOString() },
      ]

      const { data, error } = await supabase
        .from('review_requests')
        .update({ chat_history: newHistory })
        .eq('id', reviewId)
        .select()
        .single()

      if (error) throw error
      return toReviewRequest(data as DbReviewRequest)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['review-requests', data.id] })
    },
  })

  // Mark as needs guidance
  const markNeedsGuidance = useMutation({
    mutationFn: async (reviewId: string) => {
      const { data, error } = await supabase
        .from('review_requests')
        .update({ needs_guidance: true })
        .eq('id', reviewId)
        .select()
        .single()

      if (error) throw error
      return toReviewRequest(data as DbReviewRequest)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['review-requests'] })
      queryClient.invalidateQueries({ queryKey: ['review-requests', data.id] })
    },
  })

  return {
    pendingReviews,
    pendingLoading,
    pendingError,
    refetchPending,
    useAllReviewRequests,
    useReviewRequest,
    createReviewRequest,
    approveReview,
    rejectReview,
    editAndApprove,
    addChatMessage,
    markNeedsGuidance,
  }
}

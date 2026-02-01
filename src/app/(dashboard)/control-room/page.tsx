'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Clock, AlertCircle, MessageSquare, Check, X } from 'lucide-react'
import { Button, Card, Modal } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useReviewRequests } from '@/hooks/useReviewRequests'
import { useControlRoomRealtime } from '@/hooks/useRealtime'
import { useActivityLogs } from '@/hooks/useActivityLogs'
import { useAuth } from '@/providers/AuthProvider'
import type { ReviewRequest, ActivityLog } from '@/types'

export default function ControlRoomPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const {
    pendingReviews,
    pendingLoading,
    approveReview,
    rejectReview,
    addChatMessage,
  } = useReviewRequests()
  const { recentLogs, isLoading: logsLoading } = useActivityLogs()

  const [selectedReview, setSelectedReview] = useState<ReviewRequest | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [feedback, setFeedback] = useState('')
  const [actionError, setActionError] = useState<string | null>(null) // CR5 fix: Error state

  // CR6 fix: Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  // Subscribe to real-time updates
  useControlRoomRealtime({
    onReviewRequestChange: (payload) => {
      console.log('Review request changed:', payload)
    },
    onActivityLogChange: (payload) => {
      console.log('Activity log changed:', payload)
    },
  })

  // CR5 fix: Add error handling to approve action
  const handleApprove = async (review: ReviewRequest) => {
    if (!user) {
      setActionError('You must be logged in to approve reviews')
      return
    }
    setActionError(null)
    try {
      await approveReview.mutateAsync({
        reviewId: review.id,
        reviewerId: user.id,
        feedback: feedback || undefined,
      })
      setSelectedReview(null)
      setFeedback('')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve review'
      setActionError(errorMessage)
      console.error('Error approving review:', error)
    }
  }

  // CR5 fix: Add error handling to reject action
  const handleReject = async (review: ReviewRequest) => {
    if (!user) {
      setActionError('You must be logged in to reject reviews')
      return
    }
    if (!feedback.trim()) {
      setActionError('Please provide feedback for rejection')
      return
    }
    setActionError(null)
    try {
      await rejectReview.mutateAsync({
        reviewId: review.id,
        reviewerId: user.id,
        feedback,
      })
      setSelectedReview(null)
      setFeedback('')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reject review'
      setActionError(errorMessage)
      console.error('Error rejecting review:', error)
    }
  }

  const handleSendChat = async () => {
    if (!selectedReview || !chatInput.trim()) return
    await addChatMessage.mutateAsync({
      reviewId: selectedReview.id,
      sender: 'user',
      text: chatInput.trim(),
    })
    setChatInput('')
  }

  const getLogIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'workflow_complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'blocker':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-blue-500" />
    }
  }

  // CR6 fix: Include auth loading in loading state
  if (authLoading || pendingLoading || logsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  // CR6 fix: Show nothing while redirecting
  if (!user) {
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* CR5 fix: Error toast notification */}
      {actionError && (
        <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg flex items-start gap-3 max-w-md">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Action Failed</p>
            <p className="text-sm text-red-600 mt-0.5">{actionError}</p>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-semibold text-gray-900">Control Room</h1>
        <p className="text-gray-600 mt-1">
          Monitor your digital workers and review their actions
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Pending Reviews */}
        <div className="w-2/3 border-r border-gray-200 overflow-y-auto p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Pending Reviews ({pendingReviews.length})
          </h2>

          {pendingReviews.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
              <p className="text-gray-500 mt-1">No pending reviews at the moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingReviews.map((review) => (
                <Card
                  key={review.id}
                  variant="outlined"
                  className="cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => setSelectedReview(review)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {review.workerName || 'Unknown Worker'}
                        </span>
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                          {review.reviewType}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Step {review.stepIndex + 1}: Requires your review
                      </p>
                      {review.needsGuidance && (
                        <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          Agent needs guidance
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {review.createdAt
                        ? new Date(review.createdAt).toLocaleTimeString()
                        : 'Just now'}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleApprove(review)
                      }}
                      isLoading={approveReview.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedReview(review)
                      }}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Review
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="w-1/3 overflow-y-auto p-6 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Activity Feed</h2>
          <div className="space-y-3">
            {recentLogs.slice(0, 20).map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100"
              >
                <div className="mt-0.5">{getLogIcon(log.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {(log.data as { message?: string })?.message || log.type}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {log.workerName && `${log.workerName} • `}
                    {log.createdAt
                      ? new Date(log.createdAt).toLocaleTimeString()
                      : 'Just now'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={!!selectedReview}
        onClose={() => {
          setSelectedReview(null)
          setFeedback('')
          setChatInput('')
        }}
        title="Review Request"
        size="lg"
      >
        {selectedReview && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">
                {selectedReview.workerName || 'Unknown Worker'}
              </h3>
              <p className="text-sm text-gray-600">
                Step {selectedReview.stepIndex + 1} • {selectedReview.reviewType}
              </p>
            </div>

            {/* Review Data */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Action Details</h4>
              <pre className="text-xs text-gray-600 overflow-auto max-h-40">
                {JSON.stringify(selectedReview.reviewData, null, 2)}
              </pre>
            </div>

            {/* Chat History */}
            {selectedReview.chatHistory && selectedReview.chatHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Conversation
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedReview.chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'p-2 rounded text-sm',
                        msg.sender === 'user'
                          ? 'bg-gray-900 text-white ml-8'
                          : 'bg-gray-100 text-gray-900 mr-8'
                      )}
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send a message to the agent..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendChat()
                    }}
                  />
                  <Button size="sm" onClick={handleSendChat}>
                    Send
                  </Button>
                </div>
              </div>
            )}

            {/* Feedback */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feedback (optional for approval, required for rejection)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Provide feedback for the agent..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => handleReject(selectedReview)}
                isLoading={rejectReview.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                onClick={() => handleApprove(selectedReview)}
                isLoading={approveReview.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

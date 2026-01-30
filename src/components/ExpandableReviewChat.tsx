'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Send,
  Check,
  X,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ReviewRequest } from '@/types'

interface ExpandableReviewChatProps {
  review: ReviewRequest
  onApprove: (reviewId: string, feedback?: string) => void
  onReject: (reviewId: string, feedback: string) => void
  onSendMessage: (reviewId: string, message: string) => void
  isSubmitting?: boolean
  className?: string
}

// Helper to safely get message from reviewData
function getReviewMessage(reviewData: Record<string, unknown> | undefined): string | null {
  if (!reviewData) return null
  const msg = reviewData.message
  if (typeof msg === 'string') return msg
  if (msg !== null && msg !== undefined) return JSON.stringify(msg)
  return null
}

export default function ExpandableReviewChat({
  review,
  onApprove,
  onReject,
  onSendMessage,
  isSubmitting = false,
  className = '',
}: ExpandableReviewChatProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [feedbackInput, setFeedbackInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change or expanded
  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isExpanded, review.chatHistory])

  const handleSendMessage = () => {
    if (!chatInput.trim()) return
    onSendMessage(review.id, chatInput.trim())
    setChatInput('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleApprove = () => {
    onApprove(review.id, feedbackInput || undefined)
    setFeedbackInput('')
  }

  const handleReject = () => {
    if (!feedbackInput.trim()) {
      alert('Please provide feedback when rejecting')
      return
    }
    onReject(review.id, feedbackInput)
    setFeedbackInput('')
  }

  const isError = review.reviewType === 'approval' && review.reviewData?.error
  const actionLabel = isError ? 'Error' : review.reviewType

  return (
    <div
      className={cn(
        'bg-white border rounded-lg overflow-hidden transition-shadow',
        isError ? 'border-l-4 border-l-red-500' : 'border-gray-200',
        isExpanded && 'shadow-md',
        className
      )}
    >
      {/* Header Row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900 truncate">
                {review.workerName || 'Digital Worker'}
              </span>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full uppercase font-medium',
                  isError
                    ? 'bg-red-100 text-red-700'
                    : review.needsGuidance
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                )}
              >
                {isError ? 'ERROR' : review.needsGuidance ? 'NEEDS GUIDANCE' : actionLabel}
              </span>
            </div>
            <p className="text-sm text-gray-500">Step {review.stepIndex + 1}</p>
            {getReviewMessage(review.reviewData) && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {getReviewMessage(review.reviewData)}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500"
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              {isExpanded ? 'Hide' : 'Chat'}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 ml-1" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-1" />
              )}
            </Button>

            {!isExpanded && (
              <Button
                size="sm"
                onClick={() => onApprove(review.id)}
                disabled={isSubmitting}
              >
                <Check className="h-4 w-4 mr-1" />
                {isError ? 'Retry' : 'Approve'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Chat Section */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Chat History */}
          <div className="max-h-60 overflow-y-auto p-4 bg-gray-50">
            {review.chatHistory && review.chatHistory.length > 0 ? (
              <div className="space-y-3">
                {review.chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex',
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                        msg.sender === 'user'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-gray-200 text-gray-900'
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      {msg.timestamp && (
                        <p className="text-xs opacity-60 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No messages yet. Start a conversation with the agent.
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Send guidance to the agent..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isSubmitting}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Feedback and Action Buttons */}
            <div className="space-y-3">
              <textarea
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                placeholder={
                  isError
                    ? 'Add notes for retry (optional)...'
                    : 'Add feedback (required for rejection)...'
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReject}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4 mr-1" />
                  {isError ? 'Dismiss' : 'Reject'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {isError ? 'Retry' : 'Approve'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

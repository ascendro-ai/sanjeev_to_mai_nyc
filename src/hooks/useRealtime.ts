'use client'

import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type TableName =
  | 'executions'
  | 'execution_steps'
  | 'review_requests'
  | 'activity_logs'
  | 'notifications'
  | 'digital_workers'

interface RealtimeOptions {
  tables?: TableName[]
  onExecutionChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onReviewRequestChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onActivityLogChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onNotificationChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onWorkerChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}

/**
 * Hook to subscribe to Supabase Realtime updates for Control Room functionality.
 * Automatically invalidates React Query caches when data changes.
 */
export function useRealtime(options: RealtimeOptions = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const {
    tables = ['executions', 'review_requests', 'activity_logs', 'notifications', 'digital_workers'],
    onExecutionChange,
    onReviewRequestChange,
    onActivityLogChange,
    onNotificationChange,
    onWorkerChange,
  } = options

  const handleChange = useCallback(
    (table: TableName, payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      // Invalidate relevant queries based on table
      switch (table) {
        case 'executions':
          queryClient.invalidateQueries({ queryKey: ['executions'] })
          onExecutionChange?.(payload)
          break
        case 'execution_steps':
          queryClient.invalidateQueries({ queryKey: ['execution-steps'] })
          break
        case 'review_requests':
          queryClient.invalidateQueries({ queryKey: ['review-requests'] })
          onReviewRequestChange?.(payload)
          break
        case 'activity_logs':
          queryClient.invalidateQueries({ queryKey: ['activity-logs'] })
          onActivityLogChange?.(payload)
          break
        case 'notifications':
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
          onNotificationChange?.(payload)
          break
        case 'digital_workers':
          queryClient.invalidateQueries({ queryKey: ['digital-workers'] })
          onWorkerChange?.(payload)
          break
      }
    },
    [queryClient, onExecutionChange, onReviewRequestChange, onActivityLogChange, onNotificationChange, onWorkerChange]
  )

  useEffect(() => {
    const channel = supabase.channel('control-room-realtime')

    // Subscribe to each requested table
    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        (payload) => handleChange(table, payload)
      )
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, tables, handleChange])
}

/**
 * Hook specifically for Control Room real-time updates.
 * Subscribes to executions, review_requests, and activity_logs.
 */
export function useControlRoomRealtime(callbacks?: {
  onExecutionChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onReviewRequestChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onActivityLogChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}) {
  useRealtime({
    tables: ['executions', 'execution_steps', 'review_requests', 'activity_logs'],
    onExecutionChange: callbacks?.onExecutionChange,
    onReviewRequestChange: callbacks?.onReviewRequestChange,
    onActivityLogChange: callbacks?.onActivityLogChange,
  })
}

/**
 * Hook for subscribing to notifications in real-time.
 */
export function useNotificationsRealtime(onNotification?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void) {
  useRealtime({
    tables: ['notifications'],
    onNotificationChange: onNotification,
  })
}

/**
 * Hook for subscribing to digital worker status changes.
 */
export function useWorkerStatusRealtime(onWorkerChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void) {
  useRealtime({
    tables: ['digital_workers'],
    onWorkerChange,
  })
}

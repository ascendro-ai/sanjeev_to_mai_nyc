/**
 * @fileoverview Supabase Realtime subscription hooks for live data updates.
 *
 * These hooks enable real-time functionality by subscribing to Supabase
 * Postgres Changes. When data changes in the database, React Query caches
 * are automatically invalidated, causing UI components to re-render with
 * fresh data.
 *
 * @module hooks/useRealtime
 *
 * @example
 * ```typescript
 * // In Control Room component
 * function ControlRoom() {
 *   // Subscribe to execution and review changes
 *   useControlRoomRealtime({
 *     onExecutionChange: (payload) => console.log('Execution updated:', payload),
 *     onReviewRequestChange: (payload) => toast('New review request!'),
 *   });
 *
 *   // Your component renders with auto-updating data
 *   const { pendingReviews } = useReviewRequests();
 *   // ...
 * }
 * ```
 */

'use client'

import { useEffect, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Database tables that support real-time subscriptions.
 * Each table maps to specific React Query cache keys.
 */
type TableName =
  | 'executions'
  | 'execution_steps'
  | 'review_requests'
  | 'activity_logs'
  | 'notifications'
  | 'digital_workers'

/**
 * Configuration options for the useRealtime hook.
 */
interface RealtimeOptions {
  /**
   * Tables to subscribe to. Defaults to all supported tables.
   * @default ['executions', 'review_requests', 'activity_logs', 'notifications', 'digital_workers']
   */
  tables?: TableName[]

  /**
   * Callback fired when execution data changes.
   * Receives the Supabase realtime payload with old/new record data.
   */
  onExecutionChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void

  /**
   * Callback fired when review request data changes.
   * Useful for showing toasts or notifications.
   */
  onReviewRequestChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void

  /**
   * Callback fired when activity log data changes.
   * Used for live activity feed updates.
   */
  onActivityLogChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void

  /**
   * Callback fired when notification data changes.
   * Can trigger notification badge updates.
   */
  onNotificationChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void

  /**
   * Callback fired when digital worker data changes.
   * Useful for status indicator updates.
   */
  onWorkerChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}

// -----------------------------------------------------------------------------
// Main Hook
// -----------------------------------------------------------------------------

/**
 * Subscribes to Supabase Realtime updates and invalidates React Query caches.
 *
 * This is the core realtime hook. It:
 * 1. Creates a Supabase Realtime channel
 * 2. Subscribes to postgres_changes events for specified tables
 * 3. Invalidates React Query caches when data changes
 * 4. Calls optional callbacks for custom handling
 * 5. Cleans up subscriptions on unmount
 *
 * @param options - Configuration for tables and callbacks
 *
 * @example
 * ```typescript
 * // Subscribe to specific tables
 * useRealtime({
 *   tables: ['executions', 'review_requests'],
 *   onExecutionChange: (payload) => {
 *     if (payload.eventType === 'UPDATE') {
 *       console.log('Execution updated:', payload.new);
 *     }
 *   }
 * });
 *
 * // Subscribe to all tables (default)
 * useRealtime();
 * ```
 */
export function useRealtime(options: RealtimeOptions = {}) {
  // Memoize Supabase client to prevent recreation on every render
  // This ensures we don't create multiple channels
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  const {
    tables = ['executions', 'review_requests', 'activity_logs', 'notifications', 'digital_workers'],
    onExecutionChange,
    onReviewRequestChange,
    onActivityLogChange,
    onNotificationChange,
    onWorkerChange,
  } = options

  /**
   * Handles incoming realtime changes by invalidating caches and calling callbacks.
   *
   * Maps table names to their corresponding React Query cache keys:
   * - executions -> ['executions']
   * - execution_steps -> ['execution-steps']
   * - review_requests -> ['review-requests']
   * - activity_logs -> ['activity-logs']
   * - notifications -> ['notifications']
   * - digital_workers -> ['digital-workers']
   */
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
    // Create a stable reference to tables for cleanup comparison
    const subscribedTables = [...tables]

    // Create a single channel for all subscriptions
    // Using a named channel allows Supabase to manage reconnections
    const channel = supabase.channel('control-room-realtime')

    // Subscribe to each requested table
    // Event '*' catches INSERT, UPDATE, and DELETE
    subscribedTables.forEach((table) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',           // Listen to all events
          schema: 'public',     // Default Supabase schema
          table,                // Table name
        },
        // Use current handleChange via closure, which is already memoized
        (payload) => handleChange(table, payload)
      )
    })

    // Start listening for changes
    channel.subscribe()

    // Cleanup: remove channel on unmount or when dependencies change
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, tables, handleChange])
}

// -----------------------------------------------------------------------------
// Pre-configured Hooks
// -----------------------------------------------------------------------------

/**
 * Pre-configured realtime hook for Control Room functionality.
 *
 * Subscribes to:
 * - executions - Track workflow progress
 * - execution_steps - Track step-by-step progress
 * - review_requests - Show pending approvals
 * - activity_logs - Live activity feed
 *
 * @param callbacks - Optional callbacks for change events
 *
 * @example
 * ```typescript
 * function ControlRoomPage() {
 *   useControlRoomRealtime({
 *     onReviewRequestChange: (payload) => {
 *       if (payload.eventType === 'INSERT') {
 *         showToast('New review request received!');
 *       }
 *     }
 *   });
 *
 *   // Component automatically gets updated data from useReviewRequests, etc.
 * }
 * ```
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
 * Pre-configured realtime hook for user notifications.
 *
 * Use this in components that display notification badges or lists.
 * Automatically invalidates the notifications cache when new notifications arrive.
 *
 * @param onNotification - Callback fired when notification changes
 *
 * @example
 * ```typescript
 * function NotificationBell() {
 *   useNotificationsRealtime((payload) => {
 *     if (payload.eventType === 'INSERT') {
 *       playNotificationSound();
 *     }
 *   });
 *
 *   const { data: notifications } = useNotifications();
 *   const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;
 *
 *   return <Bell count={unreadCount} />;
 * }
 * ```
 */
export function useNotificationsRealtime(onNotification?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void) {
  useRealtime({
    tables: ['notifications'],
    onNotificationChange: onNotification,
  })
}

/**
 * Pre-configured realtime hook for digital worker status changes.
 *
 * Use this to show live status indicators for workers (active, error, etc.).
 * Automatically invalidates the digital-workers cache when status changes.
 *
 * @param onWorkerChange - Callback fired when worker data changes
 *
 * @example
 * ```typescript
 * function WorkerStatusDashboard() {
 *   useWorkerStatusRealtime((payload) => {
 *     if (payload.new?.status === 'error') {
 *       showAlert(`Worker ${payload.new.name} has an error!`);
 *     }
 *   });
 *
 *   const { workers } = useTeam();
 *   // Render workers with live status...
 * }
 * ```
 */
export function useWorkerStatusRealtime(onWorkerChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void) {
  useRealtime({
    tables: ['digital_workers'],
    onWorkerChange,
  })
}

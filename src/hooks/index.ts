/**
 * @fileoverview Custom React hooks for data management and real-time functionality.
 *
 * This module exports all hooks used throughout the application. Hooks handle:
 * - Data fetching and caching via React Query
 * - Real-time subscriptions via Supabase Realtime
 * - Mutations with automatic cache invalidation
 *
 * @module hooks
 *
 * @example
 * ```typescript
 * import { useWorkflows, useTeam, useRealtime } from '@/hooks';
 *
 * function MyComponent() {
 *   const { workflows, addWorkflow, isLoading } = useWorkflows();
 *   const { workers, teams } = useTeam();
 *
 *   // Subscribe to real-time updates
 *   useRealtime({ tables: ['executions', 'review_requests'] });
 * }
 * ```
 */

// -----------------------------------------------------------------------------
// Data Hooks - CRUD operations for core entities
// -----------------------------------------------------------------------------

/** Workflow management - create, read, update, delete workflows */
export { useWorkflows } from './useWorkflows'

/** Team and digital worker management */
export { useTeam } from './useTeam'

/** Conversation session management for workflow creation chat */
export { useConversations } from './useConversations'

/** Workflow execution tracking and management */
export { useExecutions } from './useExecutions'

/** Human review request management for approval workflows */
export { useReviewRequests } from './useReviewRequests'

/** Activity log querying and creation for audit trail */
export { useActivityLogs } from './useActivityLogs'

// -----------------------------------------------------------------------------
// Organization Hook
// -----------------------------------------------------------------------------

/** Organization membership and settings management */
export { useOrganization } from './useOrganization'

// -----------------------------------------------------------------------------
// Workflow Extraction Hook
// -----------------------------------------------------------------------------

/**
 * AI-powered workflow extraction from conversation.
 * Debounces Gemini API calls and extracts workflow structure.
 */
export { useWorkflowExtraction } from './useWorkflowExtraction'

// -----------------------------------------------------------------------------
// Testing Hooks
// -----------------------------------------------------------------------------

/** Test case management for workflow testing */
export { useTestCases } from './useTestCases'

/** Test execution runner with polling support */
export { useTestRunner } from './useTestRunner'

// -----------------------------------------------------------------------------
// Analytics Hooks
// -----------------------------------------------------------------------------

/**
 * Worker analytics and performance metrics.
 * Includes trends, comparisons, and export functionality.
 */
export {
  useWorkerAnalytics,
  useWorkerDetail,
  useWorkerTrends,
  useAnalyticsExport,
} from './useWorkerAnalytics'

// -----------------------------------------------------------------------------
// Realtime Hooks - Supabase Realtime subscriptions
// -----------------------------------------------------------------------------

/**
 * Real-time data subscriptions for live updates.
 * Automatically invalidates React Query caches on changes.
 *
 * @see useControlRoomRealtime - Pre-configured for Control Room
 * @see useNotificationsRealtime - User notification updates
 * @see useWorkerStatusRealtime - Digital worker status changes
 */
export {
  useRealtime,
  useControlRoomRealtime,
  useNotificationsRealtime,
  useWorkerStatusRealtime,
} from './useRealtime'

/**
 * @fileoverview React hook for workflow CRUD operations with React Query caching.
 *
 * This hook provides complete workflow management functionality including:
 * - Fetching workflows filtered by user's organization
 * - Creating, updating, and deleting workflows
 * - Updating workflow steps and status
 * - Assigning workers to workflows
 *
 * All operations automatically invalidate relevant React Query caches.
 *
 * @module hooks/useWorkflows
 *
 * @example
 * ```typescript
 * function WorkflowList() {
 *   const { workflows, isLoading, addWorkflow, updateWorkflow } = useWorkflows();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <ul>
 *       {workflows.map(wf => (
 *         <li key={wf.id}>{wf.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */

'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Workflow, WorkflowStep } from '@/types'

// -----------------------------------------------------------------------------
// Database Types - Match Supabase schema
// -----------------------------------------------------------------------------

/**
 * Database representation of a workflow.
 * Uses snake_case to match PostgreSQL column naming conventions.
 * @internal
 */
interface DbWorkflow {
  id: string
  organization_id: string
  name: string
  description: string | null
  trigger_type: string | null
  trigger_config: Record<string, unknown> | null
  steps: DbWorkflowStep[] | null
  blueprint: Record<string, unknown> | null
  n8n_workflow_id: string | null
  is_active: boolean | null
  status: string | null
  assigned_worker_id: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Database representation of a workflow step.
 * Stored as JSONB array in the workflows table.
 * @internal
 */
interface DbWorkflowStep {
  id: string
  label: string
  type: string
  order_index: number
  assigned_to_type: string | null
  assigned_to_name: string | null
  requirements: Record<string, unknown> | null
}

// -----------------------------------------------------------------------------
// Transform Functions - DB <-> App conversions
// -----------------------------------------------------------------------------

/**
 * Transforms a database workflow record into the application Workflow type.
 *
 * Handles:
 * - snake_case to camelCase conversion
 * - null to undefined conversion for optional fields
 * - Date parsing from ISO strings
 * - Step array transformation
 *
 * @param db - Database workflow record from Supabase
 * @returns Transformed Workflow object for application use
 * @internal
 */
function toWorkflow(db: DbWorkflow): Workflow {
  return {
    id: db.id,
    name: db.name,
    description: db.description || undefined,
    steps: (db.steps || []).map((step, index) => ({
      id: step.id,
      label: step.label,
      type: step.type as WorkflowStep['type'],
      order: step.order_index ?? index,
      assignedTo: step.assigned_to_type ? {
        type: step.assigned_to_type as 'ai' | 'human',
        agentName: step.assigned_to_name || undefined,
      } : undefined,
      requirements: step.requirements as unknown as WorkflowStep['requirements'],
    })),
    status: (db.status || 'draft') as Workflow['status'],
    n8nWorkflowId: db.n8n_workflow_id || undefined,
    organizationId: db.organization_id,
    createdBy: db.created_by || undefined,
    createdAt: db.created_at ? new Date(db.created_at) : undefined,
    updatedAt: db.updated_at ? new Date(db.updated_at) : undefined,
    assignedTo: db.assigned_worker_id ? {
      stakeholderName: '', // Will be populated when joining with digital_workers
      stakeholderType: 'ai' as const,
    } : undefined,
  }
}

/**
 * Transforms an application Workflow into database format for insert/update.
 *
 * Handles:
 * - camelCase to snake_case conversion
 * - undefined to null conversion for optional fields
 * - Step array transformation to database format
 *
 * @param workflow - Application workflow object with organizationId required
 * @returns Partial database workflow record for Supabase operations
 * @internal
 */
function toDbWorkflow(workflow: Partial<Workflow> & { organizationId: string }): Partial<DbWorkflow> {
  const dbWorkflow: Partial<DbWorkflow> = {
    organization_id: workflow.organizationId,
    name: workflow.name,
    description: workflow.description || null,
    status: workflow.status || 'draft',
    n8n_workflow_id: workflow.n8nWorkflowId || null,
  }

  if (workflow.steps) {
    dbWorkflow.steps = workflow.steps.map((step, index) => ({
      id: step.id,
      label: step.label,
      type: step.type,
      order_index: step.order ?? index,
      assigned_to_type: step.assignedTo?.type || null,
      assigned_to_name: step.assignedTo?.agentName || null,
      requirements: (step.requirements as unknown as Record<string, unknown>) || null,
    }))
  }

  return dbWorkflow
}

// -----------------------------------------------------------------------------
// Main Hook
// -----------------------------------------------------------------------------

/**
 * React hook for workflow CRUD operations.
 *
 * Provides:
 * - `workflows`: Array of workflows for current organization
 * - `isLoading`: Loading state
 * - `error`: Error if query failed
 * - `refetch`: Manual refetch function
 * - `useWorkflow(id)`: Hook to fetch single workflow
 * - `addWorkflow`: Mutation to create workflow
 * - `updateWorkflow`: Mutation to update workflow
 * - `deleteWorkflow`: Mutation to delete workflow
 * - `assignWorker`: Mutation to assign worker
 * - `updateStatus`: Mutation to change status
 * - `updateSteps`: Mutation to update steps array
 *
 * @returns Object containing workflow data and mutations
 *
 * @example
 * ```typescript
 * const { workflows, addWorkflow, isLoading } = useWorkflows();
 *
 * // Create a new workflow
 * const handleCreate = async () => {
 *   await addWorkflow.mutateAsync({
 *     name: 'My Workflow',
 *     organizationId: 'org_123',
 *     steps: [],
 *     status: 'draft'
 *   });
 * };
 *
 * // Fetch a single workflow
 * const { data: workflow } = useWorkflows().useWorkflow('wf_123');
 * ```
 */
export function useWorkflows() {
  // Memoize Supabase client to prevent re-creation on each render
  // This is important because createClient() returns a new instance each time
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  // -------------------------------------------------------------------------
  // Organization Membership Query
  // -------------------------------------------------------------------------

  /**
   * Fetches the current user's organization membership.
   * Required for security: workflows are filtered by organization.
   */
  const {
    data: membership,
    isLoading: membershipLoading,
  } = useQuery({
    queryKey: ['organization-membership'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (error) {
        // PGRST116 = no rows returned, user might not be in an organization yet
        if (error.code === 'PGRST116') return null
        throw error
      }
      return data
    },
  })

  // -------------------------------------------------------------------------
  // Workflows List Query
  // -------------------------------------------------------------------------

  /**
   * Fetches all workflows for the current user's organization.
   * Security: Only returns workflows matching organization_id.
   */
  const {
    data: workflows = [],
    isLoading: workflowsLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['workflows', membership?.organization_id],
    queryFn: async () => {
      // Return empty array if user has no organization
      if (!membership?.organization_id) return []

      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('organization_id', membership.organization_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as DbWorkflow[]).map(toWorkflow)
    },
    enabled: !membershipLoading, // Wait for membership to load first
  })

  const isLoading = membershipLoading || workflowsLoading

  // -------------------------------------------------------------------------
  // Single Workflow Query Hook
  // -------------------------------------------------------------------------

  /**
   * Hook to fetch a single workflow by ID.
   *
   * @param workflowId - Workflow ID to fetch (undefined to skip)
   * @returns React Query result with workflow data
   *
   * @example
   * ```typescript
   * const { useWorkflow } = useWorkflows();
   * const { data: workflow, isLoading } = useWorkflow('wf_123');
   * ```
   */
  const useWorkflow = (workflowId: string | undefined) => {
    return useQuery({
      queryKey: ['workflows', workflowId],
      queryFn: async () => {
        if (!workflowId) return null
        const { data, error } = await supabase
          .from('workflows')
          .select('*')
          .eq('id', workflowId)
          .single()

        if (error) throw error
        return toWorkflow(data as DbWorkflow)
      },
      enabled: !!workflowId,
    })
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  /**
   * Creates a new workflow.
   * Automatically invalidates workflow list cache on success.
   */
  const addWorkflow = useMutation({
    mutationFn: async (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> & { organizationId: string }) => {
      const dbWorkflow = toDbWorkflow(workflow)
      const { data, error } = await supabase
        .from('workflows')
        .insert(dbWorkflow)
        .select()
        .single()

      if (error) throw error
      return toWorkflow(data as DbWorkflow)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })

  /**
   * Updates an existing workflow.
   * Invalidates both the workflow list and the specific workflow cache.
   */
  const updateWorkflow = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Workflow> & { id: string; organizationId: string }) => {
      const dbUpdates = toDbWorkflow(updates as Partial<Workflow> & { organizationId: string })
      const { data, error } = await supabase
        .from('workflows')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return toWorkflow(data as DbWorkflow)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['workflows', data.id] })
    },
  })

  /**
   * Deletes a workflow by ID.
   * Removes the workflow from cache completely.
   */
  const deleteWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflowId)

      if (error) throw error
      return workflowId
    },
    onSuccess: (workflowId) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.removeQueries({ queryKey: ['workflows', workflowId] })
    },
  })

  /**
   * Assigns or unassigns a worker to a workflow.
   *
   * @param workflowId - Target workflow ID
   * @param workerId - Worker ID to assign, or null to unassign
   */
  const assignWorker = useMutation({
    mutationFn: async ({ workflowId, workerId }: { workflowId: string; workerId: string | null }) => {
      const { data, error } = await supabase
        .from('workflows')
        .update({
          assigned_worker_id: workerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId)
        .select()
        .single()

      if (error) throw error
      return toWorkflow(data as DbWorkflow)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['workflows', data.id] })
    },
  })

  /**
   * Updates workflow status and syncs is_active flag.
   * Setting status to 'active' also sets is_active to true.
   */
  const updateStatus = useMutation({
    mutationFn: async ({ workflowId, status }: { workflowId: string; status: Workflow['status'] }) => {
      const { data, error } = await supabase
        .from('workflows')
        .update({
          status,
          is_active: status === 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId)
        .select()
        .single()

      if (error) throw error
      return toWorkflow(data as DbWorkflow)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['workflows', data.id] })
    },
  })

  /**
   * Updates the steps array of a workflow.
   * Used after Gemini extracts steps or user configures them.
   */
  const updateSteps = useMutation({
    mutationFn: async ({ workflowId, steps }: { workflowId: string; steps: WorkflowStep[] }) => {
      const { data, error } = await supabase
        .from('workflows')
        .update({
          steps: steps.map((step, index) => ({
            id: step.id,
            label: step.label,
            type: step.type,
            order_index: step.order ?? index,
            assigned_to_type: step.assignedTo?.type || null,
            assigned_to_name: step.assignedTo?.agentName || null,
            requirements: step.requirements || null,
          })),
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId)
        .select()
        .single()

      if (error) throw error
      return toWorkflow(data as DbWorkflow)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['workflows', data.id] })
    },
  })

  // -------------------------------------------------------------------------
  // Return Object
  // -------------------------------------------------------------------------

  return {
    /** Array of workflows for current organization */
    workflows,
    /** True while loading membership or workflows */
    isLoading,
    /** Error if query failed */
    error,
    /** Manual refetch function */
    refetch,
    /** Hook to fetch single workflow by ID */
    useWorkflow,
    /** Mutation to create new workflow */
    addWorkflow,
    /** Mutation to update existing workflow */
    updateWorkflow,
    /** Mutation to delete workflow */
    deleteWorkflow,
    /** Mutation to assign/unassign worker */
    assignWorker,
    /** Mutation to update workflow status */
    updateStatus,
    /** Mutation to update workflow steps */
    updateSteps,
  }
}

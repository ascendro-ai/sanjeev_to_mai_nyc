'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ActivityLog, ActivityLogType } from '@/types'

// Database types matching Supabase schema
interface DbActivityLog {
  id: string
  organization_id: string | null
  type: string
  worker_name: string | null
  workflow_id: string | null
  step_id: string | null
  data: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string | null
}

// Transform database activity log to app activity log
function toActivityLog(db: DbActivityLog): ActivityLog {
  return {
    id: db.id,
    organizationId: db.organization_id || undefined,
    type: db.type as ActivityLogType,
    workerName: db.worker_name || undefined,
    workflowId: db.workflow_id || undefined,
    stepId: db.step_id || undefined,
    data: db.data || undefined,
    metadata: db.metadata || undefined,
    createdAt: db.created_at ? new Date(db.created_at) : undefined,
  }
}

export function useActivityLogs() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch recent activity logs
  const {
    data: recentLogs = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['activity-logs', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return (data as DbActivityLog[]).map(toActivityLog)
    },
  })

  // Fetch activity logs with filters
  const useFilteredLogs = (filters?: {
    workflowId?: string
    workerName?: string
    type?: ActivityLogType
    limit?: number
  }) => {
    return useQuery({
      queryKey: ['activity-logs', filters],
      queryFn: async () => {
        let query = supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })

        if (filters?.workflowId) {
          query = query.eq('workflow_id', filters.workflowId)
        }
        if (filters?.workerName) {
          query = query.eq('worker_name', filters.workerName)
        }
        if (filters?.type) {
          query = query.eq('type', filters.type)
        }
        if (filters?.limit) {
          query = query.limit(filters.limit)
        }

        const { data, error } = await query

        if (error) throw error
        return (data as DbActivityLog[]).map(toActivityLog)
      },
    })
  }

  // Fetch logs for a specific workflow
  const useWorkflowLogs = (workflowId: string | undefined) => {
    return useQuery({
      queryKey: ['activity-logs', 'workflow', workflowId],
      queryFn: async () => {
        if (!workflowId) return []
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('workflow_id', workflowId)
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data as DbActivityLog[]).map(toActivityLog)
      },
      enabled: !!workflowId,
    })
  }

  // Fetch logs for a specific worker
  const useWorkerLogs = (workerName: string | undefined) => {
    return useQuery({
      queryKey: ['activity-logs', 'worker', workerName],
      queryFn: async () => {
        if (!workerName) return []
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('worker_name', workerName)
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data as DbActivityLog[]).map(toActivityLog)
      },
      enabled: !!workerName,
    })
  }

  // Create a new activity log
  const createLog = useMutation({
    mutationFn: async (log: {
      organizationId?: string
      type: ActivityLogType
      workerName?: string
      workflowId?: string
      stepId?: string
      data?: Record<string, unknown>
      metadata?: Record<string, unknown>
    }) => {
      const { data, error } = await supabase
        .from('activity_logs')
        .insert({
          organization_id: log.organizationId || null,
          type: log.type,
          worker_name: log.workerName || null,
          workflow_id: log.workflowId || null,
          step_id: log.stepId || null,
          data: log.data || {},
          metadata: log.metadata || {},
        })
        .select()
        .single()

      if (error) throw error
      return toActivityLog(data as DbActivityLog)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] })
    },
  })

  // Helper functions to create specific log types
  const logWorkerActivation = async (workerName: string, workflowId?: string, organizationId?: string) => {
    return createLog.mutateAsync({
      organizationId,
      type: 'digital_worker_activation',
      workerName,
      workflowId,
      data: { message: `${workerName} activated` },
    })
  }

  const logWorkflowStart = async (workflowId: string, workerName?: string, organizationId?: string) => {
    return createLog.mutateAsync({
      organizationId,
      type: 'workflow_execution_start',
      workerName,
      workflowId,
      data: { message: 'Workflow execution started' },
    })
  }

  const logStepExecution = async (
    workflowId: string,
    stepId: string,
    stepName: string,
    workerName?: string,
    organizationId?: string
  ) => {
    return createLog.mutateAsync({
      organizationId,
      type: 'workflow_step_execution',
      workerName,
      workflowId,
      stepId,
      data: { stepName, message: `Executing step: ${stepName}` },
    })
  }

  const logStepComplete = async (
    workflowId: string,
    stepId: string,
    stepName: string,
    workerName?: string,
    organizationId?: string
  ) => {
    return createLog.mutateAsync({
      organizationId,
      type: 'workflow_step_complete',
      workerName,
      workflowId,
      stepId,
      data: { stepName, message: `Step completed: ${stepName}` },
    })
  }

  const logWorkflowComplete = async (workflowId: string, workerName?: string, organizationId?: string) => {
    return createLog.mutateAsync({
      organizationId,
      type: 'workflow_complete',
      workerName,
      workflowId,
      data: { message: 'Workflow completed successfully' },
    })
  }

  const logError = async (
    message: string,
    workflowId?: string,
    stepId?: string,
    workerName?: string,
    organizationId?: string,
    metadata?: Record<string, unknown>
  ) => {
    return createLog.mutateAsync({
      organizationId,
      type: 'error',
      workerName,
      workflowId,
      stepId,
      data: { message },
      metadata,
    })
  }

  const logBlocker = async (
    message: string,
    workflowId?: string,
    stepId?: string,
    workerName?: string,
    organizationId?: string
  ) => {
    return createLog.mutateAsync({
      organizationId,
      type: 'blocker',
      workerName,
      workflowId,
      stepId,
      data: { message },
    })
  }

  return {
    recentLogs,
    isLoading,
    error,
    refetch,
    useFilteredLogs,
    useWorkflowLogs,
    useWorkerLogs,
    createLog,
    logWorkerActivation,
    logWorkflowStart,
    logStepExecution,
    logStepComplete,
    logWorkflowComplete,
    logError,
    logBlocker,
  }
}

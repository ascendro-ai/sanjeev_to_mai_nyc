'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Execution, ExecutionStep } from '@/types'

// Database types matching Supabase schema
interface DbExecution {
  id: string
  workflow_id: string
  worker_id: string | null
  n8n_execution_id: string | null
  status: string
  current_step_index: number | null
  trigger_type: string | null
  trigger_data: Record<string, unknown> | null
  input_data: Record<string, unknown> | null
  output_data: Record<string, unknown> | null
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
}

interface DbExecutionStep {
  id: string
  execution_id: string
  step_index: number
  step_name: string
  step_type: string
  status: string
  input_data: Record<string, unknown> | null
  output_data: Record<string, unknown> | null
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
}

// Transform database execution to app execution
function toExecution(db: DbExecution): Execution {
  return {
    id: db.id,
    workflowId: db.workflow_id,
    workerId: db.worker_id || undefined,
    n8nExecutionId: db.n8n_execution_id || undefined,
    status: db.status as Execution['status'],
    currentStepIndex: db.current_step_index ?? 0,
    triggerType: db.trigger_type || 'manual',
    triggerData: db.trigger_data || undefined,
    inputData: db.input_data || undefined,
    outputData: db.output_data || undefined,
    error: db.error || undefined,
    startedAt: db.started_at ? new Date(db.started_at) : undefined,
    completedAt: db.completed_at ? new Date(db.completed_at) : undefined,
    createdAt: db.created_at ? new Date(db.created_at) : undefined,
  }
}

// Transform database execution step to app execution step
function toExecutionStep(db: DbExecutionStep): ExecutionStep {
  return {
    id: db.id,
    executionId: db.execution_id,
    stepIndex: db.step_index,
    stepName: db.step_name,
    stepType: db.step_type,
    status: db.status as ExecutionStep['status'],
    inputData: db.input_data || undefined,
    outputData: db.output_data || undefined,
    error: db.error || undefined,
    startedAt: db.started_at ? new Date(db.started_at) : undefined,
    completedAt: db.completed_at ? new Date(db.completed_at) : undefined,
    createdAt: db.created_at ? new Date(db.created_at) : undefined,
  }
}

export function useExecutions() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch all executions (with optional filters)
  const useAllExecutions = (filters?: { workflowId?: string; workerId?: string; status?: string }) => {
    return useQuery({
      queryKey: ['executions', filters],
      queryFn: async () => {
        let query = supabase
          .from('executions')
          .select('*')
          .order('created_at', { ascending: false })

        if (filters?.workflowId) {
          query = query.eq('workflow_id', filters.workflowId)
        }
        if (filters?.workerId) {
          query = query.eq('worker_id', filters.workerId)
        }
        if (filters?.status) {
          query = query.eq('status', filters.status)
        }

        const { data, error } = await query

        if (error) throw error
        return (data as DbExecution[]).map(toExecution)
      },
    })
  }

  // Fetch a single execution by ID
  const useExecution = (executionId: string | undefined) => {
    return useQuery({
      queryKey: ['executions', executionId],
      queryFn: async () => {
        if (!executionId) return null
        const { data, error } = await supabase
          .from('executions')
          .select('*')
          .eq('id', executionId)
          .single()

        if (error) throw error
        return toExecution(data as DbExecution)
      },
      enabled: !!executionId,
    })
  }

  // Fetch execution steps for an execution
  const useExecutionSteps = (executionId: string | undefined) => {
    return useQuery({
      queryKey: ['execution-steps', executionId],
      queryFn: async () => {
        if (!executionId) return []
        const { data, error } = await supabase
          .from('execution_steps')
          .select('*')
          .eq('execution_id', executionId)
          .order('step_index', { ascending: true })

        if (error) throw error
        return (data as DbExecutionStep[]).map(toExecutionStep)
      },
      enabled: !!executionId,
    })
  }

  // Fetch running executions
  const useRunningExecutions = () => {
    return useQuery({
      queryKey: ['executions', 'running'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('executions')
          .select('*')
          .in('status', ['pending', 'running', 'waiting_review'])
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data as DbExecution[]).map(toExecution)
      },
      refetchInterval: 5000, // Poll every 5 seconds for running executions
    })
  }

  // Create a new execution
  const createExecution = useMutation({
    mutationFn: async (execution: {
      workflowId: string
      workerId?: string
      triggerType?: string
      triggerData?: Record<string, unknown>
      inputData?: Record<string, unknown>
    }) => {
      const { data, error } = await supabase
        .from('executions')
        .insert({
          workflow_id: execution.workflowId,
          worker_id: execution.workerId || null,
          status: 'pending',
          current_step_index: 0,
          trigger_type: execution.triggerType || 'manual',
          trigger_data: execution.triggerData || null,
          input_data: execution.inputData || null,
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return toExecution(data as DbExecution)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] })
    },
  })

  // Update execution status
  const updateStatus = useMutation({
    mutationFn: async ({
      executionId,
      status,
      error: errorMessage,
      outputData,
    }: {
      executionId: string
      status: Execution['status']
      error?: string
      outputData?: Record<string, unknown>
    }) => {
      const updates: Partial<DbExecution> = { status }

      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        updates.completed_at = new Date().toISOString()
      }
      if (errorMessage) {
        updates.error = errorMessage
      }
      if (outputData) {
        updates.output_data = outputData
      }

      const { data, error } = await supabase
        .from('executions')
        .update(updates)
        .eq('id', executionId)
        .select()
        .single()

      if (error) throw error
      return toExecution(data as DbExecution)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['executions'] })
      queryClient.invalidateQueries({ queryKey: ['executions', data.id] })
      queryClient.invalidateQueries({ queryKey: ['executions', 'running'] })
    },
  })

  // Update current step index
  const updateStepIndex = useMutation({
    mutationFn: async ({
      executionId,
      stepIndex
    }: {
      executionId: string
      stepIndex: number
    }) => {
      const { data, error } = await supabase
        .from('executions')
        .update({ current_step_index: stepIndex })
        .eq('id', executionId)
        .select()
        .single()

      if (error) throw error
      return toExecution(data as DbExecution)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['executions', data.id] })
    },
  })

  // Record an execution step
  const recordStep = useMutation({
    mutationFn: async (step: {
      executionId: string
      stepIndex: number
      stepName: string
      stepType: string
      status: ExecutionStep['status']
      inputData?: Record<string, unknown>
      outputData?: Record<string, unknown>
      error?: string
    }) => {
      const { data, error } = await supabase
        .from('execution_steps')
        .insert({
          execution_id: step.executionId,
          step_index: step.stepIndex,
          step_name: step.stepName,
          step_type: step.stepType,
          status: step.status,
          input_data: step.inputData || null,
          output_data: step.outputData || null,
          error: step.error || null,
          started_at: new Date().toISOString(),
          completed_at: step.status === 'completed' || step.status === 'failed'
            ? new Date().toISOString()
            : null,
        })
        .select()
        .single()

      if (error) throw error
      return toExecutionStep(data as DbExecutionStep)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['execution-steps', data.executionId] })
    },
  })

  // Cancel an execution
  const cancelExecution = useMutation({
    mutationFn: async (executionId: string) => {
      const { data, error } = await supabase
        .from('executions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId)
        .select()
        .single()

      if (error) throw error
      return toExecution(data as DbExecution)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['executions'] })
      queryClient.invalidateQueries({ queryKey: ['executions', data.id] })
      queryClient.invalidateQueries({ queryKey: ['executions', 'running'] })
    },
  })

  return {
    useAllExecutions,
    useExecution,
    useExecutionSteps,
    useRunningExecutions,
    createExecution,
    updateStatus,
    updateStepIndex,
    recordStep,
    cancelExecution,
  }
}

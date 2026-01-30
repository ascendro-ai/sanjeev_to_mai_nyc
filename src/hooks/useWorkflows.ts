'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Workflow, WorkflowStep } from '@/types'

// Database types matching Supabase schema
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

interface DbWorkflowStep {
  id: string
  label: string
  type: string
  order_index: number
  assigned_to_type: string | null
  assigned_to_name: string | null
  requirements: Record<string, unknown> | null
}

// Transform database workflow to app workflow
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

// Transform app workflow to database format for insert/update
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

export function useWorkflows() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch all workflows for the organization
  const {
    data: workflows = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as DbWorkflow[]).map(toWorkflow)
    },
  })

  // Fetch a single workflow by ID
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

  // Add a new workflow
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

  // Update an existing workflow
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

  // Delete a workflow
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

  // Assign a worker to a workflow
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

  // Update workflow status
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

  // Update workflow steps
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

  return {
    workflows,
    isLoading,
    error,
    refetch,
    useWorkflow,
    addWorkflow,
    updateWorkflow,
    deleteWorkflow,
    assignWorker,
    updateStatus,
    updateSteps,
  }
}

'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { DigitalWorker, NodeData, Team } from '@/types'

// Database types matching Supabase schema
interface DbDigitalWorker {
  id: string
  organization_id: string
  team_id: string | null
  manager_id: string | null
  name: string
  type: string | null
  avatar_url: string | null
  description: string | null
  personality: { tone?: string; verbosity?: string } | null
  status: string
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

interface DbTeam {
  id: string
  organization_id: string
  parent_team_id: string | null
  name: string
  description: string | null
  created_at: string | null
  updated_at: string | null
}

// Transform database worker to app worker
function toDigitalWorker(db: DbDigitalWorker): DigitalWorker {
  return {
    id: db.id,
    organizationId: db.organization_id,
    teamId: db.team_id || undefined,
    managerId: db.manager_id || undefined,
    name: db.name,
    type: (db.type || 'ai') as 'ai' | 'human',
    avatarUrl: db.avatar_url || undefined,
    description: db.description || undefined,
    personality: db.personality ? {
      tone: db.personality.tone || 'professional',
      verbosity: db.personality.verbosity || 'concise',
    } : undefined,
    status: db.status as DigitalWorker['status'],
    metadata: db.metadata || undefined,
    createdAt: db.created_at ? new Date(db.created_at) : undefined,
    updatedAt: db.updated_at ? new Date(db.updated_at) : undefined,
  }
}

// Transform database team to app team
function toTeam(db: DbTeam): Team {
  return {
    id: db.id,
    organizationId: db.organization_id,
    parentTeamId: db.parent_team_id || undefined,
    name: db.name,
    description: db.description || undefined,
    createdAt: db.created_at ? new Date(db.created_at) : undefined,
    updatedAt: db.updated_at ? new Date(db.updated_at) : undefined,
  }
}

// Convert workers to org chart NodeData format
function toOrgChartData(workers: DigitalWorker[], currentUserId?: string): NodeData {
  // Find the manager (current user's perspective) or create a root node
  const managerWorkers = workers.filter(w => !w.managerId)

  // Build the root - this would typically be the human manager
  const rootNode: NodeData = {
    name: 'You',
    type: 'human',
    role: 'Manager',
    status: 'active',
    assignedWorkflows: [],
    children: managerWorkers.map(worker => buildWorkerNode(worker, workers)),
  }

  return rootNode
}

function buildWorkerNode(worker: DigitalWorker, allWorkers: DigitalWorker[]): NodeData {
  const directReports = allWorkers.filter(w => w.managerId === worker.id)

  return {
    name: worker.name,
    type: worker.type,
    role: worker.description || worker.type === 'ai' ? 'AI Agent' : 'Team Member',
    status: worker.status as NodeData['status'],
    assignedWorkflows: worker.assignedWorkflows,
    children: directReports.length > 0
      ? directReports.map(dr => buildWorkerNode(dr, allWorkers))
      : undefined,
  }
}

export function useTeam() {
  // Memoize Supabase client to prevent re-creation on each render
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  // Fetch all digital workers
  const {
    data: workers = [],
    isLoading: workersLoading,
    error: workersError,
    refetch: refetchWorkers,
  } = useQuery({
    queryKey: ['digital-workers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('digital_workers')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data as DbDigitalWorker[]).map(toDigitalWorker)
    },
  })

  // Fetch all teams
  const {
    data: teams = [],
    isLoading: teamsLoading,
    error: teamsError,
  } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return (data as DbTeam[]).map(toTeam)
    },
  })

  // Fetch a single worker by ID
  const useWorker = (workerId: string | undefined) => {
    return useQuery({
      queryKey: ['digital-workers', workerId],
      queryFn: async () => {
        if (!workerId) return null
        const { data, error } = await supabase
          .from('digital_workers')
          .select('*')
          .eq('id', workerId)
          .single()

        if (error) throw error
        return toDigitalWorker(data as DbDigitalWorker)
      },
      enabled: !!workerId,
    })
  }

  // Add a new digital worker
  const addWorker = useMutation({
    mutationFn: async (worker: Omit<DigitalWorker, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data, error } = await supabase
        .from('digital_workers')
        .insert({
          organization_id: worker.organizationId,
          team_id: worker.teamId || null,
          manager_id: worker.managerId || null,
          name: worker.name,
          type: worker.type,
          avatar_url: worker.avatarUrl || null,
          description: worker.description || null,
          personality: worker.personality || { tone: 'professional', verbosity: 'concise' },
          status: worker.status || 'inactive',
          metadata: worker.metadata || {},
        })
        .select()
        .single()

      if (error) throw error
      return toDigitalWorker(data as DbDigitalWorker)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-workers'] })
    },
  })

  // Update a digital worker
  const updateWorker = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DigitalWorker> & { id: string }) => {
      const dbUpdates: Partial<DbDigitalWorker> = {
        updated_at: new Date().toISOString(),
      }

      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.type !== undefined) dbUpdates.type = updates.type
      if (updates.status !== undefined) dbUpdates.status = updates.status
      if (updates.description !== undefined) dbUpdates.description = updates.description
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl
      if (updates.teamId !== undefined) dbUpdates.team_id = updates.teamId || null
      if (updates.managerId !== undefined) dbUpdates.manager_id = updates.managerId || null
      if (updates.personality !== undefined) dbUpdates.personality = updates.personality
      if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata

      const { data, error } = await supabase
        .from('digital_workers')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return toDigitalWorker(data as DbDigitalWorker)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['digital-workers'] })
      queryClient.invalidateQueries({ queryKey: ['digital-workers', data.id] })
    },
  })

  // Delete a digital worker
  const deleteWorker = useMutation({
    mutationFn: async (workerId: string) => {
      const { error } = await supabase
        .from('digital_workers')
        .delete()
        .eq('id', workerId)

      if (error) throw error
      return workerId
    },
    onSuccess: (workerId) => {
      queryClient.invalidateQueries({ queryKey: ['digital-workers'] })
      queryClient.removeQueries({ queryKey: ['digital-workers', workerId] })
    },
  })

  // Activate a worker
  const activateWorker = useMutation({
    mutationFn: async (workerId: string) => {
      const { data, error } = await supabase
        .from('digital_workers')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', workerId)
        .select()
        .single()

      if (error) throw error
      return toDigitalWorker(data as DbDigitalWorker)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['digital-workers'] })
      queryClient.invalidateQueries({ queryKey: ['digital-workers', data.id] })
    },
  })

  // Deactivate a worker
  const deactivateWorker = useMutation({
    mutationFn: async (workerId: string) => {
      const { data, error } = await supabase
        .from('digital_workers')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString(),
        })
        .eq('id', workerId)
        .select()
        .single()

      if (error) throw error
      return toDigitalWorker(data as DbDigitalWorker)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['digital-workers'] })
      queryClient.invalidateQueries({ queryKey: ['digital-workers', data.id] })
    },
  })

  // Add a team
  const addTeam = useMutation({
    mutationFn: async (team: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          organization_id: team.organizationId,
          parent_team_id: team.parentTeamId || null,
          name: team.name,
          description: team.description || null,
        })
        .select()
        .single()

      if (error) throw error
      return toTeam(data as DbTeam)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })

  // Memoize org chart data to prevent unnecessary recalculations
  const orgChartData = useMemo(() => toOrgChartData(workers), [workers])

  return {
    workers,
    teams,
    orgChartData,
    isLoading: workersLoading || teamsLoading,
    workersLoading,
    teamsLoading,
    error: workersError || teamsError,
    refetch: refetchWorkers,
    useWorker,
    addWorker,
    updateWorker,
    deleteWorker,
    activateWorker,
    deactivateWorker,
    addTeam,
  }
}

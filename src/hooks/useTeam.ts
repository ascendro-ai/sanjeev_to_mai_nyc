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
  role: string | null // T6 fix: Add role column
  avatar_url: string | null
  description: string | null
  personality: { tone?: string; verbosity?: string } | null
  status: string
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
  // T5 fix: Team relationship data from join
  teams?: {
    id: string
    name: string
    description: string | null
    parent_team_id: string | null
  } | null
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
    // T6 fix: Use persisted role, fall back to description, then default based on type
    role: db.role || db.description || (db.type === 'ai' ? 'AI Agent' : 'Team Member'),
    avatarUrl: db.avatar_url || undefined,
    description: db.description || undefined,
    personality: db.personality ? {
      tone: db.personality.tone || 'professional',
      verbosity: db.personality.verbosity || 'concise',
    } : undefined,
    status: db.status as DigitalWorker['status'],
    metadata: {
      // Issue 10 fix: Include error_message in metadata if present
      ...(db.metadata || {}),
      ...(db.error_message ? { errorMessage: db.error_message } : {}),
      // T5 fix: Include team info in metadata if present
      ...(db.teams ? {
        teamName: db.teams.name,
        teamDescription: db.teams.description,
        parentTeamId: db.teams.parent_team_id,
      } : {}),
    },
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
    // T6 fix: Use persisted role from worker
    role: worker.role,
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

  // T2 fix: Fetch worker workflow assignments
  const {
    data: workflowAssignments = [],
  } = useQuery({
    queryKey: ['worker-workflow-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_workflow_assignments')
        .select('worker_id, workflow_id')
        .eq('is_active', true)

      if (error) {
        console.error('Failed to fetch workflow assignments:', error)
        return []
      }
      return data || []
    },
  })

  // Fetch all digital workers with team relationship (T5 fix)
  const {
    data: workers = [],
    isLoading: workersLoading,
    error: workersError,
    refetch: refetchWorkers,
  } = useQuery({
    queryKey: ['digital-workers'],
    queryFn: async () => {
      // T5 fix: Join with teams table to get team info
      const { data, error } = await supabase
        .from('digital_workers')
        .select(`
          *,
          teams (
            id,
            name,
            description,
            parent_team_id
          )
        `)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data as DbDigitalWorker[]).map(toDigitalWorker)
    },
  })

  // T2 fix: Merge workflow assignments into workers
  const workersWithAssignments = useMemo(() => {
    const assignmentsByWorker = workflowAssignments.reduce((acc, assignment) => {
      if (!acc[assignment.worker_id]) {
        acc[assignment.worker_id] = []
      }
      acc[assignment.worker_id].push(assignment.workflow_id)
      return acc
    }, {} as Record<string, string[]>)

    return workers.map(worker => ({
      ...worker,
      assignedWorkflows: assignmentsByWorker[worker.id] || [],
    }))
  }, [workers, workflowAssignments])

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
      if (updates.role !== undefined) dbUpdates.role = updates.role // T6 fix: Support role updates
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
        .select(`
          *,
          teams (
            id,
            name,
            description,
            parent_team_id
          )
        `)
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

  // T5 fix: Assign worker to team
  const assignWorkerToTeam = useMutation({
    mutationFn: async ({ workerId, teamId }: { workerId: string; teamId: string | null }) => {
      const { data, error } = await supabase
        .from('digital_workers')
        .update({
          team_id: teamId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workerId)
        .select(`
          *,
          teams (
            id,
            name,
            description,
            parent_team_id
          )
        `)
        .single()

      if (error) throw error
      return toDigitalWorker(data as DbDigitalWorker)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['digital-workers'] })
      queryClient.invalidateQueries({ queryKey: ['digital-workers', data.id] })
    },
  })

  // T5 fix: Group workers by team
  const workersByTeam = useMemo(() => {
    const grouped: Record<string, DigitalWorker[]> = {
      unassigned: [], // Workers with no team
    }

    // Initialize groups for each team
    teams.forEach(team => {
      grouped[team.id] = []
    })

    // Assign workers to their teams
    workersWithAssignments.forEach(worker => {
      if (worker.teamId && grouped[worker.teamId]) {
        grouped[worker.teamId].push(worker)
      } else {
        grouped.unassigned.push(worker)
      }
    })

    return grouped
  }, [workersWithAssignments, teams])

  // T5 fix: Get team hierarchy (teams with their parent relationships)
  const teamHierarchy = useMemo(() => {
    const rootTeams = teams.filter(t => !t.parentTeamId)

    function buildTeamTree(team: Team): Team & { children: Team[] } {
      const children = teams.filter(t => t.parentTeamId === team.id)
      return {
        ...team,
        children: children.map(child => buildTeamTree(child)),
      }
    }

    return rootTeams.map(team => buildTeamTree(team))
  }, [teams])

  // T2/T3 fix: Memoize org chart data with assignments
  const orgChartData = useMemo(() => toOrgChartData(workersWithAssignments), [workersWithAssignments])

  return {
    workers: workersWithAssignments, // T2 fix: Return workers with assignments
    teams,
    teamHierarchy, // T5 fix: Teams with hierarchy structure
    workersByTeam, // T5 fix: Workers grouped by team
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
    assignWorkerToTeam, // T5 fix: Mutation to assign worker to team
  }
}

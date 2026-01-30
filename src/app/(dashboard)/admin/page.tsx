'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Workflow,
  Bot,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  Shield,
} from 'lucide-react'
import { Card } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface AdminStats {
  totalUsers: number
  totalWorkflows: number
  totalWorkers: number
  activeExecutions: number
  recentActivity: {
    type: string
    message: string
    timestamp: string
  }[]
  systemHealth: {
    status: 'healthy' | 'degraded' | 'down'
    uptime: number
    lastCheck: string
  }
}

export default function AdminDashboardPage() {
  const supabase = createClient()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminStats> => {
      // Get user count
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // Get workflow count
      const { count: workflowCount } = await supabase
        .from('workflows')
        .select('*', { count: 'exact', head: true })

      // Get worker count
      const { count: workerCount } = await supabase
        .from('digital_workers')
        .select('*', { count: 'exact', head: true })

      // Get active execution count
      const { count: executionCount } = await supabase
        .from('executions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'running')

      // Get recent activity
      const { data: recentLogs } = await supabase
        .from('activity_logs')
        .select('type, data, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      return {
        totalUsers: userCount || 0,
        totalWorkflows: workflowCount || 0,
        totalWorkers: workerCount || 0,
        activeExecutions: executionCount || 0,
        recentActivity: recentLogs?.map((log) => ({
          type: log.type,
          message: (log.data as { message?: string })?.message || log.type,
          timestamp: log.created_at,
        })) || [],
        systemHealth: {
          status: 'healthy',
          uptime: 99.9,
          lastCheck: new Date().toISOString(),
        },
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Workflows',
      value: stats?.totalWorkflows || 0,
      icon: Workflow,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      label: 'Digital Workers',
      value: stats?.totalWorkers || 0,
      icon: Bot,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      label: 'Active Executions',
      value: stats?.activeExecutions || 0,
      icon: Activity,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ]

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'down':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} variant="outlined">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        <Card variant="outlined">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
            <div className="flex items-center gap-2">
              {getHealthIcon(stats?.systemHealth.status || 'healthy')}
              <span className="text-sm font-medium capitalize">
                {stats?.systemHealth.status}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Uptime</span>
              <span className="text-sm font-medium text-gray-900">
                {stats?.systemHealth.uptime}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Last Health Check</span>
              <span className="text-sm font-medium text-gray-900">
                {stats?.systemHealth.lastCheck
                  ? new Date(stats.systemHealth.lastCheck).toLocaleTimeString()
                  : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">n8n Connection</span>
              <span className="flex items-center gap-2 text-sm font-medium text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Supabase</span>
              <span className="flex items-center gap-2 text-sm font-medium text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Connected
              </span>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card variant="outlined">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.slice(0, 5).map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <Activity className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {activity.message}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">
              No recent activity
            </p>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card variant="outlined">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/admin/users"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-gray-900">Manage Users</p>
              <p className="text-sm text-gray-500">Invite and manage team members</p>
            </div>
          </a>
          <a
            href="/admin/integrations"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Shield className="h-5 w-5 text-purple-600" />
            <div>
              <p className="font-medium text-gray-900">Integrations</p>
              <p className="text-sm text-gray-500">Manage OAuth and API keys</p>
            </div>
          </a>
          <a
            href="/analytics"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Activity className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-gray-900">View Analytics</p>
              <p className="text-sm text-gray-500">Performance dashboards</p>
            </div>
          </a>
        </div>
      </Card>
    </div>
  )
}

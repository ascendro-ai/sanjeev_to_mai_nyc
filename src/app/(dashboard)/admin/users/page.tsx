'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserPlus,
  Mail,
  Shield,
  MoreVertical,
  Trash2,
  Check,
  X,
  Search,
} from 'lucide-react'
import { Button, Card, Modal, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type UserRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'

interface OrganizationUser {
  id: string
  user_id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  last_sign_in: string | null
  status: 'active' | 'invited' | 'disabled'
}

interface PendingInvite {
  id: string
  email: string
  role: UserRole
  created_at: string
  expires_at: string
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full access to admin console' },
  { value: 'manager', label: 'Manager', description: 'Can manage workers and workflows' },
  { value: 'member', label: 'Member', description: 'Can create and execute workflows' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
]

const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  manager: 'bg-green-100 text-green-700',
  member: 'bg-gray-100 text-gray-700',
  viewer: 'bg-yellow-100 text-yellow-700',
}

export default function UserManagementPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('member')
  const [selectedUser, setSelectedUser] = useState<OrganizationUser | null>(null)
  const [selectedUserMenu, setSelectedUserMenu] = useState<string | null>(null)

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role,
          created_at,
          users:user_id (
            email,
            raw_user_meta_data->full_name,
            last_sign_in_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []).map((member): OrganizationUser => ({
        id: member.id,
        user_id: member.user_id,
        email: (member.users as { email?: string })?.email || 'Unknown',
        full_name: (member.users as { 'raw_user_meta_data->full_name'?: string })?.['raw_user_meta_data->full_name'] || null,
        role: member.role as UserRole,
        created_at: member.created_at,
        last_sign_in: (member.users as { last_sign_in_at?: string })?.last_sign_in_at || null,
        status: 'active',
      }))
    },
  })

  // Fetch pending invites
  const { data: pendingInvites } = useQuery({
    queryKey: ['admin-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as PendingInvite[]
    },
  })

  // Invite user mutation
  const inviteUser = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: UserRole }) => {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send invite')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invites'] })
      setIsInviteModalOpen(false)
      setInviteEmail('')
      setInviteRole('member')
    },
  })

  // Update role mutation
  const updateRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: UserRole }) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('id', memberId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setSelectedUser(null)
    },
  })

  // Remove user mutation
  const removeUser = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setSelectedUserMenu(null)
    },
  })

  // Cancel invite mutation
  const cancelInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('organization_invites')
        .delete()
        .eq('id', inviteId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invites'] })
    },
  })

  const filteredUsers = users?.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">
            Manage team members and their access levels
          </p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users..."
          className="pl-10"
        />
      </div>

      {/* Pending Invites */}
      {pendingInvites && pendingInvites.length > 0 && (
        <Card variant="outlined">
          <h2 className="font-medium text-gray-900 mb-4">
            Pending Invites ({pendingInvites.length})
          </h2>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100"
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {invite.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      Invited as {invite.role} •{' '}
                      {new Date(invite.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelInvite.mutate(invite.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Users List */}
      <Card variant="outlined">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  User
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Role
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Last Active
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Joined
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers?.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.full_name || user.email.split('@')[0]}
                      </p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full capitalize',
                        ROLE_COLORS[user.role]
                      )}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {user.last_sign_in
                      ? new Date(user.last_sign_in).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() =>
                          setSelectedUserMenu(
                            selectedUserMenu === user.id ? null : user.id
                          )
                        }
                        className="p-1 hover:bg-gray-100 rounded"
                        disabled={user.role === 'owner'}
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>
                      {selectedUserMenu === user.id && user.role !== 'owner' && (
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setSelectedUserMenu(null)
                            }}
                            className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Shield className="h-4 w-4" />
                            Change Role
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Remove this user from the organization?')) {
                                removeUser.mutate(user.id)
                              }
                            }}
                            className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove User
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite User"
      >
        <div className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="user@company.com"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setInviteRole(option.value)}
                  className={cn(
                    'w-full p-3 rounded-lg border-2 text-left transition-colors',
                    inviteRole === option.value
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {option.label}
                    </span>
                    {inviteRole === option.value && (
                      <Check className="h-4 w-4 text-gray-900" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setIsInviteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                inviteUser.mutate({ email: inviteEmail, role: inviteRole })
              }
              isLoading={inviteUser.isPending}
              disabled={!inviteEmail.includes('@')}
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Invite
            </Button>
          </div>
        </div>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={`Change Role for ${selectedUser?.email}`}
      >
        {selectedUser && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Current role:{' '}
              <span className="font-medium capitalize">{selectedUser.role}</span>
            </p>

            <div className="space-y-2">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    updateRole.mutate({
                      memberId: selectedUser.id,
                      role: option.value,
                    })
                  }
                  disabled={updateRole.isPending}
                  className={cn(
                    'w-full p-3 rounded-lg border-2 text-left transition-colors',
                    selectedUser.role === option.value
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {option.label}
                    </span>
                    {selectedUser.role === option.value && (
                      <Check className="h-4 w-4 text-gray-900" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

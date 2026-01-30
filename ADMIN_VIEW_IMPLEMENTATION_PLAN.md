# Implementation Plan: Admin vs Consumer Views with Role-Based Access

## Overview

Build an IT administrator view distinct from the consumer view, controlled by user permissions (admin vs. not). Only users with `owner` or `admin` roles can access the admin console.

---

## Current State Analysis

| Component | Status | Location |
|-----------|--------|----------|
| Auth system (Supabase) | Working | `src/providers/AuthProvider.tsx` |
| Role types defined | Exists | `src/types/index.ts:149-155` |
| organization_members table | Exists | Database (with role CHECK constraint) |
| Role in auth context | Missing | Need to add |
| Role-based middleware | Not implemented | `src/lib/supabase/middleware.ts` |
| Admin UI pages | Don't exist | Need to create |
| Admin route in sidebar | Missing | `src/components/Sidebar.tsx` |

---

## Role Hierarchy (from PRD)

```
owner > admin > manager > member > viewer
```

| Role | Admin Console | Manage Users | Create Workflows | View Control Room |
|------|---------------|--------------|------------------|-------------------|
| **owner** | Yes | Yes | Yes | Yes |
| **admin** | Yes | Yes | Yes | Yes |
| **manager** | No | No | Yes | Yes |
| **member** | No | No | Yes | Yes |
| **viewer** | No | No | No | Yes |

---

## Implementation Steps

### Step 1: Database Migration (SKIP - Already Exists)

The `organization_members` table already exists with the correct schema including the role column with CHECK constraint for the 5 roles.

---

### Step 2: Update Types

**File**: `src/types/index.ts`

Add the following after the ORGANIZATION & TEAM TYPES section header:

```typescript
// Role type (reusable)
export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'

// Admin roles helper
export const ADMIN_ROLES: OrganizationRole[] = ['owner', 'admin']

// Permission helpers
export const PERMISSIONS = {
  accessAdminConsole: ['owner', 'admin'],
  manageUsers: ['owner', 'admin'],
  manageOrganization: ['owner', 'admin'],
  manageBilling: ['owner'],
  createWorkflows: ['owner', 'admin', 'manager', 'member'],
  viewControlRoom: ['owner', 'admin', 'manager', 'member', 'viewer'],
  approveReviews: ['owner', 'admin', 'manager', 'member'],
} as const

// Helper function
export function hasPermission(
  role: OrganizationRole | null,
  permission: keyof typeof PERMISSIONS
): boolean {
  if (!role) return false
  return (PERMISSIONS[permission] as readonly string[]).includes(role)
}
```

Update `OrganizationMember` interface to use the new type:

```typescript
export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: OrganizationRole  // Changed from string union to type
  invitedBy?: string
  invitedAt?: Date
  joinedAt?: Date
  createdAt?: Date
  updatedAt?: Date
}
```

---

### Step 3: Create useUserRole Hook

**File to create**: `src/hooks/useUserRole.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import { OrganizationRole, ADMIN_ROLES, hasPermission, PERMISSIONS } from '@/types'

export function useUserRole() {
  const { user } = useAuth()
  const supabase = createClient()

  const { data: memberData, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null

      const { data, error } = await supabase
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', user.id)
        .single()

      if (error) return null
      return data
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const role = memberData?.role as OrganizationRole | null
  const organizationId = memberData?.organization_id

  return {
    role,
    organizationId,
    isLoading,
    isAdmin: role ? ADMIN_ROLES.includes(role) : false,
    isOwner: role === 'owner',
    can: (permission: keyof typeof PERMISSIONS) => hasPermission(role, permission),
  }
}
```

---

### Step 4: Create Admin Route Guard Component

**File to create**: `src/components/AdminGuard.tsx`

```typescript
'use client'

import { useUserRole } from '@/hooks/useUserRole'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AdminGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { isAdmin, isLoading } = useUserRole()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/unauthorized')
    }
  }, [isAdmin, isLoading, router])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!isAdmin) {
    return fallback || null
  }

  return <>{children}</>
}
```

---

### Step 5: Update Middleware for Admin Routes

**File**: `src/lib/supabase/middleware.ts`

Replace the entire file with:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key-for-build'

const ADMIN_ROUTES = ['/admin']
const PUBLIC_ROUTES = ['/login', '/signup', '/auth', '/']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Check if admin route
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route))

  if (isAdminRoute && user) {
    // Fetch user's role
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = member?.role === 'owner' || member?.role === 'admin'

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  // Redirect unauthenticated users to login for protected routes
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

---

### Step 6: Update Sidebar with Conditional Admin Link

**File**: `src/components/Sidebar.tsx`

Add import at top:
```typescript
import { useUserRole } from '@/hooks/useUserRole'
import { Settings } from 'lucide-react'
```

Inside the component, add:
```typescript
const { isAdmin } = useUserRole()
```

Update navItems to be dynamic:
```typescript
const baseNavItems: NavItem[] = [
  { href: '/create', label: 'Create a Task', icon: FileText },
  { href: '/workflows', label: 'Your Workflows', icon: Workflow },
  { href: '/team', label: 'Your Team', icon: Users },
  { href: '/control-room', label: 'Control Room', icon: Monitor },
]

// Add admin link only for admin/owner
const navItems = isAdmin
  ? [...baseNavItems, { href: '/admin', label: 'Admin Console', icon: Settings }]
  : baseNavItems
```

---

### Step 7: Create Admin Layout

**File to create**: `src/app/(dashboard)/admin/layout.tsx`

```typescript
import { AdminGuard } from '@/components/AdminGuard'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <div className="flex-1">
        <div className="border-b px-6 py-4">
          <h1 className="text-2xl font-semibold">Admin Console</h1>
          <p className="text-sm text-gray-500">Manage your organization</p>
        </div>
        {children}
      </div>
    </AdminGuard>
  )
}
```

---

### Step 8: Create Admin Dashboard Page

**File to create**: `src/app/(dashboard)/admin/page.tsx`

```typescript
'use client'

import { Card } from '@/components/ui/Card'
import { Users, Key, Activity, Settings } from 'lucide-react'
import Link from 'next/link'

const adminSections = [
  {
    title: 'User Management',
    description: 'Invite, manage roles, and remove users',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Integrations',
    description: 'Manage connected services and credentials',
    href: '/admin/integrations',
    icon: Key,
  },
  {
    title: 'Usage & Analytics',
    description: 'View organization usage statistics',
    href: '/admin/usage',
    icon: Activity,
  },
  {
    title: 'Organization Settings',
    description: 'Configure organization preferences',
    href: '/admin/settings',
    icon: Settings,
  },
]

export default function AdminPage() {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adminSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <section.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{section.title}</h3>
                  <p className="text-sm text-gray-500">{section.description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

---

### Step 9: Create User Management Page

**File to create**: `src/app/(dashboard)/admin/users/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { OrganizationRole } from '@/types'
import { useUserRole } from '@/hooks/useUserRole'

export default function UsersPage() {
  const { organizationId } = useUserRole()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')

  // Fetch organization members
  const { data: members, isLoading } = useQuery({
    queryKey: ['org-members', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          role,
          joined_at,
          user:user_id (
            id,
            email,
            raw_user_meta_data
          )
        `)
        .eq('organization_id', organizationId)
        .order('joined_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!organizationId,
  })

  // Update role mutation
  const updateRole = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: OrganizationRole }) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    },
  })

  // Remove member mutation
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    },
  })

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      {/* Invite Section */}
      <Card className="p-4">
        <h2 className="font-semibold mb-4">Invite New User</h2>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-md"
          />
          <Button>Send Invite</Button>
        </div>
      </Card>

      {/* Members List */}
      <Card className="p-4">
        <h2 className="font-semibold mb-4">Organization Members</h2>
        <div className="space-y-2">
          {members?.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="font-medium">{member.user?.email}</p>
                <p className="text-sm text-gray-500">
                  Joined {new Date(member.joined_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={member.role}
                  onChange={(e) => updateRole.mutate({
                    memberId: member.id,
                    newRole: e.target.value as OrganizationRole
                  })}
                  className="px-2 py-1 border rounded-md text-sm"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember.mutate(member.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
```

---

### Step 10: Create Placeholder Admin Subpages

**File to create**: `src/app/(dashboard)/admin/integrations/page.tsx`

```typescript
export default function IntegrationsPage() {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Integrations Management</h2>
      <p className="text-gray-500">Manage connected services and OAuth credentials.</p>
      {/* Integration management UI to be implemented */}
    </div>
  )
}
```

**File to create**: `src/app/(dashboard)/admin/usage/page.tsx`

```typescript
export default function UsagePage() {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Usage & Analytics</h2>
      <p className="text-gray-500">View organization usage statistics and analytics.</p>
      {/* Usage analytics UI to be implemented */}
    </div>
  )
}
```

**File to create**: `src/app/(dashboard)/admin/settings/page.tsx`

```typescript
export default function SettingsPage() {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Organization Settings</h2>
      <p className="text-gray-500">Configure organization preferences.</p>
      {/* Settings UI to be implemented */}
    </div>
  )
}
```

---

### Step 11: Create Unauthorized Page

**File to create**: `src/app/unauthorized/page.tsx`

```typescript
import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <ShieldX className="h-16 w-16 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
      <p className="text-gray-600 mb-6 text-center">
        You don't have permission to access this page.
        <br />
        Contact your organization admin for access.
      </p>
      <Link href="/create">
        <Button>Return to Dashboard</Button>
      </Link>
    </div>
  )
}
```

---

## Files Summary

| Action | File Path |
|--------|-----------|
| MODIFY | `src/types/index.ts` |
| CREATE | `src/hooks/useUserRole.ts` |
| CREATE | `src/components/AdminGuard.tsx` |
| MODIFY | `src/lib/supabase/middleware.ts` |
| MODIFY | `src/components/Sidebar.tsx` |
| CREATE | `src/app/(dashboard)/admin/layout.tsx` |
| CREATE | `src/app/(dashboard)/admin/page.tsx` |
| CREATE | `src/app/(dashboard)/admin/users/page.tsx` |
| CREATE | `src/app/(dashboard)/admin/integrations/page.tsx` |
| CREATE | `src/app/(dashboard)/admin/usage/page.tsx` |
| CREATE | `src/app/(dashboard)/admin/settings/page.tsx` |
| CREATE | `src/app/unauthorized/page.tsx` |

---

## Architecture Diagram

```
                           REQUEST FLOW

User Request
     |
     v
+-------------------------------------------------------------------------+
|  MIDDLEWARE (src/lib/supabase/middleware.ts)                            |
|  |-- Check: Is user authenticated?                                      |
|  |   +-- No -> Redirect to /login                                       |
|  +-- Check: Is route /admin/*?                                          |
|      +-- Yes -> Fetch role from organization_members                    |
|          +-- role not in ['owner', 'admin'] -> Redirect to /unauthorized|
+-------------------------------------------------------------------------+
     |
     v
+-------------------------------------------------------------------------+
|  AUTH PROVIDER + useUserRole HOOK                                       |
|  |-- user, session from Supabase Auth                                   |
|  +-- role, isAdmin, can() from organization_members table               |
+-------------------------------------------------------------------------+
     |
     |-----------------------------+--------------------------------------+
     v                             v                                      |
+----------------------+   +----------------------+                       |
|   CONSUMER VIEW      |   |    ADMIN VIEW        |                       |
|   (All Roles)        |   |    (owner/admin)     |                       |
+----------------------+   +----------------------+                       |
| /create              |   | /admin               |                       |
| /workflows           |   | /admin/users         |                       |
| /team                |   | /admin/integrations  |                       |
| /control-room        |   | /admin/usage         |                       |
|                      |   | /admin/settings      |                       |
+----------------------+   +----------------------+                       |
                                                                          |
+-------------------------------------------------------------------------+
|  SIDEBAR (src/components/Sidebar.tsx)
|  +-- Conditionally shows "Admin Console" link based on isAdmin
+-------------------------------------------------------------------------+
```

---

## Verification Checklist

After implementation:

- [ ] Run TypeScript check: `pnpm tsc --noEmit`
- [ ] Run tests: `pnpm test`
- [ ] Seed test data: Create user with 'admin' role in organization_members
- [ ] Test consumer view: Login as 'member' role - Should NOT see Admin Console link
- [ ] Test admin view: Login as 'admin' role - Should see Admin Console link
- [ ] Test route protection: As 'member', navigate to /admin - Should redirect to /unauthorized
- [ ] Test user management: As 'admin', invite user, change role, remove user
- [ ] Verify RLS: Member cannot update their own role to 'admin'

---

## Future Enhancements (Post-MVP)

- [ ] Audit logs for admin actions
- [ ] Email invitations with Supabase Edge Functions
- [ ] SSO/SAML configuration
- [ ] API key management
- [ ] Data retention policies
- [ ] Organization branding settings

---

*Generated by Claude Code - January 30, 2026*

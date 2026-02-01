'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface OrganizationMembership {
  organization_id: string
  role: string
}

interface Organization {
  id: string
  name: string
  slug: string
}

export function useOrganization() {
  // Memoize Supabase client to prevent re-creation on each render
  const supabase = useMemo(() => createClient(), [])

  // Fetch current user's organization membership
  const {
    data: membership,
    isLoading: membershipLoading,
    error: membershipError,
  } = useQuery({
    queryKey: ['organization-membership'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .single()

      if (error) {
        // User might not be in an organization yet
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }
      return data as OrganizationMembership
    },
  })

  // Fetch organization details if we have membership
  const {
    data: organization,
    isLoading: organizationLoading,
    error: organizationError,
  } = useQuery({
    queryKey: ['organization', membership?.organization_id],
    queryFn: async () => {
      if (!membership?.organization_id) return null

      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('id', membership.organization_id)
        .single()

      if (error) throw error
      return data as Organization
    },
    enabled: !!membership?.organization_id,
  })

  return {
    organizationId: membership?.organization_id || null,
    role: membership?.role || null,
    organization,
    isLoading: membershipLoading || organizationLoading,
    error: membershipError || organizationError,
    // Helper to check if user has organization
    hasOrganization: !!membership?.organization_id,
  }
}

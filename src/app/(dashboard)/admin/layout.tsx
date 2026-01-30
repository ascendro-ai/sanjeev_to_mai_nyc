'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Users, Plug, Settings, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'

const adminNavItems = [
  { href: '/admin', label: 'Overview', icon: Shield, exact: true },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/admin/integrations', label: 'Integrations', icon: Plug },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading } = useAuth()

  // Check admin access - in a real app, check role from database
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Admin Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-900 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/workflows"
              className="p-2 hover:bg-gray-800 rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              <h1 className="text-lg font-semibold">Admin Console</h1>
            </div>
          </div>
          <span className="text-sm text-gray-400">{user?.email}</span>
        </div>
      </div>

      {/* Admin Navigation */}
      <div className="border-b border-gray-200 bg-white">
        <nav className="flex gap-1 px-4">
          {adminNavItems.map((item) => {
            const Icon = item.icon
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Admin Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </div>
    </div>
  )
}

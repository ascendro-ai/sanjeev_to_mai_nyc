'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Workflow, Users, Monitor, LogOut, BarChart3, FlaskConical, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'

interface NavItem {
  href: string
  label: string
  icon: typeof Workflow
}

const navItems: NavItem[] = [
  { href: '/create', label: 'Create a Workflow', icon: Workflow },
  { href: '/testing', label: 'Testing', icon: FlaskConical },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/team', label: 'Your Team', icon: Users },
  { href: '/control-room', label: 'Control Room', icon: Monitor },
  { href: '/admin', label: 'Admin', icon: Shield },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="flex flex-col h-screen w-64 bg-[#0d0d0d] border-r border-[#2a2a2a]">
      {/* Logo */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <Link href="/create" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
            <span className="text-black font-bold text-sm">W</span>
          </div>
          <span className="text-lg font-semibold text-white">Workflow.ai</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[#2a2a2a] text-white'
                      : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Profile */}
      {user && (
        <div className="p-4 border-t border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {getInitials(user.user_metadata?.full_name || user.email || 'U')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.user_metadata?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 text-gray-500 hover:text-gray-300 rounded-md hover:bg-[#1a1a1a]"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

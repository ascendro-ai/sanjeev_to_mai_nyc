/*
 * Vitest Setup File
 * Uncomment when tests are enabled
 */

// import '@testing-library/jest-dom'
// import { vi } from 'vitest'

// // Mock Next.js router
// vi.mock('next/navigation', () => ({
//   useRouter: () => ({
//     push: vi.fn(),
//     replace: vi.fn(),
//     prefetch: vi.fn(),
//     back: vi.fn(),
//   }),
//   usePathname: () => '/',
//   useSearchParams: () => new URLSearchParams(),
// }))

// // Mock Supabase client
// vi.mock('@/lib/supabase/client', () => ({
//   createClient: vi.fn(() => ({
//     auth: {
//       getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
//       getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
//       signOut: vi.fn().mockResolvedValue({ error: null }),
//       onAuthStateChange: vi.fn().mockReturnValue({
//         data: { subscription: { unsubscribe: vi.fn() } }
//       }),
//     },
//     from: vi.fn(() => ({
//       select: vi.fn().mockReturnThis(),
//       insert: vi.fn().mockReturnThis(),
//       update: vi.fn().mockReturnThis(),
//       delete: vi.fn().mockReturnThis(),
//       eq: vi.fn().mockReturnThis(),
//       order: vi.fn().mockReturnThis(),
//       limit: vi.fn().mockReturnThis(),
//       single: vi.fn().mockResolvedValue({ data: null, error: null }),
//     })),
//     channel: vi.fn(() => ({
//       on: vi.fn().mockReturnThis(),
//       subscribe: vi.fn().mockReturnThis(),
//     })),
//     removeChannel: vi.fn(),
//   })),
// }))

// // Global test cleanup
// afterEach(() => {
//   vi.clearAllMocks()
// })

export {}

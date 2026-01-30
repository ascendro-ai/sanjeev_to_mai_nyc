/*
 * Supabase Mock
 * Uncomment when tests are enabled
 */

// import { vi } from 'vitest'

// const mockSession = {
//   user: { id: 'user-123', email: 'test@example.com' },
//   access_token: 'mock-token',
// }

// const mockUser = { id: 'user-123', email: 'test@example.com' }

// export const mockSupabaseClient = {
//   auth: {
//     getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
//     getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
//     signOut: vi.fn().mockResolvedValue({ error: null }),
//     signInWithPassword: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
//     signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: 'https://oauth.example.com' }, error: null }),
//     onAuthStateChange: vi.fn().mockReturnValue({
//       data: { subscription: { unsubscribe: vi.fn() } }
//     }),
//   },
//   from: vi.fn((table: string) => ({
//     select: vi.fn().mockReturnThis(),
//     insert: vi.fn().mockReturnThis(),
//     update: vi.fn().mockReturnThis(),
//     delete: vi.fn().mockReturnThis(),
//     upsert: vi.fn().mockReturnThis(),
//     eq: vi.fn().mockReturnThis(),
//     neq: vi.fn().mockReturnThis(),
//     in: vi.fn().mockReturnThis(),
//     order: vi.fn().mockReturnThis(),
//     limit: vi.fn().mockReturnThis(),
//     single: vi.fn().mockResolvedValue({ data: null, error: null }),
//     maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
//   })),
//   channel: vi.fn(() => ({
//     on: vi.fn().mockReturnThis(),
//     subscribe: vi.fn().mockReturnThis(),
//   })),
//   removeChannel: vi.fn(),
// }

// export const createClient = vi.fn(() => mockSupabaseClient)

// // Helper to reset mocks
// export function resetSupabaseMocks() {
//   vi.clearAllMocks()
// }

// // Helper to mock specific query responses
// export function mockSupabaseQuery(table: string, data: any, error: any = null) {
//   mockSupabaseClient.from.mockImplementationOnce(() => ({
//     select: vi.fn().mockReturnThis(),
//     insert: vi.fn().mockReturnThis(),
//     update: vi.fn().mockReturnThis(),
//     delete: vi.fn().mockReturnThis(),
//     eq: vi.fn().mockReturnThis(),
//     order: vi.fn().mockReturnThis(),
//     limit: vi.fn().mockReturnThis(),
//     single: vi.fn().mockResolvedValue({ data, error }),
//   }))
// }

export {}

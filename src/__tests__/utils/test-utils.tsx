/*
 * Test Utilities - Custom render with providers
 * Uncomment when tests are enabled
 */

// import React from 'react'
// import { render, RenderOptions } from '@testing-library/react'
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// // Create a custom render function that wraps components in providers
// function createTestQueryClient() {
//   return new QueryClient({
//     defaultOptions: {
//       queries: {
//         retry: false,
//         gcTime: 0,
//         staleTime: 0,
//       },
//       mutations: {
//         retry: false,
//       },
//     },
//   })
// }

// interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
//   queryClient?: QueryClient
// }

// function AllTheProviders({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
//   return (
//     <QueryClientProvider client={queryClient}>
//       {children}
//     </QueryClientProvider>
//   )
// }

// export function customRender(
//   ui: React.ReactElement,
//   options?: CustomRenderOptions
// ) {
//   const queryClient = options?.queryClient ?? createTestQueryClient()
//
//   return {
//     ...render(ui, {
//       wrapper: ({ children }) => (
//         <AllTheProviders queryClient={queryClient}>{children}</AllTheProviders>
//       ),
//       ...options,
//     }),
//     queryClient,
//   }
// }

// // Re-export everything
// export * from '@testing-library/react'
// export { customRender as render }

// // Helper to wait for async operations
// export async function waitForLoadingToFinish() {
//   await new Promise((resolve) => setTimeout(resolve, 0))
// }

// // Helper to create a deferred promise for testing async states
// export function createDeferred<T>() {
//   let resolve: (value: T) => void
//   let reject: (reason?: any) => void
//
//   const promise = new Promise<T>((res, rej) => {
//     resolve = res
//     reject = rej
//   })
//
//   return { promise, resolve: resolve!, reject: reject! }
// }

export {}

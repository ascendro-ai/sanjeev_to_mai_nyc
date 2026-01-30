/*
 * Vitest Configuration
 * Uncomment and run `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom` to enable
 */

// import { defineConfig } from 'vitest/config'
// import react from '@vitejs/plugin-react'
// import path from 'path'

// export default defineConfig({
//   plugins: [react()],
//   resolve: {
//     alias: {
//       '@': path.resolve(__dirname, './src'),
//     },
//   },
//   test: {
//     environment: 'jsdom',
//     setupFiles: ['./vitest.setup.ts'],
//     globals: true,
//     coverage: {
//       provider: 'v8',
//       reporter: ['text', 'lcov', 'html'],
//       exclude: [
//         'node_modules/',
//         'e2e/',
//         '**/*.d.ts',
//         '**/*.config.*',
//         '**/index.ts',
//       ],
//       thresholds: {
//         global: {
//           branches: 70,
//           functions: 75,
//           lines: 80,
//           statements: 80,
//         },
//         './src/hooks/': {
//           branches: 85,
//           functions: 90,
//           lines: 90,
//           statements: 90,
//         },
//         './src/app/api/': {
//           branches: 80,
//           functions: 85,
//           lines: 85,
//           statements: 85,
//         },
//         './src/lib/': {
//           branches: 80,
//           functions: 85,
//           lines: 85,
//           statements: 85,
//         },
//       },
//     },
//   },
// })

export {}

/**
 * Logger utility for consistent logging across the application
 * Debug logs are only shown in development mode
 */

const isDev = process.env.NODE_ENV === 'development'

export const logger = {
  debug: (msg: string, data?: unknown) => {
    if (isDev) console.log(`[DEBUG] ${msg}`, data ?? '')
  },
  info: (msg: string, data?: unknown) => {
    console.log(`[INFO] ${msg}`, data ?? '')
  },
  warn: (msg: string, data?: unknown) => {
    console.warn(`[WARN] ${msg}`, data ?? '')
  },
  error: (msg: string, error?: unknown) => {
    console.error(`[ERROR] ${msg}`, error ?? '')
  },
}

export default logger

/**
 * @fileoverview Error handling utilities with information leakage prevention.
 *
 * This module provides functions to safely handle and report errors without
 * exposing sensitive internal details to API clients. It sanitizes error
 * messages to remove:
 *
 * - Database connection strings
 * - API keys and tokens
 * - Internal file paths
 * - Stack traces
 * - IP addresses
 * - Environment variable names
 *
 * @module lib/error-handler
 *
 * @example
 * ```typescript
 * import { createSafeErrorResponse, getSafeErrorMessage } from '@/lib/error-handler'
 *
 * export async function POST(request: NextRequest) {
 *   try {
 *     // ... operation that might throw
 *   } catch (error) {
 *     // Returns sanitized error safe for client
 *     const safeError = createSafeErrorResponse(error, 'POST /api/users')
 *     return NextResponse.json(safeError, { status: 500 })
 *   }
 * }
 * ```
 *
 * @security This module prevents information disclosure vulnerabilities
 * (OWASP A01:2021 - Broken Access Control, CWE-209).
 */

import { logger } from '@/lib/logger'

// -----------------------------------------------------------------------------
// Sanitization Patterns
// -----------------------------------------------------------------------------

/**
 * Regex patterns that match sensitive information in error messages.
 *
 * These patterns are used to redact potentially harmful details
 * before returning errors to clients.
 *
 * @internal
 */
const SENSITIVE_PATTERNS = [
  // Database/connection strings
  /postgres:\/\/[^\s]+/gi,
  /mysql:\/\/[^\s]+/gi,
  /mongodb:\/\/[^\s]+/gi,
  /redis:\/\/[^\s]+/gi,

  // API keys and tokens
  /api[_-]?key[=:]\s*["']?[a-zA-Z0-9_-]{20,}["']?/gi,
  /bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi,
  /sk-[a-zA-Z0-9]{32,}/gi, // OpenAI/Anthropic style keys
  /AIza[a-zA-Z0-9_-]{35}/gi, // Google API keys

  // Internal URLs and paths
  /\/Users\/[^\s]+/gi,
  /\/home\/[^\s]+/gi,
  /C:\\[^\s]+/gi,
  /file:\/\/[^\s]+/gi,

  // Stack traces (simplified)
  /at\s+[^\s]+\s+\([^\)]+\)/gi,
  /at\s+[^\s]+\s+\[[^\]]+\]/gi,

  // Environment variables
  /process\.env\.[A-Z_]+/gi,

  // IP addresses (internal ranges only)
  /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g,

  // Email addresses in errors
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
]

// -----------------------------------------------------------------------------
// Error Message Mapping
// -----------------------------------------------------------------------------

/**
 * Maps error patterns to generic, user-friendly messages.
 *
 * Keys are patterns to search for in error messages.
 * Values are the generic messages to return to clients.
 *
 * @internal
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Database errors (Supabase, PostgreSQL, SQLite, MySQL)
  PGRST: 'Database operation failed',
  SQLITE: 'Database operation failed',
  ER_: 'Database operation failed',

  // Authentication errors
  AUTH: 'Authentication failed',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access denied',

  // Validation errors
  VALIDATION: 'Invalid request data',
  ZOD: 'Invalid request data',

  // Network errors
  ECONNREFUSED: 'Service temporarily unavailable',
  ETIMEDOUT: 'Request timed out',
  ENOTFOUND: 'Service not found',

  // Rate limiting
  RATE_LIMIT: 'Too many requests',

  // Default fallback
  DEFAULT: 'An unexpected error occurred',
}

// -----------------------------------------------------------------------------
// Sanitization Functions
// -----------------------------------------------------------------------------

/**
 * Removes sensitive information from an error message.
 *
 * Applies all patterns in SENSITIVE_PATTERNS and replaces matches
 * with '[REDACTED]'. Also removes very long alphanumeric strings
 * that might be tokens or keys.
 *
 * @param message - The raw error message
 * @returns The sanitized message safe for client exposure
 *
 * @example
 * ```typescript
 * const raw = 'Connection to postgres://user:pass@host/db failed'
 * const safe = sanitizeErrorMessage(raw)
 * // Returns: 'Connection to [REDACTED] failed'
 * ```
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message

  // Remove sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }

  // Remove any remaining long alphanumeric strings that might be tokens
  sanitized = sanitized.replace(/\b[a-zA-Z0-9_-]{40,}\b/g, '[REDACTED]')

  return sanitized
}

/**
 * Returns a safe, generic error message based on error type.
 *
 * First tries to match the error against known patterns in ERROR_MESSAGES.
 * If no match is found, sanitizes the original message and checks if it's
 * safe to return. Very long or technical-looking messages are replaced
 * with a generic message.
 *
 * @param error - The original error (Error, string, or unknown)
 * @returns A user-friendly error message
 *
 * @example
 * ```typescript
 * // Database error
 * getSafeErrorMessage(new Error('PGRST116: Row not found'))
 * // Returns: 'Database operation failed'
 *
 * // Network error
 * getSafeErrorMessage(new Error('ECONNREFUSED: connect failed'))
 * // Returns: 'Service temporarily unavailable'
 *
 * // Unknown error
 * getSafeErrorMessage(new Error('Something went wrong'))
 * // Returns: 'Something went wrong' (after sanitization check)
 * ```
 */
export function getSafeErrorMessage(error: unknown): string {
  if (!error) return ERROR_MESSAGES.DEFAULT

  const errorString = error instanceof Error
    ? error.message
    : String(error)

  // Check for known error patterns and return generic message
  for (const [pattern, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorString.toUpperCase().includes(pattern)) {
      return message
    }
  }

  // For unknown errors, sanitize the message
  const sanitized = sanitizeErrorMessage(errorString)

  // If the sanitized message is too long or still looks technical, use generic
  if (sanitized.length > 200 || sanitized.includes('[REDACTED]') || sanitized.includes('Error:')) {
    return ERROR_MESSAGES.DEFAULT
  }

  return sanitized
}

/**
 * Extracts an error code from an error for logging and tracking.
 *
 * Checks for common error code properties:
 * - error.code (Node.js style)
 * - error.name (Error subclass name)
 *
 * @param error - The error to extract a code from
 * @returns The error code string, or 'UNKNOWN_ERROR'
 *
 * @example
 * ```typescript
 * const err = new Error('Connection refused')
 * err.code = 'ECONNREFUSED'
 *
 * getErrorCode(err) // Returns: 'ECONNREFUSED'
 * getErrorCode(new Error('oops')) // Returns: 'Error'
 * getErrorCode('string error') // Returns: 'UNKNOWN_ERROR'
 * ```
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof Error) {
    // Check for common error properties
    const anyError = error as Record<string, unknown>
    if (anyError.code && typeof anyError.code === 'string') {
      return anyError.code
    }
    if (anyError.name) {
      return String(anyError.name)
    }
  }
  return 'UNKNOWN_ERROR'
}

// -----------------------------------------------------------------------------
// Response Creation
// -----------------------------------------------------------------------------

/**
 * Creates a client-safe error response with internal logging.
 *
 * This function:
 * 1. Extracts the error code for tracking
 * 2. Gets a safe user-friendly message
 * 3. Logs the full error details internally
 * 4. Returns only safe information to the client
 *
 * @param error - The original error
 * @param context - Description of where the error occurred (for logging)
 * @returns Object with safe error message and optional code
 *
 * @example
 * ```typescript
 * catch (error) {
 *   const safeError = createSafeErrorResponse(error, 'POST /api/users/create')
 *   // Logs full error internally, returns safe response
 *   return NextResponse.json(safeError, { status: 500 })
 * }
 * ```
 */
export function createSafeErrorResponse(
  error: unknown,
  context?: string
): { error: string; code?: string } {
  const code = getErrorCode(error)
  const message = getSafeErrorMessage(error)

  // Log the full error internally for debugging
  logger.error(`Error in ${context || 'unknown context'}:`, {
    code,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })

  return {
    error: message,
    ...(code !== 'UNKNOWN_ERROR' && { code }),
  }
}

// -----------------------------------------------------------------------------
// Error Wrapper Utilities
// -----------------------------------------------------------------------------

/**
 * Wraps an async handler to automatically sanitize thrown errors.
 *
 * Any errors thrown within the handler are caught and re-thrown
 * as SafeError instances with sanitized messages.
 *
 * @param handler - The async function to wrap
 * @param context - Description for error logging
 * @returns The wrapped function with automatic error sanitization
 *
 * @example
 * ```typescript
 * const safeHandler = withErrorHandling(
 *   async (request) => {
 *     // ... might throw
 *   },
 *   'user-creation'
 * )
 * ```
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  handler: T,
  context: string
): T {
  return (async (...args: unknown[]) => {
    try {
      return await handler(...args)
    } catch (error) {
      throw new SafeError(getSafeErrorMessage(error), getErrorCode(error), error)
    }
  }) as T
}

// -----------------------------------------------------------------------------
// Safe Error Class
// -----------------------------------------------------------------------------

/**
 * An error class that wraps the original error but only exposes sanitized information.
 *
 * Use this when you need to propagate errors while ensuring sensitive
 * details are not exposed. The original error is preserved for internal
 * logging but not included in the JSON representation.
 *
 * @example
 * ```typescript
 * throw new SafeError('Database operation failed', 'DB_ERROR', originalError)
 *
 * // In catch block
 * if (error instanceof SafeError) {
 *   // error.message is safe for clients
 *   // error.originalError is available for logging
 * }
 * ```
 */
export class SafeError extends Error {
  /** Error code for categorization */
  public readonly code: string

  /** Original error (for internal logging only) */
  public readonly originalError: unknown

  /**
   * Creates a new SafeError.
   *
   * @param message - The safe, sanitized error message
   * @param code - Error code for categorization
   * @param originalError - The original error (preserved for logging)
   */
  constructor(message: string, code: string = 'UNKNOWN_ERROR', originalError?: unknown) {
    super(message)
    this.name = 'SafeError'
    this.code = code
    this.originalError = originalError
  }

  /**
   * Returns a JSON-safe representation of the error.
   * Does not include the original error or stack trace.
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
    }
  }
}

/**
 * Type guard to check if an error is a SafeError.
 *
 * @param error - The error to check
 * @returns true if the error is a SafeError instance
 *
 * @example
 * ```typescript
 * if (isSafeError(error)) {
 *   // Safe to send error.message to client
 *   return NextResponse.json(error.toJSON())
 * }
 * ```
 */
export function isSafeError(error: unknown): error is SafeError {
  return error instanceof SafeError
}

/**
 * Creates a complete API error response object.
 *
 * Convenience function that combines error sanitization with
 * HTTP status code, ready for NextResponse.json().
 *
 * @param error - The original error
 * @param statusCode - HTTP status code to return
 * @returns Object with status and body for API response
 *
 * @example
 * ```typescript
 * catch (error) {
 *   const apiError = toApiError(error, 500)
 *   return NextResponse.json(apiError.body, { status: apiError.status })
 * }
 * ```
 */
export function toApiError(error: unknown, statusCode: number = 500): {
  status: number
  body: { error: string; code?: string }
} {
  return {
    status: statusCode,
    body: createSafeErrorResponse(error),
  }
}

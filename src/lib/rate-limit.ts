/**
 * @fileoverview In-memory rate limiting middleware for API routes.
 *
 * This module provides rate limiting functionality to prevent API abuse.
 * It uses a sliding window algorithm with in-memory storage, suitable
 * for single-instance deployments.
 *
 * For distributed deployments with multiple instances, consider using
 * Redis-based rate limiting instead.
 *
 * Features:
 * - Configurable time windows and request limits
 * - Custom key generators for granular rate limiting
 * - Pre-configured limiters for common use cases
 * - Automatic cleanup of expired entries
 * - Standard rate limit headers (RFC 6585)
 *
 * @module lib/rate-limit
 *
 * @example
 * ```typescript
 * import { applyRateLimit, standardRateLimiter } from '@/lib/rate-limit'
 *
 * export async function POST(request: NextRequest) {
 *   // Apply rate limiting - returns error response if limit exceeded
 *   const rateLimitResult = applyRateLimit(request, standardRateLimiter)
 *   if (rateLimitResult) return rateLimitResult
 *
 *   // Continue with normal request handling
 *   return NextResponse.json({ success: true })
 * }
 * ```
 *
 * @security This module helps prevent:
 * - Brute force attacks on authentication endpoints
 * - API abuse and denial of service
 * - Resource exhaustion from automated requests
 */

import { NextRequest, NextResponse } from 'next/server'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Internal tracking data for a single rate limit entry.
 * @internal
 */
interface RateLimitEntry {
  /** Number of requests in the current window */
  count: number
  /** Unix timestamp when the window resets */
  resetTime: number
}

/**
 * Configuration options for a rate limiter.
 *
 * @example
 * ```typescript
 * const config: RateLimitConfig = {
 *   windowMs: 60 * 1000,    // 1 minute window
 *   maxRequests: 100,        // 100 requests per window
 *   message: 'Rate limit exceeded',
 *   keyGenerator: (req) => req.headers.get('x-api-key') || getClientId(req),
 * }
 * ```
 */
interface RateLimitConfig {
  /**
   * Time window in milliseconds.
   * @default 60000 (1 minute)
   */
  windowMs: number

  /**
   * Maximum requests allowed per window.
   * @default 100
   */
  maxRequests: number

  /**
   * Custom function to generate rate limit key from request.
   * Defaults to client IP address.
   * Use this to rate limit by API key, user ID, etc.
   */
  keyGenerator?: (request: NextRequest) => string

  /**
   * Whether to exclude failed requests from the count.
   * If true, only successful responses count toward the limit.
   * @default false
   */
  skipFailedRequests?: boolean

  /**
   * Custom error message when rate limited.
   * @default 'Too many requests, please try again later'
   */
  message?: string
}

/**
 * Result from checking rate limit status.
 */
interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of requests remaining in the current window */
  remaining: number
  /** Milliseconds until the window resets */
  resetIn: number
}

// -----------------------------------------------------------------------------
// In-Memory Store
// -----------------------------------------------------------------------------

/**
 * In-memory store for rate limit tracking.
 *
 * Note: This store is not shared across server instances.
 * For production deployments with multiple instances, use Redis instead.
 *
 * @internal
 */
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Default configuration applied when not specified.
 * @internal
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Too many requests, please try again later',
}

// -----------------------------------------------------------------------------
// Cleanup
// -----------------------------------------------------------------------------

/**
 * Removes expired entries from the rate limit store.
 *
 * Called periodically to prevent memory growth.
 * Entries are deleted when their reset time has passed.
 *
 * @internal
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key)
    }
  }
}

// Run cleanup every minute (only in environments with setInterval)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 60 * 1000)
}

// -----------------------------------------------------------------------------
// Client Identification
// -----------------------------------------------------------------------------

/**
 * Extracts the client identifier from a request.
 *
 * Checks headers in this order:
 * 1. x-forwarded-for (from proxy/load balancer)
 * 2. x-real-ip (from nginx)
 * 3. User agent hash (fallback)
 *
 * @param request - The incoming request
 * @returns A string identifier for the client
 *
 * @security The x-forwarded-for header can be spoofed. For critical
 * security scenarios, consider using additional verification.
 *
 * @internal
 */
function getClientId(request: NextRequest): string {
  // Try to get IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fall back to a hash of the user agent if no IP available
  const userAgent = request.headers.get('user-agent') || 'unknown'
  return `ua-${hashString(userAgent)}`
}

/**
 * Simple hash function for strings.
 *
 * Used to create a deterministic identifier from user agent strings.
 * Not cryptographically secure - only for rate limit key generation.
 *
 * @param str - String to hash
 * @returns Base36-encoded hash value
 *
 * @internal
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

/**
 * Checks and updates rate limit status for a request.
 *
 * This is the core rate limiting function. It:
 * 1. Generates a key for the request (IP or custom)
 * 2. Looks up or creates a rate limit entry
 * 3. Increments the request count
 * 4. Returns whether the request is allowed
 *
 * @param request - The incoming request
 * @param config - Rate limit configuration (merged with defaults)
 * @returns Rate limit status with allowed flag and remaining count
 *
 * @example
 * ```typescript
 * const result = checkRateLimit(request, { maxRequests: 10, windowMs: 60000 })
 *
 * if (!result.allowed) {
 *   return rateLimitResponse(result.resetIn)
 * }
 *
 * // Process request...
 * ```
 */
export function checkRateLimit(
  request: NextRequest,
  config: Partial<RateLimitConfig> = {}
): RateLimitResult {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const { windowMs, maxRequests, keyGenerator } = mergedConfig

  const key = keyGenerator ? keyGenerator(request) : getClientId(request)
  const now = Date.now()

  let entry = rateLimitStore.get(key)

  // Create new entry if doesn't exist or has expired
  if (!entry || entry.resetTime <= now) {
    entry = {
      count: 1,
      resetTime: now + windowMs,
    }
    rateLimitStore.set(key, entry)
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetIn: windowMs,
    }
  }

  // Increment count for existing entry
  entry.count++

  const remaining = Math.max(0, maxRequests - entry.count)
  const resetIn = entry.resetTime - now

  return {
    allowed: entry.count <= maxRequests,
    remaining,
    resetIn,
  }
}

/**
 * Creates a 429 Too Many Requests response with standard headers.
 *
 * Includes headers:
 * - Retry-After: Seconds until the client can retry
 * - X-RateLimit-Reset: Unix timestamp when the limit resets
 *
 * @param resetIn - Milliseconds until the rate limit resets
 * @param message - Custom error message
 * @returns NextResponse with 429 status and rate limit headers
 *
 * @example
 * ```typescript
 * if (!result.allowed) {
 *   return rateLimitResponse(result.resetIn, 'Please slow down')
 * }
 * ```
 */
export function rateLimitResponse(
  resetIn: number,
  message?: string
): NextResponse {
  return NextResponse.json(
    { error: message || DEFAULT_CONFIG.message },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(resetIn / 1000)),
        'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + Math.ceil(resetIn / 1000)),
      },
    }
  )
}

// -----------------------------------------------------------------------------
// Rate Limiter Factory
// -----------------------------------------------------------------------------

/**
 * Creates a reusable rate limiter with fixed configuration.
 *
 * Returns an object with methods for checking and applying rate limits.
 * Use this to create pre-configured limiters for different routes.
 *
 * @param config - Rate limit configuration
 * @returns Rate limiter object with check, apply, and addHeaders methods
 *
 * @example
 * ```typescript
 * // Create a custom rate limiter
 * const apiKeyLimiter = createRateLimiter({
 *   windowMs: 60 * 1000,
 *   maxRequests: 1000,
 *   keyGenerator: (req) => req.headers.get('x-api-key') || 'anonymous',
 * })
 *
 * // Use in route handler
 * export async function POST(request: NextRequest) {
 *   const result = apiKeyLimiter.apply(request)
 *   if (result) return result
 *   // ...
 * }
 * ```
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  return {
    /**
     * Check if request is allowed and get rate limit info.
     * Does not return a response - use for informational purposes.
     */
    check(request: NextRequest): RateLimitResult {
      return checkRateLimit(request, mergedConfig)
    },

    /**
     * Apply rate limit to a request.
     * Returns error response if limited, null if allowed.
     */
    apply(request: NextRequest): NextResponse | null {
      const result = checkRateLimit(request, mergedConfig)

      if (!result.allowed) {
        return rateLimitResponse(result.resetIn, mergedConfig.message)
      }

      return null
    },

    /**
     * Add rate limit headers to a successful response.
     * Call this to inform clients of their remaining quota.
     */
    addHeaders(response: NextResponse, remaining: number, resetIn: number): NextResponse {
      response.headers.set('X-RateLimit-Limit', String(mergedConfig.maxRequests))
      response.headers.set('X-RateLimit-Remaining', String(remaining))
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + Math.ceil(resetIn / 1000)))
      return response
    },
  }
}

// -----------------------------------------------------------------------------
// Pre-configured Rate Limiters
// -----------------------------------------------------------------------------

/**
 * Standard API rate limiter.
 *
 * Configuration:
 * - 100 requests per minute per IP
 * - Suitable for most API endpoints
 *
 * @example
 * ```typescript
 * const result = applyRateLimit(request, standardRateLimiter)
 * if (result) return result
 * ```
 */
export const standardRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
})

/**
 * Authentication rate limiter.
 *
 * Configuration:
 * - 10 requests per minute per IP
 * - For login, signup, password reset endpoints
 *
 * @security Prevents brute force attacks on authentication.
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many authentication attempts, please try again later',
})

/**
 * Strict rate limiter for sensitive operations.
 *
 * Configuration:
 * - 20 requests per minute per IP
 * - For password changes, account deletion, etc.
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Rate limit exceeded for sensitive operation',
})

/**
 * Webhook rate limiter for n8n callbacks.
 *
 * Configuration:
 * - 500 requests per minute per IP
 * - Higher limit for automated n8n workflow callbacks
 *
 * @note n8n may send many requests during high-volume workflow execution.
 */
export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 500,
  message: 'Webhook rate limit exceeded',
})

// -----------------------------------------------------------------------------
// Helper Function
// -----------------------------------------------------------------------------

/**
 * Convenience function to apply rate limiting in API routes.
 *
 * This is the primary function to use in route handlers.
 * Returns a 429 response if rate limited, or null if allowed.
 *
 * @param request - The incoming Next.js request
 * @param limiter - The rate limiter to use (defaults to standardRateLimiter)
 * @returns NextResponse with 429 status if rate limited, null otherwise
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   // Apply rate limiting at the start of the handler
 *   const rateLimitResult = applyRateLimit(request, standardRateLimiter)
 *   if (rateLimitResult) return rateLimitResult
 *
 *   // Request is allowed, continue with normal processing
 *   const body = await request.json()
 *   // ...
 * }
 * ```
 *
 * @example Using with auth limiter
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = applyRateLimit(request, authRateLimiter)
 *   if (rateLimitResult) return rateLimitResult
 *
 *   // Handle login...
 * }
 * ```
 */
export function applyRateLimit(
  request: NextRequest,
  limiter = standardRateLimiter
): NextResponse | null {
  return limiter.apply(request)
}

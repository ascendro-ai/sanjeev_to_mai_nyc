import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  checkRateLimit,
  rateLimitResponse,
  createRateLimiter,
  applyRateLimit,
  standardRateLimiter,
  authRateLimiter,
  strictRateLimiter,
  webhookRateLimiter,
} from '../rate-limit'

// Helper to create mock NextRequest
function createMockRequest(options: {
  ip?: string
  forwardedFor?: string
  realIp?: string
  userAgent?: string
  url?: string
} = {}): NextRequest {
  const headers = new Headers()
  if (options.forwardedFor) {
    headers.set('x-forwarded-for', options.forwardedFor)
  }
  if (options.realIp) {
    headers.set('x-real-ip', options.realIp)
  }
  if (options.userAgent) {
    headers.set('user-agent', options.userAgent)
  }

  return new NextRequest(options.url || 'http://localhost/api/test', {
    headers,
  })
}

describe('rate-limit', () => {
  // Clear rate limit store between tests by using unique keys
  let testCounter = 0

  beforeEach(() => {
    testCounter++
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkRateLimit', () => {
    describe('basic rate limiting', () => {
      it('should allow requests under the limit', () => {
        const request = createMockRequest({ forwardedFor: `test-ip-${testCounter}-1` })
        const config = { maxRequests: 10, windowMs: 60000 }

        const result = checkRateLimit(request, config)

        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(9)
      })

      it('should block requests over the limit', () => {
        const ip = `test-ip-${testCounter}-2`
        const config = { maxRequests: 3, windowMs: 60000 }

        // Make requests up to the limit
        for (let i = 0; i < 3; i++) {
          const request = createMockRequest({ forwardedFor: ip })
          checkRateLimit(request, config)
        }

        // Next request should be blocked
        const request = createMockRequest({ forwardedFor: ip })
        const result = checkRateLimit(request, config)

        expect(result.allowed).toBe(false)
        expect(result.remaining).toBe(0)
      })

      it('should track requests per unique key', () => {
        const config = { maxRequests: 2, windowMs: 60000 }

        // IP 1 makes 2 requests
        const ip1 = `unique-ip1-${testCounter}`
        const ip2 = `unique-ip2-${testCounter}`

        checkRateLimit(createMockRequest({ forwardedFor: ip1 }), config)
        checkRateLimit(createMockRequest({ forwardedFor: ip1 }), config)

        // IP 1 should be blocked
        const result1 = checkRateLimit(createMockRequest({ forwardedFor: ip1 }), config)
        expect(result1.allowed).toBe(false)

        // IP 2 should still be allowed
        const result2 = checkRateLimit(createMockRequest({ forwardedFor: ip2 }), config)
        expect(result2.allowed).toBe(true)
      })

      it('should reset count after window expires', () => {
        const ip = `test-ip-reset-${testCounter}`
        const config = { maxRequests: 2, windowMs: 1000 } // 1 second window

        // Use up the limit
        checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        checkRateLimit(createMockRequest({ forwardedFor: ip }), config)

        // Should be blocked
        let result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        expect(result.allowed).toBe(false)

        // Advance time past the window
        vi.advanceTimersByTime(1100)

        // Should be allowed again
        result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(1)
      })
    })

    describe('window management', () => {
      it('should correctly calculate remaining requests', () => {
        const ip = `remaining-test-${testCounter}`
        const config = { maxRequests: 5, windowMs: 60000 }

        let result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        expect(result.remaining).toBe(4)

        result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        expect(result.remaining).toBe(3)

        result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        expect(result.remaining).toBe(2)
      })

      it('should return correct reset timestamp', () => {
        const ip = `reset-time-${testCounter}`
        const config = { maxRequests: 10, windowMs: 60000 }

        const result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)

        expect(result.resetIn).toBeGreaterThan(0)
        expect(result.resetIn).toBeLessThanOrEqual(60000)
      })

      it('should handle window boundary edge cases', () => {
        const ip = `boundary-test-${testCounter}`
        const config = { maxRequests: 2, windowMs: 1000 }

        // First request
        checkRateLimit(createMockRequest({ forwardedFor: ip }), config)

        // Advance almost to the boundary
        vi.advanceTimersByTime(999)

        // Second request should still count against same window
        const result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        expect(result.remaining).toBe(0)
      })
    })

    describe('key extraction', () => {
      it('should extract IP from x-forwarded-for header', () => {
        const config = { maxRequests: 1, windowMs: 60000 }

        const request1 = createMockRequest({ forwardedFor: `fwd-ip-${testCounter}` })
        checkRateLimit(request1, config)

        const request2 = createMockRequest({ forwardedFor: `fwd-ip-${testCounter}` })
        const result = checkRateLimit(request2, config)

        expect(result.allowed).toBe(false)
      })

      it('should extract first IP from comma-separated x-forwarded-for', () => {
        const config = { maxRequests: 1, windowMs: 60000 }
        const ip = `first-ip-${testCounter}`

        const request1 = createMockRequest({ forwardedFor: `${ip}, proxy1, proxy2` })
        checkRateLimit(request1, config)

        const request2 = createMockRequest({ forwardedFor: `${ip}, other-proxy` })
        const result = checkRateLimit(request2, config)

        expect(result.allowed).toBe(false)
      })

      it('should extract IP from x-real-ip header', () => {
        const config = { maxRequests: 1, windowMs: 60000 }
        const ip = `real-ip-${testCounter}`

        const request1 = createMockRequest({ realIp: ip })
        checkRateLimit(request1, config)

        const request2 = createMockRequest({ realIp: ip })
        const result = checkRateLimit(request2, config)

        expect(result.allowed).toBe(false)
      })

      it('should use custom key when provided', () => {
        const config = {
          maxRequests: 1,
          windowMs: 60000,
          keyGenerator: () => `custom-key-${testCounter}`,
        }

        const request1 = createMockRequest({ forwardedFor: 'ip1' })
        checkRateLimit(request1, config)

        // Different IP but same custom key should be blocked
        const request2 = createMockRequest({ forwardedFor: 'ip2' })
        const result = checkRateLimit(request2, config)

        expect(result.allowed).toBe(false)
      })

      it('should handle missing IP gracefully', () => {
        const config = { maxRequests: 1, windowMs: 60000 }

        // Request with only user-agent (no IP headers)
        const request = createMockRequest({ userAgent: `TestAgent-${testCounter}` })
        const result = checkRateLimit(request, config)

        expect(result.allowed).toBe(true)
      })
    })

    describe('configuration options', () => {
      it('should respect custom limit', () => {
        const ip = `custom-limit-${testCounter}`
        const config = { maxRequests: 2, windowMs: 60000 }

        checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        checkRateLimit(createMockRequest({ forwardedFor: ip }), config)

        const result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        expect(result.allowed).toBe(false)
      })

      it('should respect custom window size', () => {
        const ip = `custom-window-${testCounter}`
        const config = { maxRequests: 1, windowMs: 500 }

        checkRateLimit(createMockRequest({ forwardedFor: ip }), config)

        // Blocked immediately
        let result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        expect(result.allowed).toBe(false)

        // Allowed after window
        vi.advanceTimersByTime(600)
        result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
        expect(result.allowed).toBe(true)
      })
    })
  })

  describe('rateLimitResponse', () => {
    it('should return 429 status code', () => {
      const response = rateLimitResponse(1000)
      expect(response.status).toBe(429)
    })

    it('should include Retry-After header', () => {
      const response = rateLimitResponse(5000)
      expect(response.headers.get('Retry-After')).toBe('5')
    })

    it('should include X-RateLimit-Reset header', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const response = rateLimitResponse(10000)
      const resetHeader = response.headers.get('X-RateLimit-Reset')

      expect(resetHeader).toBeDefined()
      expect(parseInt(resetHeader!)).toBeGreaterThan(now / 1000)
    })

    it('should return JSON error body', async () => {
      const response = rateLimitResponse(1000)
      const body = await response.json()

      expect(body.error).toBeDefined()
    })

    it('should use custom message when provided', async () => {
      const customMessage = 'Custom rate limit message'
      const response = rateLimitResponse(1000, customMessage)
      const body = await response.json()

      expect(body.error).toBe(customMessage)
    })

    it('should use default message when not provided', async () => {
      const response = rateLimitResponse(1000)
      const body = await response.json()

      expect(body.error).toContain('Too many requests')
    })
  })

  describe('createRateLimiter', () => {
    it('should create limiter with default options', () => {
      const limiter = createRateLimiter()

      expect(limiter.check).toBeDefined()
      expect(limiter.apply).toBeDefined()
      expect(limiter.addHeaders).toBeDefined()
    })

    it('should create limiter with custom options', () => {
      const ip = `custom-limiter-${testCounter}`
      const limiter = createRateLimiter({
        maxRequests: 2,
        windowMs: 1000,
      })

      // Make requests up to limit
      limiter.check(createMockRequest({ forwardedFor: ip }))
      limiter.check(createMockRequest({ forwardedFor: ip }))

      // Third should be blocked
      const result = limiter.check(createMockRequest({ forwardedFor: ip }))
      expect(result.allowed).toBe(false)
    })

    it('should isolate state between different limiters', () => {
      const ip = `isolated-${testCounter}`
      const limiter1 = createRateLimiter({ maxRequests: 1, windowMs: 60000 })
      const limiter2 = createRateLimiter({ maxRequests: 5, windowMs: 60000 })

      // Exhaust limiter1
      limiter1.check(createMockRequest({ forwardedFor: ip }))
      const result1 = limiter1.check(createMockRequest({ forwardedFor: ip }))

      // limiter2 should still have capacity
      const result2 = limiter2.check(createMockRequest({ forwardedFor: ip }))

      expect(result1.allowed).toBe(false)
      expect(result2.allowed).toBe(true)
    })
  })

  describe('applyRateLimit middleware', () => {
    it('should pass through allowed requests', () => {
      const request = createMockRequest({ forwardedFor: `apply-allowed-${testCounter}` })
      const result = applyRateLimit(request, createRateLimiter({ maxRequests: 100, windowMs: 60000 }))

      expect(result).toBeNull()
    })

    it('should block rate-limited requests', () => {
      const ip = `apply-blocked-${testCounter}`
      const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60000 })

      // First request
      applyRateLimit(createMockRequest({ forwardedFor: ip }), limiter)

      // Second should be blocked
      const result = applyRateLimit(createMockRequest({ forwardedFor: ip }), limiter)

      expect(result).not.toBeNull()
      expect(result?.status).toBe(429)
    })

    it('should use standard limiter by default', () => {
      const request = createMockRequest({ forwardedFor: `default-limiter-${testCounter}` })
      const result = applyRateLimit(request)

      expect(result).toBeNull() // Should be allowed with default high limit
    })
  })

  describe('rate limiter addHeaders', () => {
    it('should add rate limit headers to response', () => {
      const ip = `add-headers-${testCounter}`
      const limiter = createRateLimiter({ maxRequests: 100, windowMs: 60000 })

      // First, make a request to get rate limit info
      const request = createMockRequest({ forwardedFor: ip })
      const checkResult = limiter.check(request)

      // Import NextResponse for proper testing
      const { NextResponse } = require('next/server')
      const response = NextResponse.json({ data: 'test' })

      // Verify addHeaders function exists and is callable
      expect(typeof limiter.addHeaders).toBe('function')

      // Call addHeaders with response, remaining, and resetIn
      const modifiedResponse = limiter.addHeaders(response, checkResult.remaining, checkResult.resetIn)

      // Should return a response object
      expect(modifiedResponse).toBeDefined()
    })

    it('should include rate limit information in headers', () => {
      const ip = `headers-info-${testCounter}`
      const limiter = createRateLimiter({ maxRequests: 50, windowMs: 60000 })

      // Make a request to get rate limit info
      const request = createMockRequest({ forwardedFor: ip })
      const checkResult = limiter.check(request)

      // Create response and add headers
      const { NextResponse } = require('next/server')
      const response = NextResponse.json({ data: 'test' })
      const modifiedResponse = limiter.addHeaders(response, checkResult.remaining, checkResult.resetIn)

      // Check that rate limit headers are present
      const limitHeader = modifiedResponse.headers.get('X-RateLimit-Limit')
      const remainingHeader = modifiedResponse.headers.get('X-RateLimit-Remaining')
      const resetHeader = modifiedResponse.headers.get('X-RateLimit-Reset')

      expect(limitHeader).toBe('50')
      expect(remainingHeader).toBe('49') // 50 - 1 request made
      expect(resetHeader).toBeDefined()
    })
  })

  describe('pre-configured rate limiters', () => {
    it('standardRateLimiter should have 100 requests per minute', () => {
      const ip = `standard-${testCounter}`

      // Should allow many requests
      for (let i = 0; i < 50; i++) {
        const result = standardRateLimiter.check(createMockRequest({ forwardedFor: ip }))
        expect(result.allowed).toBe(true)
      }
    })

    it('authRateLimiter should have 10 requests per minute', () => {
      const ip = `auth-${testCounter}`

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        authRateLimiter.check(createMockRequest({ forwardedFor: ip }))
      }

      // 11th should be blocked
      const result = authRateLimiter.check(createMockRequest({ forwardedFor: ip }))
      expect(result.allowed).toBe(false)
    })

    it('strictRateLimiter should have 20 requests per minute', () => {
      const ip = `strict-${testCounter}`

      // Make 20 requests
      for (let i = 0; i < 20; i++) {
        strictRateLimiter.check(createMockRequest({ forwardedFor: ip }))
      }

      // 21st should be blocked
      const result = strictRateLimiter.check(createMockRequest({ forwardedFor: ip }))
      expect(result.allowed).toBe(false)
    })

    it('webhookRateLimiter should have 500 requests per minute', () => {
      const ip = `webhook-${testCounter}`

      // Should allow many requests
      for (let i = 0; i < 100; i++) {
        const result = webhookRateLimiter.check(createMockRequest({ forwardedFor: ip }))
        expect(result.allowed).toBe(true)
      }
    })

    it('authRateLimiter should have custom error message', async () => {
      const ip = `auth-message-${testCounter}`

      // Exhaust the limit
      for (let i = 0; i < 11; i++) {
        authRateLimiter.check(createMockRequest({ forwardedFor: ip }))
      }

      const response = authRateLimiter.apply(createMockRequest({ forwardedFor: ip }))
      expect(response).not.toBeNull()

      if (response) {
        const body = await response.json()
        expect(body.error).toContain('authentication')
      }
    })

    it('strictRateLimiter should have custom error message', async () => {
      const ip = `strict-message-${testCounter}`

      // Exhaust the limit
      for (let i = 0; i < 21; i++) {
        strictRateLimiter.check(createMockRequest({ forwardedFor: ip }))
      }

      const response = strictRateLimiter.apply(createMockRequest({ forwardedFor: ip }))
      expect(response).not.toBeNull()

      if (response) {
        const body = await response.json()
        expect(body.error).toContain('sensitive')
      }
    })
  })

  describe('concurrent request handling', () => {
    it('should handle rapid requests correctly', () => {
      const ip = `concurrent-${testCounter}`
      const config = { maxRequests: 5, windowMs: 60000 }

      // Simulate rapid concurrent requests
      const results = []
      for (let i = 0; i < 10; i++) {
        results.push(checkRateLimit(createMockRequest({ forwardedFor: ip }), config))
      }

      // First 5 should be allowed
      expect(results.slice(0, 5).every((r) => r.allowed)).toBe(true)

      // Rest should be blocked
      expect(results.slice(5).every((r) => !r.allowed)).toBe(true)
    })

    it('should maintain accurate counts under load', () => {
      const ip = `load-${testCounter}`
      const config = { maxRequests: 100, windowMs: 60000 }

      // Make exactly 100 requests
      for (let i = 0; i < 100; i++) {
        checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
      }

      // 101st should be blocked
      const result = checkRateLimit(createMockRequest({ forwardedFor: ip }), config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })
})

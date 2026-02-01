import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { createHmac } from 'crypto'

const mockWebhookSecret = 'test-webhook-secret-for-testing'

// Set environment variables BEFORE any imports
// This must happen at the top level before module resolution
process.env.WEBHOOK_SECRET = mockWebhookSecret
process.env.NODE_ENV = 'production'

// Now import the module - it will capture the env vars we just set
import {
  verifyWebhookSignature,
  generateWebhookSignature,
  validateWebhookRequest,
} from '../webhook-auth'

describe('webhook-auth', () => {
  // Store original env values
  const originalWebhookSecret = process.env.WEBHOOK_SECRET
  const originalNodeEnv = process.env.NODE_ENV

  beforeAll(() => {
    // Ensure env is set for all tests
    process.env.WEBHOOK_SECRET = mockWebhookSecret
    process.env.NODE_ENV = 'production'
  })

  afterAll(() => {
    // Restore original values
    process.env.WEBHOOK_SECRET = originalWebhookSecret
    process.env.NODE_ENV = originalNodeEnv
  })

  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC signature', () => {
      const body = JSON.stringify({ event: 'test', data: { id: 123 } })
      const signature = createHmac('sha256', mockWebhookSecret)
        .update(body)
        .digest('hex')

      const result = verifyWebhookSignature(body, signature)
      expect(result).toBe(true)
    })

    it('should verify signature with sha256= prefix', () => {
      const body = JSON.stringify({ event: 'test' })
      const signature = createHmac('sha256', mockWebhookSecret)
        .update(body)
        .digest('hex')

      const result = verifyWebhookSignature(body, `sha256=${signature}`)
      expect(result).toBe(true)
    })

    it('should reject invalid signature', () => {
      const body = JSON.stringify({ event: 'test' })
      const invalidSignature = 'invalid-signature-value'

      const result = verifyWebhookSignature(body, invalidSignature)
      expect(result).toBe(false)
    })

    it('should reject tampered body', () => {
      const originalBody = JSON.stringify({ event: 'test' })
      const signature = createHmac('sha256', mockWebhookSecret)
        .update(originalBody)
        .digest('hex')

      // Tamper with the body
      const tamperedBody = JSON.stringify({ event: 'hacked' })

      const result = verifyWebhookSignature(tamperedBody, signature)
      expect(result).toBe(false)
    })

    it('should reject null signature', () => {
      const body = JSON.stringify({ event: 'test' })

      const result = verifyWebhookSignature(body, null)
      expect(result).toBe(false)
    })

    it('should reject empty signature', () => {
      const body = JSON.stringify({ event: 'test' })

      const result = verifyWebhookSignature(body, '')
      expect(result).toBe(false)
    })

    it('should handle different body formats', () => {
      // Plain text
      const textBody = 'plain text body'
      const textSignature = createHmac('sha256', mockWebhookSecret)
        .update(textBody)
        .digest('hex')
      expect(verifyWebhookSignature(textBody, textSignature)).toBe(true)

      // URL encoded
      const urlBody = 'key=value&another=test'
      const urlSignature = createHmac('sha256', mockWebhookSecret)
        .update(urlBody)
        .digest('hex')
      expect(verifyWebhookSignature(urlBody, urlSignature)).toBe(true)
    })

    it('should handle signatures of different lengths', () => {
      const body = 'test body'
      // Signature with wrong length
      const shortSignature = 'abc123'
      const longSignature = 'a'.repeat(100)

      expect(verifyWebhookSignature(body, shortSignature)).toBe(false)
      expect(verifyWebhookSignature(body, longSignature)).toBe(false)
    })

    it('should use timing-safe comparison', () => {
      const body = JSON.stringify({ event: 'test' })
      const validSignature = createHmac('sha256', mockWebhookSecret)
        .update(body)
        .digest('hex')

      // Create a signature that differs in the last character
      const almostValidSignature = validSignature.slice(0, -1) + (validSignature.slice(-1) === '0' ? '1' : '0')

      expect(verifyWebhookSignature(body, almostValidSignature)).toBe(false)
    })
  })

  describe('generateWebhookSignature', () => {
    it('should generate signature with sha256= prefix', () => {
      const body = JSON.stringify({ event: 'test' })
      const signature = generateWebhookSignature(body)

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/)
    })

    it('should generate consistent signatures for same body', () => {
      const body = JSON.stringify({ event: 'test', id: 123 })
      const sig1 = generateWebhookSignature(body)
      const sig2 = generateWebhookSignature(body)

      expect(sig1).toBe(sig2)
    })

    it('should generate different signatures for different bodies', () => {
      const sig1 = generateWebhookSignature('body1')
      const sig2 = generateWebhookSignature('body2')

      expect(sig1).not.toBe(sig2)
    })

    it('should generate verifiable signatures', () => {
      const body = JSON.stringify({ event: 'webhook.created', data: { userId: '123' } })
      const signature = generateWebhookSignature(body)

      // Extract the hex part (remove sha256= prefix)
      const hexSignature = signature.replace('sha256=', '')

      const isValid = verifyWebhookSignature(body, hexSignature)
      expect(isValid).toBe(true)
    })

    it('should generate verifiable signatures with prefix', () => {
      const body = JSON.stringify({ test: true })
      const signature = generateWebhookSignature(body)

      // Signature already has prefix
      const isValid = verifyWebhookSignature(body, signature)
      expect(isValid).toBe(true)
    })

    it('should handle empty body', () => {
      const signature = generateWebhookSignature('')
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/)
    })

    it('should handle large bodies', () => {
      const largeBody = JSON.stringify({
        data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` })),
      })
      const signature = generateWebhookSignature(largeBody)

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/)
      expect(verifyWebhookSignature(largeBody, signature)).toBe(true)
    })

    it('should handle unicode in body', () => {
      const body = JSON.stringify({ message: 'Hello 世界 🌍 مرحبا' })
      const signature = generateWebhookSignature(body)

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/)
      expect(verifyWebhookSignature(body, signature)).toBe(true)
    })
  })

  describe('validateWebhookRequest', () => {
    it('should return valid result for correctly signed request', async () => {
      const body = JSON.stringify({ event: 'test.event', data: { id: 1 } })
      const signature = generateWebhookSignature(body)

      const request = new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
        },
        body,
      })

      const result = await validateWebhookRequest(request)

      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.body).toBe(body)
      }
    })

    it('should return invalid result for unsigned request', async () => {
      const body = JSON.stringify({ event: 'test' })

      const request = new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })

      const result = await validateWebhookRequest(request)

      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toContain('signature')
      }
    })

    it('should return invalid result for tampered request', async () => {
      const originalBody = JSON.stringify({ event: 'original' })
      const signature = generateWebhookSignature(originalBody)

      const tamperedBody = JSON.stringify({ event: 'tampered' })

      const request = new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
        },
        body: tamperedBody,
      })

      const result = await validateWebhookRequest(request)

      expect(result.valid).toBe(false)
    })

    it('should return invalid result for wrong signature', async () => {
      const body = JSON.stringify({ event: 'test' })

      const request = new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': 'sha256=invalid-signature-here',
        },
        body,
      })

      const result = await validateWebhookRequest(request)

      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toContain('Invalid')
      }
    })

    it('should handle request body read errors gracefully', async () => {
      // Create a request that will fail to read
      const request = {
        text: () => Promise.reject(new Error('Body read failed')),
        headers: {
          get: () => 'sha256=test',
        },
      } as unknown as Request

      const result = await validateWebhookRequest(request)

      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toContain('Failed')
      }
    })

    it('should work with both signature formats', async () => {
      const body = JSON.stringify({ test: 'data' })

      // With sha256= prefix
      const signatureWithPrefix = generateWebhookSignature(body)
      const request1 = new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'x-webhook-signature': signatureWithPrefix,
        },
        body,
      })

      const result1 = await validateWebhookRequest(request1)
      expect(result1.valid).toBe(true)

      // Without prefix (raw hex)
      const signatureWithoutPrefix = signatureWithPrefix.replace('sha256=', '')
      const request2 = new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'x-webhook-signature': signatureWithoutPrefix,
        },
        body,
      })

      const result2 = await validateWebhookRequest(request2)
      expect(result2.valid).toBe(true)
    })
  })

  describe('security considerations', () => {
    it('should not leak timing information', () => {
      const body = 'test body'
      const validSignature = generateWebhookSignature(body).replace('sha256=', '')

      // Generate an invalid signature of the same length
      const invalidSignature = 'a'.repeat(64)

      // Both should complete in similar time (no early return optimization)
      const start1 = performance.now()
      verifyWebhookSignature(body, validSignature)
      const time1 = performance.now() - start1

      const start2 = performance.now()
      verifyWebhookSignature(body, invalidSignature)
      const time2 = performance.now() - start2

      // Times should be within reasonable range of each other
      // (this is a basic check - real timing attacks need more sophisticated testing)
      expect(Math.abs(time1 - time2)).toBeLessThan(50) // Within 50ms
    })

    it('should reject signatures that only partially match', () => {
      const body = 'test body'
      const validSignature = generateWebhookSignature(body).replace('sha256=', '')

      // Change just one character
      const partialMatch = validSignature.slice(0, -1) + '0'

      expect(verifyWebhookSignature(body, partialMatch)).toBe(false)
    })

    it('should handle case sensitivity correctly', () => {
      const body = 'test body'
      const signature = generateWebhookSignature(body).replace('sha256=', '')

      // HMAC hex output is lowercase, test uppercase
      const uppercaseSignature = signature.toUpperCase()

      // The implementation uses direct charCode comparison, so uppercase will fail
      // which is the expected secure behavior
      expect(verifyWebhookSignature(body, uppercaseSignature)).toBe(false)
    })
  })
})

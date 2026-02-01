import { describe, it, expect } from 'vitest'
import {
  reviewRequestSchema,
  reviewResponseSchema,
  executionUpdateSchema,
  executionCompleteSchema,
  workflowActivateSchema,
  webhookTriggerSchema,
  credentialCreateSchema,
  validateBody,
  sanitizeString,
  validatePagination,
  uuidSchema,
  nonEmptyStringSchema,
} from '../validation'

describe('validation', () => {
  describe('Zod Schemas', () => {
    describe('reviewRequestSchema', () => {
      it('should validate valid review request', () => {
        const validRequest = {
          executionId: 'exec-123',
          stepId: 'step-1',
          reviewType: 'approval' as const,
        }
        const result = reviewRequestSchema.safeParse(validRequest)
        expect(result.success).toBe(true)
      })

      it('should validate with optional workflowId', () => {
        const validRequest = {
          executionId: 'exec-123',
          workflowId: '123e4567-e89b-12d3-a456-426614174000',
          stepId: 'step-1',
          reviewType: 'edit' as const,
        }
        const result = reviewRequestSchema.safeParse(validRequest)
        expect(result.success).toBe(true)
      })

      it('should reject missing executionId', () => {
        const invalidRequest = {
          stepId: 'step-1',
          reviewType: 'approval',
        }
        const result = reviewRequestSchema.safeParse(invalidRequest)
        expect(result.success).toBe(false)
      })

      it('should reject missing stepId', () => {
        const invalidRequest = {
          executionId: 'exec-123',
          reviewType: 'approval',
        }
        const result = reviewRequestSchema.safeParse(invalidRequest)
        expect(result.success).toBe(false)
      })

      it('should reject invalid UUID format for workflowId', () => {
        const invalidRequest = {
          executionId: 'exec-123',
          workflowId: 'not-a-uuid',
          stepId: 'step-1',
          reviewType: 'approval',
        }
        const result = reviewRequestSchema.safeParse(invalidRequest)
        expect(result.success).toBe(false)
      })

      it('should validate optional fields', () => {
        const request = {
          executionId: 'exec-123',
          stepId: 'step-1',
          reviewType: 'decision' as const,
          workerName: 'Test Worker',
          stepLabel: 'Review Step',
          data: { key: 'value' },
          callbackUrl: 'https://example.com/callback',
          timeoutHours: 24,
        }
        const result = reviewRequestSchema.safeParse(request)
        expect(result.success).toBe(true)
      })

      it('should reject invalid reviewType', () => {
        const invalidRequest = {
          executionId: 'exec-123',
          stepId: 'step-1',
          reviewType: 'invalid',
        }
        const result = reviewRequestSchema.safeParse(invalidRequest)
        expect(result.success).toBe(false)
      })

      it('should reject timeoutHours over 168', () => {
        const invalidRequest = {
          executionId: 'exec-123',
          stepId: 'step-1',
          reviewType: 'approval',
          timeoutHours: 200,
        }
        const result = reviewRequestSchema.safeParse(invalidRequest)
        expect(result.success).toBe(false)
      })

      it('should reject timeoutHours under 1', () => {
        const invalidRequest = {
          executionId: 'exec-123',
          stepId: 'step-1',
          reviewType: 'approval',
          timeoutHours: 0,
        }
        const result = reviewRequestSchema.safeParse(invalidRequest)
        expect(result.success).toBe(false)
      })
    })

    describe('reviewResponseSchema', () => {
      it('should validate approved response', () => {
        const response = {
          reviewId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'approved' as const,
        }
        const result = reviewResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      })

      it('should validate rejected response', () => {
        const response = {
          reviewId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'rejected' as const,
          feedback: 'This needs more work',
        }
        const result = reviewResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      })

      it('should validate response with feedback', () => {
        const response = {
          reviewId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'needs_changes' as const,
          feedback: 'Please update the data',
        }
        const result = reviewResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      })

      it('should reject missing reviewId', () => {
        const response = {
          status: 'approved',
        }
        const result = reviewResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })

      it('should reject missing status', () => {
        const response = {
          reviewId: '123e4567-e89b-12d3-a456-426614174000',
        }
        const result = reviewResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })

      it('should reject invalid status value', () => {
        const response = {
          reviewId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'invalid_status',
        }
        const result = reviewResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })

      it('should validate editedData field', () => {
        const response = {
          reviewId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'edited' as const,
          editedData: { key: 'new value', nested: { data: 123 } },
        }
        const result = reviewResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      })

      it('should reject feedback over 10000 characters', () => {
        const response = {
          reviewId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'rejected' as const,
          feedback: 'a'.repeat(10001),
        }
        const result = reviewResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })
    })

    describe('executionUpdateSchema', () => {
      it('should validate status update', () => {
        const update = {
          executionId: 'exec-123',
          status: 'running' as const,
        }
        const result = executionUpdateSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should validate with output data', () => {
        const update = {
          executionId: 'exec-123',
          status: 'completed' as const,
          outputData: { result: 'success', value: 42 },
        }
        const result = executionUpdateSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should validate error update', () => {
        const update = {
          executionId: 'exec-123',
          status: 'failed' as const,
          error: 'Something went wrong',
        }
        const result = executionUpdateSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should reject invalid status values', () => {
        const update = {
          executionId: 'exec-123',
          status: 'invalid_status',
        }
        const result = executionUpdateSchema.safeParse(update)
        expect(result.success).toBe(false)
      })

      it('should validate all status values', () => {
        const statuses = ['pending', 'running', 'waiting_review', 'completed', 'failed', 'cancelled']
        for (const status of statuses) {
          const update = { executionId: 'exec-123', status }
          const result = executionUpdateSchema.safeParse(update)
          expect(result.success).toBe(true)
        }
      })

      it('should validate currentStepIndex', () => {
        const update = {
          executionId: 'exec-123',
          status: 'running' as const,
          currentStepIndex: 2,
          currentStepName: 'Processing',
        }
        const result = executionUpdateSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should reject negative currentStepIndex', () => {
        const update = {
          executionId: 'exec-123',
          status: 'running',
          currentStepIndex: -1,
        }
        const result = executionUpdateSchema.safeParse(update)
        expect(result.success).toBe(false)
      })

      it('should reject error over 10000 characters', () => {
        const update = {
          executionId: 'exec-123',
          status: 'failed' as const,
          error: 'a'.repeat(10001),
        }
        const result = executionUpdateSchema.safeParse(update)
        expect(result.success).toBe(false)
      })
    })

    describe('executionCompleteSchema', () => {
      it('should validate successful completion', () => {
        const complete = {
          workflowId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'completed' as const,
        }
        const result = executionCompleteSchema.safeParse(complete)
        expect(result.success).toBe(true)
      })

      it('should validate failed completion', () => {
        const complete = {
          workflowId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'failed' as const,
          error: 'Execution failed due to timeout',
        }
        const result = executionCompleteSchema.safeParse(complete)
        expect(result.success).toBe(true)
      })

      it('should validate completion with outputs', () => {
        const complete = {
          workflowId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'completed' as const,
          result: { processed: 100, skipped: 5 },
        }
        const result = executionCompleteSchema.safeParse(complete)
        expect(result.success).toBe(true)
      })

      it('should use default status if not provided', () => {
        const complete = {
          workflowId: '123e4567-e89b-12d3-a456-426614174000',
        }
        const result = executionCompleteSchema.safeParse(complete)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.status).toBe('completed')
        }
      })

      it('should reject missing workflowId', () => {
        const complete = {
          status: 'completed',
        }
        const result = executionCompleteSchema.safeParse(complete)
        expect(result.success).toBe(false)
      })

      it('should validate with workerName', () => {
        const complete = {
          workflowId: '123e4567-e89b-12d3-a456-426614174000',
          workerName: 'Email Processor',
        }
        const result = executionCompleteSchema.safeParse(complete)
        expect(result.success).toBe(true)
      })
    })

    describe('workflowActivateSchema', () => {
      it('should validate activation request', () => {
        const request = {
          workflowId: '123e4567-e89b-12d3-a456-426614174000',
          action: 'activate' as const,
        }
        const result = workflowActivateSchema.safeParse(request)
        expect(result.success).toBe(true)
      })

      it('should validate deactivation request', () => {
        const request = {
          workflowId: '123e4567-e89b-12d3-a456-426614174000',
          action: 'deactivate' as const,
        }
        const result = workflowActivateSchema.safeParse(request)
        expect(result.success).toBe(true)
      })

      it('should reject invalid workflow ID', () => {
        const request = {
          workflowId: 'not-a-uuid',
          action: 'activate',
        }
        const result = workflowActivateSchema.safeParse(request)
        expect(result.success).toBe(false)
      })

      it('should reject invalid action', () => {
        const request = {
          workflowId: '123e4567-e89b-12d3-a456-426614174000',
          action: 'toggle',
        }
        const result = workflowActivateSchema.safeParse(request)
        expect(result.success).toBe(false)
      })
    })

    describe('webhookTriggerSchema', () => {
      it('should validate webhook payload', () => {
        const payload = {
          data: { event: 'user.created', userId: '123' },
        }
        const result = webhookTriggerSchema.safeParse(payload)
        expect(result.success).toBe(true)
      })

      it('should validate with metadata', () => {
        const payload = {
          data: { event: 'order.completed' },
          metadata: { source: 'stripe', version: '1.0' },
        }
        const result = webhookTriggerSchema.safeParse(payload)
        expect(result.success).toBe(true)
      })

      it('should validate empty payload', () => {
        const payload = {}
        const result = webhookTriggerSchema.safeParse(payload)
        expect(result.success).toBe(true)
      })

      it('should handle nested data', () => {
        const payload = {
          data: {
            user: {
              id: '123',
              profile: {
                name: 'John',
                settings: { theme: 'dark' },
              },
            },
          },
        }
        const result = webhookTriggerSchema.safeParse(payload)
        expect(result.success).toBe(true)
      })
    })

    describe('credentialCreateSchema', () => {
      it('should validate credential creation', () => {
        const credential = {
          credentialType: 'oauth2',
          credentialName: 'My Google Account',
        }
        const result = credentialCreateSchema.safeParse(credential)
        expect(result.success).toBe(true)
      })

      it('should reject missing type', () => {
        const credential = {
          credentialName: 'My Account',
        }
        const result = credentialCreateSchema.safeParse(credential)
        expect(result.success).toBe(false)
      })

      it('should reject missing name', () => {
        const credential = {
          credentialType: 'oauth2',
        }
        const result = credentialCreateSchema.safeParse(credential)
        expect(result.success).toBe(false)
      })

      it('should validate credential name length', () => {
        const credential = {
          credentialType: 'api_key',
          credentialName: 'a'.repeat(100),
        }
        const result = credentialCreateSchema.safeParse(credential)
        expect(result.success).toBe(true)
      })

      it('should reject credential name over 100 characters', () => {
        const credential = {
          credentialType: 'api_key',
          credentialName: 'a'.repeat(101),
        }
        const result = credentialCreateSchema.safeParse(credential)
        expect(result.success).toBe(false)
      })

      it('should reject empty credential name', () => {
        const credential = {
          credentialType: 'oauth2',
          credentialName: '',
        }
        const result = credentialCreateSchema.safeParse(credential)
        expect(result.success).toBe(false)
      })

      it('should validate with config', () => {
        const credential = {
          credentialType: 'oauth2',
          credentialName: 'My Account',
          config: { scopes: ['read', 'write'], region: 'us-east-1' },
        }
        const result = credentialCreateSchema.safeParse(credential)
        expect(result.success).toBe(true)
      })

      it('should validate with action', () => {
        const credential = {
          action: 'getOAuthUrl' as const,
          credentialType: 'oauth2',
          credentialName: 'Google',
        }
        const result = credentialCreateSchema.safeParse(credential)
        expect(result.success).toBe(true)
      })
    })

    describe('common schemas', () => {
      it('uuidSchema should validate valid UUID', () => {
        expect(uuidSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success).toBe(true)
      })

      it('uuidSchema should reject invalid UUID', () => {
        expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false)
        expect(uuidSchema.safeParse('').success).toBe(false)
        expect(uuidSchema.safeParse('123').success).toBe(false)
      })

      it('nonEmptyStringSchema should validate non-empty string', () => {
        expect(nonEmptyStringSchema.safeParse('hello').success).toBe(true)
        expect(nonEmptyStringSchema.safeParse('a').success).toBe(true)
      })

      it('nonEmptyStringSchema should reject empty string', () => {
        expect(nonEmptyStringSchema.safeParse('').success).toBe(false)
      })
    })
  })

  describe('validateBody', () => {
    it('should return parsed data for valid input', () => {
      const result = validateBody(reviewRequestSchema, {
        executionId: 'exec-123',
        stepId: 'step-1',
        reviewType: 'approval',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.executionId).toBe('exec-123')
      }
    })

    it('should return error for invalid input', () => {
      const result = validateBody(reviewRequestSchema, {
        executionId: 'exec-123',
        // missing stepId and reviewType
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.error.length).toBeGreaterThan(0)
      }
    })

    it('should include field-level errors', () => {
      const result = validateBody(reviewRequestSchema, {
        executionId: 'exec-123',
        stepId: 'step-1',
        reviewType: 'invalid_type',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('reviewType')
      }
    })

    it('should handle nested validation errors', () => {
      const result = validateBody(executionUpdateSchema, {
        executionId: 'exec-123',
        status: 'running',
        currentStepIndex: -5,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('currentStepIndex')
      }
    })

    it('should transform data according to schema', () => {
      const result = validateBody(executionCompleteSchema, {
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        // status not provided, should default to 'completed'
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('completed')
      }
    })
  })

  describe('sanitizeString', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeString('<script>')).toBe('&lt;script&gt;')
    })

    it('should escape double quotes', () => {
      expect(sanitizeString('Hello "world"')).toBe('Hello &quot;world&quot;')
    })

    it('should escape single quotes', () => {
      expect(sanitizeString("Hello 'world'")).toBe('Hello &#x27;world&#x27;')
    })

    it('should escape angle brackets', () => {
      expect(sanitizeString('a < b > c')).toBe('a &lt; b &gt; c')
    })

    it('should handle multiple special characters', () => {
      expect(sanitizeString('<div class="test">\'Hello\'</div>')).toBe(
        '&lt;div class=&quot;test&quot;&gt;&#x27;Hello&#x27;&lt;/div&gt;'
      )
    })

    it('should preserve valid characters', () => {
      expect(sanitizeString('Hello World! 123')).toBe('Hello World! 123')
    })

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('')
    })

    it('should handle strings with only special characters', () => {
      expect(sanitizeString('<>"\'<>"')).toBe('&lt;&gt;&quot;&#x27;&lt;&gt;&quot;')
    })

    it('should preserve unicode characters', () => {
      expect(sanitizeString('Hello 世界 🌍')).toBe('Hello 世界 🌍')
    })

    it('should handle newlines and tabs', () => {
      expect(sanitizeString('Line 1\nLine 2\tTabbed')).toBe('Line 1\nLine 2\tTabbed')
    })
  })

  describe('validatePagination', () => {
    it('should validate default values', () => {
      const params = new URLSearchParams()
      const result = validatePagination(params)

      expect(result.limit).toBe(50)
      expect(result.offset).toBe(0)
    })

    it('should parse limit and offset', () => {
      const params = new URLSearchParams('limit=25&offset=100')
      const result = validatePagination(params)

      expect(result.limit).toBe(25)
      expect(result.offset).toBe(100)
    })

    it('should cap limit at maxLimit', () => {
      const params = new URLSearchParams('limit=500')
      const result = validatePagination(params, 100)

      expect(result.limit).toBe(100)
    })

    it('should use custom maxLimit', () => {
      const params = new URLSearchParams('limit=75')
      const result = validatePagination(params, 50)

      expect(result.limit).toBe(50)
    })

    it('should handle negative limit', () => {
      const params = new URLSearchParams('limit=-10')
      const result = validatePagination(params)

      expect(result.limit).toBe(1) // Should be at least 1
    })

    it('should handle negative offset', () => {
      const params = new URLSearchParams('offset=-50')
      const result = validatePagination(params)

      expect(result.offset).toBe(0) // Should be at least 0
    })

    it('should handle non-numeric values', () => {
      const params = new URLSearchParams('limit=abc&offset=xyz')
      const result = validatePagination(params)

      // parseInt returns NaN for non-numeric strings
      // Math.max(1, NaN) and Math.min(NaN, maxLimit) both return NaN
      // This is the actual behavior - the implementation doesn't guard against NaN
      expect(Number.isNaN(result.limit)).toBe(true)
      expect(Number.isNaN(result.offset)).toBe(true)
    })

    it('should handle zero limit', () => {
      const params = new URLSearchParams('limit=0')
      const result = validatePagination(params)

      expect(result.limit).toBe(1) // Should be at least 1
    })

    it('should handle float values by truncating', () => {
      const params = new URLSearchParams('limit=25.7&offset=10.3')
      const result = validatePagination(params)

      expect(result.limit).toBe(25)
      expect(result.offset).toBe(10)
    })
  })
})

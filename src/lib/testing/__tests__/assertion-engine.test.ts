/**
 * Assertion Engine Tests
 * Tests for the test assertion engine
 */

import { describe, it, expect } from 'vitest'
import type { TestAssertion } from '@/types/testing'

describe('AssertionEngine', () => {
  describe('evaluateAssertion', () => {
    describe('equals assertion', () => {
      it('should pass when values are equal', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check status',
          type: 'equals',
          path: 'status',
          expectedValue: 'success',
        }

        const result = evaluateAssertion(assertion, { status: 'success' })

        expect(result.passed).toBe(true)
      })

      it('should fail when values are not equal', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check status',
          type: 'equals',
          path: 'status',
          expectedValue: 'success',
        }

        const result = evaluateAssertion(assertion, { status: 'failed' })

        expect(result.passed).toBe(false)
        expect(result.message).toContain('Expected')
      })

      it('should handle nested paths', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check nested',
          type: 'equals',
          path: 'data.user.name',
          expectedValue: 'John',
        }

        const result = evaluateAssertion(assertion, { data: { user: { name: 'John' } } })

        expect(result.passed).toBe(true)
      })

      it('should handle array index paths', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check array item',
          type: 'equals',
          path: 'items[0].id',
          expectedValue: '123',
        }

        const result = evaluateAssertion(assertion, { items: [{ id: '123' }, { id: '456' }] })

        expect(result.passed).toBe(true)
      })

      it('should perform deep equality for objects', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check object',
          type: 'equals',
          path: 'config',
          expectedValue: { timeout: 5000, retries: 3 },
        }

        const result = evaluateAssertion(assertion, { config: { timeout: 5000, retries: 3 } })

        expect(result.passed).toBe(true)
      })
    })

    describe('notEquals assertion', () => {
      it('should pass when values are different', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check not error',
          type: 'notEquals',
          path: 'status',
          expectedValue: 'error',
        }

        const result = evaluateAssertion(assertion, { status: 'success' })

        expect(result.passed).toBe(true)
      })

      it('should fail when values are equal', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check not success',
          type: 'notEquals',
          path: 'status',
          expectedValue: 'success',
        }

        const result = evaluateAssertion(assertion, { status: 'success' })

        expect(result.passed).toBe(false)
      })
    })

    describe('contains assertion', () => {
      it('should pass when string contains substring', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check message',
          type: 'contains',
          path: 'message',
          expectedValue: 'success',
        }

        const result = evaluateAssertion(assertion, { message: 'Operation completed successfully' })

        expect(result.passed).toBe(true)
      })

      it('should fail when string does not contain substring', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check message',
          type: 'contains',
          path: 'message',
          expectedValue: 'error',
        }

        const result = evaluateAssertion(assertion, { message: 'Operation completed successfully' })

        expect(result.passed).toBe(false)
      })

      it('should pass when array contains element', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check tags',
          type: 'contains',
          path: 'tags',
          expectedValue: 'important',
        }

        const result = evaluateAssertion(assertion, { tags: ['urgent', 'important', 'work'] })

        expect(result.passed).toBe(true)
      })
    })

    describe('greaterThan assertion', () => {
      it('should pass when value is greater', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check count',
          type: 'greaterThan',
          path: 'count',
          expectedValue: 10,
        }

        const result = evaluateAssertion(assertion, { count: 15 })

        expect(result.passed).toBe(true)
      })

      it('should fail when value is not greater', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check count',
          type: 'greaterThan',
          path: 'count',
          expectedValue: 10,
        }

        const result = evaluateAssertion(assertion, { count: 5 })

        expect(result.passed).toBe(false)
      })
    })

    describe('lessThan assertion', () => {
      it('should pass when value is less', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check duration',
          type: 'lessThan',
          path: 'duration',
          expectedValue: 1000,
        }

        const result = evaluateAssertion(assertion, { duration: 500 })

        expect(result.passed).toBe(true)
      })
    })

    describe('isNull assertion', () => {
      it('should pass when value is null', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check null',
          type: 'isNull',
          path: 'data',
        }

        const result = evaluateAssertion(assertion, { data: null })

        expect(result.passed).toBe(true)
      })

      it('should pass when value is undefined', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check undefined',
          type: 'isNull',
          path: 'missing',
        }

        const result = evaluateAssertion(assertion, {})

        expect(result.passed).toBe(true)
      })
    })

    describe('isNotNull assertion', () => {
      it('should pass when value exists', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check exists',
          type: 'isNotNull',
          path: 'data',
        }

        const result = evaluateAssertion(assertion, { data: { id: '123' } })

        expect(result.passed).toBe(true)
      })

      it('should fail when value is null', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check exists',
          type: 'isNotNull',
          path: 'data',
        }

        const result = evaluateAssertion(assertion, { data: null })

        expect(result.passed).toBe(false)
      })
    })

    describe('isEmpty assertion', () => {
      it('should pass for empty string', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check empty',
          type: 'isEmpty',
          path: 'text',
        }

        const result = evaluateAssertion(assertion, { text: '' })

        expect(result.passed).toBe(true)
      })

      it('should pass for empty array', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check empty',
          type: 'isEmpty',
          path: 'items',
        }

        const result = evaluateAssertion(assertion, { items: [] })

        expect(result.passed).toBe(true)
      })
    })

    describe('isTrue assertion', () => {
      it('should pass for true value', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check true',
          type: 'isTrue',
          path: 'active',
        }

        const result = evaluateAssertion(assertion, { active: true })

        expect(result.passed).toBe(true)
      })
    })

    describe('isFalse assertion', () => {
      it('should pass for false value', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check false',
          type: 'isFalse',
          path: 'disabled',
        }

        const result = evaluateAssertion(assertion, { disabled: false })

        expect(result.passed).toBe(true)
      })
    })

    describe('hasProperty assertion', () => {
      it('should pass when object has property', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check property',
          type: 'hasProperty',
          path: 'user',
          expectedValue: 'name',
        }

        const result = evaluateAssertion(assertion, { user: { name: 'John', age: 30 } })

        expect(result.passed).toBe(true)
      })
    })

    describe('hasLength assertion', () => {
      it('should pass when array has expected length', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check length',
          type: 'hasLength',
          path: 'items',
          expectedValue: 3,
        }

        const result = evaluateAssertion(assertion, { items: [1, 2, 3] })

        expect(result.passed).toBe(true)
      })
    })

    describe('step outputs', () => {
      it('should use step outputs when stepId is provided', async () => {
        const { evaluateAssertion } = await import('../assertion-engine')
        const assertion: TestAssertion = {
          id: 'a1',
          name: 'Check step output',
          type: 'equals',
          path: 'result',
          expectedValue: 'done',
          stepId: 'step-1',
        }

        const stepOutputs = {
          'step-1': { result: 'done' },
          'step-2': { result: 'pending' },
        }

        const result = evaluateAssertion(assertion, { final: 'output' }, stepOutputs)

        expect(result.passed).toBe(true)
      })
    })
  })

  describe('evaluateAllAssertions', () => {
    it('should evaluate multiple assertions', async () => {
      const { evaluateAllAssertions } = await import('../assertion-engine')
      const assertions: TestAssertion[] = [
        { id: 'a1', name: 'Check status', type: 'equals', path: 'status', expectedValue: 'success' },
        { id: 'a2', name: 'Check data', type: 'isNotNull', path: 'data' },
        { id: 'a3', name: 'Check count', type: 'greaterThan', path: 'count', expectedValue: 0 },
      ]

      const result = evaluateAllAssertions(
        assertions,
        { status: 'success', data: { id: '123' }, count: 5 },
        {}
      )

      expect(result.passed).toBe(3)
      expect(result.failed).toBe(0)
      expect(result.total).toBe(3)
    })

    it('should return all results even with failures', async () => {
      const { evaluateAllAssertions } = await import('../assertion-engine')
      const assertions: TestAssertion[] = [
        { id: 'a1', name: 'Pass', type: 'equals', path: 'status', expectedValue: 'success' },
        { id: 'a2', name: 'Fail', type: 'equals', path: 'status', expectedValue: 'failed' },
      ]

      const result = evaluateAllAssertions(assertions, { status: 'success' }, {})

      expect(result.results.length).toBe(2)
      expect(result.passed).toBe(1)
      expect(result.failed).toBe(1)
    })

    it('should handle empty assertions array', async () => {
      const { evaluateAllAssertions } = await import('../assertion-engine')

      const result = evaluateAllAssertions([], { data: 'test' }, {})

      expect(result.results).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('getAssertionTypes', () => {
    it('should return available assertion types', async () => {
      const { getAssertionTypes } = await import('../assertion-engine')

      const types = getAssertionTypes()

      expect(types.length).toBeGreaterThan(0)
      expect(types.find(t => t.type === 'equals')).toBeDefined()
      expect(types.find(t => t.type === 'contains')).toBeDefined()
      expect(types.find(t => t.type === 'greaterThan')).toBeDefined()
    })

    it('should include descriptions for each type', async () => {
      const { getAssertionTypes } = await import('../assertion-engine')

      const types = getAssertionTypes()

      types.forEach(type => {
        expect(type.label).toBeDefined()
        expect(type.description).toBeDefined()
        expect(typeof type.requiresExpectedValue).toBe('boolean')
      })
    })
  })
})

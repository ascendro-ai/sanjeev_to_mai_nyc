/**
 * Execution Service Tests
 * Tests for the test execution service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: 'test-case-123',
                workflow_id: 'workflow-123',
                input_data: { email: 'test@example.com' },
                expected_output: { status: 'sent' },
                assertions: [{ type: 'equals', path: 'status', expected: 'sent' }],
              },
              error: null,
            })
          ),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: 'run-123', status: 'pending' },
              error: null,
            })
          ),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}))

vi.mock('@/lib/n8n/client', () => ({
  executeWorkflow: vi.fn(() =>
    Promise.resolve({
      executionId: 'exec-123',
      status: 'completed',
      output: { status: 'sent' },
    })
  ),
}))

describe('ExecutionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('executeTestCase', () => {
    it('should execute a test case', async () => {
      const { executeTestCase } = await import('../execution-service')
      const result = await executeTestCase({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })

      expect(result).toBeDefined()
      expect(result.status).toBeDefined()
    })

    it('should use test case input data', async () => {
      const { executeWorkflow } = await import('@/lib/n8n/client')
      const { executeTestCase } = await import('../execution-service')

      await executeTestCase({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })

      expect(executeWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ email: 'test@example.com' }),
        })
      )
    })

    it('should evaluate assertions', async () => {
      const { executeTestCase } = await import('../execution-service')
      const result = await executeTestCase({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })

      expect(result.assertions).toBeDefined()
      expect(Array.isArray(result.assertions)).toBe(true)
    })

    it('should return pass/fail status based on assertions', async () => {
      const { executeTestCase } = await import('../execution-service')
      const result = await executeTestCase({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })

      expect(typeof result.passed).toBe('boolean')
    })

    it('should record execution time', async () => {
      const { executeTestCase } = await import('../execution-service')
      const result = await executeTestCase({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })

      expect(result.duration).toBeDefined()
      expect(typeof result.duration).toBe('number')
    })
  })

  describe('executeTestSuite', () => {
    it('should execute multiple test cases', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: 'tc-1',
                    workflow_id: 'workflow-123',
                    input_data: {},
                    expected_output: {},
                    assertions: [],
                  },
                  error: null,
                })
              ),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: { id: 'run-123' }, error: null })
              ),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      } as never)

      const { executeTestSuite } = await import('../execution-service')
      const results = await executeTestSuite({
        testCaseIds: ['tc-1', 'tc-2', 'tc-3'],
        workflowId: 'workflow-123',
      })

      expect(results.results).toBeDefined()
      expect(Array.isArray(results.results)).toBe(true)
    })

    it('should calculate overall pass rate', async () => {
      const { executeTestSuite } = await import('../execution-service')
      const results = await executeTestSuite({
        testCaseIds: ['tc-1', 'tc-2'],
        workflowId: 'workflow-123',
      })

      expect(results.passRate).toBeDefined()
      expect(typeof results.passRate).toBe('number')
    })

    it('should calculate total duration', async () => {
      const { executeTestSuite } = await import('../execution-service')
      const results = await executeTestSuite({
        testCaseIds: ['tc-1', 'tc-2'],
        workflowId: 'workflow-123',
      })

      expect(results.totalDuration).toBeDefined()
    })

    it('should run tests in parallel when specified', async () => {
      const { executeTestSuite } = await import('../execution-service')
      const startTime = Date.now()

      await executeTestSuite({
        testCaseIds: ['tc-1', 'tc-2', 'tc-3'],
        workflowId: 'workflow-123',
        parallel: true,
      })

      const duration = Date.now() - startTime
      // Parallel should be faster than sequential
      expect(duration).toBeLessThan(3000)
    })

    it('should run tests sequentially when not parallel', async () => {
      const { executeTestSuite } = await import('../execution-service')

      const results = await executeTestSuite({
        testCaseIds: ['tc-1', 'tc-2'],
        workflowId: 'workflow-123',
        parallel: false,
      })

      expect(results.results).toBeDefined()
    })
  })

  describe('mock data handling', () => {
    it('should use mock data when provided', async () => {
      const { executeWorkflow } = await import('@/lib/n8n/client')
      const { executeTestCase } = await import('../execution-service')

      await executeTestCase({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
        mockData: {
          externalApi: { response: 'mocked' },
        },
      })

      expect(executeWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          mockData: expect.objectContaining({
            externalApi: { response: 'mocked' },
          }),
        })
      )
    })

    it('should override external calls with mocks', async () => {
      const { executeTestCase } = await import('../execution-service')
      const result = await executeTestCase({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
        mockData: {
          httpRequest: { status: 200, body: { data: 'mocked' } },
        },
      })

      expect(result).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle workflow execution errors', async () => {
      const { executeWorkflow } = await import('@/lib/n8n/client')
      vi.mocked(executeWorkflow).mockRejectedValueOnce(new Error('Workflow failed'))

      const { executeTestCase } = await import('../execution-service')
      const result = await executeTestCase({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })

      expect(result.passed).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle missing test case', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { code: 'PGRST116', message: 'Not found' },
                })
              ),
            })),
          })),
        })),
      } as never)

      const { executeTestCase } = await import('../execution-service')

      await expect(
        executeTestCase({
          testCaseId: 'non-existent',
          workflowId: 'workflow-123',
        })
      ).rejects.toThrow(/not found/i)
    })

    it('should handle timeout', async () => {
      const { executeWorkflow } = await import('@/lib/n8n/client')
      vi.mocked(executeWorkflow).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      )

      const { executeTestCase } = await import('../execution-service')

      await expect(
        executeTestCase({
          testCaseId: 'test-case-123',
          workflowId: 'workflow-123',
          timeout: 100,
        })
      ).rejects.toThrow(/timeout/i)
    })
  })

  describe('recording results', () => {
    it('should save test run to database', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const insertMock = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: { id: 'run-123' }, error: null })
          ),
        })),
      }))
      vi.mocked(createClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: 'tc-1',
                    workflow_id: 'workflow-123',
                    input_data: {},
                    expected_output: {},
                    assertions: [],
                  },
                  error: null,
                })
              ),
            })),
          })),
          insert: insertMock,
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      } as never)

      const { executeTestCase } = await import('../execution-service')
      await executeTestCase({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })

      expect(insertMock).toHaveBeenCalled()
    })

    it('should update test run status on completion', async () => {
      const updateMock = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      }))
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: 'tc-1',
                    workflow_id: 'workflow-123',
                    input_data: {},
                    expected_output: {},
                    assertions: [],
                  },
                  error: null,
                })
              ),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: { id: 'run-123' }, error: null })
              ),
            })),
          })),
          update: updateMock,
        })),
      } as never)

      const { executeTestCase } = await import('../execution-service')
      await executeTestCase({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })

      expect(updateMock).toHaveBeenCalled()
    })
  })
})

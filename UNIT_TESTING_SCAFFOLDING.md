# Comprehensive Unit Testing Scaffolding Plan

## Overview

This document provides granular, comprehensive unit test scaffolding for the entire codebase. It covers ~940 individual test cases across all modules, organized by priority and module type.

**Testing Framework:** Vitest v3.2.4 + React Testing Library + MSW
**Coverage Targets:** Lines: 80%, Statements: 80%, Functions: 75%, Branches: 70%

---

## Phase 1: Security & Validation Tests (HIGHEST PRIORITY)

These new security modules are critical and need immediate test coverage.

### 1.1 PII Filter Tests (`src/lib/__tests__/pii-filter.test.ts`)

**Source:** `src/lib/pii-filter.ts` (193 lines)

```typescript
describe('pii-filter', () => {
  describe('filterPII', () => {
    describe('email detection and redaction', () => {
      it('should redact simple email addresses')
      it('should redact emails with subdomains')
      it('should redact multiple emails in same string')
      it('should handle emails in nested objects')
      it('should preserve non-email @ symbols')
    })

    describe('phone number detection and redaction', () => {
      it('should redact US phone numbers (xxx-xxx-xxxx)')
      it('should redact US phone numbers ((xxx) xxx-xxxx)')
      it('should redact international phone numbers (+1-xxx-xxx-xxxx)')
      it('should redact phone numbers with extensions')
      it('should not redact number sequences that are not phones')
    })

    describe('SSN detection and redaction', () => {
      it('should redact SSN format (xxx-xx-xxxx)')
      it('should redact SSN without dashes')
      it('should not redact similar but invalid patterns')
    })

    describe('credit card detection and redaction', () => {
      it('should redact Visa card numbers')
      it('should redact Mastercard numbers')
      it('should redact Amex card numbers')
      it('should redact cards with spaces or dashes')
      it('should not redact numbers that fail Luhn check')
    })

    describe('address detection and redaction', () => {
      it('should redact street addresses')
      it('should redact PO Box addresses')
      it('should handle multi-line addresses')
    })

    describe('name detection in sensitive keys', () => {
      it('should redact values in keys containing "name"')
      it('should redact values in keys containing "fullName"')
      it('should redact values in keys containing "firstName"')
      it('should redact values in keys containing "lastName"')
      it('should not redact "name" keys that are product names')
    })

    describe('nested object handling', () => {
      it('should recursively filter nested objects')
      it('should handle arrays of objects')
      it('should handle arrays of strings')
      it('should respect maxDepth limit')
      it('should handle circular references gracefully')
      it('should preserve object structure')
    })

    describe('edge cases', () => {
      it('should handle null values')
      it('should handle undefined values')
      it('should handle empty strings')
      it('should handle empty objects')
      it('should handle empty arrays')
      it('should return primitives unchanged')
    })
  })

  describe('createSafeDataForAI', () => {
    it('should filter PII from data before AI processing')
    it('should include metadata about redactions')
    it('should preserve data types')
    it('should handle large payloads efficiently')
  })

  describe('containsSensitiveData', () => {
    it('should return true when PII is present')
    it('should return false when no PII is present')
    it('should check nested structures')
    it('should be fast for large payloads')
  })

  describe('warnIfSensitiveData', () => {
    it('should log warning when sensitive data detected')
    it('should not log when no sensitive data')
    it('should include context in warning message')
  })
})
```

**Test Count:** ~45 tests

---

### 1.2 Rate Limit Tests (`src/lib/__tests__/rate-limit.test.ts`)

**Source:** `src/lib/rate-limit.ts` (238 lines)

```typescript
describe('rate-limit', () => {
  describe('checkRateLimit', () => {
    describe('basic rate limiting', () => {
      it('should allow requests under the limit')
      it('should block requests over the limit')
      it('should track requests per unique key')
      it('should reset count after window expires')
    })

    describe('window management', () => {
      it('should use sliding window algorithm')
      it('should correctly calculate remaining requests')
      it('should return correct reset timestamp')
      it('should handle window boundary edge cases')
    })

    describe('key extraction', () => {
      it('should extract IP from x-forwarded-for header')
      it('should extract IP from x-real-ip header')
      it('should fallback to connection remote address')
      it('should use custom key when provided')
      it('should handle missing IP gracefully')
    })

    describe('configuration options', () => {
      it('should respect custom limit')
      it('should respect custom window size')
      it('should apply different limits per route')
    })
  })

  describe('rateLimitResponse', () => {
    it('should return 429 status code')
    it('should include Retry-After header')
    it('should include X-RateLimit-Limit header')
    it('should include X-RateLimit-Remaining header')
    it('should include X-RateLimit-Reset header')
    it('should return JSON error body')
  })

  describe('createRateLimiter', () => {
    it('should create limiter with default options')
    it('should create limiter with custom options')
    it('should share state across multiple calls')
    it('should isolate state between different limiters')
  })

  describe('applyRateLimit middleware', () => {
    it('should pass through allowed requests')
    it('should block rate-limited requests')
    it('should add rate limit headers to response')
    it('should work with async handlers')
  })

  describe('cleanup and memory management', () => {
    it('should cleanup expired entries')
    it('should run cleanup on interval')
    it('should not leak memory over time')
    it('should handle high request volume')
  })

  describe('concurrent request handling', () => {
    it('should handle concurrent requests correctly')
    it('should maintain accurate counts under load')
    it('should not have race conditions')
  })
})
```

**Test Count:** ~40 tests

---

### 1.3 Validation Tests (`src/lib/__tests__/validation.test.ts`)

**Source:** `src/lib/validation.ts` (150 lines)

```typescript
describe('validation', () => {
  describe('Zod Schemas', () => {
    describe('reviewRequestSchema', () => {
      it('should validate valid review request')
      it('should reject missing workflowId')
      it('should reject missing executionId')
      it('should reject missing stepId')
      it('should reject invalid UUID format')
      it('should validate optional fields')
      it('should reject extra unknown fields')
    })

    describe('reviewResponseSchema', () => {
      it('should validate approved response')
      it('should validate rejected response')
      it('should validate response with feedback')
      it('should reject missing decision')
      it('should reject invalid decision value')
      it('should validate modified data field')
    })

    describe('executionUpdateSchema', () => {
      it('should validate status update')
      it('should validate output update')
      it('should validate error update')
      it('should reject invalid status values')
      it('should validate timestamp format')
    })

    describe('executionCompleteSchema', () => {
      it('should validate successful completion')
      it('should validate failed completion')
      it('should validate completion with outputs')
      it('should reject missing required fields')
    })

    describe('workflowActivateSchema', () => {
      it('should validate activation request')
      it('should validate with settings object')
      it('should reject invalid workflow ID')
    })

    describe('webhookTriggerSchema', () => {
      it('should validate webhook payload')
      it('should validate with custom headers')
      it('should reject oversized payloads')
      it('should handle nested data')
    })

    describe('credentialCreateSchema', () => {
      it('should validate credential creation')
      it('should reject missing type')
      it('should reject missing data')
      it('should validate credential name')
      it('should reject invalid credential types')
    })
  })

  describe('validateBody', () => {
    it('should return parsed data for valid input')
    it('should throw ZodError for invalid input')
    it('should include field-level errors')
    it('should handle async validation')
  })

  describe('sanitizeString', () => {
    it('should trim whitespace')
    it('should escape HTML entities')
    it('should remove null bytes')
    it('should handle unicode')
    it('should preserve valid characters')
    it('should handle empty strings')
  })

  describe('validatePagination', () => {
    it('should validate page number')
    it('should validate page size')
    it('should apply default values')
    it('should cap maximum page size')
    it('should reject negative values')
    it('should reject non-integer values')
  })
})
```

**Test Count:** ~50 tests

---

### 1.4 Webhook Auth Tests (`src/lib/n8n/__tests__/webhook-auth.test.ts`)

**Source:** `src/lib/n8n/webhook-auth.ts`

```typescript
describe('webhook-auth', () => {
  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC signature')
    it('should reject invalid signature')
    it('should reject expired timestamp')
    it('should reject replay attacks')
    it('should handle different hash algorithms')
  })

  describe('generateWebhookSecret', () => {
    it('should generate cryptographically secure secret')
    it('should generate unique secrets each call')
    it('should meet minimum length requirements')
  })

  describe('createSignedPayload', () => {
    it('should include timestamp in signature')
    it('should sign payload correctly')
    it('should work with JSON payloads')
    it('should work with string payloads')
  })

  describe('webhookAuthMiddleware', () => {
    it('should pass through valid signed requests')
    it('should reject unsigned requests')
    it('should reject tampered payloads')
    it('should return appropriate error codes')
  })
})
```

**Test Count:** ~20 tests

---

## Phase 2: API Route Tests (HIGH PRIORITY)

### 2.1 N8N API Routes

#### 2.1.1 Activate Route (`src/app/api/n8n/__tests__/activate.test.ts`)

**Source:** `src/app/api/n8n/activate/route.ts`

```typescript
describe('POST /api/n8n/activate', () => {
  describe('request validation', () => {
    it('should reject missing workflowId')
    it('should reject invalid workflowId format')
    it('should reject unauthorized requests')
  })

  describe('workflow activation', () => {
    it('should activate inactive workflow')
    it('should return already active status')
    it('should update workflow status in database')
    it('should sync with n8n service')
    it('should handle n8n activation failure')
  })

  describe('workflow deactivation', () => {
    it('should deactivate active workflow')
    it('should update database on deactivation')
    it('should handle n8n deactivation failure')
  })

  describe('error handling', () => {
    it('should return 404 for non-existent workflow')
    it('should return 500 for database errors')
    it('should return 502 for n8n service errors')
    it('should log errors appropriately')
  })

  describe('activity logging', () => {
    it('should log activation event')
    it('should log deactivation event')
    it('should include user context in log')
  })
})
```

#### 2.1.2 AI Action Route (`src/app/api/n8n/__tests__/ai-action.test.ts`)

**Source:** `src/app/api/n8n/ai-action/route.ts`

```typescript
describe('POST /api/n8n/ai-action', () => {
  describe('request validation', () => {
    it('should reject missing action type')
    it('should reject missing execution context')
    it('should validate action parameters')
  })

  describe('AI action execution', () => {
    it('should execute text analysis action')
    it('should execute data extraction action')
    it('should execute decision making action')
    it('should pass context to AI model')
    it('should filter PII before AI processing')
  })

  describe('response handling', () => {
    it('should return structured AI response')
    it('should include confidence scores')
    it('should handle AI service timeout')
    it('should handle AI service errors')
  })

  describe('rate limiting', () => {
    it('should apply rate limits')
    it('should return 429 when rate limited')
  })
})
```

#### 2.1.3 Credentials Route (`src/app/api/n8n/__tests__/credentials.test.ts`)

**Source:** `src/app/api/n8n/credentials/route.ts`

```typescript
describe('/api/n8n/credentials', () => {
  describe('GET', () => {
    it('should list all credentials for organization')
    it('should filter by credential type')
    it('should not expose credential secrets')
    it('should handle pagination')
    it('should require authentication')
  })

  describe('POST', () => {
    it('should create new credential')
    it('should encrypt credential data')
    it('should validate credential type')
    it('should prevent duplicate names')
    it('should sync to n8n service')
  })

  describe('PUT', () => {
    it('should update credential data')
    it('should update credential name')
    it('should re-encrypt on update')
    it('should sync updates to n8n')
  })

  describe('DELETE', () => {
    it('should delete credential')
    it('should check for workflows using credential')
    it('should sync deletion to n8n')
    it('should return 409 if credential in use')
  })
})
```

#### 2.1.4 Cleanup Route (`src/app/api/n8n/__tests__/cleanup.test.ts`)

**Source:** `src/app/api/n8n/cleanup/route.ts`

```typescript
describe('POST /api/n8n/cleanup', () => {
  describe('execution cleanup', () => {
    it('should delete executions older than retention period')
    it('should preserve recent executions')
    it('should handle pagination for large datasets')
    it('should sync cleanup with n8n')
  })

  describe('orphan cleanup', () => {
    it('should identify orphaned records')
    it('should cleanup orphaned executions')
    it('should cleanup orphaned steps')
  })

  describe('dry run mode', () => {
    it('should report what would be deleted')
    it('should not delete in dry run')
  })

  describe('authorization', () => {
    it('should require admin role')
    it('should reject non-admin users')
  })
})
```

#### 2.1.5 Execution Complete Route (`src/app/api/n8n/__tests__/execution-complete.test.ts`)

**Source:** `src/app/api/n8n/execution-complete/route.ts`

```typescript
describe('POST /api/n8n/execution-complete', () => {
  describe('request validation', () => {
    it('should reject missing executionId')
    it('should reject invalid status')
    it('should validate outputs schema')
  })

  describe('successful completion', () => {
    it('should mark execution as completed')
    it('should store execution outputs')
    it('should calculate execution duration')
    it('should update all step statuses')
    it('should trigger completion webhook')
  })

  describe('failed completion', () => {
    it('should mark execution as failed')
    it('should store error details')
    it('should identify failed step')
    it('should trigger failure webhook')
  })

  describe('activity logging', () => {
    it('should log completion event')
    it('should include execution metrics')
    it('should log step-level details')
  })

  describe('notifications', () => {
    it('should send completion notification')
    it('should notify assigned reviewers')
    it('should handle notification failures gracefully')
  })
})
```

#### 2.1.6 Node Types Route (`src/app/api/n8n/__tests__/node-types.test.ts`)

**Source:** `src/app/api/n8n/node-types/route.ts`

```typescript
describe('GET /api/n8n/node-types', () => {
  describe('listing node types', () => {
    it('should return all available node types')
    it('should include node metadata')
    it('should include node credentials requirements')
    it('should categorize nodes')
  })

  describe('filtering', () => {
    it('should filter by category')
    it('should filter by search term')
    it('should filter by credential type')
  })

  describe('caching', () => {
    it('should cache node types response')
    it('should invalidate cache on n8n update')
  })
})
```

#### 2.1.7 Resume Execution Route (`src/app/api/n8n/__tests__/resume.test.ts`)

**Source:** `src/app/api/n8n/resume/[executionId]/route.ts`

```typescript
describe('POST /api/n8n/resume/[executionId]', () => {
  describe('request validation', () => {
    it('should reject invalid executionId')
    it('should reject if execution not paused')
    it('should validate resume data')
  })

  describe('human review resume', () => {
    it('should resume after approval')
    it('should resume with modifications')
    it('should handle rejection')
    it('should update review request status')
  })

  describe('execution continuation', () => {
    it('should continue from paused step')
    it('should pass resume data to next step')
    it('should handle continuation failure')
  })

  describe('activity logging', () => {
    it('should log resume event')
    it('should log who resumed')
    it('should log resume reason')
  })
})
```

#### 2.1.8 Webhook Route (`src/app/api/n8n/__tests__/webhook.test.ts`)

**Source:** `src/app/api/n8n/webhook/[workflowId]/route.ts`

```typescript
describe('/api/n8n/webhook/[workflowId]', () => {
  describe('POST', () => {
    it('should trigger workflow execution')
    it('should validate webhook signature')
    it('should pass payload to workflow')
    it('should return execution ID')
    it('should handle workflow not found')
    it('should handle inactive workflow')
  })

  describe('GET', () => {
    it('should handle GET webhooks')
    it('should parse query parameters')
  })

  describe('authentication', () => {
    it('should verify webhook secret')
    it('should reject invalid signatures')
    it('should reject expired requests')
  })

  describe('rate limiting', () => {
    it('should apply webhook rate limits')
    it('should return 429 when exceeded')
  })

  describe('payload handling', () => {
    it('should handle JSON payloads')
    it('should handle form data')
    it('should handle multipart uploads')
    it('should reject oversized payloads')
  })
})
```

#### 2.1.9 OAuth Callback Route (`src/app/api/n8n/__tests__/oauth-callback.test.ts`)

**Source:** `src/app/api/n8n/credentials/oauth/callback/route.ts`

```typescript
describe('GET /api/n8n/credentials/oauth/callback', () => {
  describe('OAuth flow completion', () => {
    it('should exchange code for tokens')
    it('should store encrypted tokens')
    it('should update credential status')
    it('should redirect to success page')
  })

  describe('error handling', () => {
    it('should handle OAuth denied')
    it('should handle invalid state')
    it('should handle token exchange failure')
    it('should redirect to error page')
  })

  describe('security', () => {
    it('should validate state parameter')
    it('should prevent CSRF attacks')
    it('should expire state tokens')
  })
})
```

---

### 2.2 Gemini API Routes

#### 2.2.1 Build Agents Route (`src/app/api/gemini/__tests__/build-agents.test.ts`)

**Source:** `src/app/api/gemini/build-agents/route.ts`

```typescript
describe('POST /api/gemini/build-agents', () => {
  describe('request validation', () => {
    it('should reject missing requirements')
    it('should reject empty requirements')
    it('should validate context object')
  })

  describe('agent generation', () => {
    it('should generate agent from requirements')
    it('should include agent capabilities')
    it('should include agent configuration')
    it('should filter PII from context')
  })

  describe('response format', () => {
    it('should return structured agent definition')
    it('should include suggested workflow steps')
    it('should include confidence scores')
  })

  describe('error handling', () => {
    it('should handle Gemini API errors')
    it('should handle timeout')
    it('should return partial results on failure')
  })
})
```

#### 2.2.2 Extract People Route (`src/app/api/gemini/__tests__/extract-people.test.ts`)

**Source:** `src/app/api/gemini/extract-people/route.ts`

```typescript
describe('POST /api/gemini/extract-people', () => {
  describe('person extraction', () => {
    it('should extract names from text')
    it('should extract roles from text')
    it('should extract relationships')
    it('should handle multiple people')
    it('should deduplicate results')
  })

  describe('context handling', () => {
    it('should use organization context')
    it('should match against existing team')
    it('should suggest role assignments')
  })
})
```

#### 2.2.3 Requirements Route (`src/app/api/gemini/__tests__/requirements.test.ts`)

**Source:** `src/app/api/gemini/requirements/route.ts`

```typescript
describe('POST /api/gemini/requirements', () => {
  describe('requirements analysis', () => {
    it('should parse natural language requirements')
    it('should identify workflow steps')
    it('should identify integrations needed')
    it('should identify approval points')
  })

  describe('structured output', () => {
    it('should return structured requirements')
    it('should include step dependencies')
    it('should include estimated complexity')
  })
})
```

---

### 2.3 Testing API Routes

#### 2.3.1 Test Run Route (`src/app/api/testing/__tests__/run.test.ts`)

**Source:** `src/app/api/testing/run/route.ts`

```typescript
describe('POST /api/testing/run', () => {
  describe('test execution', () => {
    it('should execute single test case')
    it('should execute test suite')
    it('should use mock data')
    it('should capture step outputs')
    it('should calculate assertions')
  })

  describe('parallel execution', () => {
    it('should run independent tests in parallel')
    it('should respect concurrency limits')
  })

  describe('result reporting', () => {
    it('should return pass/fail status')
    it('should include assertion details')
    it('should include execution time')
    it('should include step-level results')
  })
})

describe('GET /api/testing/run/[id]', () => {
  it('should return test run status')
  it('should return test run results')
  it('should return 404 for unknown run')
})
```

#### 2.3.2 Test Cases Route (`src/app/api/testing/__tests__/test-cases.test.ts`)

**Source:** `src/app/api/testing/test-cases/route.ts`

```typescript
describe('/api/testing/test-cases', () => {
  describe('GET', () => {
    it('should list test cases for workflow')
    it('should filter by status')
    it('should include last run info')
  })

  describe('POST', () => {
    it('should create test case')
    it('should validate test case structure')
    it('should validate assertions')
    it('should validate mock data')
  })

  describe('PUT', () => {
    it('should update test case')
    it('should update mock data')
    it('should update assertions')
  })

  describe('DELETE', () => {
    it('should delete test case')
    it('should delete associated runs')
  })
})
```

---

### 2.4 Analytics API Routes

#### 2.4.1 Workers Route (`src/app/api/analytics/__tests__/workers.test.ts`)

**Source:** `src/app/api/analytics/workers/route.ts`

```typescript
describe('GET /api/analytics/workers', () => {
  describe('metrics aggregation', () => {
    it('should return execution counts')
    it('should return success rates')
    it('should return average duration')
    it('should return error rates')
  })

  describe('filtering', () => {
    it('should filter by date range')
    it('should filter by worker ID')
    it('should filter by workflow')
  })

  describe('grouping', () => {
    it('should group by day')
    it('should group by week')
    it('should group by worker')
  })
})
```

#### 2.4.2 Worker Trends Route (`src/app/api/analytics/__tests__/worker-trends.test.ts`)

**Source:** `src/app/api/analytics/workers/[workerId]/trends/route.ts`

```typescript
describe('GET /api/analytics/workers/[workerId]/trends', () => {
  describe('trend calculation', () => {
    it('should calculate execution trend')
    it('should calculate success rate trend')
    it('should calculate duration trend')
    it('should identify anomalies')
  })

  describe('comparison', () => {
    it('should compare to previous period')
    it('should calculate percentage change')
  })
})
```

#### 2.4.3 Export Route (`src/app/api/analytics/__tests__/export.test.ts`)

**Source:** `src/app/api/analytics/export/route.ts`

```typescript
describe('POST /api/analytics/export', () => {
  describe('CSV export', () => {
    it('should export to CSV format')
    it('should include headers')
    it('should handle large datasets')
  })

  describe('JSON export', () => {
    it('should export to JSON format')
    it('should include metadata')
  })

  describe('filtering', () => {
    it('should apply date range filter')
    it('should apply workflow filter')
  })
})
```

---

### 2.5 Admin API Routes

#### 2.5.1 Invite Route (`src/app/api/admin/__tests__/invite.test.ts`)

**Source:** `src/app/api/admin/invite/route.ts`

```typescript
describe('POST /api/admin/invite', () => {
  describe('invitation creation', () => {
    it('should create invitation')
    it('should send invitation email')
    it('should set expiration')
    it('should assign role')
  })

  describe('authorization', () => {
    it('should require admin role')
    it('should prevent self-invitation')
  })

  describe('validation', () => {
    it('should validate email format')
    it('should prevent duplicate invitations')
    it('should validate role')
  })
})
```

---

## Phase 3: Hook Tests

### 3.1 Missing Hook Tests

#### 3.1.1 useOrganization (`src/hooks/__tests__/useOrganization.test.ts`)

**Source:** `src/hooks/useOrganization.ts`

```typescript
describe('useOrganization', () => {
  describe('organization fetching', () => {
    it('should fetch current organization')
    it('should return loading state initially')
    it('should handle fetch error')
    it('should cache organization data')
  })

  describe('organization switching', () => {
    it('should switch organization')
    it('should update context on switch')
    it('should refetch related data on switch')
  })

  describe('organization updates', () => {
    it('should update organization settings')
    it('should handle concurrent updates')
  })

  describe('member management', () => {
    it('should fetch organization members')
    it('should add member')
    it('should remove member')
    it('should update member role')
  })
})
```

#### 3.1.2 useTestRunner (`src/hooks/__tests__/useTestRunner.test.ts`)

**Source:** `src/hooks/useTestRunner.ts`

```typescript
describe('useTestRunner', () => {
  describe('test execution', () => {
    it('should start test run')
    it('should track execution progress')
    it('should report completion')
    it('should handle test failure')
  })

  describe('state management', () => {
    it('should update running state')
    it('should store results')
    it('should reset between runs')
  })

  describe('cancellation', () => {
    it('should cancel running test')
    it('should cleanup on cancel')
  })
})
```

#### 3.1.3 useTestCases (`src/hooks/__tests__/useTestCases.test.ts`)

**Source:** `src/hooks/useTestCases.ts`

```typescript
describe('useTestCases', () => {
  describe('CRUD operations', () => {
    it('should fetch test cases')
    it('should create test case')
    it('should update test case')
    it('should delete test case')
  })

  describe('filtering', () => {
    it('should filter by workflow')
    it('should filter by status')
  })

  describe('optimistic updates', () => {
    it('should optimistically add test case')
    it('should rollback on error')
  })
})
```

#### 3.1.4 useWorkerAnalytics (`src/hooks/__tests__/useWorkerAnalytics.test.ts`)

**Source:** `src/hooks/useWorkerAnalytics.ts`

```typescript
describe('useWorkerAnalytics', () => {
  describe('metrics fetching', () => {
    it('should fetch worker metrics')
    it('should fetch trend data')
    it('should handle date range')
  })

  describe('data transformation', () => {
    it('should calculate derived metrics')
    it('should format for charts')
  })

  describe('caching', () => {
    it('should cache metrics data')
    it('should invalidate on range change')
  })
})
```

#### 3.1.5 useWorkflowExtraction (`src/hooks/__tests__/useWorkflowExtraction.test.ts`)

**Source:** `src/hooks/useWorkflowExtraction.ts`

```typescript
describe('useWorkflowExtraction', () => {
  describe('extraction process', () => {
    it('should extract workflow from text')
    it('should track extraction progress')
    it('should return structured workflow')
  })

  describe('AI integration', () => {
    it('should call Gemini API')
    it('should handle API errors')
    it('should handle timeout')
  })

  describe('result handling', () => {
    it('should parse extraction result')
    it('should validate workflow structure')
  })
})
```

---

## Phase 4: Component Tests

### 4.1 Domain Components

#### 4.1.1 WorkflowBuilder (`src/components/__tests__/WorkflowBuilder.test.tsx`)

**Source:** `src/components/WorkflowBuilder.tsx`

```typescript
describe('WorkflowBuilder', () => {
  describe('rendering', () => {
    it('should render workflow canvas')
    it('should render step palette')
    it('should render existing steps')
    it('should render connections')
  })

  describe('step management', () => {
    it('should add step on drop')
    it('should remove step on delete')
    it('should reorder steps via drag')
    it('should open config on step click')
  })

  describe('connections', () => {
    it('should create connection between steps')
    it('should validate connection rules')
    it('should delete connection')
  })

  describe('step configuration', () => {
    it('should open step config modal')
    it('should save step configuration')
    it('should validate step config')
  })

  describe('workflow actions', () => {
    it('should save workflow')
    it('should validate workflow before save')
    it('should activate workflow')
  })

  describe('keyboard shortcuts', () => {
    it('should delete selected step on Delete key')
    it('should undo on Ctrl+Z')
    it('should redo on Ctrl+Y')
  })
})
```

#### 4.1.2 WorkflowFlowchart (`src/components/__tests__/WorkflowFlowchart.test.tsx`)

**Source:** `src/components/WorkflowFlowchart.tsx`

```typescript
describe('WorkflowFlowchart', () => {
  describe('rendering', () => {
    it('should render nodes for each step')
    it('should render edges for connections')
    it('should position nodes correctly')
    it('should apply step type styling')
  })

  describe('interaction', () => {
    it('should pan on drag')
    it('should zoom on scroll')
    it('should select node on click')
    it('should fit view on button click')
  })

  describe('step status', () => {
    it('should show running indicator')
    it('should show completed indicator')
    it('should show error indicator')
    it('should show pending indicator')
  })
})
```

#### 4.1.3 Sidebar (`src/components/__tests__/Sidebar.test.tsx`)

**Source:** `src/components/Sidebar.tsx`

```typescript
describe('Sidebar', () => {
  describe('rendering', () => {
    it('should render navigation links')
    it('should render organization selector')
    it('should render user menu')
  })

  describe('navigation', () => {
    it('should highlight active link')
    it('should navigate on link click')
  })

  describe('collapsing', () => {
    it('should collapse on toggle')
    it('should expand on toggle')
    it('should persist collapse state')
  })
})
```

#### 4.1.4 StepConfigModal (`src/components/__tests__/StepConfigModal.test.tsx`)

**Source:** `src/components/StepConfigModal.tsx`

```typescript
describe('StepConfigModal', () => {
  describe('rendering', () => {
    it('should render step name input')
    it('should render step type selector')
    it('should render type-specific fields')
    it('should render credential selector')
  })

  describe('form handling', () => {
    it('should validate required fields')
    it('should save configuration')
    it('should cancel without saving')
  })

  describe('step types', () => {
    it('should render trigger config')
    it('should render action config')
    it('should render condition config')
    it('should render human review config')
  })
})
```

#### 4.1.5 AnalyticsDashboard (`src/components/analytics/__tests__/AnalyticsDashboard.test.tsx`)

**Source:** `src/components/analytics/AnalyticsDashboard.tsx`

```typescript
describe('AnalyticsDashboard', () => {
  describe('rendering', () => {
    it('should render metric cards')
    it('should render trend chart')
    it('should render distribution pie')
    it('should render date range picker')
  })

  describe('data loading', () => {
    it('should show loading state')
    it('should show error state')
    it('should show empty state')
  })

  describe('filtering', () => {
    it('should filter by date range')
    it('should filter by worker')
    it('should filter by workflow')
  })

  describe('export', () => {
    it('should export to CSV')
    it('should export to JSON')
  })
})
```

#### 4.1.6 TestRunnerPanel (`src/components/testing/__tests__/TestRunnerPanel.test.tsx`)

**Source:** `src/components/testing/TestRunnerPanel.tsx`

```typescript
describe('TestRunnerPanel', () => {
  describe('rendering', () => {
    it('should render test case list')
    it('should render run button')
    it('should render results section')
  })

  describe('test execution', () => {
    it('should run selected tests')
    it('should show progress')
    it('should display results')
  })

  describe('test selection', () => {
    it('should select individual test')
    it('should select all tests')
    it('should clear selection')
  })
})
```

#### 4.1.7 ErrorBoundary (`src/components/__tests__/ErrorBoundary.test.tsx`)

**Source:** `src/components/ErrorBoundary.tsx`

```typescript
describe('ErrorBoundary', () => {
  describe('error catching', () => {
    it('should catch rendering errors')
    it('should display fallback UI')
    it('should log error details')
  })

  describe('recovery', () => {
    it('should allow retry')
    it('should reset state on retry')
  })
})
```

#### 4.1.8 ChatPanel (`src/components/__tests__/ChatPanel.test.tsx`)

**Source:** `src/components/ChatPanel.tsx`

```typescript
describe('ChatPanel', () => {
  describe('rendering', () => {
    it('should render message list')
    it('should render input field')
    it('should render send button')
  })

  describe('messaging', () => {
    it('should send message on submit')
    it('should display sent message')
    it('should display received message')
    it('should show typing indicator')
  })

  describe('scrolling', () => {
    it('should auto-scroll to bottom')
    it('should preserve scroll on new message')
  })
})
```

#### 4.1.9 ExecutionDebugger (`src/components/__tests__/ExecutionDebugger.test.tsx`)

**Source:** `src/components/ExecutionDebugger.tsx`

```typescript
describe('ExecutionDebugger', () => {
  describe('rendering', () => {
    it('should render execution timeline')
    it('should render step details')
    it('should render input/output panels')
  })

  describe('step inspection', () => {
    it('should show step inputs')
    it('should show step outputs')
    it('should show step errors')
    it('should highlight current step')
  })

  describe('timeline navigation', () => {
    it('should jump to step on click')
    it('should show step duration')
  })
})
```

---

### 4.2 Chart Components

#### 4.2.1 MetricCard (`src/components/analytics/__tests__/MetricCard.test.tsx`)

```typescript
describe('MetricCard', () => {
  it('should render metric value')
  it('should render metric label')
  it('should render trend indicator')
  it('should apply positive trend styling')
  it('should apply negative trend styling')
  it('should format large numbers')
  it('should format percentages')
})
```

#### 4.2.2 TrendLineChart (`src/components/analytics/__tests__/TrendLineChart.test.tsx`)

```typescript
describe('TrendLineChart', () => {
  it('should render chart with data')
  it('should handle empty data')
  it('should format axis labels')
  it('should show tooltip on hover')
  it('should handle multiple series')
})
```

#### 4.2.3 WorkerComparisonChart (`src/components/analytics/__tests__/WorkerComparisonChart.test.tsx`)

```typescript
describe('WorkerComparisonChart', () => {
  it('should render bar chart')
  it('should sort by metric')
  it('should highlight selected worker')
  it('should handle click events')
})
```

#### 4.2.4 WorkloadDistributionPie (`src/components/analytics/__tests__/WorkloadDistributionPie.test.tsx`)

```typescript
describe('WorkloadDistributionPie', () => {
  it('should render pie chart')
  it('should show legend')
  it('should show percentages')
  it('should handle click on segment')
})
```

---

## Phase 5: Library & Utility Tests

### 5.1 Gemini Client Tests (`src/lib/gemini/__tests__/client.test.ts`)

**Source:** `src/lib/gemini/client.ts`

```typescript
describe('GeminiClient', () => {
  describe('initialization', () => {
    it('should create client with API key')
    it('should throw on missing API key')
  })

  describe('generateContent', () => {
    it('should send request to Gemini API')
    it('should parse response correctly')
    it('should handle API errors')
    it('should retry on transient failures')
    it('should respect rate limits')
  })

  describe('streaming', () => {
    it('should stream responses')
    it('should handle stream errors')
    it('should cancel stream on abort')
  })
})
```

### 5.2 Supabase Client Tests (`src/lib/supabase/__tests__/client.test.ts`)

**Source:** `src/lib/supabase/client.ts`

```typescript
describe('SupabaseClient', () => {
  describe('initialization', () => {
    it('should create browser client')
    it('should throw on missing env vars')
  })

  describe('authentication', () => {
    it('should get current session')
    it('should handle session refresh')
  })
})
```

### 5.3 Testing Engine Tests

#### 5.3.1 Assertion Engine (`src/lib/testing/__tests__/assertion-engine.test.ts`)

**Source:** `src/lib/testing/assertion-engine.ts`

```typescript
describe('AssertionEngine', () => {
  describe('equality assertions', () => {
    it('should assert equals')
    it('should assert not equals')
    it('should assert deep equals')
  })

  describe('type assertions', () => {
    it('should assert type string')
    it('should assert type number')
    it('should assert type boolean')
    it('should assert type array')
    it('should assert type object')
  })

  describe('comparison assertions', () => {
    it('should assert greater than')
    it('should assert less than')
    it('should assert between')
  })

  describe('string assertions', () => {
    it('should assert contains')
    it('should assert starts with')
    it('should assert matches regex')
  })

  describe('array assertions', () => {
    it('should assert includes')
    it('should assert length')
    it('should assert all match')
  })

  describe('object assertions', () => {
    it('should assert has property')
    it('should assert property value')
    it('should assert schema match')
  })
})
```

#### 5.3.2 Execution Service (`src/lib/testing/__tests__/execution-service.test.ts`)

**Source:** `src/lib/testing/execution-service.ts`

```typescript
describe('ExecutionService', () => {
  describe('test execution', () => {
    it('should execute test case')
    it('should use mock data')
    it('should capture outputs')
    it('should run assertions')
  })

  describe('step mocking', () => {
    it('should mock step execution')
    it('should inject mock responses')
  })

  describe('result collection', () => {
    it('should collect step results')
    it('should calculate pass/fail')
    it('should measure duration')
  })
})
```

### 5.4 Utility Tests

#### 5.4.1 Formatting Utils (`src/lib/utils/__tests__/formatting.test.ts`)

**Source:** `src/lib/utils/formatting.ts`

```typescript
describe('formatting utils', () => {
  describe('formatDate', () => {
    it('should format date in locale format')
    it('should format relative dates')
    it('should handle invalid dates')
  })

  describe('formatDuration', () => {
    it('should format milliseconds')
    it('should format seconds')
    it('should format minutes')
    it('should format hours')
  })

  describe('formatNumber', () => {
    it('should format with thousands separator')
    it('should format percentages')
    it('should format currency')
  })

  describe('truncate', () => {
    it('should truncate long strings')
    it('should add ellipsis')
    it('should handle short strings')
  })
})
```

#### 5.4.2 Parsing Utils (`src/lib/utils/__tests__/parsing.test.ts`)

**Source:** `src/lib/utils/parsing.ts`

```typescript
describe('parsing utils', () => {
  describe('parseJSON', () => {
    it('should parse valid JSON')
    it('should return default on invalid')
    it('should handle null')
  })

  describe('parseQueryParams', () => {
    it('should parse URL search params')
    it('should handle arrays')
    it('should handle nested objects')
  })
})
```

#### 5.4.3 CN Utility (`src/lib/utils/__tests__/cn.test.ts`)

**Source:** `src/lib/utils/cn.ts`

```typescript
describe('cn', () => {
  it('should merge class names')
  it('should handle conditional classes')
  it('should resolve Tailwind conflicts')
  it('should handle undefined values')
  it('should handle arrays')
})
```

---

## Phase 6: Provider Tests

### 6.1 AuthProvider (`src/providers/__tests__/AuthProvider.test.tsx`)

**Source:** `src/providers/AuthProvider.tsx`

```typescript
describe('AuthProvider', () => {
  describe('authentication state', () => {
    it('should provide user context')
    it('should handle loading state')
    it('should handle unauthenticated state')
  })

  describe('session management', () => {
    it('should refresh session')
    it('should handle session expiry')
    it('should redirect on logout')
  })

  describe('auth methods', () => {
    it('should provide signIn method')
    it('should provide signOut method')
    it('should provide signUp method')
  })
})
```

### 6.2 QueryProvider (`src/providers/__tests__/QueryProvider.test.tsx`)

**Source:** `src/providers/QueryProvider.tsx`

```typescript
describe('QueryProvider', () => {
  describe('configuration', () => {
    it('should configure default options')
    it('should configure retry logic')
    it('should configure caching')
  })

  describe('devtools', () => {
    it('should include devtools in development')
    it('should exclude devtools in production')
  })
})
```

---

## Test Infrastructure Improvements

### Enable Test Factories

Uncomment and enable `src/__tests__/factories/index.ts`:

```typescript
// Enable faker-based factories
export function createWorkflow(overrides?: Partial<Workflow>): Workflow
export function createWorkflowStep(overrides?: Partial<WorkflowStep>): WorkflowStep
export function createDigitalWorker(overrides?: Partial<DigitalWorker>): DigitalWorker
export function createReviewRequest(overrides?: Partial<ReviewRequest>): ReviewRequest
export function createExecution(overrides?: Partial<Execution>): Execution
export function createActivityLog(overrides?: Partial<ActivityLog>): ActivityLog
export function createTestCase(overrides?: Partial<TestCase>): TestCase
export function createOrganization(overrides?: Partial<Organization>): Organization
```

### Add Missing MSW Handlers

Extend `vitest.setup.ts` with handlers for:
- Testing API routes
- Analytics API routes
- Admin API routes
- OAuth callback flows

---

## Summary Statistics

| Category | Files | Estimated Tests |
|----------|-------|-----------------|
| Security & Validation | 4 | 155 |
| N8N API Routes | 9 | 150 |
| Gemini API Routes | 3 | 50 |
| Testing API Routes | 2 | 35 |
| Analytics API Routes | 3 | 30 |
| Admin API Routes | 1 | 15 |
| Hooks | 5 | 75 |
| Domain Components | 15 | 250 |
| Chart Components | 4 | 30 |
| Library/Utils | 8 | 120 |
| Providers | 2 | 30 |
| **TOTAL** | **56** | **~940** |

---

## Verification

After implementation:

1. **Run full test suite:**
   ```bash
   npm test
   ```

2. **Check coverage:**
   ```bash
   npm test -- --coverage
   ```

3. **Verify coverage thresholds:**
   - Lines: 80%
   - Statements: 80%
   - Functions: 75%
   - Branches: 70%

4. **Run specific test file:**
   ```bash
   npm test -- src/lib/__tests__/pii-filter.test.ts
   ```

---

## Files to Create

```
src/lib/__tests__/
├── pii-filter.test.ts
├── rate-limit.test.ts
└── validation.test.ts

src/lib/n8n/__tests__/
└── webhook-auth.test.ts

src/app/api/n8n/__tests__/
├── activate.test.ts
├── ai-action.test.ts
├── credentials.test.ts
├── cleanup.test.ts
├── execution-complete.test.ts
├── node-types.test.ts
├── resume.test.ts
├── webhook.test.ts
└── oauth-callback.test.ts

src/app/api/gemini/__tests__/
├── build-agents.test.ts
├── extract-people.test.ts
└── requirements.test.ts

src/app/api/testing/__tests__/
├── run.test.ts
└── test-cases.test.ts

src/app/api/analytics/__tests__/
├── workers.test.ts
├── worker-trends.test.ts
└── export.test.ts

src/app/api/admin/__tests__/
└── invite.test.ts

src/hooks/__tests__/
├── useOrganization.test.ts
├── useTestRunner.test.ts
├── useTestCases.test.ts
├── useWorkerAnalytics.test.ts
└── useWorkflowExtraction.test.ts

src/components/__tests__/
├── WorkflowBuilder.test.tsx
├── WorkflowFlowchart.test.tsx
├── Sidebar.test.tsx
├── StepConfigModal.test.tsx
├── ErrorBoundary.test.tsx
├── ChatPanel.test.tsx
└── ExecutionDebugger.test.tsx

src/components/analytics/__tests__/
├── AnalyticsDashboard.test.tsx
├── MetricCard.test.tsx
├── TrendLineChart.test.tsx
├── WorkerComparisonChart.test.tsx
└── WorkloadDistributionPie.test.tsx

src/components/testing/__tests__/
└── TestRunnerPanel.test.tsx

src/lib/gemini/__tests__/
└── client.test.ts

src/lib/supabase/__tests__/
└── client.test.ts

src/lib/testing/__tests__/
├── assertion-engine.test.ts
└── execution-service.test.ts

src/lib/utils/__tests__/
├── formatting.test.ts
├── parsing.test.ts
└── cn.test.ts

src/providers/__tests__/
├── AuthProvider.test.tsx
└── QueryProvider.test.tsx
```

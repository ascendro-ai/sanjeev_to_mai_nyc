# N8N Integration & Security Fix Plan

## Executive Summary

This plan addresses **16 n8n integration bugs** and **25+ security vulnerabilities** discovered in the codebase. Issues are prioritized by severity and grouped into implementation phases.

---

## Part A: Security Vulnerabilities

### CRITICAL (Fix Immediately)

| # | Issue | Location | Risk |
|---|-------|----------|------|
| S1 | **Unauthenticated webhook endpoints** | All `/api/n8n/*` webhook routes | Anyone can trigger workflows, spoof execution data |
| S2 | **No webhook signature verification** | Same routes | No way to verify requests come from n8n |
| S3 | **SSRF vulnerability** | `review-response/route.ts:100,143` | Attacker-controlled URLs in `resumeWebhookUrl`, `callbackUrl` |
| S4 | **Weak XOR encryption** | `credentials.ts:58-78` | OAuth tokens easily decryptable |
| S5 | **Default encryption key in code** | `credentials.ts:11` | `'default-dev-key-change-in-prod'` may be used |
| S6 | **Test endpoints accessible** | `/api/test/route.ts` | Only env check, can seed/delete data if misconfigured |
| S7 | **Exposed API keys in .env.local** | `.env.local` | Gemini, n8n, Supabase keys in file (rotate immediately) |

### HIGH (Fix This Week)

| # | Issue | Location | Risk |
|---|-------|----------|------|
| S8 | **Missing org isolation** | `analytics/workers`, `n8n/sync` | Cross-org data leakage |
| S9 | **Credential access without org check** | `credentials/route.ts:40-56` | Any user can read any credential by ID |
| S10 | **Review response no auth** | `review-response/route.ts` | Anyone can approve/reject any review |
| S11 | **No rate limiting** | All API routes | DoS, quota exhaustion, brute force |
| S12 | **Sensitive data to Gemini** | `debug/route.ts`, `ai-action/route.ts` | PII sent to external AI without filtering |
| S13 | **Error message info leakage** | Multiple routes | Stack traces, internal URLs exposed |
| S14 | **Missing input validation** | `review-request`, `execution-update` | No schema validation on payloads |

### MEDIUM

| # | Issue | Location | Risk |
|---|-------|----------|------|
| S15 | **OAuth state not signed** | `oauth/callback/route.ts` | Base64 JSON, no HMAC signature |
| S16 | **No fetch timeouts** | `review-response`, `credentials` | Requests can hang indefinitely |
| S17 | **No request size limits** | All routes | Large payload DoS |
| S18 | **Pagination unbounded** | `test-cases/route.ts` | Can request unlimited records |
| S19 | **Prompt injection** | `consult/route.ts` | User input directly in LLM prompts |
| S20 | **Missing security headers** | No middleware | No CSP, X-Frame-Options, HSTS |
| S21 | **Admin role TODO** | `audit/route.ts:288` | Anyone can delete audit logs |
| S22 | **Activity logs unfiltered** | Multiple routes | PII in logs without masking |

---

## Part B: N8N Integration Bugs

### CRITICAL (Data Corruption)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| N1 | **Wrong field in execution lookup** | `execution-update/route.ts:38` | `.eq('id', executionId)` should be `n8n_execution_id` - creates duplicates |
| N2 | **Review feedback wrong columns** | `review-response/route.ts:51-59` | Written to `action_payload.feedback`, read from `feedback` column |
| N3 | **Activity log types mismatch** | `types/index.ts` | 7 types used but not in union definition |

### HIGH (Stuck Workflows)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| N4 | **No transactions** | `execution-complete`, `review-response` | Partial failures leave inconsistent state |
| N5 | **Resume webhook fails silently** | `review-response/route.ts:100-127` | Logs warning, marks as running anyway |
| N6 | **No wait node timeout** | `client.ts` convertToN8NWorkflow | Workflows wait forever if no review |
| N7 | **Duplicate reviews allowed** | `review-request/route.ts` | No uniqueness check on (execution_id, step_id) |
| N8 | **timeout_at never enforced** | `review-request/route.ts` | Field set but no cleanup job |

### MEDIUM (Reliability)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| N9 | **N8N down = zombie execution** | `webhook/[workflowId]/route.ts` | Execution created before n8n call |
| N10 | **Credential sync silent fail** | `credentials.ts:197-211` | Saved to DB but not n8n |
| N11 | **React Query cache stale** | `useExecutions`, `useRealtime` | Real-time callbacks don't update cache |
| N12 | **No idempotency** | `execution-update/route.ts` | Duplicate webhooks create duplicate records |

---

## Implementation Plan

### Phase 1: Critical Security (Day 1-2)

**Goal:** Stop active vulnerabilities

#### 1.1 Add Webhook Authentication
**Files:** All `/api/n8n/` webhook routes
```typescript
// Add to each webhook route
const signature = request.headers.get('x-webhook-signature')
const isValid = verifyWebhookSignature(body, signature, process.env.WEBHOOK_SECRET)
if (!isValid) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
}
```

#### 1.2 Fix SSRF Vulnerability
**File:** `review-response/route.ts`
```typescript
// Add URL validation
function isAllowedUrl(url: string): boolean {
  const parsed = new URL(url)
  const allowedHosts = [new URL(process.env.N8N_API_URL).hostname]
  return allowedHosts.includes(parsed.hostname)
}

if (!isAllowedUrl(resumeWebhookUrl)) {
  return NextResponse.json({ error: 'Invalid callback URL' }, { status: 400 })
}
```

#### 1.3 Replace XOR with AES-256-GCM
**File:** `credentials.ts`
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function decrypt(encryptedText: string): string {
  const buffer = Buffer.from(encryptedText, 'base64')
  const iv = buffer.subarray(0, 16)
  const tag = buffer.subarray(16, 32)
  const encrypted = buffer.subarray(32)
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

#### 1.4 Require Encryption Key
**File:** `credentials.ts`
```typescript
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
}
```

#### 1.5 Protect Test Endpoints
**File:** `test/route.ts`
```typescript
// Add explicit check at the top of each handler
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json({ error: 'Not available' }, { status: 404 })
}
```

---

### Phase 2: Critical Data Fixes (Day 2-3)

**Goal:** Stop data corruption

#### 2.1 Fix Execution Field Lookup
**File:** `execution-update/route.ts:38`
```typescript
// BEFORE
.eq('id', executionId)

// AFTER
.eq('n8n_execution_id', executionId)
```

#### 2.2 Fix Review Feedback Columns
**File:** `review-response/route.ts:51-59`
```typescript
// BEFORE
.update({
  status,
  action_payload: { ...reviewRequest.action_payload, feedback, editedData }
})

// AFTER
.update({
  status,
  feedback,           // Direct column
  edited_data: editedData,  // Direct column
  reviewer_id: reviewerId,  // Direct column
  reviewed_at: new Date().toISOString(),
  action_payload: reviewRequest.action_payload  // Keep URL only
})
```

#### 2.3 Add Missing Activity Log Types
**File:** `types/index.ts`
```typescript
export type ActivityLogType =
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_progress'
  | 'review_requested'
  | 'review_completed'
  | 'review_approved'
  | 'review_rejected'
  | 'digital_worker_activation'
  | 'agent_building_start'
  | 'agent_building_complete'
  | 'workflow_execution_start'
  | 'workflow_step_execution'
  | 'workflow_step_complete'
  | 'workflow_complete'
  | 'agent_assignment'
  | 'error'
  | 'blocker'
```

---

### Phase 3: Authorization & Isolation (Day 3-4)

**Goal:** Proper access control

#### 3.1 Add Organization Filters
**Files:** `analytics/workers/route.ts`, `n8n/sync/route.ts`, `credentials/route.ts`
```typescript
// Get user's organization
const { data: membership } = await supabase
  .from('organization_members')
  .select('organization_id')
  .eq('user_id', user.id)
  .single()

if (!membership) {
  return NextResponse.json({ error: 'No organization found' }, { status: 403 })
}

// Filter all queries by organization
const { data: workers } = await supabase
  .from('digital_workers')
  .select('*')
  .eq('organization_id', membership.organization_id)
```

#### 3.2 Add Review Authorization
**File:** `review-response/route.ts`
```typescript
// Verify user can access this review through org membership
const { data: review } = await supabase
  .from('review_requests')
  .select(`
    *,
    executions!inner(
      workflow_id,
      workflows!inner(organization_id)
    )
  `)
  .eq('id', reviewId)
  .eq('executions.workflows.organization_id', membership.organization_id)
  .single()

if (!review) {
  return NextResponse.json({ error: 'Review not found' }, { status: 404 })
}
```

#### 3.3 Add Credential Access Control
**File:** `credentials/route.ts`
```typescript
// When fetching by ID, verify ownership
if (credentialId) {
  const credential = await getCredential(credentialId)
  if (!credential || credential.organization_id !== membership.organization_id) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }
  // ... return credential
}
```

---

### Phase 4: Workflow Reliability (Day 4-5)

**Goal:** Prevent stuck workflows

#### 4.1 Fix Resume Webhook Handling
**File:** `review-response/route.ts`
```typescript
// Add timeout and proper error handling
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 10000)

try {
  const response = await fetch(resumeWebhookUrl, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resumePayload),
  })
  clearTimeout(timeout)

  if (!response.ok) {
    // DON'T update execution status if resume failed
    // Revert review to pending so user can retry
    await supabase
      .from('review_requests')
      .update({ status: 'pending' })
      .eq('id', reviewId)

    return NextResponse.json({
      error: 'Failed to resume workflow - please retry',
      retryable: true
    }, { status: 502 })
  }
} catch (error) {
  clearTimeout(timeout)

  // Revert review status on any error
  await supabase
    .from('review_requests')
    .update({ status: 'pending' })
    .eq('id', reviewId)

  if (error.name === 'AbortError') {
    return NextResponse.json({
      error: 'Workflow resume timed out - please retry',
      retryable: true
    }, { status: 504 })
  }
  throw error
}
```

#### 4.2 Add Duplicate Review Prevention
**File:** `review-request/route.ts`
```typescript
// Check for existing pending review before creating new one
const { data: existing } = await supabase
  .from('review_requests')
  .select('id')
  .eq('execution_id', executionId)
  .eq('step_id', stepId)
  .eq('status', 'pending')
  .single()

if (existing) {
  // Return existing review instead of creating duplicate
  return NextResponse.json({
    reviewId: existing.id,
    message: 'Review already exists',
    alreadyExists: true
  })
}
```

#### 4.3 Add Wait Node Timeout
**File:** `client.ts` in `convertToN8NWorkflow`
```typescript
const waitNode: N8NNode = {
  id: waitNodeId,
  name: `${step.label || 'Human Review'} - Wait`,
  type: 'n8n-nodes-base.wait',
  position: [position[0] + 200, position[1]],
  parameters: {
    resume: 'webhook',
    options: {
      webhookSuffix: `review-${step.id}`,
    },
    // Add timeout configuration
    limitWaitTime: true,
    maxWaitTime: step.requirements?.timeoutHours || 72,
    maxWaitTimeUnit: 'hours',
  },
  typeVersion: 1.1,
}
```

#### 4.4 Add Stale Review Cleanup Endpoint
**File:** New `src/app/api/n8n/cleanup/route.ts`
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  // Find and expire stale reviews
  const { data: expiredReviews, error } = await supabase
    .from('review_requests')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('timeout_at', new Date().toISOString())
    .select('id, execution_id')

  if (error) {
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }

  // Update related executions
  for (const review of expiredReviews || []) {
    await supabase
      .from('executions')
      .update({ status: 'failed', error: 'Review timed out' })
      .eq('id', review.execution_id)
      .eq('status', 'waiting_review')
  }

  return NextResponse.json({
    expiredCount: expiredReviews?.length || 0
  })
}
```

---

### Phase 5: Input Validation & Rate Limiting (Day 5-6)

#### 5.1 Add Zod Validation Schemas
**File:** New `src/lib/validation.ts`
```typescript
import { z } from 'zod'

export const reviewRequestSchema = z.object({
  executionId: z.string().min(1),
  workflowId: z.string().uuid().optional(),
  stepId: z.string().min(1),
  workerName: z.string().optional(),
  reviewType: z.enum(['approval', 'edit', 'decision']),
  stepLabel: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  callbackUrl: z.string().url().optional(),
  timeoutHours: z.number().min(1).max(168).optional(), // Max 1 week
})

export const reviewResponseSchema = z.object({
  reviewId: z.string().uuid(),
  status: z.enum(['approved', 'rejected', 'needs_changes']),
  feedback: z.string().max(10000).optional(),
  editedData: z.record(z.unknown()).optional(),
  reviewerId: z.string().uuid().optional(),
})

export const executionUpdateSchema = z.object({
  executionId: z.string().min(1),
  workflowId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'waiting_review', 'completed', 'failed', 'cancelled']),
  currentStepIndex: z.number().int().min(0).optional(),
  outputData: z.record(z.unknown()).optional(),
  error: z.string().max(10000).optional(),
})

export const webhookTriggerSchema = z.object({
  triggerType: z.string().optional(),
  inputData: z.record(z.unknown()).optional(),
})

// Helper function to validate and parse
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown):
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  }
}
```

#### 5.2 Apply Validation to Routes
**Example for `review-request/route.ts`:**
```typescript
import { reviewRequestSchema, validateBody } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const validation = validateBody(reviewRequestSchema, body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error },
      { status: 400 }
    )
  }

  const { executionId, stepId, reviewType, ... } = validation.data
  // ... rest of handler
}
```

#### 5.3 Add Rate Limiting Middleware
**File:** `src/middleware.ts`
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function rateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Rate limit API routes
  if (path.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'

    // Different limits for different endpoints
    let limit = 100
    let window = 60000 // 1 minute

    if (path.includes('/gemini/')) {
      limit = 20  // Stricter for AI endpoints
    } else if (path.includes('/webhook/')) {
      limit = 200  // Higher for webhooks
    }

    if (!rateLimit(`${ip}:${path}`, limit, window)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

#### 5.4 Add Security Headers
**File:** `next.config.js`
```javascript
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}
```

---

### Phase 6: Database Transactions (Day 6-7)

#### 6.1 Create Transaction RPC Functions
**Migration:** `supabase/migrations/xxx_transaction_functions.sql`
```sql
-- Function to atomically complete an execution
CREATE OR REPLACE FUNCTION complete_execution(
  p_execution_id UUID,
  p_status TEXT,
  p_output_data JSONB DEFAULT NULL,
  p_error TEXT DEFAULT NULL,
  p_worker_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Update execution
  UPDATE executions
  SET
    status = p_status,
    output_data = COALESCE(p_output_data, output_data),
    error = p_error,
    completed_at = NOW()
  WHERE id = p_execution_id;

  -- Update worker if provided
  IF p_worker_id IS NOT NULL THEN
    UPDATE digital_workers
    SET
      status = 'active',
      current_execution_id = NULL
    WHERE id = p_worker_id;
  END IF;

  -- Log activity
  INSERT INTO activity_logs (type, workflow_id, data, created_at)
  SELECT
    CASE WHEN p_status = 'completed' THEN 'execution_completed' ELSE 'execution_failed' END,
    workflow_id,
    jsonb_build_object(
      'executionId', p_execution_id,
      'status', p_status,
      'error', p_error
    ),
    NOW()
  FROM executions
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql;

-- Function to atomically process review response
CREATE OR REPLACE FUNCTION process_review_response(
  p_review_id UUID,
  p_status TEXT,
  p_feedback TEXT DEFAULT NULL,
  p_edited_data JSONB DEFAULT NULL,
  p_reviewer_id UUID DEFAULT NULL
) RETURNS TABLE(
  execution_id UUID,
  resume_webhook_url TEXT
) AS $$
DECLARE
  v_execution_id UUID;
  v_resume_url TEXT;
BEGIN
  -- Update review request
  UPDATE review_requests
  SET
    status = p_status,
    feedback = p_feedback,
    edited_data = p_edited_data,
    reviewer_id = p_reviewer_id,
    reviewed_at = NOW()
  WHERE id = p_review_id
  RETURNING
    review_requests.execution_id,
    action_payload->>'resumeWebhookUrl'
  INTO v_execution_id, v_resume_url;

  -- Log activity
  INSERT INTO activity_logs (type, workflow_id, data, created_at)
  SELECT
    CASE WHEN p_status = 'approved' THEN 'review_approved' ELSE 'review_rejected' END,
    e.workflow_id,
    jsonb_build_object(
      'reviewId', p_review_id,
      'executionId', v_execution_id,
      'status', p_status
    ),
    NOW()
  FROM executions e
  WHERE e.id = v_execution_id;

  RETURN QUERY SELECT v_execution_id, v_resume_url;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint for reviews
ALTER TABLE review_requests
ADD CONSTRAINT unique_pending_review
UNIQUE (execution_id, step_id)
WHERE status = 'pending';
```

#### 6.2 Use RPC in Routes
**File:** `execution-complete/route.ts`
```typescript
const { error } = await supabase.rpc('complete_execution', {
  p_execution_id: executionId,
  p_status: status,
  p_output_data: outputData,
  p_error: executionError,
  p_worker_id: workerId,
})

if (error) {
  logger.error('Transaction failed:', error)
  return NextResponse.json({ error: 'Failed to complete execution' }, { status: 500 })
}
```

**File:** `review-response/route.ts`
```typescript
const { data, error } = await supabase.rpc('process_review_response', {
  p_review_id: reviewId,
  p_status: status,
  p_feedback: feedback,
  p_edited_data: editedData,
  p_reviewer_id: reviewerId,
})

if (error) {
  logger.error('Transaction failed:', error)
  return NextResponse.json({ error: 'Failed to process review' }, { status: 500 })
}

const resumeWebhookUrl = data?.[0]?.resume_webhook_url
// ... continue with resume webhook call
```

---

## Files to Modify

### API Routes (11 files)
- `src/app/api/n8n/execution-update/route.ts`
- `src/app/api/n8n/execution-complete/route.ts`
- `src/app/api/n8n/review-request/route.ts`
- `src/app/api/n8n/review-response/route.ts`
- `src/app/api/n8n/webhook/[workflowId]/route.ts`
- `src/app/api/n8n/sync/route.ts`
- `src/app/api/n8n/credentials/route.ts`
- `src/app/api/analytics/workers/route.ts`
- `src/app/api/analytics/export/route.ts`
- `src/app/api/test/route.ts`
- `src/app/api/n8n/audit/route.ts`

### Libraries (3 files)
- `src/lib/n8n/client.ts`
- `src/lib/n8n/credentials.ts`
- `src/lib/validation.ts` (new)

### Types (1 file)
- `src/types/index.ts`

### Hooks (3 files)
- `src/hooks/useExecutions.ts`
- `src/hooks/useReviewRequests.ts`
- `src/hooks/useRealtime.ts`

### Middleware & Config (2 files)
- `src/middleware.ts` (new or modify)
- `next.config.js`

### New Files (2 files)
- `src/app/api/n8n/cleanup/route.ts`
- `src/lib/validation.ts`

### Migrations (4 files)
- `supabase/migrations/xxx_add_webhook_signature.sql`
- `supabase/migrations/xxx_unique_review_constraint.sql`
- `supabase/migrations/xxx_transaction_functions.sql`
- `supabase/migrations/xxx_reencrypt_credentials.sql`

---

## Verification Checklist

### After Phase 1 (Security):
- [ ] Call webhook without signature -> 401 Unauthorized
- [ ] Try SSRF with localhost URL -> 400 Bad Request
- [ ] Create new credential -> verify AES encryption in DB
- [ ] Call /api/test in production mode -> 404 Not Found
- [ ] Generate new 32-byte encryption key and rotate credentials

### After Phase 2 (Data):
- [ ] Trigger n8n execution -> verify single execution record
- [ ] Approve review with feedback -> verify feedback retrievable via hook
- [ ] Check activity logs insert without type errors

### After Phase 3 (Authorization):
- [ ] User A cannot see User B's workflows in /api/n8n/sync
- [ ] User cannot approve review from different organization
- [ ] Credential GET by ID returns 404 for wrong organization

### After Phase 4 (Reliability):
- [ ] Simulate n8n timeout on resume -> review stays pending, user can retry
- [ ] Try creating duplicate review for same step -> returns existing review
- [ ] Wait node has timeout configured in n8n

### After Phase 5 (Validation):
- [ ] Invalid JSON body -> 400 with validation details
- [ ] Exceed rate limit -> 429 Too Many Requests
- [ ] Security headers present in response

### After Phase 6 (Transactions):
- [ ] Kill DB connection mid-execution-complete -> no partial state
- [ ] Worker status always consistent with execution status
- [ ] Activity logs created atomically with state changes

---

## Priority Summary

| Day | Phase | Focus | Issues Fixed |
|-----|-------|-------|--------------|
| 1-2 | Phase 1 | Critical Security | S1-S7 |
| 2-3 | Phase 2 | Data Corruption | N1-N3 |
| 3-4 | Phase 3 | Authorization | S8-S10 |
| 4-5 | Phase 4 | Workflow Reliability | N4-N8 |
| 5-6 | Phase 5 | Input Validation | S11, S14, S17-S20 |
| 6-7 | Phase 6 | Transactions | N4 (complete) |

**Total: ~7 days of implementation**

---

## Immediate Actions (Do Now)

1. **Rotate all API keys** in `.env.local`:
   - Generate new Gemini API key
   - Generate new n8n API key
   - Regenerate Supabase anon key if needed

2. **Generate new encryption key**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Add to `.env.local` as `CREDENTIAL_ENCRYPTION_KEY`

3. **Verify .env.local is in .gitignore** (it is, but double-check)

4. **Check git history** for any accidentally committed secrets:
   ```bash
   git log -p -- .env* | grep -i "key\|secret\|password"
   ```

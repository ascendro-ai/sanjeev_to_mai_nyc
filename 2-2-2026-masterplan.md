# Master Plan: Enterprise Agent Platform - Complete Fix List

**Created:** February 2, 2026
**Updated:** February 2, 2026
**Purpose:** Systematic action plan to resolve ALL documented issues
**Sources:** `CODE_QUALITY_REPORT.md`, `TEST_FIX_PLAN.md`, `SECURITY_AND_N8N_FIX_PLAN.md`

---

## Executive Summary

This document consolidates ALL issues from the three source documents into a single actionable fix plan organized by priority and dependency order.

### Issue Counts by Section (from CODE_QUALITY_REPORT.md)

| Section | Critical | High | Medium | Low |
|---------|----------|------|--------|-----|
| Workflows Pages | 5 | 4 | 4 | 4 |
| Analytics Dashboard | 3 | 3 | 4 | 4 |
| Hooks Layer | 1 | 4 | 5 | 4 |
| Workflow Builder | 2 | 5 | 5 | 3 |
| n8n API Routes | 3 | 5 | 7 | 5 |
| Control Room | 2 | 0 | 4 | 0 |
| Team Functionality | 1 | 2 | 4 | 1 |
| **TOTAL** | **17** | **23** | **33** | **21** |

### Implementation Phases

| Phase | Focus | Issues | Priority | Est. Time |
|-------|-------|--------|----------|-----------|
| 1 | Critical Security | 10 | MUST FIX | Day 1-2 |
| 2 | Critical Bugs & Data Corruption | 12 | MUST FIX | Day 2-3 |
| 3 | Authorization & Isolation | 10 | HIGH | Day 3-4 |
| 4 | Workflow Reliability | 12 | HIGH | Day 4-5 |
| 5 | Input Validation & Rate Limiting | 14 | HIGH | Day 5-6 |
| 6 | Analytics & Hooks Fixes | 14 | MEDIUM | Day 6-7 |
| 7 | Database Transactions | 4 | MEDIUM | Day 7-8 |
| 8 | UI/UX & Code Quality | 15 | NICE TO FIX | Day 8-9 |
| 9 | Test Coverage | 20+ | QUALITY | Day 9-11 |
| 10 | Dead Code Cleanup | 8 | CLEANUP | Day 11-12 |

**Total: ~94+ issues across 12 days**

### Top 5 Most Severe Issues

1. **Infinite loop in Analytics** - `trends/route.ts:103-107` - Server hangs
2. **Broken XOR encryption** - `lib/n8n/credentials.ts` - Credentials exposed
3. **Hardcoded organization ID** - `WorkflowBuilder.tsx:73` - Multi-tenancy broken
4. **Missing org permission checks** - All analytics routes - Data breach risk
5. **Redirect loop** - `workflows/page.tsx:9-12` - Back button breaks

---

# PHASE 1: CRITICAL SECURITY FIXES

> **Priority:** MUST FIX - Active vulnerabilities
> **Timeline:** Day 1-2
> **Issues:** 10

---

## 1.1 Add Webhook Authentication (S1, S2)

**Files:** All `/api/n8n/` webhook routes
**Issue:** Unauthenticated webhooks - anyone can trigger workflows

**Fix:** Add signature verification to each webhook route:
```typescript
// Add to src/lib/n8n/webhook-auth.ts (NEW FILE)
import { createHmac } from 'crypto'

export function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false
  const expectedSignature = createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  return signature === `sha256=${expectedSignature}`
}

// In each webhook route:
import { verifyWebhookSignature } from '@/lib/n8n/webhook-auth'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-webhook-signature')

  if (!verifyWebhookSignature(body, signature, process.env.WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const data = JSON.parse(body)
  // ... rest of handler
}
```

**Apply to:**
- `src/app/api/n8n/execution-update/route.ts`
- `src/app/api/n8n/execution-complete/route.ts`
- `src/app/api/n8n/review-request/route.ts`
- `src/app/api/n8n/webhook/[workflowId]/route.ts`

---

## 1.2 Fix SSRF Vulnerability (S3)

**File:** `src/app/api/n8n/review-response/route.ts`
**Lines:** 100, 142-164
**Issue:** Attacker-controlled URLs in `resumeWebhookUrl`, `callbackUrl`

```typescript
const ALLOWED_CALLBACK_HOSTS = [
  process.env.N8N_API_URL ? new URL(process.env.N8N_API_URL).host : 'localhost:5678',
]

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_CALLBACK_HOSTS.includes(parsed.hostname) &&
           (parsed.protocol === 'https:' || parsed.hostname === 'localhost')
  } catch {
    return false
  }
}

// Before any fetch to user-provided URL:
if (!isAllowedUrl(resumeWebhookUrl)) {
  return NextResponse.json({ error: 'Invalid callback URL' }, { status: 400 })
}
```

---

## 1.3 Replace XOR with AES-256-GCM (S4)

**File:** `src/lib/n8n/credentials.ts`
**Lines:** 59-78

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
}

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

---

## 1.4 Require Encryption Key (S5)

**File:** `src/lib/n8n/credentials.ts`
**Line:** 11

Remove the default fallback and require the key (already included in 1.3 above).

---

## 1.5 Protect Test Endpoints (S6)

**File:** `src/app/api/test/route.ts`

```typescript
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }
  // ... rest of handler
}

export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }
  // ... rest of handler
}
```

---

## 1.6 Fix Missing Admin Check on Audit Delete (S21)

**File:** `src/app/api/n8n/audit/route.ts`
**Lines:** 279-307

```typescript
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // ... proceed with delete
}
```

---

## 1.7 Add N8N API Key Validation

**File:** `src/lib/n8n/client.ts`
**Lines:** 8-9

```typescript
const N8N_API_KEY = process.env.N8N_API_KEY
if (!N8N_API_KEY) {
  throw new Error('N8N_API_KEY environment variable is required')
}
```

---

## 1.8 Sanitize Error Messages (S13)

**Files:** Multiple API routes
**Issue:** Stack traces and internal URLs exposed

```typescript
// Create src/lib/error-handler.ts (NEW FILE)
export function sanitizeError(error: unknown): string {
  if (process.env.NODE_ENV === 'development') {
    return error instanceof Error ? error.message : String(error)
  }
  return 'An internal error occurred'
}

export function logErrorSafely(logger: Logger, message: string, error: unknown, context?: Record<string, unknown>) {
  // Remove sensitive data before logging
  const safeContext = { ...context }
  delete safeContext.apiKey
  delete safeContext.password
  delete safeContext.token

  logger.error(message, { error: error instanceof Error ? error.message : error, ...safeContext })
}
```

---

## 1.9 Redact API Keys from Logs (S4/N4)

**File:** `src/app/api/n8n/resume/[executionId]/route.ts`
**Lines:** 92-96

```typescript
// BEFORE
logger.error('Failed to resume n8n workflow:', { targetUrl })

// AFTER
logger.error('Failed to resume n8n workflow:', {
  targetUrl: targetUrl.replace(/api[_-]?key=\w+/gi, 'api_key=REDACTED')
})
```

---

## 1.10 Immediate Actions

```bash
# 1. Generate new encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add to .env.local as CREDENTIAL_ENCRYPTION_KEY

# 2. Generate webhook secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add to .env.local as WEBHOOK_SECRET

# 3. Verify .env.local is in .gitignore
grep -q "\.env\.local" .gitignore && echo "OK" || echo "ADD IT!"

# 4. Check git history for secrets
git log -p -- .env* | grep -i "key\|secret\|password" | head -20
```

---

## Phase 1 Verification

```bash
npm run build
npm run test
```

Manual tests:
- [ ] Call webhook without signature → 401 Unauthorized
- [ ] Try SSRF with localhost:5432 → 400 Bad Request
- [ ] Create credential → verify AES encryption in DB
- [ ] Call /api/test in NODE_ENV=production → 404
- [ ] Non-admin DELETE /api/n8n/audit → 403

---

# PHASE 2: CRITICAL BUGS & DATA CORRUPTION

> **Priority:** MUST FIX - Data integrity issues
> **Timeline:** Day 2-3
> **Issues:** 8

---

## 2.1 Fix Execution Field Lookup Bug (N1, N5)

**File:** `src/app/api/n8n/execution-update/route.ts`
**Lines:** 38, 75

```typescript
// BEFORE
.eq('id', executionId)

// AFTER
.eq('n8n_execution_id', executionId)
```

---

## 2.2 Fix Review Feedback Column Mismatch (N2)

**File:** `src/app/api/n8n/review-response/route.ts`
**Lines:** 51-59

```typescript
// BEFORE
.update({
  status,
  action_payload: { ...reviewRequest.action_payload, feedback, editedData }
})

// AFTER
.update({
  status,
  feedback,                              // Direct column
  edited_data: editedData,               // Direct column
  reviewer_id: reviewerId,               // Direct column
  reviewed_at: new Date().toISOString(),
  action_payload: reviewRequest.action_payload  // Keep URL only
})
```

---

## 2.3 Add Missing ActivityLog Types (N3)

**File:** `src/types/index.ts`
**Lines:** 302-312

```typescript
export type ActivityLogType =
  | 'digital_worker_activation'
  | 'agent_building_start'
  | 'agent_building_complete'
  | 'workflow_execution_start'
  | 'workflow_step_execution'
  | 'workflow_step_complete'
  | 'workflow_step_error'       // ADD
  | 'workflow_complete'
  | 'agent_assignment'
  | 'error'
  | 'blocker'
  | 'debug_analysis'            // ADD
  | 'review_approved'           // ADD
  | 'review_rejected'           // ADD
  | 'review_requested'          // ADD
  | 'review_completed'          // ADD
  | 'execution_progress'        // ADD
  | 'execution_completed'       // ADD
  | 'execution_failed'          // ADD
```

---

## 2.4 Fix useTeam Hook Ternary Bug (T1)

**File:** `src/hooks/useTeam.ts`
**Line:** 95

```typescript
// BEFORE (wrong precedence)
role: worker.description || worker.type === 'ai' ? 'AI Agent' : 'Team Member',

// AFTER (correct)
role: worker.description || (worker.type === 'ai' ? 'AI Agent' : 'Team Member'),
```

---

## 2.5 Fix Analytics Infinite Loop (A1) - CRITICAL

**File:** `src/app/api/analytics/workers/[workerId]/trends/route.ts`
**Lines:** 103-107

```typescript
// BEFORE (infinite loop - d.setDate returns number)
for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
  // ...
}

// AFTER (correct)
for (let d = new Date(startDate); d <= new Date(); ) {
  // ... do work ...
  d.setDate(d.getDate() + 1)  // Increment at end
}
```

---

## 2.6 Fix Analytics Column Mismatch (A2)

**File:** `src/app/api/analytics/workers/[workerId]/trends/route.ts`
**Lines:** 63-77

Add null checks and fallbacks for database columns:
```typescript
trendData = {
  executions: dailyMetrics.map(m => ({
    value: m.total_executions ?? 0,  // Add fallback
  })),
  successRate: dailyMetrics.map(m => ({
    value: m.successful_executions ?? 0,  // Add fallback
  })),
}
```

---

## 2.7 Fix Analytics Export Type Mismatch (A3)

**File:** `src/app/api/analytics/export/route.ts`
**Lines:** 194-208

```typescript
// Return properly typed response
return NextResponse.json({
  data: Buffer.from(output).toString('base64'),
  format: format,
  filename: `analytics-export-${Date.now()}.${format}`,
})
```

---

## 2.8 Fix Hardcoded Organization ID (WB1)

**File:** `src/components/WorkflowBuilder.tsx`
**Lines:** 150, 262

```typescript
// At component top:
const { user } = useAuth()
const { data: profile } = useQuery({
  queryKey: ['profile', user?.id],
  queryFn: async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user?.id)
      .single()
    return data
  },
  enabled: !!user?.id,
})

// Replace hardcoded ID:
organizationId: profile?.organization_id,
```

---

## 2.9 Fix Workflows List Redirect Loop (W2) - CRITICAL

**File:** `src/app/(dashboard)/workflows/page.tsx`
**Lines:** 9-12

```typescript
// BEFORE - causes infinite redirect loop
useEffect(() => {
  router.replace('/create')  // ❌ Unconditional redirect
}, [router])

// AFTER - only redirect if no workflows exist
const { data: workflows, isLoading } = useWorkflows()

useEffect(() => {
  if (!isLoading && workflows?.length === 0) {
    router.replace('/create')
  }
}, [isLoading, workflows, router])
```

**Impact:** Back button causes infinite redirect, breaking navigation.

---

## 2.10 Fix Silent Mutation Failures (W1) - CRITICAL

**File:** `src/app/(dashboard)/workflows/[id]/page.tsx`
**Lines:** 68-99, 146-154

```typescript
// BEFORE
const handleSaveStep = useCallback(async () => {
  await updateSteps.mutateAsync({...})
  setIsEditMode(false)  // ❌ Runs even if save failed
  setEditForm(null)
}, [])

// AFTER
const handleSaveStep = useCallback(async () => {
  try {
    await updateSteps.mutateAsync({...})
    toast.success('Step saved successfully')
    setIsEditMode(false)
    setEditForm(null)
  } catch (error) {
    toast.error('Failed to save step. Please try again.')
    // Don't exit edit mode on failure
  }
}, [])
```

---

## 2.11 Fix Query Key Mismatch (W3) - CRITICAL

**File:** `src/app/(dashboard)/workflows/[id]/testing/page.tsx`
**Line:** 20

```typescript
// BEFORE - different key than useWorkflow hook
queryKey: ['workflow', id]

// AFTER - match the key used by useWorkflow
queryKey: ['workflows', id]  // Consistent with useWorkflows hook
```

**Impact:** Same workflow fetched twice, separate caches, wasted bandwidth.

---

## 2.12 Fix useWorkflows Organization Filter (W4) - CRITICAL SECURITY

**File:** `src/hooks/useWorkflows.ts`
**Lines:** 103-111

```typescript
// BEFORE - fetches ALL workflows
const { data } = await supabase
  .from('workflows')
  .select('*')
  .order('created_at', { ascending: false })

// AFTER - filter by user's organization
const { data: membership } = await supabase
  .from('organization_members')
  .select('organization_id')
  .eq('user_id', user.id)
  .single()

const { data } = await supabase
  .from('workflows')
  .select('*')
  .eq('organization_id', membership?.organization_id)
  .order('created_at', { ascending: false })
```

**Impact:** Users may see workflows from other organizations - data breach.

---

## Phase 2 Verification

- [ ] Trigger n8n execution → verify single execution record
- [ ] Approve review with feedback → verify feedback retrievable
- [ ] Check activity logs insert without type errors
- [ ] Test analytics trends endpoint → no server hang
- [ ] New workflows save with correct organization ID
- [ ] Navigate to /workflows → no infinite redirect loop (W2)
- [ ] Failed step save → user sees error toast (W1)
- [ ] Testing page uses same query key as detail page (W3)
- [ ] User only sees workflows from their organization (W4)

---

# PHASE 3: AUTHORIZATION & ISOLATION

> **Priority:** HIGH - Security access control
> **Timeline:** Day 3-4
> **Issues:** 8

---

## 3.1 Add Organization Filters (S8)

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

---

## 3.2 Fix Credential Access Control (S9)

**File:** `src/app/api/n8n/credentials/route.ts`
**Lines:** 40-56

```typescript
if (credentialId) {
  const { data: credential } = await supabase
    .from('credentials')
    .select('*')
    .eq('id', credentialId)
    .eq('organization_id', membership.organization_id)  // ADD ORG FILTER
    .single()

  if (!credential) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }
  // ... return credential
}
```

---

## 3.3 Add Review Authorization (S10)

**File:** `src/app/api/n8n/review-response/route.ts`

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

---

## 3.4 Add Analytics Organization Permission (A4)

**File:** `src/app/api/analytics/workers/route.ts`

Apply the same organization filter pattern from 3.1.

---

## 3.5 Fix Template Delete Ownership Check (N9)

**File:** `src/app/api/n8n/templates/route.ts`
**Lines:** 280-311

```typescript
const { data: template } = await supabase
  .from('workflow_templates')
  .select('created_by, organization_id')
  .eq('id', templateId)
  .single()

if (!template || template.organization_id !== membership.organization_id) {
  return NextResponse.json({ error: 'Template not found' }, { status: 404 })
}

if (template.created_by !== user.id && profile?.role !== 'admin') {
  return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
}
```

---

## 3.6 Filter Sensitive Data to Gemini (S12)

**Files:** `debug/route.ts`, `ai-action/route.ts`

```typescript
// Create src/lib/pii-filter.ts (NEW FILE)
export function filterPII(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data

  const sensitiveKeys = ['email', 'password', 'ssn', 'credit_card', 'phone', 'address']
  const filtered = { ...data as Record<string, unknown> }

  for (const key of Object.keys(filtered)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      filtered[key] = '[REDACTED]'
    } else if (typeof filtered[key] === 'object') {
      filtered[key] = filterPII(filtered[key])
    }
  }

  return filtered
}

// Before sending to Gemini:
const safeData = filterPII(userData)
```

---

## 3.7 Add Authentication Redirect (CR6)

**File:** `src/app/(dashboard)/control-room/page.tsx`

```typescript
import { useRouter } from 'next/navigation'

const router = useRouter()

useEffect(() => {
  if (!user && !isLoading) {
    router.push('/login')
  }
}, [user, isLoading, router])
```

---

## 3.8 Mask Activity Log PII (S22)

**Files:** Multiple routes that insert activity logs

```typescript
await supabase.from('activity_logs').insert({
  type: activityType,
  workflow_id: workflowId,
  data: filterPII({  // Wrap with PII filter
    executionId,
    status,
    // ... other data
  }),
})
```

---

## Phase 3 Verification

- [ ] User A cannot see User B's workflows
- [ ] User cannot approve review from different org
- [ ] Credential GET by ID returns 404 for wrong org
- [ ] PII filtered before sending to Gemini
- [ ] Activity logs don't contain raw PII

---

# PHASE 4: WORKFLOW RELIABILITY

> **Priority:** HIGH - Prevent stuck workflows
> **Timeline:** Day 4-5
> **Issues:** 10

---

## 4.1 Fix Resume Webhook Handling (N5)

**File:** `src/app/api/n8n/review-response/route.ts`

```typescript
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

---

## 4.2 Add Duplicate Review Prevention (N7)

**File:** `src/app/api/n8n/review-request/route.ts`

```typescript
// Check for existing pending review
const { data: existing } = await supabase
  .from('review_requests')
  .select('id')
  .eq('execution_id', executionId)
  .eq('step_id', stepId)
  .eq('status', 'pending')
  .single()

if (existing) {
  return NextResponse.json({
    reviewId: existing.id,
    message: 'Review already exists',
    alreadyExists: true
  })
}
```

---

## 4.3 Add Wait Node Timeout (N6)

**File:** `src/lib/n8n/client.ts` in `convertToN8NWorkflow`

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
    limitWaitTime: true,                              // ADD
    maxWaitTime: step.requirements?.timeoutHours || 72, // ADD
    maxWaitTimeUnit: 'hours',                         // ADD
  },
  typeVersion: 1.1,
}
```

---

## 4.4 Add Stale Review Cleanup (N8)

**File:** New `src/app/api/n8n/cleanup/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  // Expire stale reviews
  const { data: expiredReviews } = await supabase
    .from('review_requests')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('timeout_at', new Date().toISOString())
    .select('id, execution_id')

  // Update related executions
  for (const review of expiredReviews || []) {
    await supabase
      .from('executions')
      .update({ status: 'failed', error: 'Review timed out' })
      .eq('id', review.execution_id)
      .eq('status', 'waiting_review')
  }

  return NextResponse.json({ expiredCount: expiredReviews?.length || 0 })
}
```

---

## 4.5 Fix Zombie Execution on N8N Down (N9)

**File:** `src/app/api/n8n/webhook/[workflowId]/route.ts`

```typescript
const { data: execution } = await supabase
  .from('executions')
  .insert({...})
  .select()
  .single()

try {
  const n8nExecution = await triggerN8nWorkflow(workflowId, payload)
  await supabase
    .from('executions')
    .update({ n8n_execution_id: n8nExecution.id })
    .eq('id', execution.id)
} catch (error) {
  // Mark as failed instead of orphan
  await supabase
    .from('executions')
    .update({
      status: 'failed',
      error: 'Failed to trigger n8n workflow: ' + (error instanceof Error ? error.message : 'Unknown error')
    })
    .eq('id', execution.id)

  throw error
}
```

---

## 4.6 Fix Credential Sync Silent Fail (N10)

**File:** `src/lib/n8n/credentials.ts`
**Lines:** 197-211

```typescript
// After saving to DB, verify n8n sync
const dbResult = await saveToDatabase(credential)
const n8nResult = await syncToN8n(credential)

if (!n8nResult.success) {
  // Rollback DB or mark as unsynced
  await supabase
    .from('credentials')
    .update({ sync_status: 'failed', sync_error: n8nResult.error })
    .eq('id', dbResult.id)

  throw new Error(`Credential saved but n8n sync failed: ${n8nResult.error}`)
}
```

---

## 4.7 Fix React Query Cache Stale (N11)

**File:** `src/hooks/useRealtime.ts`

```typescript
import { useQueryClient } from '@tanstack/react-query'

export function useControlRoomRealtime(options: RealtimeOptions) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase.channel('control-room')

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'review_requests' }, () => {
      queryClient.invalidateQueries({ queryKey: ['reviewRequests'] })
    })

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'executions' }, () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] })
    })

    channel.subscribe()
    return () => { channel.unsubscribe() }
  }, [queryClient])
}
```

---

## 4.8 Add Execution Update Idempotency (N12)

**File:** `src/app/api/n8n/execution-update/route.ts`

```typescript
// Add idempotency key check
const idempotencyKey = request.headers.get('x-idempotency-key')

if (idempotencyKey) {
  const { data: existing } = await supabase
    .from('execution_updates')
    .select('response')
    .eq('idempotency_key', idempotencyKey)
    .single()

  if (existing) {
    return NextResponse.json(existing.response)
  }
}

// ... process update ...

// Store idempotency record
if (idempotencyKey) {
  await supabase.from('execution_updates').insert({
    idempotency_key: idempotencyKey,
    response: responseData,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  })
}
```

---

## 4.9 Fix Unsafe Non-Null Assertion (WB2)

**File:** `src/components/WorkflowBuilder.tsx`
**Line:** 540

```typescript
const selectedStep = steps.find(s => s.id === selectedStepId)

{selectedStepId && selectedStep && (
  <StepConfigModal
    step={selectedStep}
    isOpen={showStepConfig}
    onClose={() => setShowStepConfig(false)}
  />
)}
```

---

## 4.10 Add Fetch Timeouts (S16)

**Files:** `review-response/route.ts`, `credentials.ts`, and other external calls

```typescript
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeout)
    return response
  } catch (error) {
    clearTimeout(timeout)
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  }
}
```

---

## Phase 4 Verification

- [ ] Simulate n8n timeout on resume → review stays pending
- [ ] Create duplicate review for same step → returns existing
- [ ] Wait node has timeout in n8n workflow
- [ ] Stale reviews auto-expire via cleanup endpoint
- [ ] Real-time updates trigger cache invalidation

---

# PHASE 5: INPUT VALIDATION & RATE LIMITING

> **Priority:** HIGH - Defense in depth
> **Timeline:** Day 5-6
> **Issues:** 12

---

## 5.1 Add Zod Validation Schemas

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
  timeoutHours: z.number().min(1).max(168).optional(),
})

export const reviewResponseSchema = z.object({
  reviewId: z.string().uuid(),
  status: z.enum(['approved', 'rejected', 'needs_changes']),
  feedback: z.string().max(10000).optional(),
  editedData: z.record(z.unknown()).optional(),
})

export const executionUpdateSchema = z.object({
  executionId: z.string().min(1),
  workflowId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'waiting_review', 'completed', 'failed', 'cancelled']),
  currentStepIndex: z.number().int().min(0).optional(),
  outputData: z.record(z.unknown()).optional(),
  error: z.string().max(10000).optional(),
})

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

---

## 5.2 Apply Validation to Routes (S14)

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

  const { executionId, stepId, reviewType } = validation.data
  // ... rest of handler
}
```

Apply to: `review-request`, `review-response`, `execution-update`, `webhook`

---

## 5.3 Add Rate Limiting Middleware (S11)

**File:** `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

  if (path.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'

    let limit = 100
    let window = 60000

    if (path.includes('/gemini/')) {
      limit = 20  // Stricter for AI
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

---

## 5.4 Add Security Headers (S20)

**File:** `next.config.js`

```javascript
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

module.exports = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
```

---

## 5.5 Add Request Size Limits (S17)

**File:** `next.config.js`

```javascript
module.exports = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
```

---

## 5.6 Add Pagination Limits (S18)

**File:** `src/app/api/testing/test-cases/route.ts`

```typescript
const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Max 100
const offset = parseInt(searchParams.get('offset') || '0')
```

Apply to all list endpoints.

---

## 5.7 Sign OAuth State (S15)

**File:** `src/app/api/n8n/oauth/callback/route.ts`

```typescript
import { createHmac } from 'crypto'

function signState(state: object): string {
  const payload = JSON.stringify(state)
  const signature = createHmac('sha256', process.env.OAUTH_STATE_SECRET!)
    .update(payload)
    .digest('hex')
  return Buffer.from(JSON.stringify({ payload, signature })).toString('base64')
}

function verifyState(encoded: string): object | null {
  try {
    const { payload, signature } = JSON.parse(Buffer.from(encoded, 'base64').toString())
    const expectedSig = createHmac('sha256', process.env.OAUTH_STATE_SECRET!)
      .update(payload)
      .digest('hex')
    if (signature !== expectedSig) return null
    return JSON.parse(payload)
  } catch {
    return null
  }
}
```

---

## 5.8 Fix Missing Input Validation in Workflows (W6)

**File:** `src/app/(dashboard)/workflows/[id]/page.tsx`
**Lines:** 102-125

```typescript
// BEFORE - no validation
const addGreenItem = useCallback(() => {
  setEditForm({...editForm, greenList: [...editForm.greenList, newGreenItem.trim()]})
  // ❌ No duplicate check, max length, or XSS protection
}, [])

// AFTER - with validation
const MAX_ITEM_LENGTH = 500
const MAX_LIST_SIZE = 100

const addGreenItem = useCallback(() => {
  const trimmed = newGreenItem.trim()

  // Validate length
  if (trimmed.length > MAX_ITEM_LENGTH) {
    toast.error(`Item must be less than ${MAX_ITEM_LENGTH} characters`)
    return
  }

  // Check for duplicates
  if (editForm.greenList.includes(trimmed)) {
    toast.error('This item already exists')
    return
  }

  // Check list size
  if (editForm.greenList.length >= MAX_LIST_SIZE) {
    toast.error(`Maximum ${MAX_LIST_SIZE} items allowed`)
    return
  }

  // Sanitize (basic XSS protection - use DOMPurify for production)
  const sanitized = trimmed.replace(/[<>]/g, '')

  setEditForm({...editForm, greenList: [...editForm.greenList, sanitized]})
  setNewGreenItem('')
}, [editForm, newGreenItem])
```

---

## 5.9-5.12 Additional Validations

Apply similar patterns to remaining routes for:
- Prompt injection protection (S19) - sanitize user input before LLM
- Workflow structure validation (WB6)
- Node data validation (N6)
- Credential type validation
- Analytics date range validation

---

## Phase 5 Verification

- [ ] Invalid JSON body → 400 with details
- [ ] Exceed rate limit → 429 Too Many Requests
- [ ] Security headers present in responses
- [ ] Pagination respects max limits
- [ ] OAuth state is signed
- [ ] Workflow greenList validates duplicates/length/XSS (W6)

---

# PHASE 6: ANALYTICS & HOOKS FIXES

> **Priority:** MEDIUM - Code quality
> **Timeline:** Day 6-7
> **Issues:** 14

---

## 6.1 Fix Analytics N+1 Query (A5)

**File:** `src/app/api/analytics/export/route.ts`

```typescript
// BEFORE: N+1 queries
for (const worker of workers) {
  const { data: executions } = await supabase
    .from('executions')
    .select('*')
    .eq('worker_id', worker.id)
}

// AFTER: Single query with join
const { data: workersWithExecutions } = await supabase
  .from('digital_workers')
  .select(`
    *,
    executions(*)
  `)
  .eq('organization_id', orgId)
```

---

## 6.2 Fix Analytics Promise.all Error Handling (A6)

**File:** `src/app/api/analytics/workers/route.ts`

```typescript
const workerAnalytics = await Promise.all(
  workers.map(async (worker) => {
    const { data: executions, error: execError } = await supabase...

    if (execError) {
      logger.error('Failed to fetch executions for worker', { workerId: worker.id, error: execError })
      return { ...worker, executions: [], error: true }
    }

    return { ...worker, executions }
  })
)

// Filter out errored workers or handle appropriately
const validAnalytics = workerAnalytics.filter(w => !w.error)
```

---

## 6.3 Calculate Real Trends (A7)

**File:** `src/app/api/analytics/workers/route.ts`

```typescript
function calculateTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
  if (current > previous * 1.1) return 'up'
  if (current < previous * 0.9) return 'down'
  return 'stable'
}

// Replace hardcoded 'stable':
executionTrend: calculateTrend(thisWeekCount, lastWeekCount),
successRateTrend: calculateTrend(thisWeekRate, lastWeekRate),
```

---

## 6.4 Add Trends Loading State (A8)

**File:** `src/app/(dashboard)/analytics/workers/[id]/page.tsx`

```typescript
const { trends, isLoading: trendsLoading, error: trendsError } = useWorkerTrends(id, dateRange)

{trendsLoading && <TrendsSkeleton />}
{trendsError && <div className="text-red-500">Failed to load trends</div>}
{trends && <TrendsChart data={trends} />}
```

---

## 6.5 Memoize Supabase Client (H2, W9)

**Files:** 6 hook files + 1 page

```typescript
// BEFORE
const supabase = createClient()

// AFTER
const supabase = useMemo(() => createClient(), [])
```

Apply to:
- `useWorkflows.ts`
- `useExecutions.ts`
- `useReviewRequests.ts`
- `useActivityLogs.ts`
- `useConversations.ts`
- `useRealtime.ts`
- `src/app/(dashboard)/workflows/[id]/testing/page.tsx` (line 17) **(W9)**

---

## 6.6 Fix useRealtime Stale Closure (H3)

**File:** `src/hooks/useRealtime.ts`

```typescript
const tablesRef = useRef(tables)
tablesRef.current = tables

useEffect(() => {
  const channel = supabase.channel('control-room-realtime')

  tablesRef.current.forEach((table) => {
    channel.on('postgres_changes', {...}, (payload) => {
      handleChange(table, payload)
    })
  })

  channel.subscribe()
  return () => { channel.unsubscribe() }
}, [supabase, handleChange]) // Remove tables from deps, use ref
```

---

## 6.7 Fix TestRunResponse Type (H4)

**File:** `src/hooks/useTestRunner.ts`

```typescript
// BEFORE
queryFn: async (): Promise<TestRunResponse> => {
  return response.json().then(r => r.data)  // Returns only data
}

// AFTER
queryFn: async (): Promise<TestRun> => {  // Fix return type
  const json = await response.json()
  return json.data
}
```

---

## 6.8 Add Missing Hook Exports (H1)

**File:** `src/hooks/index.ts`

```typescript
// Add these exports:
export { useWorkflowExtraction } from './useWorkflowExtraction'
export { useTestCases } from './useTestCases'
export { useTestRunner } from './useTestRunner'
export { useWorkerAnalytics } from './useWorkerAnalytics'
export { useWorkerDetail } from './useWorkerDetail'
export { useWorkerTrends } from './useWorkerTrends'
export { useAnalyticsExport } from './useAnalyticsExport'
```

---

## 6.9 Stabilize Query Keys (H6)

**File:** Multiple hooks

```typescript
// BEFORE
queryKey: ['test-runs', workflowId, testCaseId, filters, limit]

// AFTER - stringify object params
queryKey: ['test-runs', workflowId, testCaseId, JSON.stringify(filters), limit]

// Or use a stable reference:
const stableFilters = useMemo(() => filters, [JSON.stringify(filters)])
```

---

## 6.10-6.14 Additional Fixes

- Fix nested hook definitions (H5) - export as standalone
- Fix date fallbacks (H7) - throw on missing dates
- Fix loose type assertions (H8) - use proper types
- Add error message mapping to useTeam
- Fix worker status type mismatch

---

## Phase 6 Verification

- [ ] Analytics exports complete quickly (no N+1)
- [ ] Failed worker fetches don't break analytics
- [ ] Trend indicators reflect actual data
- [ ] No memory leaks in realtime hooks
- [ ] All hooks importable from `@/hooks`
- [ ] Testing page uses memoized Supabase client (W9)

---

# PHASE 7: DATABASE TRANSACTIONS

> **Priority:** MEDIUM - Data consistency
> **Timeline:** Day 7-8
> **Issues:** 4

---

## 7.1 Create Transaction RPC Functions

**Migration:** `supabase/migrations/xxx_transaction_functions.sql`

```sql
-- Atomically complete an execution
CREATE OR REPLACE FUNCTION complete_execution(
  p_execution_id UUID,
  p_status TEXT,
  p_output_data JSONB DEFAULT NULL,
  p_error TEXT DEFAULT NULL,
  p_worker_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE executions SET
    status = p_status,
    output_data = COALESCE(p_output_data, output_data),
    error = p_error,
    completed_at = NOW()
  WHERE id = p_execution_id;

  IF p_worker_id IS NOT NULL THEN
    UPDATE digital_workers SET
      status = 'active',
      current_execution_id = NULL
    WHERE id = p_worker_id;
  END IF;

  INSERT INTO activity_logs (type, workflow_id, data, created_at)
  SELECT
    CASE WHEN p_status = 'completed' THEN 'execution_completed' ELSE 'execution_failed' END,
    workflow_id,
    jsonb_build_object('executionId', p_execution_id, 'status', p_status, 'error', p_error),
    NOW()
  FROM executions WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql;

-- Atomically process review response
CREATE OR REPLACE FUNCTION process_review_response(
  p_review_id UUID,
  p_status TEXT,
  p_feedback TEXT DEFAULT NULL,
  p_edited_data JSONB DEFAULT NULL,
  p_reviewer_id UUID DEFAULT NULL
) RETURNS TABLE(execution_id UUID, resume_webhook_url TEXT) AS $$
DECLARE
  v_execution_id UUID;
  v_resume_url TEXT;
BEGIN
  UPDATE review_requests SET
    status = p_status,
    feedback = p_feedback,
    edited_data = p_edited_data,
    reviewer_id = p_reviewer_id,
    reviewed_at = NOW()
  WHERE id = p_review_id
  RETURNING review_requests.execution_id, action_payload->>'resumeWebhookUrl'
  INTO v_execution_id, v_resume_url;

  INSERT INTO activity_logs (type, workflow_id, data, created_at)
  SELECT
    CASE WHEN p_status = 'approved' THEN 'review_approved' ELSE 'review_rejected' END,
    e.workflow_id,
    jsonb_build_object('reviewId', p_review_id, 'executionId', v_execution_id, 'status', p_status),
    NOW()
  FROM executions e WHERE e.id = v_execution_id;

  RETURN QUERY SELECT v_execution_id, v_resume_url;
END;
$$ LANGUAGE plpgsql;

-- Unique constraint for pending reviews
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_review
ON review_requests (execution_id, step_id)
WHERE status = 'pending';
```

---

## 7.2 Use RPC in Routes

**File:** `execution-complete/route.ts`

```typescript
const { error } = await supabase.rpc('complete_execution', {
  p_execution_id: executionId,
  p_status: status,
  p_output_data: outputData,
  p_error: executionError,
  p_worker_id: workerId,
})
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
```

---

## 7.3 Re-encrypt Credentials Migration

**Migration:** `supabase/migrations/xxx_reencrypt_credentials.sql`

Run after deploying new encryption:
```sql
-- This needs to be done via application code, not SQL
-- The migration should add a new column and mark old as deprecated
ALTER TABLE credentials ADD COLUMN encrypted_data_v2 TEXT;
ALTER TABLE credentials ADD COLUMN encryption_version INTEGER DEFAULT 1;
```

---

## Phase 7 Verification

- [ ] Kill DB mid-execution-complete → no partial state
- [ ] Worker status always consistent with execution
- [ ] Activity logs created atomically
- [ ] Duplicate review insert fails cleanly

---

# PHASE 8: UI/UX & CODE QUALITY

> **Priority:** NICE TO FIX
> **Timeline:** Day 8-9
> **Issues:** 12

---

## 8.1 Fix Race Condition in Edit Form (W5)

**File:** `src/app/(dashboard)/workflows/[id]/page.tsx`
**Lines:** 45-65

```typescript
// BEFORE - closure captures stale selectedStep
const startEditing = useCallback(() => {
  setEditForm({
    label: selectedStep.label,  // ❌ Uses closure value
  })
}, [selectedStep])

// AFTER - prevent switching while editing
const startEditing = useCallback(() => {
  if (isEditMode) {
    // Don't switch steps while editing - ask user to save or cancel first
    toast.warning('Please save or cancel current edits before selecting another step')
    return
  }

  setEditForm({
    label: selectedStep.label,
    // ... other fields
  })
  setIsEditMode(true)
}, [selectedStep, isEditMode])

// Also track the step being edited separately
const [editingStepId, setEditingStepId] = useState<string | null>(null)

// Prevent step selection while editing
const handleStepSelect = useCallback((stepId: string) => {
  if (editingStepId && editingStepId !== stepId) {
    toast.warning('Save or cancel current edits first')
    return
  }
  setSelectedStepId(stepId)
}, [editingStepId])
```

---

## 8.2 Fix Unsafe Type Casts (W7)

**File:** `src/app/(dashboard)/workflows/[id]/testing/page.tsx`
**Lines:** 105, 127

```typescript
// BEFORE - inconsistent and unsafe casts
{(workflow.steps as Array<{ id: string; label: string }>).map(...)}
// Line 127:
{(workflow.steps as unknown[])?.length === 0 && ...}

// AFTER - use proper typing
interface WorkflowStep {
  id: string
  label: string
  type: 'action' | 'review' | 'condition'
  // ... other fields
}

// Define workflow type properly
interface Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
}

// Use type guard for safety
function isValidWorkflow(w: unknown): w is Workflow {
  return (
    w !== null &&
    typeof w === 'object' &&
    'steps' in w &&
    Array.isArray((w as Workflow).steps)
  )
}

// Then use with guard
{isValidWorkflow(workflow) && workflow.steps.map((step) => (
  <div key={step.id}>{step.label}</div>
))}

{isValidWorkflow(workflow) && workflow.steps.length === 0 && (
  <div>No steps defined</div>
)}
```

---

## 8.3 Add Cancel Confirmation (W8)

**File:** `src/app/(dashboard)/workflows/[id]/page.tsx`
**Lines:** 569-572

```typescript
// BEFORE - no confirmation
onClick={() => {
  setIsEditMode(false)  // ❌ No "Discard changes?" confirmation
  setEditForm(null)
}}

// AFTER - with confirmation dialog
const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

// Check if form has unsaved changes
const hasUnsavedChanges = useMemo(() => {
  if (!editForm || !selectedStep) return false
  return (
    editForm.label !== selectedStep.label ||
    editForm.description !== selectedStep.description
    // ... compare other fields
  )
}, [editForm, selectedStep])

const handleCancel = useCallback(() => {
  if (hasUnsavedChanges) {
    setShowDiscardConfirm(true)
  } else {
    setIsEditMode(false)
    setEditForm(null)
  }
}, [hasUnsavedChanges])

const confirmDiscard = useCallback(() => {
  setShowDiscardConfirm(false)
  setIsEditMode(false)
  setEditForm(null)
}, [])

// In JSX:
<Button onClick={handleCancel}>Cancel</Button>

{showDiscardConfirm && (
  <Modal
    title="Discard changes?"
    onClose={() => setShowDiscardConfirm(false)}
  >
    <p>You have unsaved changes. Are you sure you want to discard them?</p>
    <div className="flex gap-2 mt-4">
      <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
        Keep Editing
      </Button>
      <Button variant="destructive" onClick={confirmDiscard}>
        Discard Changes
      </Button>
    </div>
  </Modal>
)}
```

---

## 8.4-8.15 Additional UI/UX Fixes

4. **StepConfigModal error handling** (WB3, WB4)
5. **StepConfigModal race condition** (WB5)
6. **Workflow structure validation** (WB6)
7. **Silent extraction failures** (WB7)
8. **Save confirmation feedback** (WB8)
9. **Real-time state updates** (CR4)
10. **Error handling in actions** (CR5)
11. **Error message mapping** (T2, 3.6)
12. **Worker status types** (T4, 3.7)
13. **Team-worker relationship** (T5)
14. **Keyboard accessibility** (WB10)
15. **Dead file upload code** (WB9)

(Detailed fixes for items 4-15 follow same patterns as earlier phases)

---

## Phase 8 Verification

- [ ] Cannot switch steps while editing form (W5)
- [ ] Workflow steps rendered with proper type safety (W7)
- [ ] Cancel with unsaved changes shows confirmation dialog (W8)
- [ ] StepConfigModal shows error state on fetch failure
- [ ] Real-time updates refresh UI without manual reload
- [ ] Save actions show success/error toasts

---

# PHASE 9: TEST COVERAGE

> **Priority:** QUALITY
> **Timeline:** Day 9-11
> **Issues:** 20+

---

## 9.1 Hook Tests

Create tests for: `useWorkflows`, `useExecutions`, `useReviewRequests`, `useActivityLogs`, `useConversations`, `useRealtime`, `useTeam`

## 9.2 Component Tests

Create tests for: `WorkflowFlowchart`, `ChatPanel`, `ReviewModal`, `Modal`, `ErrorBoundary`, `ConversationPanel`

## 9.3 API Route Tests

Create tests for all `/api/n8n/*` and `/api/analytics/*` routes

## 9.4 E2E Tests

Set up Playwright with test user seeding for: `workflow-builder`, `auth`, `control-room`, `team-management`

---

# PHASE 10: DEAD CODE CLEANUP

> **Priority:** CLEANUP
> **Timeline:** Day 11-12
> **Issues:** 8

---

## 10.1 Remove Unused Components

- `src/components/ChatPanel.tsx`
- `src/components/ExpandableReviewChat.tsx`
- `src/components/RequirementsGatheringModal.tsx`
- `src/components/N8nChatWidget.tsx`
- `src/components/ExecutionDebugger.tsx`

## 10.2 Remove Unused Hooks

- `useConversations` (if unused)
- `useExecutions` (if unused)

## 10.3 Remove Unused Functions

- `createDecisionNodes` in `src/lib/n8n/client.ts`

---

# FINAL VERIFICATION

```bash
npm run build
npm run test
npm run lint
npx tsc --noEmit
```

## Security Checklist

- [ ] Webhooks require valid signature
- [ ] SSRF blocked for all user URLs
- [ ] Credentials use AES-256-GCM
- [ ] Test endpoints blocked in production
- [ ] Admin-only endpoints protected
- [ ] Org isolation on all queries
- [ ] Rate limiting active
- [ ] Security headers present
- [ ] PII filtered from logs and AI

## Reliability Checklist

- [ ] Failed resumes don't leave stuck reviews
- [ ] Duplicate reviews prevented
- [ ] Wait nodes have timeouts
- [ ] Stale reviews auto-expire
- [ ] Transactions prevent partial updates
- [ ] Real-time updates work

---

# APPENDIX: All Files by Phase

## Phase 1 (Security)
- `src/lib/n8n/webhook-auth.ts` (NEW)
- `src/lib/n8n/credentials.ts`
- `src/app/api/n8n/review-response/route.ts`
- `src/app/api/n8n/audit/route.ts`
- `src/app/api/test/route.ts`
- `src/lib/n8n/client.ts`
- `src/lib/error-handler.ts` (NEW)

## Phase 2 (Data)
- `src/app/api/n8n/execution-update/route.ts`
- `src/types/index.ts`
- `src/hooks/useTeam.ts`
- `src/app/api/analytics/workers/[workerId]/trends/route.ts`
- `src/components/WorkflowBuilder.tsx`

## Phase 3 (Authorization)
- `src/app/api/analytics/workers/route.ts`
- `src/app/api/n8n/credentials/route.ts`
- `src/app/api/n8n/templates/route.ts`
- `src/lib/pii-filter.ts` (NEW)

## Phase 4 (Reliability)
- `src/app/api/n8n/review-request/route.ts`
- `src/app/api/n8n/cleanup/route.ts` (NEW)
- `src/app/api/n8n/webhook/[workflowId]/route.ts`
- `src/hooks/useRealtime.ts`

## Phase 5 (Validation)
- `src/lib/validation.ts` (NEW)
- `src/middleware.ts`
- `next.config.js`

## Phase 6 (Analytics/Hooks)
- `src/app/api/analytics/export/route.ts`
- `src/hooks/index.ts`
- `src/hooks/useTestRunner.ts`
- Multiple hook files for memoization

## Phase 7 (Transactions)
- `supabase/migrations/xxx_transaction_functions.sql`
- `src/app/api/n8n/execution-complete/route.ts`

---

*Master plan updated February 2, 2026*
*Sources: CODE_QUALITY_REPORT.md, TEST_FIX_PLAN.md, SECURITY_AND_N8N_FIX_PLAN.md*

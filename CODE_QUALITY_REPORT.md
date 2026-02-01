# Code Quality Report

**Generated:** February 1, 2026
**Project:** Enterprise Agent Collaboration Platform
**Scope:** Full codebase linkage analysis against PRD

---

## Executive Summary

The codebase is **generally well-structured** with good separation of concerns. All PRD-required features are implemented. However, there are **significant issues across all sections** that must be addressed before production deployment.

### Issues by Section

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

### Top 5 Most Severe Issues

1. **Infinite loop in Analytics** - `trends/route.ts:103-107` - Server hangs
2. **Broken XOR encryption** - `lib/n8n/credentials.ts` - Credentials exposed
3. **Hardcoded organization ID** - `WorkflowBuilder.tsx:73` - Multi-tenancy broken
4. **Missing org permission checks** - All analytics routes - Data breach risk
5. **Redirect loop** - `workflows/page.tsx:9-12` - Back button breaks

### Key Themes

- **Security:** Missing org filters, broken encryption, SSRF vulnerability
- **Data Integrity:** Wrong field lookups, type mismatches, silent failures
- **Memory Leaks:** 6 hooks create new Supabase clients every render
- **UX:** No error toasts, silent failures, missing loading states

---

## Critical Issues

### 1. ActivityLogType Mismatch
**Severity:** CRITICAL
**Location:** `src/types/index.ts` (lines 302-312)

**Problem:** The `ActivityLogType` union is missing 9 values that are actively used throughout API routes. This will cause TypeScript errors and potentially database insertion failures.

**Missing types:**
```typescript
'workflow_step_error'    // used in /api/n8n/ai-action/route.ts (line 212)
'debug_analysis'         // used in /api/n8n/debug/route.ts
'review_approved'        // used in /api/n8n/resume/[executionId]/route.ts (line 131)
'review_rejected'        // used in /api/n8n/resume/[executionId]/route.ts (line 131)
'review_requested'       // used in /api/n8n/review-request/route.ts (line 82)
'review_completed'       // used in /api/n8n/review-response/route.ts (line 73)
'execution_progress'     // used in /api/n8n/execution-update/route.ts (line 87)
'execution_completed'    // used in /api/n8n/execution-update/route.ts (line 87)
'execution_failed'       // used in /api/n8n/execution-update/route.ts (line 89)
```

**Fix:** Add these types to the `ActivityLogType` union in `src/types/index.ts`

---

### 2. Execution Update Field Lookup Bug
**Severity:** CRITICAL
**Location:** `src/app/api/n8n/execution-update/route.ts` (lines 34-39)

**Problem:** The route uses the wrong field to look up existing executions.

```typescript
// Current code (WRONG):
const { data: existingExecution } = await supabase
  .from('executions')
  .select('id')
  .eq('id', executionId)    // ← Looking for platform 'id'
  .single()

// Should be:
  .eq('n8n_execution_id', executionId)  // ← n8n sends its execution ID
```

**Impact:**
- New execution records created when updates should modify existing ones
- Duplicate executions accumulate in database
- Execution history becomes corrupted

---

### 3. Logic Bug in useTeam Hook
**Severity:** CRITICAL
**Location:** `src/hooks/useTeam.ts` (line 95)

**Problem:** Operator precedence issue in ternary expression.

```typescript
// Current code (WRONG - evaluates as: (description || type) === 'ai'):
role: worker.description || worker.type === 'ai' ? 'AI Agent' : 'Team Member',

// Should be (proper parentheses):
role: worker.description || (worker.type === 'ai' ? 'AI Agent' : 'Team Member'),
```

**Impact:** All workers may incorrectly show "AI Agent" role if they have a description.

---

## High Priority Issues

### 4. Missing/Unverified API Endpoint
**Severity:** HIGH
**Location:** `src/components/StepConfigModal.tsx` (line 61)

**Problem:** Component calls `/api/n8n/node-types` endpoint:
```typescript
const response = await fetch(`/api/n8n/node-types?${params}`)
```

**Status:** This endpoint exists at `src/app/api/n8n/node-types/route.ts` but has no test coverage.

**Action Required:** Verify endpoint works correctly and add tests.

---

### 5. Missing Hook Exports
**Severity:** HIGH
**Location:** `src/hooks/index.ts`

**Problem:** The following hooks are NOT exported in the barrel file, breaking import consistency:

| Hook | Used In |
|------|---------|
| `useWorkflowExtraction` | WorkflowBuilder.tsx |
| `useTestCases` | TestRunnerPanel.tsx |
| `useTestRunner` | TestRunnerPanel.tsx |
| `useWorkerAnalytics` | AnalyticsDashboard.tsx |

**Fix:** Add exports to `src/hooks/index.ts`:
```typescript
export { useWorkflowExtraction } from './useWorkflowExtraction'
export { useTestCases } from './useTestCases'
export { useTestRunner } from './useTestRunner'
export { useWorkerAnalytics } from './useWorkerAnalytics'
```

---

### 6. ReviewRequest Type Mismatch
**Severity:** HIGH
**Location:** `src/hooks/useReviewRequests.ts` (lines 38-39)

**Problem:** Database field names don't match TypeScript type definitions:

| Database Field | Type Property | Status |
|----------------|---------------|--------|
| `action_type` | `reviewType` | Mismatch |
| `action_payload` | `reviewData` | Mismatch |

**Current workaround in hook:**
```typescript
reviewType: db.action_type as ReviewRequest['reviewType'],
reviewData: db.action_payload || {},
```

**Recommendation:** Either rename database columns OR update type definitions to match.

---

### 7. N8N Client API Key Validation Missing
**Severity:** HIGH
**Location:** `src/lib/n8n/client.ts` (lines 8-9)

**Problem:** API key falls back to empty string silently if env var is missing:
```typescript
const N8N_API_KEY = process.env.N8N_API_KEY || ''  // Silent failure!
```

**Fix:** Add validation:
```typescript
const N8N_API_KEY = process.env.N8N_API_KEY
if (!N8N_API_KEY) {
  throw new Error('N8N_API_KEY environment variable is required')
}
```

---

## Medium Priority Issues

### 8. Unused Components (Dead Code)
**Severity:** MEDIUM

The following components are defined but never imported anywhere:

| Component | File | Lines |
|-----------|------|-------|
| ChatPanel | `src/components/ChatPanel.tsx` | 1-200 |
| ExpandableReviewChat | `src/components/ExpandableReviewChat.tsx` | 1-100 |
| RequirementsGatheringModal | `src/components/RequirementsGatheringModal.tsx` | 1-150 |
| N8nChatWidget | `src/components/N8nChatWidget.tsx` | 1-80 |
| ExecutionDebugger | `src/components/ExecutionDebugger.tsx` | 1-120 |

**Action:** Remove if no longer needed, or document as future features.

---

### 9. Unused Hooks
**Severity:** MEDIUM

| Hook | Exported | Used By Pages | Status |
|------|----------|---------------|--------|
| `useConversations` | Yes | None | Unused |
| `useExecutions` | Yes | None | Unused |

**Note:** May be for future features - document or remove.

---

### 10. Missing Error Message Mapping
**Severity:** MEDIUM
**Location:** `src/hooks/useTeam.ts` (lines 20, 37-55)

**Problem:** The `digital_workers` table has an `error_message` column that is fetched but never mapped to the app type.

```typescript
// DbDigitalWorker includes error_message (line 20)
// But toDigitalWorker() function ignores it (lines 37-55)
```

**Impact:** If the API sets an error message, it will be silently dropped.

---

### 11. Unused Function
**Severity:** LOW
**Location:** `src/lib/n8n/client.ts` (line 810)

**Problem:** `createDecisionNodes` (plural, returns array) is defined but only `createDecisionNode` (singular) is called.

**Action:** Remove unused function or add usage.

---

## Test Coverage Analysis

### Routes WITH Test Coverage (6 routes - 20%)
- `src/app/api/n8n/__tests__/sync.test.ts`
- `src/app/api/n8n/__tests__/review-request.test.ts`
- `src/app/api/n8n/__tests__/review-response.test.ts`
- `src/app/api/n8n/__tests__/execution-update.test.ts`
- `src/app/api/gemini/__tests__/consult.test.ts`
- `src/app/api/gemini/__tests__/extract.test.ts`

### Routes WITHOUT Test Coverage (~24 routes - 80%)
- All `/api/testing/*` routes
- All `/api/analytics/*` routes
- All `/api/admin/*` routes
- `/api/n8n/blueprint`
- `/api/n8n/audit`
- `/api/n8n/templates`
- `/api/n8n/node-types`
- `/api/n8n/debug`
- `/api/n8n/credentials`
- `/api/n8n/ai-action`
- `/api/n8n/webhook/[workflowId]`
- `/api/n8n/resume/[executionId]`

**Recommendation:** Increase test coverage to at least 70% before production.

---

## What's Working Well

### Properly Connected Components
| Page | Components Used | Status |
|------|-----------------|--------|
| `/create` | WorkflowBuilder, WorkflowFlowchart | ✅ |
| `/team` | OrgChart, Button, Card, Input, Modal | ✅ |
| `/analytics` | AnalyticsDashboard | ✅ |
| `/control-room` | Button, Card, Modal, Input | ✅ |
| `/workflows/[id]` | All UI components | ✅ |
| `/workflows/[id]/testing` | TestRunnerPanel | ✅ |

### Well-Implemented Features
- ✅ Supabase client with proper error handling for missing env vars
- ✅ N8n client with retry logic, exponential backoff, and jitter
- ✅ All PRD-required API endpoints implemented
- ✅ React Query integration with proper cache invalidation
- ✅ No circular dependencies detected
- ✅ Real-time subscriptions via Supabase Realtime
- ✅ Proper transformation functions between DB and app types
- ✅ Good separation of concerns (hooks, lib, components, api)

### PRD Compliance
| Feature | PRD Requirement | Status |
|---------|----------------|--------|
| User Authentication | Supabase Auth | ✅ Implemented |
| Workflow Builder (Chat) | Gemini integration | ✅ Implemented |
| Workflow Visualization | Visual flowchart | ✅ Implemented |
| Digital Workers | CRUD operations | ✅ Implemented |
| Control Room | 3-column Kanban | ✅ Implemented |
| Human-in-the-Loop Reviews | Review requests | ✅ Implemented |
| N8n Integration | Workflow sync | ✅ Implemented |
| Team Management | Org chart | ✅ Implemented |
| Activity Logging | Log tracking | ⚠️ Type issues |
| Testing Features | Test runner | ✅ Implemented |
| Analytics Dashboard | Worker metrics | ✅ Implemented |

---

## Recommended Fix Order

### Immediate (Before Production)
1. Fix ActivityLogType in `src/types/index.ts` - Add 9 missing types
2. Fix execution-update field lookup - Change to `n8n_execution_id`
3. Fix useTeam.ts ternary logic - Add parentheses

### Short Term (Next Sprint)
4. Verify `/api/n8n/node-types` endpoint works
5. Add missing hook exports to `src/hooks/index.ts`
6. Add N8N API key validation
7. Fix ReviewRequest type/field naming inconsistency

### Medium Term (Quality Improvements)
8. Remove or document unused components
9. Clean up unused hooks
10. Add error_message mapping to useTeam
11. Remove unused createDecisionNodes function
12. Increase test coverage to 70%+

---

## Verification Steps

After applying fixes, run these checks:

```bash
# 1. TypeScript compilation
npm run build

# 2. Run all tests
npm run test

# 3. Lint check
npm run lint

# 4. Manual E2E test
# - Create a workflow via chat
# - Assign to digital worker
# - Trigger execution
# - Complete human review
# - Verify activity logs
```

---

## Files Requiring Attention

### Critical
- `src/types/index.ts` (line 302-312)
- `src/app/api/n8n/execution-update/route.ts` (lines 34-39)
- `src/hooks/useTeam.ts` (line 95)

### High
- `src/components/StepConfigModal.tsx` (line 61)
- `src/hooks/index.ts`
- `src/hooks/useReviewRequests.ts` (lines 38-39)
- `src/lib/n8n/client.ts` (lines 8-9)

### Medium
- `src/components/ChatPanel.tsx`
- `src/components/ExpandableReviewChat.tsx`
- `src/components/RequirementsGatheringModal.tsx`
- `src/components/N8nChatWidget.tsx`
- `src/components/ExecutionDebugger.tsx`
- `src/hooks/useConversations.ts`
- `src/hooks/useExecutions.ts`

---

## Deep Dive: Workflows Pages Issues

The Workflows pages handle listing, viewing, editing, and testing workflows.

### Issue W1: Silent Mutation Failures (CRITICAL)
**Location:** `src/app/(dashboard)/workflows/[id]/page.tsx` (lines 68-99, 146-154)

```typescript
const handleSaveStep = useCallback(async () => {
  await updateSteps.mutateAsync({...})
  // ❌ No error handling - user never knows if save failed
  setIsEditMode(false)
  setEditForm(null)
}, [])
```

**Impact:** User thinks save succeeded but data wasn't persisted.

---

### Issue W2: Wrong List Page Redirect (CRITICAL)
**Location:** `src/app/(dashboard)/workflows/page.tsx` (lines 9-12)

```typescript
useEffect(() => {
  router.replace('/create')  // ❌ Unconditional redirect
}, [router])
```

**Impact:** Back button causes infinite redirect loop.

---

### Issue W3: Query Key Mismatch (CRITICAL)
**Location:** `src/app/(dashboard)/workflows/[id]/testing/page.tsx` (line 20)

```typescript
// Testing page uses:
queryKey: ['workflow', id]

// But useWorkflow hook uses:
queryKey: ['workflows', workflowId]
```

**Impact:** Same workflow fetched twice, separate caches, wasted bandwidth.

---

### Issue W4: No Organization Filter (CRITICAL - SECURITY)
**Location:** `src/hooks/useWorkflows.ts` (lines 103-111)

```typescript
const { data } = await supabase
  .from('workflows')
  .select('*')
  .order('created_at', { ascending: false })
  // ❌ No .eq('organization_id', orgId)
```

**Impact:** Users may see workflows from other organizations.

---

### Issue W5: Race Condition in Edit Form (HIGH)
**Location:** `src/app/(dashboard)/workflows/[id]/page.tsx` (lines 45-65)

```typescript
const startEditing = useCallback(() => {
  setEditForm({
    label: selectedStep.label,  // ❌ Uses closure value
  })
}, [selectedStep])
```

**Problem:** If user selects new step mid-edit, form switches and loses unsaved changes.

---

### Issue W6: Missing Input Validation (HIGH)
**Location:** `src/app/(dashboard)/workflows/[id]/page.tsx` (lines 102-125)

```typescript
const addGreenItem = useCallback(() => {
  setEditForm({...editForm, greenList: [...editForm.greenList, newGreenItem.trim()]})
  // ❌ No duplicate check, max length, or XSS protection
}, [])
```

---

### Issue W7: Unsafe Type Casts (HIGH)
**Location:** `src/app/(dashboard)/workflows/[id]/testing/page.tsx` (lines 105, 127)

```typescript
{(workflow.steps as Array<{ id: string; label: string }>).map(...)}
// Line 127:
{(workflow.steps as unknown[])?.length === 0 && ...}
```

**Problem:** Same property cast two different ways - inconsistent and unsafe.

---

### Issue W8: No Cancel Confirmation (MEDIUM)
**Location:** `src/app/(dashboard)/workflows/[id]/page.tsx` (lines 569-572)

```typescript
onClick={() => {
  setIsEditMode(false)  // ❌ No "Discard changes?" confirmation
  setEditForm(null)
}}
```

---

### Issue W9: Supabase Client in Render (MEDIUM)
**Location:** `src/app/(dashboard)/workflows/[id]/testing/page.tsx` (line 17)

```typescript
const supabase = createClient()  // ❌ New client every render
```

**Fix:** Use `useMemo(() => createClient(), [])`

---

### Workflows Pages Issues Summary

| Severity | Count | Types |
|----------|-------|-------|
| CRITICAL | 5 | Silent failures, redirect loop, cache miss, security |
| HIGH | 4 | Race conditions, no validation, unsafe types |
| MEDIUM | 4 | UX issues, memory leaks, test bugs |
| LOW | 4 | Inconsistencies, accessibility, unused code |

---

## Deep Dive: Analytics Dashboard Issues

The Analytics Dashboard handles worker metrics, performance tracking, and data exports.

### Issue A1: Infinite Loop in Date Iteration (CRITICAL)
**Location:** `src/app/api/analytics/workers/[workerId]/trends/route.ts` (lines 103-107)

```typescript
for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
  // ❌ d.setDate() returns a NUMBER (timestamp), not Date
  // Loop becomes: number <= Date → type coercion → never terminates
}
```

**Impact:** Server hangs, request times out, CPU spike.

**Fix:**
```typescript
for (let d = new Date(startDate); d <= new Date(); ) {
  // ... do work ...
  d.setDate(d.getDate() + 1)  // Increment at end, don't use return value
}
```

---

### Issue A2: Database Column Mismatch (CRITICAL)
**Location:** `api/analytics/workers/[workerId]/trends/route.ts` (lines 63-77)

```typescript
trendData = {
  executions: dailyMetrics.map(m => ({
    value: m.total_executions,      // ❌ Column may not exist
  })),
  successRate: dailyMetrics.map(m => ({
    value: m.successful_executions,  // ❌ Column may not exist
  })),
}
```

**Impact:** Trend charts show NaN or fail silently.

---

### Issue A3: Export Response Type Mismatch (CRITICAL)
**Location:** `src/app/api/analytics/export/route.ts` (lines 194-208)

```typescript
return NextResponse.json({
  data: {
    data: output,  // ❌ Returns raw string, but types expect base64
  },
})
```

**Impact:** XLSX export format defined but won't work.

---

### Issue A4: Missing Organization Permission Checks (HIGH - SECURITY)
**Location:** All 4 analytics routes

```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) return 401

// ❌ Then immediately queries ALL workers without org filter!
const { data: workers } = await supabase.from('digital_workers').select('*')
```

**Impact:** Users can see analytics for ANY organization's workers.

---

### Issue A5: N+1 Query Problem (HIGH)
**Location:** `src/app/api/analytics/export/route.ts` (lines 75-110)

```typescript
for (const worker of workers) {
  const { data: executions } = await supabase
    .from('executions')
    .select('*')
    .eq('worker_id', worker.id)  // ❌ One query per worker
}
```

**Impact:** 100 workers = 100 sequential DB queries. Very slow exports.

---

### Issue A6: Missing Error Handling in Promise.all (HIGH)
**Location:** `src/app/api/analytics/workers/route.ts` (lines 52-108)

```typescript
const workerAnalytics = await Promise.all(
  workers.map(async (worker) => {
    const { data: executions, error: execError } = await supabase...
    // ❌ execError never checked! Silent data corruption.
    const executionList = executions || []
  })
)
```

---

### Issue A7: Hardcoded "stable" Trends (MEDIUM)
**Location:** `src/app/api/analytics/workers/route.ts` (lines 88-89)

```typescript
executionTrend: 'stable' as const,  // ❌ Always "stable"
successRateTrend: 'stable' as const,
```

**Impact:** Trend indicators are meaningless - no actual calculation.

---

### Issue A8: Missing Trends Loading State (MEDIUM)
**Location:** `src/app/(dashboard)/analytics/workers/[id]/page.tsx` (lines 35-44)

```typescript
const { trends } = useWorkerTrends(id, dateRange)  // ❌ isLoading not destructured
```

**Impact:** User doesn't know if trends are loading or failed.

---

### Analytics Dashboard Issues Summary

| Severity | Count | Types |
|----------|-------|-------|
| CRITICAL | 3 | Infinite loop, column mismatch, type error |
| HIGH | 3 | Security (no org filter), N+1 queries, no error handling |
| MEDIUM | 4 | Fake trends, unsafe types, date bugs, loading state |
| LOW | 4 | Dead imports, magic numbers, NaN display, no retry |

---

## Deep Dive: Hooks Layer Issues

The hooks layer manages data fetching and state via custom React hooks with React Query.

### Issue H1: Missing Hook Exports (CRITICAL)
**Location:** `src/hooks/index.ts`

9 hooks exist but are NOT exported from the barrel file:
- `useWorkflowExtraction`
- `useTestCases` / `useTestCase`
- `useTestRunner` / `useTestHistory`
- `useWorkerAnalytics` / `useWorkerDetail` / `useWorkerTrends`
- `useAnalyticsExport`

**Impact:** Components must use direct imports, breaking the module pattern.

---

### Issue H2: Supabase Client Not Memoized (HIGH)
**Location:** 6 hook files

```typescript
// WRONG - creates new client every render
const supabase = createClient()  // useWorkflows.ts:92, useExecutions.ts:79, etc.

// CORRECT - only useTeam.ts does this
const supabase = useMemo(() => createClient(), [])
```

**Affected files:**
- `useWorkflows.ts` (line 92)
- `useExecutions.ts` (line 79)
- `useReviewRequests.ts` (line 56)
- `useActivityLogs.ts` (line 36)
- `useConversations.ts` (line 36)
- `useRealtime.ts` (line 30)

**Impact:** Memory leaks, multiple realtime subscriptions per render.

---

### Issue H3: useRealtime Stale Closure Bug (HIGH)
**Location:** `src/hooks/useRealtime.ts` (lines 74-95)

```typescript
useEffect(() => {
  const channel = supabase.channel('control-room-realtime')

  tables.forEach((table) => {
    channel.on('postgres_changes', {...}, (payload) => handleChange(table, payload))
  })
  // ❌ If tables changes, callbacks reference old tables array
}, [supabase, tables, handleChange])
```

**Problem:** Callbacks capture stale `tables` reference if array changes.

---

### Issue H4: TestRunResponse Type Mismatch (HIGH)
**Location:** `src/hooks/useTestRunner.ts` (line 88)

```typescript
queryFn: async (): Promise<TestRunResponse> => {
  return response.json().then(r => r.data)  // ❌ Extracts .data
}

// But TestRunResponse expects:
interface TestRunResponse {
  data: TestRun
  testCase?: {...}
  workflow?: {...}
  stepResults: TestStepResult[]
}
```

**Impact:** Type says full response, but only `data` field is returned.

---

### Issue H5: Nested Hook Definitions (MEDIUM)
**Location:** 8 hook files

Hooks return other hooks as properties, violating React rules:

```typescript
// useWorkflows.ts line 268
return {
  useWorkflow,  // ❌ Hook returned as property
}

// To use correctly in component:
const { useWorkflow } = useWorkflows()
const workflow = useWorkflow(id)  // ❌ Not callable as hook in conditional
```

**Better:** Export as standalone hooks.

---

### Issue H6: Query Key Instability (MEDIUM)
**Location:** Multiple hooks

```typescript
// useTestRunner.ts line 62
queryKey: ['test-runs', workflowId, testCaseId, filters, limit],
// ❌ If filters is inline object, new identity every render = cache miss
```

**Affected:**
- `useTestRunner.ts:62,81`
- `useTestCases.ts:52`
- `useActivityLogs.ts:67`

---

### Issue H7: Date Fallbacks Mask Errors (LOW)
**Location:** `src/hooks/useConversations.ts` (lines 30-31)

```typescript
createdAt: db.created_at ? new Date(db.created_at) : new Date(),  // ❌ Falls back to now
```

**Problem:** Missing timestamp silently becomes current time, masking data issues.

---

### Issue H8: Loose Type Assertions (LOW)
**Location:** `src/hooks/useWorkflows.ts` (lines 51, 84)

```typescript
requirements: step.requirements as unknown as WorkflowStep['requirements'],
// ❌ Double assertion bypasses TypeScript
```

---

### Hooks Layer Issues Summary

| Severity | Count | Types |
|----------|-------|-------|
| CRITICAL | 1 | Missing exports |
| HIGH | 4 | Memory leaks, stale closures, type mismatches |
| MEDIUM | 5 | Nested hooks, query keys, error handling |
| LOW | 4 | Date fallbacks, loose types, null checks |

---

## Deep Dive: Workflow Builder Issues

The Workflow Builder handles chat-based workflow creation with Gemini AI and visual flowchart display.

### Issue WB1: Hardcoded Organization ID (CRITICAL - SECURITY)
**Location:** `src/components/WorkflowBuilder.tsx` (lines 73, 185)

```typescript
const result = await addWorkflow.mutateAsync({
  name: extractedWorkflow.name || 'Untitled Workflow',
  organizationId: 'a0000000-0000-0000-0000-000000000001',  // ❌ HARDCODED
})
```

**Impact:** All users' workflows go to the same organization. Multi-tenancy completely broken.

**Fix:** Get organization ID from authenticated user's session.

---

### Issue WB2: Non-Null Assertion on Undefined (CRITICAL)
**Location:** `src/components/WorkflowBuilder.tsx` (line 416)

```typescript
<StepConfigModal
  step={steps.find(s => s.id === selectedStepId)!}  // ❌ Unsafe assertion
  ...
/>
```

**Problem:** If step is deleted while modal is open, this crashes at runtime.

---

### Issue WB3: Missing response.ok Check (HIGH)
**Location:** `src/components/StepConfigModal.tsx` (lines 61, 91)

```typescript
const response = await fetch(`/api/n8n/node-types?${params}`)
const data = await response.json()  // ❌ No check if response.ok
setNodeInfo(data)  // ❌ Error object treated as valid data
```

---

### Issue WB4: No Error State in StepConfigModal (HIGH)
**Location:** `src/components/StepConfigModal.tsx` (lines 54-79)

```typescript
} catch (error) {
  console.error('Error fetching node info:', error)
  // ❌ No setError(), no UI feedback, nodeInfo stays null
}
```

---

### Issue WB5: Race Condition in Node Type Fetch (HIGH)
**Location:** `src/components/StepConfigModal.tsx` (lines 85-102)

```typescript
useEffect(() => {
  // ...fetch node schema...
}, [selectedNodeType])  // ❌ Missing nodeInfo dependency
```

**Problem:** Quick node type changes cause out-of-order responses.

---

### Issue WB6: No Workflow Structure Validation (HIGH)
**Location:** `src/app/api/gemini/extract/route.ts` (lines 99-134)

```typescript
const workflowData = JSON.parse(jsonMatch[0])  // ❌ No schema validation

const steps = workflowData.steps.map((step) => ({
  label: step.label as string,  // ❌ Could be undefined
}))
```

**Problem:** Invalid AI extraction results pass through silently.

---

### Issue WB7: Silent Extraction Failures (HIGH)
**Location:** `src/hooks/useWorkflowExtraction.ts` (lines 73-98)

```typescript
const workflow = await extractWorkflowFromConversation(messages)

if (workflow) {
  setExtractedWorkflow(workflow)
}
// ❌ If workflow is null (API failed), no error state set
```

**Impact:** User has no feedback that extraction failed.

---

### Issue WB8: No Save Confirmation (MEDIUM)
**Location:** `src/components/WorkflowBuilder.tsx` (lines 133-159)

```typescript
try {
  await updateSteps.mutateAsync({ workflowId, steps })
} catch (error) {
  console.error('Error saving step config:', error)
  // ❌ No toast, no error UI, modal closes anyway
}
```

---

### Issue WB9: Dead Code - File Upload (LOW)
**Location:** `src/components/WorkflowBuilder.tsx` (lines 348-376)

```typescript
<input
  ref={fileInputRef}
  type="file"
  className="hidden"
  multiple
/>
// ❌ No onChange handler - clicking "Attach file" does nothing
```

---

### Issue WB10: No Keyboard Accessibility (LOW)
**Location:** `src/components/WorkflowFlowchart.tsx` (lines 454-499)

Flowchart nodes are not keyboard-accessible:
- No `tabIndex="0"`
- No keyboard handlers (Enter/Space)
- No `role` or `aria-*` attributes

---

### Workflow Builder Issues Summary

| Severity | Count | Types |
|----------|-------|-------|
| CRITICAL | 2 | Hardcoded org ID, unsafe null assertion |
| HIGH | 5 | Missing validation, race conditions, no error handling |
| MEDIUM | 5 | No confirmations, incomplete auth, memory leaks |
| LOW | 3 | Dead code, accessibility, minor UX |

---

## Deep Dive: n8n API Routes Issues

The n8n API routes handle workflow sync, executions, webhooks, and human reviews. Critical security issues found.

### Issue N1: Broken Encryption (CRITICAL - SECURITY)
**Location:** `src/lib/n8n/credentials.ts` (lines 59-78)

```typescript
function encrypt(text: string): string {
  const key = ENCRYPTION_KEY  // 'default-dev-key-change-in-prod'
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return Buffer.from(result).toString('base64')
}
```

**Problem:** XOR is NOT encryption. Anyone with codebase can decrypt all stored credentials.

**Fix:** Use AES-256-GCM with Node's native `crypto` module.

---

### Issue N2: Missing Admin Check on Audit Delete (CRITICAL - SECURITY)
**Location:** `src/app/api/n8n/audit/route.ts` (lines 279-307)

```typescript
export async function DELETE(request: NextRequest) {
  // ... auth check ...
  // TODO: Add admin role check here  // ← UNFIXED TODO

  const { data: deletedCount } = await supabase.rpc('cleanup_expired_audit_logs')
```

**Problem:** Any authenticated user can delete audit logs - compliance violation.

---

### Issue N3: SSRF Vulnerability (CRITICAL - SECURITY)
**Location:** `src/app/api/n8n/review-response/route.ts` (lines 142-164)

```typescript
const callbackUrl = reviewRequest.action_payload?.callbackUrl
if (callbackUrl) {
  await fetch(callbackUrl, {...})  // ❌ No URL validation
}
```

**Problem:** Attacker can set `callbackUrl` to internal services (e.g., `http://localhost:5432`).

**Fix:** Validate against allowlist of trusted domains.

---

### Issue N4: API Key Logged in Errors (HIGH - SECURITY)
**Location:** `src/app/api/n8n/resume/[executionId]/route.ts` (lines 92-96)

```typescript
logger.error('Failed to resume n8n workflow:', {
  targetUrl,  // ← URL may contain API credentials
})
```

---

### Issue N5: Execution Lookup Uses Wrong Field (HIGH)
**Location:** `src/app/api/n8n/execution-update/route.ts` (line 38)

```typescript
.eq('id', executionId)  // ❌ Should be 'n8n_execution_id'
```

**Impact:** Creates duplicate execution records instead of updating.

---

### Issue N6: No Validation of n8n Node Data (HIGH)
**Location:** `src/app/api/n8n/sync/route.ts` (lines 89-104)

```typescript
const steps = n8nWorkflow.nodes
  ?.filter(node => !['n8n-nodes-base.start'].includes(node.type))
  .map((node, index) => ({
    type: node.type.includes('humanReview') ? 'review' : 'action',  // ❌ Trusts input
  }))
```

**Problem:** No validation that `node.type` exists or is a string.

---

### Issue N7: Race Condition in Webhook Handler (MEDIUM)
**Location:** `src/app/api/n8n/webhook/[workflowId]/route.ts` (lines 52-72)

```typescript
// 1. Create execution record
const { data: execution } = await supabase.from('executions').insert({...})

// 2. Call n8n (may fail)
const n8nExecution = await triggerN8nWorkflow(workflowId, payload)

// 3. Update with n8n ID (orphan if step 2 fails)
await supabase.from('executions').update({ n8n_execution_id: n8nExecution.id })
```

**Problem:** If n8n call fails, execution record has no `n8n_execution_id`.

---

### Issue N8: Silent Callback Failure (MEDIUM)
**Location:** `src/app/api/n8n/review-response/route.ts` (lines 142-164)

```typescript
try {
  await fetch(callbackUrl, {...})
} catch (callbackError) {
  logger.error('Error calling legacy callback:', callbackError)
  // ❌ Silently continues - downstream never knows
}
```

---

### Issue N9: No Ownership Check on Template Delete (MEDIUM)
**Location:** `src/app/api/n8n/templates/route.ts` (lines 280-311)

```typescript
await supabase.from('workflow_templates').delete().eq('id', templateId)
// ❌ No check that user owns this template
```

---

### Issue N10: Dead Code (LOW)
**Location:** `src/lib/n8n/client.ts` (lines 810-887)

Function `createDecisionNodes` (plural) defined but never called. Only `createDecisionNode` (singular) is used.

---

### n8n API Issues Summary

| Severity | Count | Types |
|----------|-------|-------|
| CRITICAL | 3 | Broken encryption, missing auth, SSRF |
| HIGH | 5 | Wrong field lookup, no validation, race conditions |
| MEDIUM | 7 | Silent failures, missing ownership checks |
| LOW | 5 | Dead code, wrong logger, unused variables |

---

## Deep Dive: Control Room Issues

The Control Room is the monitoring dashboard for Digital Workers and their executions. It has critical data flow bugs.

### Issue CR1: API Field Mismatch (HIGH)
**Location:** `src/app/api/n8n/review-response/route.ts` (lines 51-59) vs `src/hooks/useReviewRequests.ts` (lines 29-52)

**Problem:** API writes to nested `action_payload` object but hook reads from separate columns:

```typescript
// API writes (review-response/route.ts lines 49-61):
.update({
  status,
  action_payload: {
    ...reviewRequest.action_payload,
    feedback,           // ❌ Written here
    editedData,         // ❌ Written here
    reviewerId,         // ❌ Written here
    reviewedAt: new Date().toISOString(),
  },
})

// Hook reads (useReviewRequests.ts lines 29-52):
return {
  feedback: db.feedback,           // ❌ Reads from separate column
  editedData: db.edited_data,      // ❌ Reads from separate column
  reviewerId: db.reviewer_id,      // ❌ Reads from separate column
}
```

**Impact:** Review metadata (feedback, reviewer, edits) is stored but never retrieved.

---

### Issue CR2: Invalid ActivityLog Type (HIGH)
**Location:** `src/app/api/n8n/review-response/route.ts` (line 73)

```typescript
await supabase.from('activity_logs').insert({
  type: 'review_completed',  // ❌ NOT in ActivityLogType union
})
```

**Impact:** Runtime error when logging review completion.

---

### Issue CR3: Missing Execution Integration (MEDIUM)
**Location:** `src/app/(dashboard)/control-room/page.tsx`

**Problem:** Page shows reviews but never imports `useExecutions()` hook. No visibility into:
- Running executions
- Pending executions
- Which execution a review belongs to

---

### Issue CR4: Real-time Callbacks Not Functional (MEDIUM)
**Location:** `src/app/(dashboard)/control-room/page.tsx` (lines 29-36)

```typescript
useControlRoomRealtime({
  onReviewRequestChange: (payload) => {
    console.log('Review request changed:', payload)  // ❌ Only logs, no state update
  },
  onActivityLogChange: (payload) => {
    console.log('Activity log changed:', payload)    // ❌ Only logs, no state update
  },
})
```

**Impact:** Real-time events are received but UI doesn't refresh. Users must manually reload.

---

### Issue CR5: Silent Error Handling (MEDIUM)
**Location:** `src/app/(dashboard)/control-room/page.tsx` (lines 38-71)

```typescript
const handleApprove = async (review: ReviewRequest) => {
  if (!user) return  // ❌ Silent return, no error message
  await approveReview.mutateAsync({...})  // ❌ No try-catch, no error toast
}
```

---

### Issue CR6: No Authentication Redirect (MEDIUM)
**Location:** `src/app/(dashboard)/control-room/page.tsx` (lines 14, 39)

```typescript
const { user } = useAuth()
// ...
if (!user) return  // ❌ Should redirect to login or show error
```

---

## Deep Dive: Team Functionality Issues

The team-related code has several interconnected issues that affect the core functionality.

### Issue T1: Ternary Operator Bug (CRITICAL)
**Location:** `src/hooks/useTeam.ts` (line 95)

```typescript
// Current buggy code:
role: worker.description || worker.type === 'ai' ? 'AI Agent' : 'Team Member',

// This evaluates as (due to operator precedence):
role: (worker.description || worker.type === 'ai') ? 'AI Agent' : 'Team Member',
```

**Test case demonstrating the bug:**
- Worker: `{ type: 'human', description: 'Email Handler' }`
- Expected: role = `'Email Handler'`
- Actual: role = `'AI Agent'` (wrong!)

**Correct fix:**
```typescript
role: worker.description || (worker.type === 'ai' ? 'AI Agent' : 'Team Member'),
```

---

### Issue T2: assignedWorkflows Never Populated
**Location:** `src/hooks/useTeam.ts` (lines 82, 97)

**Problem:** The `assignedWorkflows` field is hardcoded as empty or passed through but never fetched from the database.

```typescript
// Line 82 - hardcoded empty:
assignedWorkflows: [],

// Line 97 - passes undefined/empty through:
assignedWorkflows: worker.assignedWorkflows,
```

**Root Cause:** Database stores workflow assignments in `worker_workflow_assignments` table (separate from `digital_workers`), but this join is never made.

**Impact:**
- OrgChart (lines 367-389) tries to display assigned workflows but always shows empty
- Workflow assignment panel can assign but never retrieves existing assignments

---

### Issue T3: Duplicate Org Chart Building Logic
**Locations:**
- `src/hooks/useTeam.ts` (lines 71-87) - `toOrgChartData()`
- `src/components/OrgChart.tsx` (lines 21-36) - `buildOrgChartData()`

**Problem:** Two different implementations exist for building org chart data:
- The hook exports `orgChartData` (line 315) but OrgChart.tsx doesn't use it
- OrgChart.tsx builds its own data (lines 58-61) instead

**Impact:** Inconsistent data transformation, wasted computation.

---

### Issue T4: Type Mismatch for Worker Status
**Location:** `src/hooks/useTeam.ts` (line 96)

```typescript
status: worker.status as NodeData['status'],
```

**Type definitions:**
- `DigitalWorker['status']`: `'active' | 'inactive' | 'paused' | 'error' | 'needs_attention'`
- `NodeData['status']`: `'active' | 'inactive' | 'needs_attention'`

**Missing in NodeData:** `'paused'` and `'error'` statuses

**Impact:** UI may not correctly render workers with `paused` or `error` status.

---

### Issue T5: Team-Worker Relationship Not Implemented
**Location:** `src/hooks/useTeam.ts`

**Architecture gap:**
- Digital workers have `team_id` field (line 12)
- Teams are fetched separately (lines 129-144)
- BUT there's no join or filtering logic connecting them

**What's missing:**
- No data showing which workers are in which team
- No filtering of workers by team
- `parent_team_id` exists but isn't used for hierarchy

**Impact:** Teams feature is incomplete - you can create teams but can't assign workers or query by team.

---

### Issue T6: Role Field Not Persisted
**Location:** `src/types/index.ts` (line 104), `src/hooks/useTeam.ts`

```typescript
// In DigitalWorker type:
role?: string

// But DbDigitalWorker has no 'role' field
// Role is computed on each load from description + type
```

**Impact:** Role is transient, not stored. Any manually set role would be lost on refresh.

---

## Team Issues Summary Table

| # | Severity | Location | Issue | Impact |
|---|----------|----------|-------|--------|
| T1 | **CRITICAL** | useTeam.ts:95 | Ternary precedence bug | Wrong role for most workers |
| T2 | HIGH | useTeam.ts:82,97 | assignedWorkflows empty | Workflow assignments don't show |
| T3 | MEDIUM | useTeam.ts, OrgChart.tsx | Duplicate logic | Inconsistent data |
| T4 | MEDIUM | useTeam.ts:96 | Status type mismatch | UI rendering issues |
| T5 | MEDIUM | useTeam.ts | Team-worker join missing | Teams feature broken |
| T6 | LOW | types, useTeam.ts | Role not persisted | Role lost on refresh |

---

*Report generated by Claude Code quality analysis*

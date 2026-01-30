# Architecture Audit Report
## Enterprise Agent Collaboration Platform

**Date**: January 30, 2026
**Codebase**: Next.js 14 + Supabase + React Query
**Files Analyzed**: 83 TypeScript files (~3,500 lines of business logic)

---

## Executive Summary

The codebase has evolved from a Vite + localStorage prototype to a Next.js + Supabase application. The existing `CODEBASE_CLEANUP_GUIDE.md` is **outdated** and references the old architecture. This audit identifies **1 critical**, **6 high**, **15 medium**, and **12 low priority** issues.

### Key Finding: You Don't Need to Build Integrations

n8n provides 1,000+ integrations. You only need to build **4 custom n8n nodes** for platform-specific features.

---

## Integration Architecture

### How It Works

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           USER EXPERIENCE FLOW                            │
└──────────────────────────────────────────────────────────────────────────┘

1. USER: Clicks "Connect Google" in your UI
         ↓
2. BROWSER: Redirects to accounts.google.com (Google's OAuth page)
         ↓
3. USER: Logs in on Google's official page, grants permission
         ↓
4. GOOGLE: Redirects back to /api/n8n/credentials/oauth/callback
         ↓
5. YOUR CALLBACK: Exchanges code for tokens
   → Stores encrypted in Supabase (n8n_credentials table)
   → Syncs credential to n8n via API
         ↓
6. N8N: Now has credential available for workflow nodes
```

### Credential Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│   │   Your UI   │────▶│  Supabase   │────▶│    n8n      │              │
│   │             │     │  (storage)  │     │  (engine)   │              │
│   └─────────────┘     └─────────────┘     └─────────────┘              │
│         │                    │                   │                      │
│         ▼                    ▼                   ▼                      │
│   • "Connect" button   • Encrypted tokens  • Uses credentials          │
│   • OAuth redirect     • n8n_credentials   • Runs workflows            │
│   • Status display     • credential_types  • Calls external APIs       │
└─────────────────────────────────────────────────────────────────────────┘
```

### What's Already Built

| Component | Status | Location |
|-----------|--------|----------|
| Credential types table | Needs seeding | `credential_types` |
| Credential storage | Built | `n8n_credentials` |
| OAuth flow handler | Built | `/api/n8n/credentials/oauth/callback` |
| n8n sync | Built | `createN8NCredential()` |
| Token refresh | Built | `refreshOAuthTokens()` |

### What You Still Need

1. **Seed `credential_types` table** with supported integrations
2. **Settings > Integrations UI** to connect services
3. **Register OAuth apps** with each provider (Google, Slack, etc.)

---

## Custom n8n Nodes Required

These 4 nodes are platform-specific and don't exist in n8n:

| Node | Purpose | Estimate |
|------|---------|----------|
| **Human Review** | Pause workflow, call your API, wait for approval | 2-3 days |
| **AI Agent** | Apply greenList/redList, call Gemini with your prompts | 3-5 days |
| **Platform Status** | Report execution events to Control Room | 1 day |
| **Blueprint Validator** | Validate outputs against workflow constraints | 2-3 days |

**Total: 8-12 days**

---

## CRITICAL - IMMEDIATE ACTION REQUIRED

### 1. Exposed API Keys in .env.local
**Risk Level**: CRITICAL
**File**: `.env.local`

All secrets are visible and must be rotated immediately:
- Supabase URL and anon key
- Gemini API key
- N8n API key

**Action**: Revoke and regenerate ALL keys before any production deployment.

---

## HIGH PRIORITY ISSUES

### 2. Weak Encryption for Credentials
**File**: `src/lib/n8n/credentials.ts` (lines 58-78)
**Problem**: XOR cipher with hardcoded default key

```typescript
// Current - INSECURE
function encrypt(text: string): string {
  const key = ENCRYPTION_KEY // 'default-dev-key-change-in-prod'
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return Buffer.from(result).toString('base64')
}
```

**Fix**: Use Node.js `crypto` module with AES-256-GCM.

---

### 3. Service Layer SRP Violations
**Files**:
| File | Lines | Issues |
|------|-------|--------|
| `src/lib/n8n/client.ts` | 1037 | Mixes HTTP, retries, CRUD |
| `src/lib/n8n/credentials.ts` | 601 | Encryption + CRUD + OAuth |
| `src/app/api/n8n/ai-action/route.ts` | 377 | Duplicates utilities |

**Fix**: Extract to separate services:
```
src/lib/
├── http/               # Generic HTTP client with retry
├── n8n/
│   ├── workflows.ts    # Workflow CRUD only
│   ├── executions.ts   # Execution management
│   └── credentials.ts  # Credential management only
└── utils/
    └── retry.ts        # Shared retry/backoff logic
```

---

### 4. Duplicate Utility Functions
**Duplicated across files**:
- `sleep()` - defined in `n8n/client.ts` AND `api/n8n/ai-action/route.ts`
- `calculateBackoff()` - defined twice with different signatures
- Error classification logic repeated in 3+ files
- Environment variable loading repeated 8+ times

**Fix**: Create `src/lib/utils/http.ts` with shared utilities.

---

### 5. Missing Error Boundary
**File**: `src/app/layout.tsx`
**Problem**: No error boundary wrapping the app - single error crashes everything

**Fix**: Add `<ErrorBoundary>` component wrapping children.

---

### 6. Environment Variable Validation Missing
**Problem**: Inconsistent validation across files

| Pattern | Files | Risk |
|---------|-------|------|
| `\|\| ''` fallback | 5+ | Silent failure |
| Console warn | 2 | Runs broken |
| Throws error | 3 | Inconsistent |

**Fix**: Create startup validation in `src/lib/config/env.ts`.

---

### 7. Large Components Needing Refactoring

| File | Lines | Issues |
|------|-------|--------|
| `workflows/[id]/page.tsx` | 639 | Multiple concerns, inline modals |
| `control-room/page.tsx` | 320 | Review UI + chat + approval |
| `create/page.tsx` | 303 | Chat UI + workflow extraction |

---

## MEDIUM PRIORITY ISSUES

### 8. Type Safety Issues
- **15 uses** of `Record<string, unknown>` losing type information
- Double type casting: `as unknown as X` pattern in hooks
- Status values as string unions instead of enums

```typescript
// Problem: Loses type info
metadata?: Record<string, unknown>

// Better: Specific types
metadata?: WorkerMetadata
```

---

### 9. State Management Anti-Patterns
**File**: `src/providers/AuthProvider.tsx`

**Issues**:
- Creates new context value object on every render (not memoized)
- No error state in auth context
- No retry mechanism for failed session recovery

```typescript
// Problem: New object every render
<AuthContext.Provider value={{ user, session, isLoading, signOut }}>

// Fix: Memoize
const value = useMemo(() => ({ user, session, isLoading, signOut }), [user, session, isLoading])
```

---

### 10. Unhandled Promise Rejections
- **122 async functions** but only **3 `.catch()` handlers**
- `mutateAsync()` calls without catch blocks
- Background extraction fails silently

---

### 11. Missing Request Timeouts
- Gemini API calls can hang indefinitely
- N8n webhook calls have no timeout
- Supabase queries unbounded

**Fix**: Add AbortController with timeouts:
```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 30000)
try {
  const response = await fetch(url, { signal: controller.signal })
} finally {
  clearTimeout(timeout)
}
```

---

### 12. Configuration Scattered
Environment variables loaded in **9+ different files** with inconsistent patterns.

---

## LOW PRIORITY ISSUES

### 13. Dead Code
- Commented-out factory functions in `src/__tests__/factories/index.ts`
- Unused mock setup in test files

### 14. Magic Numbers
- `MAX_RETRIES = 3` defined in 2+ places
- `INITIAL_DELAY_MS = 1000` repeated
- Various timeouts hardcoded

### 15. Missing Accessibility
- ARIA labels on interactive elements
- Keyboard navigation for visualizations

---

## OUTDATED DOCUMENTATION

The `CODEBASE_CLEANUP_GUIDE.md` references the **old architecture**:

| Guide References | Current Reality |
|------------------|-----------------|
| Vite | Next.js 14 |
| localStorage contexts | Supabase + React Query |
| `geminiService.ts` client-side | Server-only API routes |
| `Screen1Consultant.tsx` | `app/(dashboard)/create/page.tsx` |

**Action**: Update or regenerate cleanup guide for current architecture.

---

## POSITIVE FINDINGS

1. **No circular dependencies** detected
2. **Clean import structure** - proper module organization
3. **Good React Query integration** - queries and mutations used correctly
4. **Proper auth provider pattern** - context-based authentication
5. **Consistent Tailwind styling** - clsx used correctly
6. **Good test infrastructure** - Vitest + Playwright setup
7. **Meaningful names** - files and functions have clear purposes
8. **Proper separation** - UI, API, hooks, lib directories well organized

---

## RECOMMENDED FIX ORDER

### Phase 1: Security (Before any deployment)
1. Rotate all exposed API keys
2. Replace weak XOR encryption with AES-256-GCM
3. Add environment variable validation at startup

### Phase 2: Reliability (Week 1)
1. Add error boundary to layout
2. Extract shared HTTP utilities
3. Add request timeouts to all external calls
4. Add error state to AuthProvider

### Phase 3: Maintainability (Week 2)
1. Refactor `n8n/client.ts` into separate services
2. Split large page components
3. Create proper enums for status values
4. Replace weak types with specific interfaces

### Phase 4: Cleanup (Week 3)
1. Remove dead code
2. Centralize configuration
3. Update documentation
4. Add missing ARIA labels

---

## Files Requiring Immediate Attention

```
CRITICAL:
  .env.local                                    # Rotate keys NOW

HIGH:
  src/lib/n8n/credentials.ts                    # Fix encryption
  src/lib/n8n/client.ts                         # Refactor (1037 lines)
  src/app/(dashboard)/workflows/[id]/page.tsx   # Split (639 lines)
  src/app/api/n8n/ai-action/route.ts            # Extract duplicates

MEDIUM:
  src/providers/AuthProvider.tsx                # Memoize + error state
  src/types/index.ts                            # Stronger types
  src/app/layout.tsx                            # Add ErrorBoundary
```

---

## Verification Checklist

After fixes:
- [ ] Run `pnpm tsc --noEmit` - zero type errors
- [ ] Run `pnpm test` - all tests pass
- [ ] Run `pnpm build` - successful build
- [ ] Manual test: Create workflow, assign to worker, execute
- [ ] Verify no console errors in browser
- [ ] Verify API calls have proper error handling

---

*Generated by Claude Code architecture audit - January 30, 2026*

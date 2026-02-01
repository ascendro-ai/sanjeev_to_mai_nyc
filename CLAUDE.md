# CLAUDE.md - Project Context for Claude Code

## Project Overview

**Enterprise Agent Collaboration Platform** - An AI-powered workflow automation platform where users design workflows through natural conversation with Gemini AI, assign them to digital workers (AI agents), and monitor execution with human-in-the-loop approvals.

### What It Does
1. Users describe their automation needs in plain English
2. Gemini AI extracts a structured workflow from the conversation
3. The workflow is synced to n8n for execution
4. Digital workers (AI agents) execute steps with human oversight
5. Control Room provides real-time monitoring and approval interface

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS 4 |
| State | React Query 5 (@tanstack/react-query) |
| Database | Supabase (PostgreSQL + Realtime) |
| AI | Google Gemini 2.0 Flash |
| Automation | n8n (self-hosted workflow engine) |
| Visualization | D3.js (org charts, flowcharts), Recharts |
| Testing | Vitest, Testing Library, Playwright, MSW |

---

## Application Flow

### 1. Workflow Creation Flow

```
User opens /workflows → Clicks "New Workflow" → WorkflowBuilder.tsx loads

┌─────────────────────────────────────────────────────────────────┐
│  WORKFLOW BUILDER (src/components/WorkflowBuilder.tsx)          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User types: "I want to send a Slack message when I get an     │
│  email from my boss"                                            │
│                                                                 │
│         ↓                                                       │
│                                                                 │
│  useWorkflowExtraction hook (debounced) calls:                 │
│  POST /api/gemini/consult                                       │
│         ↓                                                       │
│  Gemini AI asks clarifying questions                            │
│  "Which Slack channel? What should the message say?"            │
│         ↓                                                       │
│  User answers, conversation continues                           │
│         ↓                                                       │
│  POST /api/gemini/extract                                       │
│  Extracts structured workflow from conversation                 │
│         ↓                                                       │
│  Returns: { name, description, steps[], trigger }               │
│         ↓                                                       │
│  WorkflowFlowchart.tsx renders visual preview                  │
│  User can click steps to configure via StepConfigModal          │
│         ↓                                                       │
│  User clicks "Save" → useWorkflows.create()                    │
│  Saves to Supabase `workflows` table                            │
│         ↓                                                       │
│  User clicks "Activate" → POST /api/n8n/activate               │
│  Syncs workflow to n8n and enables trigger                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Workflow Execution Flow

```
External Event (email arrives, webhook, schedule)
         ↓
n8n trigger fires → starts workflow execution
         ↓
POST /api/n8n/execution-update (from n8n)
         ↓
Creates execution record in Supabase `executions` table
         ↓
Supabase Realtime pushes update to Control Room
(useRealtime hook subscribes to changes)
         ↓
┌─────────────────────────────────────────────────────────────────┐
│  FOR EACH STEP IN WORKFLOW:                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  n8n executes step → POST /api/n8n/execution-update            │
│         ↓                                                       │
│  Updates `execution_steps` table with status                    │
│         ↓                                                       │
│  IF step requires human approval:                               │
│    POST /api/n8n/review-request                                │
│         ↓                                                       │
│    Creates record in `review_requests` table                    │
│    n8n workflow PAUSES (waiting for resume)                     │
│         ↓                                                       │
│    Control Room shows pending approval                          │
│    (useReviewRequests hook, Supabase Realtime)                  │
│         ↓                                                       │
│    Human reviews in Control Room, approves/rejects              │
│         ↓                                                       │
│    POST /api/n8n/review-response                               │
│         ↓                                                       │
│    POST /api/n8n/resume/[executionId]                          │
│    n8n workflow RESUMES                                         │
│                                                                 │
│  IF step is AI action:                                          │
│    POST /api/n8n/ai-action                                     │
│    AI decides action based on greenList/redList rules           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         ↓
All steps complete → POST /api/n8n/execution-complete
         ↓
Updates execution status to 'completed'
Logs to `activity_logs` table
```

### 3. Control Room Real-time Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTROL ROOM (src/app/(dashboard)/control-room/page.tsx)       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  On mount:                                                      │
│  useRealtime() subscribes to Supabase Realtime channels:        │
│    - review_requests table (INSERT, UPDATE)                     │
│    - activity_logs table (INSERT)                               │
│    - executions table (UPDATE)                                  │
│                                                                 │
│  useReviewRequests() fetches pending reviews                    │
│  useActivityLogs() fetches recent activity                      │
│         ↓                                                       │
│  UI displays:                                                   │
│    - List of pending approvals                                  │
│    - Live activity feed                                         │
│    - Execution status indicators                                │
│         ↓                                                       │
│  When n8n sends review request:                                 │
│    Supabase Realtime pushes to client                           │
│    React Query cache invalidates                                │
│    UI updates instantly (no polling)                            │
│         ↓                                                       │
│  User clicks review → sees chat history, context                │
│  User approves/rejects → POST /api/n8n/review-response         │
│  Workflow resumes/aborts                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Digital Worker (Agent) Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  TEAM MANAGEMENT                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Organization                                                   │
│       └── Team (e.g., "Sales Automation")                       │
│               ├── Digital Worker: "Email Processor" (AI)        │
│               ├── Digital Worker: "Slack Notifier" (AI)         │
│               └── Digital Worker: "Approval Manager" (Human)    │
│                                                                 │
│  useTeam() hook manages:                                        │
│    - Fetching workers and teams                                 │
│    - Creating/updating workers                                  │
│    - Assigning workers to workflows                             │
│                                                                 │
│  OrgChart.tsx visualizes hierarchy using D3.js                  │
│                                                                 │
│  When workflow executes:                                        │
│    - Steps are assigned to specific workers                     │
│    - Worker status updates in real-time                         │
│    - Analytics track worker performance                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  Next.js     │────▶│  External    │
│   (React)    │◀────│  API Routes  │◀────│  Services    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    │                    │
       ▼                    ▼                    │
┌──────────────┐     ┌──────────────┐           │
│ React Query  │     │  Supabase    │◀──────────┘
│   Cache      │◀───▶│  Database    │
└──────────────┘     └──────────────┘
       │                    │
       │                    ▼
       │             ┌──────────────┐
       │             │  Supabase    │
       └────────────▶│  Realtime    │ (WebSocket subscriptions)
                     └──────────────┘

External Services:
├── Gemini AI (workflow consultation, extraction)
├── n8n (workflow execution, webhooks)
└── OAuth providers (Google, Slack, etc.)
```

---

## Hook Architecture

Hooks are the bridge between UI and data. They handle caching, optimistic updates, and real-time subscriptions.

```
┌─────────────────────────────────────────────────────────────────┐
│  HOOK PATTERN                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Component calls hook:                                          │
│    const { workflows, create, isLoading } = useWorkflows();     │
│                                                                 │
│  Hook internally:                                               │
│    1. useQuery fetches from Supabase                            │
│    2. Data cached in React Query                                │
│    3. useMutation for create/update/delete                      │
│    4. onSuccess invalidates cache → refetch                     │
│                                                                 │
│  Real-time hooks (useRealtime):                                 │
│    1. Subscribe to Supabase Realtime channel                    │
│    2. On change → invalidate React Query cache                  │
│    3. UI updates automatically                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Key Hooks:
├── useWorkflows()      - Workflow CRUD operations
├── useTeam()           - Digital workers and teams
├── useExecutions()     - Workflow run tracking
├── useReviewRequests() - Pending human approvals
├── useActivityLogs()   - Event history
├── useRealtime()       - Supabase subscriptions (Control Room)
├── useTestRunner()     - Test execution
└── useWorkflowExtraction() - Background Gemini extraction
```

---

## API Route Architecture

All API routes are in `src/app/api/`. They validate input with Zod, call external services, and return JSON.

### Gemini AI Routes (`/api/gemini/`)
```
POST /consult          - Chat with AI about workflow design
POST /extract          - Parse conversation → workflow structure
POST /requirements     - Gather requirements for steps
POST /extract-people   - Extract team members from description
POST /build-agents     - Generate agent configurations
```

### n8n Routes (`/api/n8n/`)
```
POST /activate         - Enable/disable workflow in n8n
POST /sync             - Push workflow definition to n8n
POST /execution-update - Receive step progress (called BY n8n)
POST /execution-complete - Workflow finished (called BY n8n)
POST /review-request   - Request human approval (called BY n8n)
POST /review-response  - Submit human decision
POST /resume/[id]      - Continue paused workflow
POST /ai-action        - AI agent makes decision
GET/POST /credentials  - Manage OAuth tokens
POST /webhook/[id]     - Generic webhook receiver
```

### Analytics Routes (`/api/analytics/`)
```
GET  /workers              - Worker performance metrics
GET  /workers/[id]/trends  - Historical trend data
POST /export               - Export metrics as CSV/JSON
```

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Login, signup (public routes)
│   ├── (dashboard)/       # Protected routes (require auth)
│   │   ├── workflows/     # /workflows, /workflows/[id]
│   │   ├── control-room/  # /control-room
│   │   ├── testing/       # /testing
│   │   └── admin/         # /admin
│   └── api/               # API routes (see above)
│
├── components/            # React components
│   ├── WorkflowBuilder.tsx    # Main workflow creation UI (chat + flowchart)
│   ├── WorkflowFlowchart.tsx  # D3.js workflow visualization
│   ├── OrgChart.tsx           # D3.js team hierarchy
│   ├── StepConfigModal.tsx    # Configure workflow step (n8n node)
│   ├── Sidebar.tsx            # Navigation
│   ├── analytics/             # Charts and metrics
│   ├── testing/               # Test runner UI
│   └── ui/                    # Primitives (Button, Modal, Input, Card)
│
├── hooks/                 # Custom React hooks (data layer)
├── lib/                   # Utilities and clients
│   ├── gemini/            # Gemini API client
│   ├── n8n/               # n8n API client
│   ├── supabase/          # Supabase clients (browser, server, admin)
│   ├── config.ts          # Timeouts, intervals, limits
│   └── validation.ts      # Zod schemas
│
├── providers/             # React context providers
│   ├── AuthProvider.tsx   # Auth state (wraps app)
│   └── QueryProvider.tsx  # React Query client
│
└── types/                 # TypeScript definitions
    └── index.ts           # Workflow, DigitalWorker, Execution, etc.
```

---

## Database Schema (Supabase)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   workflows     │     │   executions    │     │ execution_steps │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │◀────│ workflow_id     │◀────│ execution_id    │
│ name            │     │ id              │     │ id              │
│ description     │     │ status          │     │ step_name       │
│ steps (JSONB)   │     │ current_step    │     │ status          │
│ n8n_workflow_id │     │ trigger_type    │     │ input_data      │
│ status          │     │ started_at      │     │ output_data     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ digital_workers │     │ review_requests │     │ activity_logs   │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ name            │     │ execution_id    │     │ type            │
│ type (ai/human) │     │ status          │     │ workflow_id     │
│ team_id         │     │ worker_name     │     │ worker_name     │
│ role            │     │ chat_history    │     │ data (JSONB)    │
│ status          │     │ timeout_at      │     │ created_at      │
└─────────────────┘     └─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│     teams       │     │ n8n_credentials │
├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │
│ name            │     │ credential_type │
│ parent_team_id  │     │ config (encrypted)
│ organization_id │     │ n8n_credential_id
└─────────────────┘     └─────────────────┘
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini AI
GEMINI_API_KEY=

# n8n
N8N_API_URL=http://localhost:5678/api/v1
N8N_API_KEY=

# OAuth (Google integrations)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Key Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm test             # Run unit tests (Vitest)
npm test:e2e         # Run E2E tests (Playwright)
npm run lint         # ESLint
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/types/index.ts` | Core type definitions (Workflow, DigitalWorker, Execution) |
| `src/lib/config.ts` | Timeouts, polling intervals, limits |
| `src/lib/n8n/client.ts` | n8n API integration (largest file) |
| `src/lib/gemini/client.ts` | Gemini AI client |
| `src/components/WorkflowBuilder.tsx` | Main workflow creation interface |
| `src/hooks/useWorkflows.ts` | Workflow data management |
| `src/hooks/useRealtime.ts` | Supabase real-time subscriptions |

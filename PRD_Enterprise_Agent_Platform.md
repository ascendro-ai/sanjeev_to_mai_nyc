# Product Requirements Document (PRD)
# Enterprise Agent Collaboration Platform

**Version:** 2.0
**Date:** January 30, 2026
**Status:** Draft - Updated with Existing Codebase Analysis

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Existing Codebase Status](#2-existing-codebase-status)
3. [Problem Statement](#3-problem-statement)
4. [Goals & Success Metrics](#4-goals--success-metrics)
5. [User Personas](#5-user-personas)
6. [Core Concepts & Mental Model](#6-core-concepts--mental-model)
7. [Feature Requirements](#7-feature-requirements)
8. [System Architecture](#8-system-architecture)
9. [Database Schema](#9-database-schema)
10. [API Specification](#10-api-specification)
11. [Security & Compliance](#11-security--compliance)
12. [Integration Requirements](#12-integration-requirements)
13. [Migration Plan](#13-migration-plan)
14. [MVP Scope](#14-mvp-scope)
15. [Future Roadmap](#15-future-roadmap)
16. [Appendix](#16-appendix)

---

## 1. Executive Summary

### 1.1 Product Vision

Build an enterprise platform that enables organizations to create, deploy, and manage AI-powered "Digital Workers" at scale. These Digital Workers execute automated workflows, are organized within team hierarchies, and are supervised by human managers through a unified control interface.

### 1.2 Core Thesis

**Workers are a constellation of tasks.** Whether human or digital, a worker is defined by the workflows and tasks they perform. This platform treats AI agents as first-class team members—assignable, manageable, and accountable within existing organizational structures.

### 1.3 Key Differentiators

| Aspect | Consumer Tools (Manus, Genspark) | Our Platform |
|--------|----------------------------------|--------------|
| Task Type | One-off tasks | Recurring workflows |
| User | Individual consumers | Enterprise teams |
| Oversight | None | Human-in-the-loop management |
| Organization | Flat | Hierarchical (teams, ownership) |
| Governance | Minimal | Enterprise-grade (audit, compliance) |

### 1.4 Technology Foundation

- **Workflow Engine:** n8n (self-hosted)
- **Database & Auth:** Supabase (PostgreSQL + Auth + Realtime)
- **Frontend:** Next.js / React
- **AI Integration:** Google Gemini API
- **Infrastructure:** Azure / Vercel

---

## 2. Existing Codebase Status

### 2.1 Current Implementation Summary

A functional React prototype ("Workflow.ai") already exists with significant frontend features completed.

**Repository:** `enterprise-agent-collaboration-platform`
**Tech Stack:** React 19 + Vite + TypeScript + Tailwind CSS

### 2.2 Features Already Built

| Feature | Status | File(s) | Notes |
|---------|--------|---------|-------|
| **Chat-based Workflow Builder** | ✅ Complete | `Screen1Consultant.tsx`, `geminiService.ts` | Gemini-powered, real-time extraction |
| **Workflow Visualization** | ✅ Complete | `WorkflowFlowchart.tsx` | Serpentine layout, drag-to-pan |
| **Requirements Gatherer** | ✅ Complete | `RequirementsGatherer.tsx` | Per-step blueprint (greenList/redList) |
| **Digital Workers** | ✅ Complete | `TeamContext.tsx`, `Screen2OrgChart.tsx` | Assignment, activation, status tracking |
| **Org Chart** | ✅ Complete | `Screen2OrgChart.tsx` | D3.js tree visualization |
| **Control Room** | ✅ Complete | `Screen4ControlRoom.tsx` | 3-column Kanban, review items |
| **Gmail OAuth** | ✅ Complete | `gmailService.ts` | PKCE flow, send/read emails |
| **Activity Logging** | ✅ Complete | `activityLogService.ts` | Circular buffer, export to JSON |
| **Workflow Execution** | ✅ Partial | `workflowExecutionService.ts`, `agentExecutionService.ts` | Custom JS (needs n8n migration) |
| **State Management** | ✅ Complete | `contexts/*.tsx` | React Context + localStorage |

### 2.3 Current File Structure

```
src/
├── App.tsx                          # Root component, OAuth callback handler
├── main.tsx                         # Entry point
├── types.ts                         # TypeScript interfaces
├── vite-env.d.ts
│
├── components/
│   ├── Screen1Consultant.tsx        # Workflow discovery chat
│   ├── Screen2OrgChart.tsx          # Team visualization (D3)
│   ├── Screen3Workflows.tsx         # Workflow management
│   ├── Screen4ControlRoom.tsx       # Execution monitoring
│   ├── RequirementsGatherer.tsx     # Step configuration
│   ├── WorkflowFlowchart.tsx        # Visual workflow editor
│   ├── Sidebar.tsx                  # Navigation sidebar
│   ├── GmailAuth.tsx                # Gmail connection UI
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       └── Modal.tsx
│
├── contexts/
│   ├── AppContext.tsx               # Global app state (activeTab, user)
│   ├── WorkflowContext.tsx          # Workflows + conversations
│   └── TeamContext.tsx              # Team/org structure
│
├── services/
│   ├── geminiService.ts             # Gemini LLM integration
│   ├── gmailService.ts              # Gmail OAuth + API
│   ├── agentExecutionService.ts     # Step execution via LLM
│   ├── workflowExecutionService.ts  # Workflow orchestration
│   ├── workflowReadinessService.ts  # Validation
│   └── activityLogService.ts        # Activity logging
│
├── utils/
│   ├── constants.ts                 # Config values
│   ├── storage.ts                   # localStorage abstraction
│   └── validation.ts                # Validation helpers
│
└── styles/
    └── index.css                    # Tailwind imports
```

### 2.4 Current Data Models (types.ts)

```typescript
// Already defined and working:
interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  assignedTo?: { stakeholderName: string; stakeholderType: 'ai' | 'human' };
  status: 'draft' | 'active' | 'paused';
  createdAt?: Date;
  updatedAt?: Date;
}

interface WorkflowStep {
  id: string;
  label: string;
  type: 'trigger' | 'action' | 'decision' | 'end';
  assignedTo?: { type: 'ai' | 'human'; agentName?: string };
  order: number;
  requirements?: StepRequirements;
}

interface StepRequirements {
  isComplete: boolean;
  requirementsText?: string;
  chatHistory?: Array<{ sender: 'user' | 'system'; text: string }>;
  integrations?: { gmail?: boolean };
  customRequirements?: string[];
  blueprint?: {
    greenList: string[];
    redList: string[];
    outstandingQuestions?: string[];
  };
}

interface NodeData {  // Team member (human or AI)
  name: string;
  type: 'ai' | 'human';
  role?: string;
  status?: 'active' | 'inactive' | 'needs_attention';
  assignedWorkflows?: string[];
}
```

### 2.5 What's Missing (Gap Analysis)

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| **User Authentication** | Static user ("Chitra M.") | Need Supabase Auth |
| **Database** | localStorage only | Need Supabase PostgreSQL |
| **Multi-tenancy** | Single hardcoded user | Need organizations + RLS |
| **Team Hierarchy** | Flat array | Need parent_team_id |
| **Workflow Engine** | Custom JS execution | Need n8n integration |
| **Real-time Updates** | Window events (local only) | Need Supabase Realtime |
| **API Layer** | None (all client-side) | Need Next.js API routes |
| **Deployment** | Vite dev server | Need Vercel + Next.js |

### 2.6 Reusable Components (Keep As-Is)

These components are production-ready and should be migrated with minimal changes:

1. **UI Components** (`components/ui/*`) - Button, Card, Input, Modal
2. **WorkflowFlowchart** - Serpentine visualization
3. **RequirementsGatherer** - Step configuration interface
4. **Sidebar** - Navigation (just update routing)
5. **GmailAuth** - OAuth UI component

### 2.7 Services to Refactor

| Service | Current | Target | Changes Needed |
|---------|---------|--------|----------------|
| `geminiService.ts` | Direct API calls | Keep + add server proxy | Move API key to server |
| `gmailService.ts` | Client-side OAuth | Keep | Works as-is |
| `agentExecutionService.ts` | Custom execution | Replace with n8n | Major rewrite |
| `workflowExecutionService.ts` | Custom orchestration | Replace with n8n | Major rewrite |
| `activityLogService.ts` | localStorage | Supabase table | Migrate storage |
| `workflowReadinessService.ts` | localStorage | Supabase queries | Migrate storage |

### 2.8 Contexts to Migrate

| Context | Current Storage | Target | Migration |
|---------|-----------------|--------|-----------|
| `AppContext` | localStorage | Supabase + cookies | Add auth state |
| `WorkflowContext` | localStorage | Supabase `workflows` table | Full migration |
| `TeamContext` | localStorage | Supabase `digital_workers` + `teams` | Full migration |

---

## 3. Problem Statement

### 2.1 The Automation Gap

- **67%** of office workers perform repetitive tasks daily
- **~5 hours/week** per worker could be automated
- **40%** of enterprise agentic AI projects will be cancelled by 2027 (Gartner)
- **46%** of CxOs cite talent gaps as primary reason AI initiatives fail

### 2.2 Why Current Solutions Fail

1. **Too Technical:** Existing RPA/automation tools require developer expertise
2. **No Oversight Model:** AI agents operate in isolation without management structure
3. **One-Off Focus:** Consumer AI tools don't support recurring, scheduled automation
4. **No Enterprise Fit:** Lack of team hierarchies, audit trails, access controls

### 2.3 Target User Pain Points

| Persona | Pain Point |
|---------|------------|
| Small Business Owner | "I spend hours on repetitive tasks but can't afford to hire help" |
| Enterprise Manager | "I don't know what my team's AI tools are doing or if they're working" |
| IT Administrator | "I need visibility and control over AI systems accessing company data" |

---

## 4. Goals & Success Metrics

### 3.1 Business Goals

| Goal | Description |
|------|-------------|
| G1 | Enable non-technical users to create workflow automations via natural language |
| G2 | Provide enterprise-grade management and oversight of AI agents |
| G3 | Reduce time-to-value for workflow automation from weeks to hours |
| G4 | Create platform stickiness through workflow library and team structures |

### 3.2 Success Metrics (KPIs)

| Metric | Target (MVP) | Target (12 months) |
|--------|--------------|-------------------|
| Workflows created per org | 5 | 50+ |
| Active Digital Workers per org | 2 | 20+ |
| Workflow success rate | 80% | 95% |
| Time to first workflow | < 30 min | < 15 min |
| User activation (created 1+ workflow) | 40% | 70% |
| Monthly Active Users (MAU) | 100 | 10,000 |

---

## 5. User Personas

### 4.1 Primary Personas

#### Persona 1: Small Business Owner (SMB)
- **Name:** Chitra M.
- **Role:** CEO, Treasure Blossom (flower shop)
- **Tech Literacy:** Low
- **Goals:** Automate inventory tracking, marketing, customer follow-ups
- **Frustrations:** No time, no technical skills, can't afford full-time help
- **Key Need:** Simple chat interface to describe what she wants automated

#### Persona 2: Enterprise Team Manager
- **Name:** Rachel K.
- **Role:** Operations Manager, Mid-size Enterprise
- **Tech Literacy:** Medium
- **Goals:** Oversee team productivity, ensure AI tools are working correctly
- **Frustrations:** No visibility into AI agent performance, scattered tools
- **Key Need:** Unified dashboard to monitor and manage Digital Workers

#### Persona 3: IT Administrator
- **Name:** David N.
- **Role:** IT Admin, Enterprise
- **Tech Literacy:** High
- **Goals:** Ensure security, compliance, and proper access controls
- **Frustrations:** Shadow AI usage, no audit trails, data governance concerns
- **Key Need:** Admin console with access controls, audit logs, integration management

### 4.2 Secondary Personas

#### Persona 4: Workflow Power User
- **Name:** Olivia B.
- **Role:** Business Analyst
- **Tech Literacy:** Medium-High
- **Goals:** Create complex workflows, optimize existing automations
- **Key Need:** Visual workflow editor with advanced configuration options

---

## 6. Core Concepts & Mental Model

### 5.1 Conceptual Hierarchy

```
Organization (Tenant)
│
├── Teams
│   ├── Human Workers (Users)
│   │   └── Role: Owner | Manager | Member | Viewer
│   │
│   └── Digital Workers (AI Agents)
│       ├── Assigned Workflows
│       │   └── Tasks (Steps)
│       ├── State (Active | Paused | Error | Idle)
│       └── Manager (Human Worker)
│
├── Workflows (Templates)
│   ├── Trigger (Schedule | Webhook | Manual | Event)
│   ├── Steps (Tasks)
│   │   ├── AI Step (LLM-powered decision/generation)
│   │   ├── Action Step (API call, data transform)
│   │   ├── Human Review Step (Approval gate)
│   │   └── Conditional Step (Branching logic)
│   └── Blueprint (Configuration & Constraints)
│
└── Control Room (Monitoring)
    ├── Active Workers
    ├── Pending Reviews
    ├── Execution History
    └── Alerts & Notifications
```

### 5.2 Key Definitions

| Term | Definition |
|------|------------|
| **Organization** | Top-level tenant; represents a company or business unit |
| **Team** | A group of Human Workers and Digital Workers with shared workflows |
| **Human Worker** | A user account; can create, manage, and supervise Digital Workers |
| **Digital Worker** | An AI agent that executes assigned workflows autonomously |
| **Workflow** | A reusable automation template consisting of ordered tasks |
| **Task** | An atomic unit of work within a workflow (e.g., "Send email", "Analyze image") |
| **Blueprint** | Configuration rules and constraints for a workflow (e.g., "Never use aggressive sales language") |
| **Trigger** | The event that initiates a workflow execution |
| **Execution** | A single run of a workflow, with its own state and history |
| **Control Room** | The management dashboard for monitoring Digital Workers |

### 5.3 State Machines

#### Digital Worker States
```
                    ┌──────────┐
          ┌────────►│  ACTIVE  │◄────────┐
          │         └────┬─────┘         │
          │              │               │
     [resume]       [pause/error]    [assign workflow]
          │              │               │
          │              ▼               │
          │         ┌──────────┐         │
          └─────────┤  PAUSED  │         │
                    └────┬─────┘         │
                         │               │
                    [delete]             │
                         │               │
                         ▼               │
                    ┌──────────┐         │
          ┌────────►│   IDLE   ├─────────┘
          │         └────┬─────┘
          │              │
     [create]       [archive]
          │              │
          │              ▼
          │         ┌──────────┐
          └─────────┤ ARCHIVED │
                    └──────────┘
```

#### Workflow Execution States
```
PENDING → RUNNING → WAITING_REVIEW → COMPLETED
                 ↘              ↗
                   → FAILED →
```

---

## 7. Feature Requirements

### 6.1 Feature Overview

| ID | Feature | Priority | MVP |
|----|---------|----------|-----|
| F1 | User Authentication & Authorization | P0 | ✓ |
| F2 | Organization & Team Management | P0 | ✓ |
| F3 | Workflow Builder (Chat-based) | P0 | ✓ |
| F4 | Workflow Builder (Visual Editor) | P1 | ✓ |
| F5 | Digital Worker Management | P0 | ✓ |
| F6 | Control Room Dashboard | P0 | ✓ |
| F7 | Human-in-the-Loop Reviews | P0 | ✓ |
| F8 | Workflow Templates Library | P1 | ✓ |
| F9 | Execution History & Logs | P1 | ✓ |
| F10 | Notifications & Alerts | P1 | ✓ |
| F11 | Integration Marketplace | P2 | ✗ |
| F12 | Analytics & Reporting | P2 | ✗ |
| F13 | Admin Console | P1 | Partial |
| F14 | Billing & Usage Metering | P2 | ✗ |

### 6.2 Detailed Feature Specifications

---

#### F1: User Authentication & Authorization

**Description:** Secure user authentication with role-based access control (RBAC).

**User Stories:**
- As a user, I can sign up with email/password or SSO (Google, Microsoft)
- As a user, I can reset my password via email
- As an admin, I can invite users to my organization
- As an admin, I can assign roles to users (Owner, Admin, Manager, Member, Viewer)

**Functional Requirements:**

| ID | Requirement |
|----|-------------|
| F1.1 | Support email/password authentication via Supabase Auth |
| F1.2 | Support OAuth providers: Google, Microsoft Azure AD |
| F1.3 | Implement email verification for new accounts |
| F1.4 | Implement password reset flow |
| F1.5 | Support organization invitations via email link |
| F1.6 | Implement RBAC with the following roles: |

**Role Permissions Matrix:**

| Permission | Owner | Admin | Manager | Member | Viewer |
|------------|-------|-------|---------|--------|--------|
| Manage organization settings | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage billing | ✓ | ✗ | ✗ | ✗ | ✗ |
| Invite/remove users | ✓ | ✓ | ✗ | ✗ | ✗ |
| Create teams | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create Digital Workers | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create workflows | ✓ | ✓ | ✓ | ✓ | ✗ |
| Manage assigned Digital Workers | ✓ | ✓ | ✓ | ✓ | ✗ |
| View Control Room | ✓ | ✓ | ✓ | ✓ | ✓ |
| Approve/reject reviews | ✓ | ✓ | ✓ | ✓ | ✗ |
| View execution history | ✓ | ✓ | ✓ | ✓ | ✓ |
| Access admin console | ✓ | ✓ | ✗ | ✗ | ✗ |

**Technical Notes:**
- Use Supabase Auth for authentication
- Store roles in `organization_members` table
- Implement Row Level Security (RLS) policies in Supabase
- JWT tokens should include organization_id and role claims

---

#### F2: Organization & Team Management

**Description:** Multi-tenant organization structure with team hierarchies.

**User Stories:**
- As a user, I can create a new organization
- As an admin, I can create teams within my organization
- As a manager, I can add Human Workers and Digital Workers to my team
- As a user, I can view the organizational hierarchy (org chart)

**Functional Requirements:**

| ID | Requirement |
|----|-------------|
| F2.1 | Support multi-tenant architecture (organization isolation) |
| F2.2 | Organizations can have multiple teams |
| F2.3 | Teams can have parent teams (hierarchical structure) |
| F2.4 | Users can belong to multiple teams |
| F2.5 | Digital Workers are assigned to exactly one team |
| F2.6 | Provide visual org chart showing humans and Digital Workers |
| F2.7 | Support drag-and-drop reorganization of team structure |

**UI Components:**
- Organization settings page
- Team management page
- Interactive org chart (canvas-based, pan/zoom)
- Team member list with role badges

---

#### F3: Workflow Builder (Chat-based)

**Description:** Natural language interface for creating workflows.

**User Stories:**
- As a user, I can describe a workflow in plain English
- As a user, the AI suggests a workflow structure based on my description
- As a user, I can refine the workflow through conversation
- As a user, I can answer clarifying questions to configure each step

**Functional Requirements:**

| ID | Requirement |
|----|-------------|
| F3.1 | Chat interface for workflow description |
| F3.2 | LLM parses user intent and generates workflow JSON |
| F3.3 | System asks clarifying questions for ambiguous requirements |
| F3.4 | Display generated workflow as visual preview |
| F3.5 | Support iterative refinement ("make step 3 run only on weekdays") |
| F3.6 | Generate "Blueprint" (constraints/rules) from conversation |
| F3.7 | Save draft workflows for later editing |

**Blueprint Structure:**
```json
{
  "workflow_id": "uuid",
  "name": "Perishable Inventory Marketing",
  "description": "...",
  "guidelines": [
    "Marketing copy should be professional but endearing",
    "Include price and discount percentage in copy"
  ],
  "hard_limits": [
    "Never use aggressive 'buy now' sales tactics",
    "Never generate low-quality images"
  ],
  "required_outputs": [
    "Marketing image (1080x1080)",
    "Copy text (max 280 chars)"
  ]
}
```

**LLM Integration:**
- Use structured output (JSON mode) for workflow generation
- Maintain conversation context for refinement
- Use function calling to map user intent to workflow actions

---

#### F4: Workflow Builder (Visual Editor)

**Description:** Drag-and-drop visual editor for advanced workflow configuration.

**User Stories:**
- As a power user, I can build workflows visually
- As a user, I can see the workflow generated from chat in visual form
- As a user, I can add, remove, and reorder steps
- As a user, I can configure each step's parameters

**Functional Requirements:**

| ID | Requirement |
|----|-------------|
| F4.1 | Canvas-based workflow editor (React Flow or similar) |
| F4.2 | Drag-and-drop step palette (triggers, actions, conditions) |
| F4.3 | Connect steps with visual edges |
| F4.4 | Step configuration panel (side drawer) |
| F4.5 | Support branching (if/else) and parallel execution |
| F4.6 | Validate workflow before saving (check for errors) |
| F4.7 | Test workflow execution from editor (dry run) |
| F4.8 | Version history for workflows |

**Step Types:**

| Type | Icon | Description |
|------|------|-------------|
| Trigger | ⚡ | Schedule, Webhook, Manual, File Upload, Event |
| AI Action | 🤖 | LLM-powered: Analyze, Generate, Summarize, Decide |
| Integration | 🔌 | API calls: Slack, Email, Google Sheets, etc. |
| Transform | ⚙️ | Data mapping, filtering, formatting |
| Condition | 🔀 | If/else branching based on data |
| Human Review | 👤 | Pause for human approval |
| End | 🏁 | Mark workflow complete |

---

#### F5: Digital Worker Management

**Description:** Create, configure, and manage AI agents (Digital Workers).

**User Stories:**
- As a user, I can create a new Digital Worker
- As a user, I can assign workflows to a Digital Worker
- As a user, I can set a Digital Worker's name, avatar, and description
- As a manager, I can pause/resume a Digital Worker
- As a manager, I can reassign a Digital Worker to another team member

**Functional Requirements:**

| ID | Requirement |
|----|-------------|
| F5.1 | Create Digital Worker with name, avatar, description |
| F5.2 | Assign one or more workflows to a Digital Worker |
| F5.3 | Configure Digital Worker "personality" (tone, behavior guidelines) |
| F5.4 | Set manager (Human Worker) for each Digital Worker |
| F5.5 | Pause/resume Digital Worker (stops/starts all assigned workflows) |
| F5.6 | View Digital Worker status: Active, Paused, Error, Idle |
| F5.7 | View Digital Worker activity log |
| F5.8 | Archive (soft delete) Digital Worker |

**Digital Worker Profile:**
```json
{
  "id": "uuid",
  "name": "Digi",
  "avatar_url": "...",
  "description": "Default Digital Worker for inventory tasks",
  "personality": {
    "tone": "professional",
    "verbosity": "concise"
  },
  "status": "active",
  "manager_id": "user_uuid",
  "team_id": "team_uuid",
  "assigned_workflows": ["workflow_uuid_1", "workflow_uuid_2"],
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-20T14:30:00Z"
}
```

---

#### F6: Control Room Dashboard

**Description:** Centralized monitoring interface for all Digital Workers and their executions.

**User Stories:**
- As a manager, I can see all active Digital Workers in my team
- As a manager, I can see tasks pending my review
- As a manager, I can see recently completed tasks
- As a user, I can filter the view by team, worker, or workflow

**Functional Requirements:**

| ID | Requirement |
|----|-------------|
| F6.1 | Three-column Kanban layout: Active Workers, Needs Review, Completed |
| F6.2 | Real-time updates via Supabase Realtime subscriptions |
| F6.3 | Filter by team, Digital Worker, workflow, date range |
| F6.4 | Click on item to see execution details |
| F6.5 | Quick actions: Approve, Reject, Chat, Retry |
| F6.6 | Badge counts for pending reviews |
| F6.7 | Search across executions |

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Control Room                              Team: [All Teams ▼]  │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Active Workers  │ Needs Review (3)│ Completed Today (12)        │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ ● Digi          │ □ Excel file    │ ✓ Invoice processed         │
│   ACTIVE        │   needed        │   2 hours ago               │
│                 │                 │                             │
│                 │ □ Preview for   │ ✓ Email sent                │
│                 │   approval      │   3 hours ago               │
│                 │   [image]       │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

---

#### F7: Human-in-the-Loop Reviews

**Description:** Approval gates within workflows where humans review and approve AI outputs.

**User Stories:**
- As an AI workflow, I can pause and request human review
- As a manager, I can see pending review items with context
- As a manager, I can approve, reject, or edit the output
- As a manager, I can provide feedback for rejected items

**Functional Requirements:**

| ID | Requirement |
|----|-------------|
| F7.1 | "Human Review" step type in workflow builder |
| F7.2 | Review requests appear in Control Room "Needs Review" column |
| F7.3 | Review detail view shows: workflow context, AI output, approve/reject buttons |
| F7.4 | Support file previews (images, PDFs, spreadsheets) |
| F7.5 | "Chat" option to ask Digital Worker clarifying questions |
| F7.6 | "Reject & Edit" option to modify output before continuing |
| F7.7 | Timeout configuration: auto-approve or auto-escalate after N hours |
| F7.8 | Review assignment: route to specific user or role |

**Review States:**
```
PENDING_REVIEW → APPROVED → (workflow continues)
              → REJECTED → (workflow fails or retries)
              → EDITED   → (workflow continues with modifications)
```

---

#### F8: Workflow Templates Library

**Description:** Pre-built workflow templates for common use cases.

**User Stories:**
- As a new user, I can browse available workflow templates
- As a user, I can preview a template before using it
- As a user, I can customize a template for my needs
- As an admin, I can create custom templates for my organization

**Functional Requirements:**

| ID | Requirement |
|----|-------------|
| F8.1 | System-provided templates (maintained by platform) |
| F8.2 | Organization-specific templates (private to org) |
| F8.3 | Template categories: Security, Finance, Marketing, HR, Operations |
| F8.4 | Template preview with step visualization |
| F8.5 | "Use Template" action creates editable copy |
| F8.6 | Template popularity/usage metrics |

**Default Templates (MVP):**

| Template | Category | Trigger | Description |
|----------|----------|---------|-------------|
| Nightly Security Check | Security | Schedule (daily) | Verify store locks via sensor logs |
| Spoilage Detection | Operations | Schedule (daily) | Analyze camera feed for spoiled inventory |
| Financial Autopilot | Finance | Webhook (bank) | Auto-categorize transactions in QuickBooks |
| Sales Response | Sales | Email received | Generate quotes for customer inquiries |
| Invoice Processing | Finance | Email attachment | Extract data from invoices, enter into system |
| Employee Onboarding | HR | Manual trigger | Guide new hire through setup tasks |

---

#### F9: Execution History & Logs

**Description:** Detailed logs of all workflow executions.

**User Stories:**
- As a user, I can see the history of all workflow runs
- As a user, I can see step-by-step execution details
- As a user, I can see inputs and outputs for each step
- As a user, I can filter history by status, date, workflow

**Functional Requirements:**

| ID | Requirement |
|----|-------------|
| F9.1 | List view of all executions with pagination |
| F9.2 | Filter by: workflow, Digital Worker, status, date range |
| F9.3 | Execution detail view with step-by-step timeline |
| F9.4 | Show input/output data for each step (with redaction for sensitive data) |
| F9.5 | Show execution duration and timestamps |
| F9.6 | Error details with stack traces (for failed executions) |
| F9.7 | Re-run execution from history |
| F9.8 | Export execution logs (CSV, JSON) |

---

#### F10: Notifications & Alerts

**Description:** Notify users of important events and required actions.

**User Stories:**
- As a manager, I get notified when a review is needed
- As a user, I get notified when a workflow fails
- As a user, I can configure my notification preferences

**Functional Requirements:**

| ID | Requirement |
|----|-------------|
| F10.1 | In-app notification center (bell icon with badge) |
| F10.2 | Email notifications for critical events |
| F10.3 | Notification types: Review needed, Execution failed, Execution completed |
| F10.4 | User-configurable notification preferences |
| F10.5 | Mark notifications as read/unread |
| F10.6 | Notification history |

**Future (P2):**
- Slack/Teams integration
- SMS for critical alerts
- Webhook notifications for external systems

---

#### F13: Admin Console (Partial MVP)

**Description:** Administrative controls for organization management.

**MVP Scope:**

| ID | Requirement |
|----|-------------|
| F13.1 | View all users in organization |
| F13.2 | Invite new users |
| F13.3 | Change user roles |
| F13.4 | Remove users |
| F13.5 | View organization usage summary |

**Post-MVP:**
- Audit logs
- Integration credentials management
- SSO/SAML configuration
- Data retention policies
- API key management

---

## 8. System Architecture

### 7.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   Web App    │  │  Mobile App  │  │   API Users  │                   │
│  │  (Next.js)   │  │   (Future)   │  │              │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
└─────────┼─────────────────┼─────────────────┼───────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Next.js API Routes / Vercel                    │   │
│  │                    (Authentication, Rate Limiting)                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                                │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Workflow  │  │   Digital   │  │   Control   │  │    Team     │    │
│  │   Service   │  │   Worker    │  │    Room     │  │   Service   │    │
│  │             │  │   Service   │  │   Service   │  │             │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │            │
└─────────┼────────────────┼────────────────┼────────────────┼────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      Supabase                                    │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │    │
│  │  │PostgreSQL │  │   Auth    │  │ Realtime  │  │  Storage  │    │    │
│  │  │ (Database)│  │           │  │           │  │  (Files)  │    │    │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW ENGINE                                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      n8n (Self-hosted)                           │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │    │
│  │  │  Workflow │  │ Execution │  │  Webhook  │  │Credentials│    │    │
│  │  │  Storage  │  │  Engine   │  │  Handler  │  │  Manager  │    │    │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                 │
│                                                                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
│  │Azure OpenAI│  │  Anthropic │  │   Slack   │  │  Google   │  ...      │
│  │    API     │  │   Claude   │  │    API    │  │   APIs    │            │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Component Details

#### 7.2.1 Frontend (Next.js)

**Technology Stack:**
- Framework: Next.js 14+ (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- UI Components: shadcn/ui
- State Management: Zustand or React Query
- Real-time: Supabase Realtime client
- Workflow Visualization: React Flow

**Key Pages:**
```
/                       → Dashboard / Home
/login                  → Login page
/signup                 → Signup page
/onboarding            → New user onboarding flow
/workflows             → Workflow list
/workflows/new         → Chat-based workflow builder
/workflows/[id]        → Workflow detail / visual editor
/workers               → Digital Worker list
/workers/[id]          → Digital Worker profile
/control-room          → Control Room dashboard
/team                  → Team / org chart view
/settings              → User settings
/admin                 → Admin console
/admin/users           → User management
/admin/integrations    → Integration management
```

#### 7.2.2 Backend (Next.js API + Supabase)

**API Architecture:**
- RESTful API via Next.js API routes
- Supabase client for database operations
- Server-side authentication validation

**Key API Namespaces:**
```
/api/auth/*            → Authentication (handled by Supabase)
/api/organizations/*   → Organization CRUD
/api/teams/*           → Team CRUD
/api/users/*           → User management
/api/workers/*         → Digital Worker CRUD
/api/workflows/*       → Workflow CRUD
/api/executions/*      → Execution history
/api/reviews/*         → Human review actions
/api/notifications/*   → Notification management
/api/n8n/*             → n8n integration proxy
```

#### 7.2.3 n8n Integration

**Deployment:**
- Self-hosted n8n instance on Azure Container Apps or VM
- PostgreSQL database (separate from main Supabase DB)
- Webhook endpoint exposed for triggers

**Integration Pattern:**
```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Platform   │  HTTP   │     n8n      │  HTTP   │   External   │
│   Backend    │ ◄─────► │   Instance   │ ◄─────► │   Services   │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │
       │                        │
       ▼                        ▼
┌──────────────┐         ┌──────────────┐
│   Supabase   │         │  n8n Queue   │
│   (State)    │         │  (Redis)     │
└──────────────┘         └──────────────┘
```

**Key Integration Points:**

| Operation | Method | Description |
|-----------|--------|-------------|
| Create workflow | n8n API: POST /workflows | Create n8n workflow from our schema |
| Activate workflow | n8n API: PATCH /workflows/{id}/activate | Enable workflow |
| Trigger execution | n8n API: POST /workflows/{id}/execute | Manual trigger |
| Get execution | n8n API: GET /executions/{id} | Fetch execution status |
| Webhook callback | Our API: POST /api/n8n/webhook | n8n calls us for human review |

**Custom n8n Nodes (to develop):**
- `Human Review Node`: Pauses execution, calls our API, waits for approval
- `AI Agent Node`: Configurable LLM call with our prompt templates
- `Platform Callback Node`: Reports status back to our Control Room

#### 7.2.4 LLM Integration

**Providers:**
- Primary: Google Gemini (gemini-2.0-flash / gemini-2.0-pro)
- Image generation: Imagen 3 (via Vertex AI) or Gemini native

**Use Cases:**

| Use Case | Model | Notes |
|----------|-------|-------|
| Workflow generation from chat | Gemini 2.0 Pro | Structured output (JSON) |
| Step execution (analyze, generate) | Gemini 2.0 Flash | Fast, cost-effective |
| Image analysis | Gemini 2.0 Pro Vision | For spoilage detection, etc. |
| Image generation | Imagen 3 | For marketing materials |
| Embeddings (future) | text-embedding-004 | For semantic search |

### 7.3 Data Flow Examples

#### 7.3.1 Workflow Creation Flow

```
┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
│  User  │     │Frontend│     │Backend │     │  LLM   │     │  n8n   │
└───┬────┘     └───┬────┘     └───┬────┘     └───┬────┘     └───┬────┘
    │              │              │              │              │
    │ "Create a workflow         │              │              │
    │  to detect spoilage"       │              │              │
    │─────────────►│              │              │              │
    │              │              │              │              │
    │              │ POST /api/workflows/generate│              │
    │              │─────────────►│              │              │
    │              │              │              │              │
    │              │              │ Generate workflow schema    │
    │              │              │─────────────►│              │
    │              │              │              │              │
    │              │              │◄─────────────│              │
    │              │              │ {workflow JSON}             │
    │              │              │              │              │
    │              │◄─────────────│              │              │
    │              │ Preview workflow            │              │
    │◄─────────────│              │              │              │
    │              │              │              │              │
    │ "Looks good, │              │              │              │
    │  save it"    │              │              │              │
    │─────────────►│              │              │              │
    │              │              │              │              │
    │              │ POST /api/workflows         │              │
    │              │─────────────►│              │              │
    │              │              │              │              │
    │              │              │ Create n8n workflow         │
    │              │              │─────────────────────────────►
    │              │              │              │              │
    │              │              │◄─────────────────────────────
    │              │              │ {n8n_workflow_id}           │
    │              │              │              │              │
    │              │              │ Save to Supabase            │
    │              │              │──────┐       │              │
    │              │              │      │       │              │
    │              │              │◄─────┘       │              │
    │              │              │              │              │
    │              │◄─────────────│              │              │
    │◄─────────────│ Workflow created            │              │
    │              │              │              │              │
```

#### 7.3.2 Workflow Execution with Human Review

```
┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
│Trigger │     │  n8n   │     │Backend │     │Supabase│     │Manager │
└───┬────┘     └───┬────┘     └───┬────┘     └───┬────┘     └───┬────┘
    │              │              │              │              │
    │ Schedule/    │              │              │              │
    │ Webhook      │              │              │              │
    │─────────────►│              │              │              │
    │              │              │              │              │
    │              │ Execute steps 1-3           │              │
    │              │──────┐       │              │              │
    │              │      │       │              │              │
    │              │◄─────┘       │              │              │
    │              │              │              │              │
    │              │ Step 4: Human Review        │              │
    │              │ POST /api/n8n/review-request│              │
    │              │─────────────►│              │              │
    │              │              │              │              │
    │              │              │ Insert review_request       │
    │              │              │─────────────►│              │
    │              │              │              │              │
    │              │              │              │ Realtime     │
    │              │              │              │ broadcast    │
    │              │              │              │─────────────►│
    │              │              │              │              │
    │              │              │              │ Notification │
    │              │              │              │ "Review      │
    │              │              │              │  needed"     │
    │              │              │              │─────────────►│
    │              │              │              │              │
    │              │              │              │ Manager      │
    │              │              │              │ approves     │
    │              │              │              │◄─────────────│
    │              │              │              │              │
    │              │              │ PATCH /api/reviews/{id}     │
    │              │              │◄────────────────────────────│
    │              │              │              │              │
    │              │              │ Update review status        │
    │              │              │─────────────►│              │
    │              │              │              │              │
    │              │ Resume execution            │              │
    │              │◄─────────────│              │              │
    │              │              │              │              │
    │              │ Execute steps 5-N           │              │
    │              │──────┐       │              │              │
    │              │      │       │              │              │
    │              │◄─────┘       │              │              │
    │              │              │              │              │
    │              │ POST /api/n8n/execution-complete           │
    │              │─────────────►│              │              │
    │              │              │              │              │
    │              │              │ Update execution record     │
    │              │              │─────────────►│              │
    │              │              │              │              │
```

---

## 9. Database Schema

### 8.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  organizations  │       │     teams       │       │     users       │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │───┐   │ id (PK)         │   ┌───│ id (PK)         │
│ name            │   │   │ organization_id │◄──┤   │ email           │
│ slug            │   │   │ parent_team_id  │───┘   │ full_name       │
│ created_at      │   │   │ name            │       │ avatar_url      │
│ updated_at      │   │   │ created_at      │       │ created_at      │
└─────────────────┘   │   └─────────────────┘       └─────────────────┘
                      │            │                        │
                      │            │                        │
                      ▼            ▼                        ▼
              ┌─────────────────────────────────────────────────────┐
              │              organization_members                    │
              ├─────────────────────────────────────────────────────┤
              │ id (PK)                                              │
              │ organization_id (FK) ───────────────────────────────┤
              │ user_id (FK) ───────────────────────────────────────┤
              │ role (owner|admin|manager|member|viewer)            │
              │ created_at                                          │
              └─────────────────────────────────────────────────────┘
                                       │
                                       │
              ┌─────────────────────────────────────────────────────┐
              │                   team_members                       │
              ├─────────────────────────────────────────────────────┤
              │ id (PK)                                              │
              │ team_id (FK) ───────────────────────────────────────┤
              │ user_id (FK) ───────────────────────────────────────┤
              │ role (manager|member)                               │
              │ created_at                                          │
              └─────────────────────────────────────────────────────┘


┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ digital_workers │       │    workflows    │       │   executions    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │───┐   │ id (PK)         │───┐   │ id (PK)         │
│ organization_id │   │   │ organization_id │   │   │ workflow_id     │◄─┐
│ team_id         │   │   │ name            │   │   │ worker_id       │  │
│ manager_id      │   │   │ description     │   │   │ status          │  │
│ name            │   │   │ trigger_type    │   │   │ started_at      │  │
│ avatar_url      │   │   │ trigger_config  │   │   │ completed_at    │  │
│ description     │   │   │ steps (JSONB)   │   │   │ error           │  │
│ personality     │   │   │ blueprint       │   │   │ input_data      │  │
│ status          │   │   │ n8n_workflow_id │   │   │ output_data     │  │
│ created_at      │   │   │ is_active       │   │   │ created_at      │  │
│ updated_at      │   │   │ created_by      │   │   └─────────────────┘  │
└─────────────────┘   │   │ created_at      │   │                        │
         │            │   │ updated_at      │   │                        │
         │            │   └─────────────────┘   │                        │
         │            │            │            │                        │
         │            │            │            │                        │
         ▼            ▼            ▼            │                        │
┌─────────────────────────────────────────────┐│   ┌─────────────────┐  │
│           worker_workflows                   ││   │ execution_steps │  │
├─────────────────────────────────────────────┤│   ├─────────────────┤  │
│ id (PK)                                      ││   │ id (PK)         │  │
│ worker_id (FK) ──────────────────────────────┘│   │ execution_id    │◄─┤
│ workflow_id (FK) ─────────────────────────────┘   │ step_index      │  │
│ assigned_at                                       │ step_name       │  │
│ is_active                                         │ status          │  │
└─────────────────────────────────────────────┘     │ input_data      │  │
                                                    │ output_data     │  │
                                                    │ started_at      │  │
                                                    │ completed_at    │  │
┌─────────────────┐       ┌─────────────────┐       │ error           │  │
│ review_requests │       │  notifications  │       └─────────────────┘  │
├─────────────────┤       ├─────────────────┤                            │
│ id (PK)         │       │ id (PK)         │                            │
│ execution_id    │───────│ user_id         │                            │
│ step_index      │       │ type            │                            │
│ assigned_to     │       │ title           │                            │
│ status          │       │ body            │                            │
│ review_data     │       │ data (JSONB)    │                            │
│ reviewer_id     │       │ is_read         │                            │
│ reviewed_at     │       │ created_at      │                            │
│ feedback        │       └─────────────────┘                            │
│ created_at      │                                                      │
└─────────────────┘──────────────────────────────────────────────────────┘
```

### 8.2 Table Definitions

```sql
-- Organizations (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Members (User <-> Organization relationship)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('manager', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- Digital Workers (AI Agents)
CREATE TABLE digital_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    description TEXT,
    personality JSONB DEFAULT '{"tone": "professional", "verbosity": "concise"}',
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('active', 'paused', 'error', 'idle', 'archived')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflows
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('schedule', 'webhook', 'manual', 'event')),
    trigger_config JSONB NOT NULL DEFAULT '{}',
    steps JSONB NOT NULL DEFAULT '[]',
    blueprint JSONB DEFAULT '{}',
    n8n_workflow_id TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    is_template BOOLEAN DEFAULT FALSE,
    template_category TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Worker-Workflow Assignments
CREATE TABLE worker_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES digital_workers(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(worker_id, workflow_id)
);

-- Workflow Executions
CREATE TABLE executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES digital_workers(id) ON DELETE SET NULL,
    n8n_execution_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'waiting_review', 'completed', 'failed', 'cancelled')),
    trigger_type TEXT NOT NULL,
    trigger_data JSONB,
    input_data JSONB,
    output_data JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Execution Steps (detailed step-by-step log)
CREATE TABLE execution_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    step_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    input_data JSONB,
    output_data JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Human Review Requests
CREATE TABLE review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'edited', 'expired')),
    review_type TEXT NOT NULL CHECK (review_type IN ('approval', 'input_needed', 'edit_review')),
    review_data JSONB NOT NULL,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    feedback TEXT,
    edited_data JSONB,
    timeout_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('review_needed', 'execution_completed', 'execution_failed', 'worker_error', 'system')),
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log (for compliance)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_teams_org ON teams(organization_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_workers_org ON digital_workers(organization_id);
CREATE INDEX idx_workers_team ON digital_workers(team_id);
CREATE INDEX idx_workers_manager ON digital_workers(manager_id);
CREATE INDEX idx_workflows_org ON workflows(organization_id);
CREATE INDEX idx_executions_workflow ON executions(workflow_id);
CREATE INDEX idx_executions_worker ON executions(worker_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_reviews_execution ON review_requests(execution_id);
CREATE INDEX idx_reviews_assigned ON review_requests(assigned_to);
CREATE INDEX idx_reviews_status ON review_requests(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX idx_audit_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
```

### 8.3 Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Example: Organizations policy (users can only see orgs they belong to)
CREATE POLICY "Users can view their organizations"
ON organizations FOR SELECT
USING (
    id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
    )
);

-- Example: Workflows policy (users can only see workflows in their org)
CREATE POLICY "Users can view organization workflows"
ON workflows FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
    )
);

-- Example: Notifications policy (users can only see their own)
CREATE POLICY "Users can view their notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

-- (Additional RLS policies for INSERT, UPDATE, DELETE operations...)
```

---

## 10. API Specification

### 9.1 Authentication

All API endpoints require authentication via Supabase JWT token in the `Authorization` header:

```
Authorization: Bearer <supabase_access_token>
```

### 9.2 Base URL

```
Production: https://api.copilotagents.com
Development: http://localhost:3000/api
```

### 9.3 API Endpoints

#### 9.3.1 Organizations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/organizations` | List user's organizations |
| POST | `/api/organizations` | Create new organization |
| GET | `/api/organizations/:id` | Get organization details |
| PATCH | `/api/organizations/:id` | Update organization |
| DELETE | `/api/organizations/:id` | Delete organization |
| GET | `/api/organizations/:id/members` | List organization members |
| POST | `/api/organizations/:id/members` | Invite member |
| PATCH | `/api/organizations/:id/members/:userId` | Update member role |
| DELETE | `/api/organizations/:id/members/:userId` | Remove member |

#### 9.3.2 Teams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teams` | List teams in current org |
| POST | `/api/teams` | Create new team |
| GET | `/api/teams/:id` | Get team details |
| PATCH | `/api/teams/:id` | Update team |
| DELETE | `/api/teams/:id` | Delete team |
| GET | `/api/teams/:id/members` | List team members |
| POST | `/api/teams/:id/members` | Add team member |
| DELETE | `/api/teams/:id/members/:userId` | Remove team member |
| GET | `/api/teams/hierarchy` | Get full team hierarchy (org chart) |

#### 9.3.3 Digital Workers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workers` | List Digital Workers |
| POST | `/api/workers` | Create Digital Worker |
| GET | `/api/workers/:id` | Get Digital Worker details |
| PATCH | `/api/workers/:id` | Update Digital Worker |
| DELETE | `/api/workers/:id` | Archive Digital Worker |
| POST | `/api/workers/:id/pause` | Pause Digital Worker |
| POST | `/api/workers/:id/resume` | Resume Digital Worker |
| GET | `/api/workers/:id/workflows` | List assigned workflows |
| POST | `/api/workers/:id/workflows` | Assign workflow |
| DELETE | `/api/workers/:id/workflows/:workflowId` | Unassign workflow |
| GET | `/api/workers/:id/activity` | Get activity log |

#### 9.3.4 Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Create workflow |
| GET | `/api/workflows/:id` | Get workflow details |
| PATCH | `/api/workflows/:id` | Update workflow |
| DELETE | `/api/workflows/:id` | Delete workflow |
| POST | `/api/workflows/:id/activate` | Activate workflow |
| POST | `/api/workflows/:id/deactivate` | Deactivate workflow |
| POST | `/api/workflows/:id/execute` | Manually trigger execution |
| POST | `/api/workflows/:id/test` | Test workflow (dry run) |
| GET | `/api/workflows/:id/executions` | List executions |
| POST | `/api/workflows/generate` | Generate workflow from natural language |
| GET | `/api/workflows/templates` | List workflow templates |

#### 9.3.5 Executions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/executions` | List executions (with filters) |
| GET | `/api/executions/:id` | Get execution details |
| GET | `/api/executions/:id/steps` | Get execution steps |
| POST | `/api/executions/:id/cancel` | Cancel running execution |
| POST | `/api/executions/:id/retry` | Retry failed execution |

#### 9.3.6 Reviews

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reviews` | List pending reviews |
| GET | `/api/reviews/:id` | Get review details |
| POST | `/api/reviews/:id/approve` | Approve review |
| POST | `/api/reviews/:id/reject` | Reject review |
| POST | `/api/reviews/:id/edit` | Edit and approve |

#### 9.3.7 Control Room

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/control-room/summary` | Get Control Room summary stats |
| GET | `/api/control-room/active-workers` | Get active Digital Workers |
| GET | `/api/control-room/pending-reviews` | Get pending reviews |
| GET | `/api/control-room/recent-completions` | Get recent completions |

#### 9.3.8 Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| POST | `/api/notifications/read-all` | Mark all as read |
| GET | `/api/notifications/unread-count` | Get unread count |

#### 9.3.9 n8n Integration (Internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/n8n/webhook/:workflowId` | Webhook trigger endpoint |
| POST | `/api/n8n/review-request` | n8n requests human review |
| POST | `/api/n8n/execution-update` | n8n reports execution status |
| POST | `/api/n8n/step-update` | n8n reports step completion |

### 9.4 Request/Response Examples

#### Create Workflow

**Request:**
```http
POST /api/workflows
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Perishable Inventory Marketing",
  "description": "Detect spoilage and create marketing materials",
  "trigger_type": "schedule",
  "trigger_config": {
    "cron": "0 8 * * *",
    "timezone": "America/Los_Angeles"
  },
  "steps": [
    {
      "type": "trigger",
      "name": "Daily morning trigger",
      "config": {}
    },
    {
      "type": "integration",
      "name": "Fetch inventory data",
      "config": {
        "integration": "google_sheets",
        "action": "read_sheet",
        "sheet_id": "abc123"
      }
    },
    {
      "type": "ai_action",
      "name": "Analyze for expiring items",
      "config": {
        "model": "gemini-2.0-flash",
        "prompt_template": "Analyze the following inventory data and identify items expiring within 48 hours: {{inventory_data}}"
      }
    },
    {
      "type": "condition",
      "name": "Check if items expiring",
      "config": {
        "condition": "expiring_items.length > 0"
      }
    },
    {
      "type": "ai_action",
      "name": "Generate marketing copy",
      "config": {
        "model": "gemini-2.0-flash",
        "prompt_template": "Create promotional copy for these expiring items: {{expiring_items}}. Follow brand guidelines: {{blueprint.guidelines}}"
      }
    },
    {
      "type": "ai_action",
      "name": "Generate promotional image",
      "config": {
        "model": "imagen-3",
        "prompt_template": "Create a promotional image for: {{marketing_copy}}"
      }
    },
    {
      "type": "human_review",
      "name": "Review marketing materials",
      "config": {
        "review_type": "approval",
        "timeout_hours": 4,
        "assigned_role": "manager"
      }
    },
    {
      "type": "integration",
      "name": "Post to Instagram",
      "config": {
        "integration": "instagram",
        "action": "create_post",
        "image": "{{generated_image}}",
        "caption": "{{marketing_copy}}"
      }
    },
    {
      "type": "end",
      "name": "Complete"
    }
  ],
  "blueprint": {
    "guidelines": [
      "Marketing copy should be professional but endearing",
      "Include price and discount percentage"
    ],
    "hard_limits": [
      "Never use aggressive sales tactics",
      "Never generate low-quality images"
    ]
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Perishable Inventory Marketing",
  "description": "Detect spoilage and create marketing materials",
  "trigger_type": "schedule",
  "trigger_config": {
    "cron": "0 8 * * *",
    "timezone": "America/Los_Angeles"
  },
  "steps": [...],
  "blueprint": {...},
  "n8n_workflow_id": "12345",
  "is_active": false,
  "created_by": "user-uuid",
  "created_at": "2026-01-30T10:00:00Z",
  "updated_at": "2026-01-30T10:00:00Z"
}
```

#### Generate Workflow from Natural Language

**Request:**
```http
POST /api/workflows/generate
Content-Type: application/json
Authorization: Bearer <token>

{
  "prompt": "Every morning, check my flower shop inventory spreadsheet for items expiring in the next 2 days. If there are any, create a promotional image and caption, then post it to Instagram after I approve it.",
  "context": {
    "integrations": ["google_sheets", "instagram"],
    "previous_messages": []
  }
}
```

**Response:**
```json
{
  "workflow": {
    "name": "Expiring Inventory Promotion",
    "description": "Daily check for expiring items with promotional posting",
    "steps": [...],
    "blueprint": {...}
  },
  "clarifying_questions": [
    {
      "id": "q1",
      "question": "What's the Google Sheets ID or name for your inventory spreadsheet?",
      "type": "text"
    },
    {
      "id": "q2",
      "question": "What time should this run each morning?",
      "type": "time",
      "default": "08:00"
    },
    {
      "id": "q3",
      "question": "Should the marketing copy be formal or casual?",
      "type": "choice",
      "options": ["Formal", "Casual", "Playful"]
    }
  ],
  "confidence": 0.85
}
```

---

## 11. Security & Compliance

### 10.1 Authentication Security

| Requirement | Implementation |
|-------------|----------------|
| Password hashing | Supabase Auth (bcrypt) |
| Session management | JWT with refresh tokens |
| MFA support | Supabase Auth TOTP (future) |
| OAuth security | PKCE flow for OAuth providers |
| Rate limiting | Vercel Edge + custom middleware |

### 10.2 Data Security

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | Supabase (AES-256) |
| Encryption in transit | TLS 1.3 |
| Data isolation | Row Level Security (RLS) |
| Secrets management | Environment variables + Vault (future) |
| PII handling | Redaction in logs, encrypted storage |

### 10.3 Access Control

| Requirement | Implementation |
|-------------|----------------|
| RBAC | Custom role system with RLS policies |
| Organization isolation | Tenant-based RLS |
| Least privilege | Role-based permissions matrix |
| Audit logging | audit_logs table |

### 10.4 Compliance Considerations

| Standard | Status | Notes |
|----------|--------|-------|
| GDPR | Planned | Data export, deletion, consent |
| SOC 2 | Future | Requires infrastructure maturity |
| HIPAA | Future | Healthcare use cases |

### 10.5 n8n Security

| Concern | Mitigation |
|---------|------------|
| Credential storage | n8n encrypted credentials + per-org isolation |
| Webhook authentication | Signed webhook payloads |
| Network isolation | Private network between app and n8n |
| Execution sandboxing | Container isolation |

---

## 12. Integration Requirements

### 11.1 MVP Integrations

| Integration | Category | Priority | Use Case |
|-------------|----------|----------|----------|
| Google Sheets | Data | P0 | Inventory tracking |
| Gmail | Communication | P0 | Email notifications |
| Slack | Communication | P1 | Team notifications |
| Google Gemini | AI | P0 | LLM operations |
| Imagen 3 | AI | P1 | Image generation |

### 11.2 Post-MVP Integrations

| Integration | Category | Priority |
|-------------|----------|----------|
| Microsoft 365 | Productivity | P1 |
| Salesforce | CRM | P2 |
| QuickBooks | Finance | P2 |
| Shopify | E-commerce | P2 |
| Twilio | Communication | P2 |
| Zapier | Automation | P2 |

### 11.3 n8n Native Integrations

n8n provides 400+ native integrations. Key ones to leverage:

- HTTP Request (generic API calls)
- Webhook (trigger)
- Cron (scheduled triggers)
- Google Sheets, Drive, Calendar
- Slack, Discord, Microsoft Teams
- Email (IMAP/SMTP)
- PostgreSQL, MySQL, MongoDB
- AWS S3, Azure Blob Storage

### 11.4 Custom n8n Nodes

Nodes to develop for our platform:

| Node | Purpose |
|------|---------|
| `Human Review` | Pause execution, request approval via our API |
| `AI Agent` | Unified LLM interface with our prompt management |
| `Platform Status` | Report execution status to Control Room |
| `Blueprint Validator` | Validate outputs against workflow constraints |

---

## 13. Migration Plan

### 13.1 Migration Overview

This plan transforms the existing Vite/React prototype into a production-ready Next.js application with Supabase backend and n8n workflow engine.

```
PHASE 1: Infrastructure Setup (Foundation)
    ↓
PHASE 2: Next.js Migration (Framework)
    ↓
PHASE 3: Supabase Integration (Database + Auth)
    ↓
PHASE 4: n8n Integration (Workflow Engine)
    ↓
PHASE 5: Deployment & Testing (Production)
```

### 13.2 Phase 1: Infrastructure Setup

**Goal:** Set up external services and project structure.

#### 1.1 Create Supabase Project
```bash
# Via Supabase Dashboard (supabase.com)
1. Create new project: "enterprise-agent-platform"
2. Note: Project URL, anon key, service role key
3. Enable Email auth provider
4. Enable Google OAuth provider (for Gmail users)
```

#### 1.2 Create n8n Instance
```bash
# Option A: Railway (recommended for MVP)
1. Deploy n8n template on Railway
2. Configure PostgreSQL addon
3. Note: n8n URL, webhook base URL

# Option B: Render
1. Create new Web Service
2. Use n8n Docker image
3. Add PostgreSQL database
```

#### 1.3 Initialize Next.js Project
```bash
# Create new Next.js project alongside existing code
npx create-next-app@latest enterprise-agent-platform-next \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd enterprise-agent-platform-next
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query
npm install lucide-react clsx tailwind-merge
npm install d3 @types/d3
```

### 13.3 Phase 2: Next.js Migration

**Goal:** Migrate existing React components to Next.js App Router.

#### 2.1 File Migration Map

| Source (Vite) | Destination (Next.js) | Changes |
|---------------|----------------------|---------|
| `src/App.tsx` | `src/app/layout.tsx` + `src/app/page.tsx` | Split into layout + page |
| `src/main.tsx` | Remove | Next.js handles this |
| `src/types.ts` | `src/types/index.ts` | Keep as-is |
| `src/components/ui/*` | `src/components/ui/*` | Keep as-is |
| `src/components/Sidebar.tsx` | `src/components/Sidebar.tsx` | Update navigation to Next.js Link |
| `src/components/Screen1*.tsx` | `src/app/(dashboard)/create/page.tsx` | Convert to page component |
| `src/components/Screen2*.tsx` | `src/app/(dashboard)/team/page.tsx` | Convert to page component |
| `src/components/Screen3*.tsx` | `src/app/(dashboard)/workflows/page.tsx` | Convert to page component |
| `src/components/Screen4*.tsx` | `src/app/(dashboard)/control-room/page.tsx` | Convert to page component |
| `src/contexts/*` | `src/providers/*` | Migrate to React Query + Supabase |
| `src/services/*` | `src/lib/*` + `src/app/api/*` | Split client/server |
| `src/utils/*` | `src/lib/utils/*` | Keep as-is |
| `src/styles/index.css` | `src/app/globals.css` | Keep as-is |

#### 2.2 New Directory Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout with providers
│   ├── page.tsx                      # Landing/redirect to dashboard
│   ├── globals.css
│   │
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/page.tsx         # OAuth callback
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Dashboard layout with Sidebar
│   │   ├── create/page.tsx           # Screen1Consultant
│   │   ├── workflows/
│   │   │   ├── page.tsx              # Screen3Workflows (list)
│   │   │   └── [id]/page.tsx         # Workflow detail
│   │   ├── team/page.tsx             # Screen2OrgChart
│   │   └── control-room/page.tsx     # Screen4ControlRoom
│   │
│   └── api/
│       ├── workflows/
│       │   ├── route.ts              # CRUD
│       │   ├── [id]/route.ts
│       │   └── generate/route.ts     # Gemini workflow generation
│       ├── workers/
│       │   └── route.ts
│       ├── executions/
│       │   └── route.ts
│       ├── n8n/
│       │   ├── webhook/route.ts      # n8n callbacks
│       │   └── sync/route.ts         # Sync workflows to n8n
│       └── gemini/
│           └── route.ts              # Proxy Gemini calls
│
├── components/
│   ├── ui/                           # Migrated from existing
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── Modal.tsx
│   ├── Sidebar.tsx                   # Updated for Next.js
│   ├── WorkflowFlowchart.tsx         # Migrated as-is
│   ├── RequirementsGatherer.tsx      # Migrated as-is
│   └── GmailAuth.tsx                 # Migrated as-is
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # Server client
│   │   └── middleware.ts             # Auth middleware
│   ├── n8n/
│   │   └── client.ts                 # n8n API client
│   ├── gemini/
│   │   └── client.ts                 # Gemini service (server-side)
│   └── utils/
│       ├── cn.ts                     # Class merge utility
│       └── validation.ts             # Migrated validators
│
├── hooks/
│   ├── useWorkflows.ts               # React Query + Supabase
│   ├── useTeam.ts
│   ├── useAuth.ts
│   └── useRealtime.ts                # Supabase Realtime subscriptions
│
├── providers/
│   ├── QueryProvider.tsx             # React Query
│   ├── AuthProvider.tsx              # Supabase Auth
│   └── RealtimeProvider.tsx          # Supabase Realtime
│
└── types/
    └── index.ts                      # Migrated + extended types
```

#### 2.3 Component Migration Tasks

**Task 2.3.1: Migrate UI Components**
```
Files: Button.tsx, Card.tsx, Input.tsx, Modal.tsx
Action: Copy as-is, update imports if needed
Effort: Low
```

**Task 2.3.2: Migrate Sidebar**
```
File: Sidebar.tsx
Changes:
- Replace custom tab handling with Next.js <Link>
- Use usePathname() for active state
- Remove AppContext dependency
```

**Task 2.3.3: Migrate Screen Components to Pages**
```
Screen1Consultant → app/(dashboard)/create/page.tsx
- Convert to async Server Component where possible
- Extract client interactivity to separate Client Components
- Replace WorkflowContext with React Query hooks

Screen2OrgChart → app/(dashboard)/team/page.tsx
- Keep as Client Component (D3 requires DOM)
- Replace TeamContext with useTeam() hook

Screen3Workflows → app/(dashboard)/workflows/page.tsx
- Server Component for initial data fetch
- Client Components for interactivity

Screen4ControlRoom → app/(dashboard)/control-room/page.tsx
- Client Component (real-time updates)
- Use Supabase Realtime subscriptions
```

**Task 2.3.4: Migrate WorkflowFlowchart & RequirementsGatherer**
```
Action: Copy as-is (already self-contained)
Add: 'use client' directive
Update: Props to use new types if needed
```

### 13.4 Phase 3: Supabase Integration

**Goal:** Replace localStorage with Supabase database and add authentication.

#### 3.1 Database Migration

**Create Tables (run in Supabase SQL Editor):**

```sql
-- See Section 9: Database Schema for full SQL
-- Key tables to create:
-- 1. organizations
-- 2. users (extends auth.users)
-- 3. organization_members
-- 4. teams
-- 5. team_members
-- 6. digital_workers
-- 7. workflows
-- 8. worker_workflows
-- 9. executions
-- 10. execution_steps
-- 11. review_requests
-- 12. notifications
-- 13. audit_logs
```

**Data Migration Script:**
```typescript
// scripts/migrate-localStorage-to-supabase.ts
// Run once to migrate existing localStorage data

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(URL, SERVICE_ROLE_KEY);

async function migrate() {
  // 1. Read localStorage exports (user provides JSON files)
  const workflows = JSON.parse(fs.readFileSync('workflows.json'));
  const team = JSON.parse(fs.readFileSync('team.json'));

  // 2. Create default organization
  const { data: org } = await supabase
    .from('organizations')
    .insert({ name: 'My Organization', slug: 'my-org' })
    .select()
    .single();

  // 3. Migrate workflows
  for (const workflow of workflows) {
    await supabase.from('workflows').insert({
      id: workflow.id,
      organization_id: org.id,
      name: workflow.name,
      description: workflow.description,
      trigger_type: workflow.steps[0]?.type === 'trigger' ? 'manual' : 'manual',
      steps: workflow.steps,
      blueprint: workflow.steps.find(s => s.requirements?.blueprint)?.requirements?.blueprint,
      is_active: workflow.status === 'active',
      created_at: workflow.createdAt,
    });
  }

  // 4. Migrate digital workers
  for (const node of team.filter(n => n.type === 'ai')) {
    await supabase.from('digital_workers').insert({
      organization_id: org.id,
      team_id: defaultTeam.id,
      name: node.name === 'default' ? 'Digi' : node.name,
      status: node.status || 'idle',
    });
  }
}
```

#### 3.2 Authentication Setup

**Supabase Auth Configuration:**
```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value; },
        set(name, value, options) { cookieStore.set({ name, value, ...options }); },
        remove(name, options) { cookieStore.set({ name, value: '', ...options }); },
      },
    }
  );
}
```

**Auth Middleware:**
```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  const response = NextResponse.next();
  const supabase = createServerClient(/* ... */);

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  if (!user && request.nextUrl.pathname.startsWith('/(dashboard)')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/(dashboard)/:path*'],
};
```

#### 3.3 React Query Hooks

**Replace Context with Hooks:**
```typescript
// src/hooks/useWorkflows.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useWorkflows() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (workflow: Partial<Workflow>) => {
      const { data, error } = await supabase
        .from('workflows')
        .insert(workflow)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}
```

#### 3.4 Realtime Subscriptions

```typescript
// src/hooks/useRealtime.ts
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useRealtimeExecutions(onUpdate: (payload) => void) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('executions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'executions' },
        onUpdate
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
}

export function useRealtimeReviews(onUpdate: (payload) => void) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('reviews')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'review_requests' },
        onUpdate
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
}
```

### 13.5 Phase 4: n8n Integration

**Goal:** Replace custom workflow execution with n8n engine.

#### 4.1 n8n API Client

```typescript
// src/lib/n8n/client.ts
const N8N_URL = process.env.N8N_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

export async function createN8nWorkflow(workflow: Workflow) {
  const n8nWorkflow = transformToN8nFormat(workflow);

  const response = await fetch(`${N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(n8nWorkflow),
  });

  return response.json();
}

export async function activateN8nWorkflow(n8nWorkflowId: string) {
  await fetch(`${N8N_URL}/api/v1/workflows/${n8nWorkflowId}/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': N8N_API_KEY },
  });
}

export async function executeN8nWorkflow(n8nWorkflowId: string, data?: any) {
  const response = await fetch(`${N8N_URL}/api/v1/workflows/${n8nWorkflowId}/execute`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  return response.json();
}

function transformToN8nFormat(workflow: Workflow) {
  // Convert our workflow format to n8n workflow JSON
  return {
    name: workflow.name,
    nodes: workflow.steps.map((step, i) => ({
      id: step.id,
      name: step.label,
      type: mapStepTypeToN8nNode(step.type),
      position: [250 * i, 300],
      parameters: buildN8nParameters(step),
    })),
    connections: buildN8nConnections(workflow.steps),
  };
}
```

#### 4.2 Webhook Handler for Human Review

```typescript
// src/app/api/n8n/webhook/route.ts
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const payload = await request.json();

  if (payload.type === 'human_review_request') {
    // Create review request in Supabase
    await supabase.from('review_requests').insert({
      execution_id: payload.executionId,
      step_index: payload.stepIndex,
      review_type: 'approval',
      review_data: payload.data,
      status: 'pending',
    });

    // This triggers Realtime update to Control Room
    return Response.json({ status: 'review_requested' });
  }

  if (payload.type === 'execution_complete') {
    await supabase
      .from('executions')
      .update({ status: 'completed', completed_at: new Date() })
      .eq('n8n_execution_id', payload.executionId);

    return Response.json({ status: 'completed' });
  }

  return Response.json({ status: 'ok' });
}
```

#### 4.3 Custom n8n Node: Human Review

```javascript
// n8n-nodes/HumanReview.node.ts (deploy to n8n)
// This node pauses execution and waits for human approval

module.exports = {
  description: {
    displayName: 'Human Review',
    name: 'humanReview',
    group: ['transform'],
    version: 1,
    description: 'Pause workflow and wait for human approval',
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Webhook URL',
        name: 'webhookUrl',
        type: 'string',
        default: '',
        description: 'URL to call when review is needed',
      },
      {
        displayName: 'Review Type',
        name: 'reviewType',
        type: 'options',
        options: [
          { name: 'Approval', value: 'approval' },
          { name: 'Input Needed', value: 'input_needed' },
        ],
        default: 'approval',
      },
    ],
  },

  async execute() {
    const webhookUrl = this.getNodeParameter('webhookUrl', 0);
    const reviewType = this.getNodeParameter('reviewType', 0);

    // Call our API to create review request
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'human_review_request',
        executionId: this.getExecutionId(),
        stepIndex: this.getNode().position,
        reviewType,
        data: this.getInputData(),
      }),
    });

    // Wait for approval (n8n's wait node pattern)
    // This would use n8n's webhook wait functionality
    return this.getInputData();
  },
};
```

### 13.6 Phase 5: Deployment & Testing

#### 5.1 Environment Variables

```bash
# .env.local (Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

GEMINI_API_KEY=AIza...

N8N_URL=https://your-n8n.railway.app
N8N_API_KEY=n8n_api_...

NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

#### 5.2 Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Connect to GitHub for auto-deploys
```

#### 5.3 Testing Checklist

- [ ] Auth: Sign up, login, logout, password reset
- [ ] Workflows: Create via chat, edit, activate
- [ ] Digital Workers: Create, assign workflows, activate
- [ ] Control Room: Real-time updates, review items
- [ ] n8n: Workflow sync, execution, webhooks
- [ ] Gmail: OAuth flow, send email action
- [ ] Mobile: Responsive layout

### 13.7 Migration Timeline

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| **Phase 1** | Supabase project, n8n instance, Next.js init | None |
| **Phase 2** | Component migration, routing setup | Phase 1 |
| **Phase 3** | Database tables, auth, React Query hooks | Phase 2 |
| **Phase 4** | n8n client, webhook handlers, custom nodes | Phase 3 |
| **Phase 5** | Vercel deploy, testing, data migration | Phase 4 |

### 13.8 Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Export localStorage to JSON before migrating |
| n8n complexity | Start with simple workflows, add complexity later |
| Breaking existing functionality | Keep Vite app running during migration, switch over when ready |
| Auth edge cases | Test OAuth flows thoroughly, handle token refresh |

---

## 14. MVP Scope

### 12.1 MVP Definition

**Goal:** Deliver a functional product that demonstrates the core value proposition—enabling non-technical users to create recurring workflow automations managed through a unified control interface.

**Target Users:** Small business owners (Chitra persona)

**Timeline Target:** 8-12 weeks

### 12.2 MVP Features (In Scope)

| Feature | Scope |
|---------|-------|
| **Auth** | Email/password + Google OAuth |
| **Organization** | Single org per user (no multi-org) |
| **Teams** | Basic team creation, no hierarchy |
| **Digital Workers** | Create, edit, pause/resume, delete |
| **Workflow Builder (Chat)** | Natural language → workflow generation |
| **Workflow Builder (Visual)** | View and edit generated workflows |
| **Control Room** | 3-column view, real-time updates |
| **Human Review** | Approve/reject flow |
| **Notifications** | In-app only |
| **Templates** | 4 pre-built templates |
| **Integrations** | Google Sheets, Gmail, Google Gemini |

### 12.3 MVP Features (Out of Scope)

| Feature | Reason |
|---------|--------|
| Multi-org support | Complexity |
| Team hierarchy | Complexity |
| SSO/SAML | Enterprise feature |
| Advanced analytics | Post-MVP |
| Billing/metering | Post-MVP |
| Mobile app | Post-MVP |
| Integration marketplace | Post-MVP |
| Custom n8n nodes | Use existing where possible |

### 12.4 MVP User Flows

#### Flow 1: First-Time User Onboarding
```
Sign Up → Create Organization → Create First Team →
Guided Workflow Creation (Chat) → Assign to Digital Worker →
View in Control Room → Complete Onboarding
```

#### Flow 2: Create Workflow via Chat
```
Click "New Workflow" → Describe in natural language →
AI generates workflow → Answer clarifying questions →
Preview workflow → Edit if needed → Save →
Assign to Digital Worker → Activate
```

#### Flow 3: Review and Approve
```
Receive notification (in-app) → Open Control Room →
Click pending review → View AI output →
Approve / Reject with feedback → Workflow continues
```

### 12.5 MVP Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind, shadcn/ui |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Real-time | Supabase Realtime |
| Workflow Engine | n8n (self-hosted on Railway or Render) |
| LLM | Google Gemini (gemini-2.0-flash / gemini-2.0-pro) |
| Hosting | Vercel (full-stack Next.js app) |

### 12.6 MVP Success Criteria

| Metric | Target |
|--------|--------|
| User can create workflow via chat | < 15 minutes |
| Workflow executes successfully | 80% success rate |
| Human review cycle time | < 5 minutes |
| Page load time | < 2 seconds |
| Zero critical security vulnerabilities | Pass |

---

## 15. Future Roadmap

### 13.1 Phase 2 (Post-MVP: 3-6 months)

| Feature | Description |
|---------|-------------|
| Multi-organization | Users can belong to multiple orgs |
| Team hierarchy | Nested teams, org chart visualization |
| Advanced analytics | Workflow performance, cost tracking |
| More integrations | Slack, Microsoft 365, QuickBooks |
| Workflow versioning | Version history, rollback |
| Custom templates | Org-specific template library |
| Email notifications | Configurable email alerts |

### 13.2 Phase 3 (6-12 months)

| Feature | Description |
|---------|-------------|
| Enterprise SSO | SAML, Azure AD integration |
| Billing & metering | Usage-based pricing, invoicing |
| Advanced AI features | Fine-tuned models, embeddings search |
| API access | Public API for external integrations |
| Mobile app | iOS/Android companion app |
| White-labeling | Custom branding for enterprises |

### 13.3 Phase 4 (12+ months)

| Feature | Description |
|---------|-------------|
| Multi-agent collaboration | Agents communicating with each other |
| Voice interface | Voice commands for workflow creation |
| Predictive automation | AI suggests workflows based on patterns |
| Compliance certifications | SOC 2, HIPAA |
| On-premise deployment | Self-hosted enterprise option |

---

## 16. Appendix

### 14.1 Glossary

| Term | Definition |
|------|------------|
| AI Agent | An autonomous AI system that can perform tasks |
| Agentic AI | AI that takes actions, not just generates content |
| Blueprint | Configuration rules and constraints for a workflow |
| Control Room | Dashboard for monitoring Digital Workers |
| Digital Worker | An AI agent assigned to a team with workflows |
| Execution | A single run of a workflow |
| Human-in-the-Loop | Pattern where humans review/approve AI outputs |
| n8n | Open-source workflow automation tool |
| RLS | Row Level Security (Postgres feature) |
| Trigger | Event that starts a workflow execution |
| Workflow | A sequence of automated tasks |

### 14.2 Reference Documents

- Microsoft Enterprise Agent Collaboration Platform (source PDF)
- n8n Documentation: https://docs.n8n.io
- Supabase Documentation: https://supabase.com/docs
- Salesforce Agentforce: https://www.salesforce.com/agentforce

### 14.3 Competitive Analysis Summary

| Product | Strengths | Weaknesses |
|---------|-----------|------------|
| Salesforce Agentforce | Enterprise-ready, CRM integration | Expensive, Salesforce lock-in |
| Manus | Fast, consumer-friendly | One-off tasks only, no management |
| Genspark | Simple UI | Consumer focus, limited enterprise |
| n8n | Flexible, open-source | Technical, no AI-native features |
| Zapier | Huge integration library | Not agentic, no oversight model |

### 14.4 Open Questions

1. **Pricing model:** Per-seat, per-execution, or hybrid?
2. **n8n licensing:** Self-hosted vs. n8n Cloud for scale?
3. **Gemini costs:** How to manage/limit Gemini API costs per org?
4. **Data residency:** EU customers require EU data storage?
5. **Agent identity:** Should Digital Workers have persistent memory across executions?

---

*Document Version: 1.0*
*Last Updated: January 30, 2026*
*Author: [Product Team]*

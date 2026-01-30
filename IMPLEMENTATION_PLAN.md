# Implementation Plan: Custom Workflow Testing & Worker Analytics

## Overview
Two features to enhance the platform:
1. **Custom Workflow Testing** - Allow users to test workflows with mock data before production
2. **Custom Analytics for Digital Workers** - Performance dashboards for each worker

---

## Feature 1: Custom Workflow Testing

### Database Schema (3 new tables)

```sql
-- 1. test_cases: Saved test configurations
CREATE TABLE test_cases (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  name TEXT NOT NULL,
  mock_trigger_data JSONB,      -- Mock input for trigger
  mock_step_inputs JSONB,       -- Per-step mock inputs
  expected_outputs JSONB,       -- Expected results
  assertions JSONB,             -- Validation rules
  last_run_status TEXT,         -- 'passed' | 'failed' | 'error'
  created_at TIMESTAMPTZ
);

-- 2. test_runs: Each test execution
CREATE TABLE test_runs (
  id UUID PRIMARY KEY,
  test_case_id UUID REFERENCES test_cases(id),
  workflow_id UUID REFERENCES workflows(id),
  execution_id UUID REFERENCES executions(id),
  run_type TEXT,                -- 'full_workflow' | 'single_step' | 'step_range'
  status TEXT,                  -- 'pending' | 'running' | 'passed' | 'failed'
  assertion_results JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ
);

-- 3. test_step_results: Per-step results
CREATE TABLE test_step_results (
  id UUID PRIMARY KEY,
  test_run_id UUID REFERENCES test_runs(id),
  step_id TEXT,
  input_data JSONB,
  output_data JSONB,
  expected_output JSONB,
  status TEXT,
  assertion_details JSONB
);

-- 4. Modify executions table
ALTER TABLE executions ADD COLUMN is_test_run BOOLEAN DEFAULT false;
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/testing/test-cases` | List/create test cases |
| GET/PUT/DELETE | `/api/testing/test-cases/[id]` | Manage single test case |
| POST | `/api/testing/run` | Start a test run |
| GET | `/api/testing/run/[id]` | Get test run results |
| GET | `/api/testing/runs` | List test history |

### Key Components

1. **TestRunnerPanel** - Main UI for running tests
2. **MockDataEditor** - JSON editor for mock inputs
3. **AssertionBuilder** - Define expected outcomes
4. **TestResultsViewer** - View pass/fail with diff
5. **TestCaseManager** - Save/manage test cases

### Core Services

```
/src/lib/testing/
  execution-service.ts    # Orchestrates test runs (via n8n)
  assertion-engine.ts     # Validates expected vs actual
```

### Hooks

```typescript
useTestCases()      // CRUD for test cases
useTestRunner()     // Execute tests, poll status
useTestHistory()    // View past test runs
```

---

## Feature 2: Worker Analytics Dashboard

### Database Schema

```sql
-- Pre-aggregated daily metrics (updated nightly)
CREATE TABLE worker_daily_metrics (
  id UUID PRIMARY KEY,
  worker_id UUID REFERENCES digital_workers(id),
  metric_date DATE NOT NULL,
  total_executions INTEGER,
  successful_executions INTEGER,
  failed_executions INTEGER,
  avg_execution_time_ms INTEGER,
  total_steps_executed INTEGER,
  UNIQUE(worker_id, metric_date)
);

-- Real-time view for current stats
CREATE VIEW worker_performance_summary AS
SELECT
  dw.id, dw.name, dw.type, dw.status,
  COUNT(e.id) AS total_executions_30d,
  COUNT(CASE WHEN e.status = 'completed' THEN 1 END) AS successful_30d,
  ROUND(successful::numeric / total * 100, 2) AS success_rate_30d,
  AVG(duration_ms) AS avg_execution_time_ms
FROM digital_workers dw
LEFT JOIN executions e ON e.worker_id = dw.id
WHERE e.created_at >= NOW() - INTERVAL '30 days'
GROUP BY dw.id;
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/analytics/workers` | All workers with metrics |
| GET | `/api/analytics/workers/[id]` | Single worker detail |
| GET | `/api/analytics/workers/[id]/trends` | Time-series data (daily) |
| GET | `/api/analytics/teams` | Team-level analytics |
| POST | `/api/analytics/export` | Export reports (CSV/JSON) |

### Dashboard Components

1. **AnalyticsDashboard** - Main page with KPIs + charts
2. **MetricCard** - Reusable KPI display
3. **TrendLineChart** - Executions/success rate over time (daily granularity)
4. **WorkerComparisonChart** - Bar chart comparing workers
5. **WorkloadDistributionPie** - Task distribution
6. **WorkerDetailPanel** - Individual worker deep-dive
7. **DateRangePicker** + **FilterBar** - Query controls

### Chart Library: Recharts
- Lightweight (~45KB)
- React-native components
- D3-based calculations
- Tailwind CSS compatible

### Hooks

```typescript
useWorkerAnalytics()    // List workers with metrics
useWorkerDetail(id)     // Single worker analytics
useWorkerTrends(id)     // Time-series data
useAnalyticsExport()    // Generate reports
```

---

## File Structure

```
/src
  /app/api
    /testing
      /test-cases/route.ts
      /test-cases/[id]/route.ts
      /run/route.ts
      /run/[id]/route.ts
      /runs/route.ts
    /analytics
      /workers/route.ts
      /workers/[workerId]/route.ts
      /workers/[workerId]/trends/route.ts
      /teams/route.ts
      /export/route.ts

  /app/(dashboard)
    /workflows/[id]/testing/page.tsx    # Workflow test page
    /analytics/page.tsx                  # Main analytics dashboard
    /analytics/workers/[id]/page.tsx     # Worker detail view

  /components
    /testing
      TestRunnerPanel.tsx
      MockDataEditor.tsx
      AssertionBuilder.tsx
      TestResultsViewer.tsx
      TestCaseManager.tsx
    /analytics
      AnalyticsDashboard.tsx
      MetricCard.tsx
      TrendLineChart.tsx
      WorkerComparisonChart.tsx
      WorkloadDistributionPie.tsx
      WorkerDetailPanel.tsx

  /hooks
    useTestCases.ts
    useTestRunner.ts
    useTestHistory.ts
    useWorkerAnalytics.ts
    useWorkerDetail.ts
    useAnalyticsExport.ts

  /lib/testing
    execution-service.ts
    assertion-engine.ts

  /types
    testing.ts
    analytics.ts
```

---

## Implementation Order (Parallel Development)

### Phase 1: Database Foundation (Day 1-2)
- [ ] Create migrations for all new tables (testing + analytics)
- [ ] Create SQL views for analytics
- [ ] Add RLS policies
- [ ] Install Recharts dependency

### Phase 2: Backend APIs (Day 3-5) - PARALLEL
**Testing Track:**
- [ ] TestExecutionService (executes via n8n)
- [ ] AssertionEngine
- [ ] Test case CRUD API routes
- [ ] Test run API routes

**Analytics Track:**
- [ ] Worker analytics API endpoints
- [ ] Daily aggregation function
- [ ] Scheduled job setup (Edge Function)
- [ ] Export endpoint

### Phase 3: Frontend Components (Day 6-10) - PARALLEL
**Testing Track:**
- [ ] useTestCases, useTestRunner hooks
- [ ] MockDataEditor component
- [ ] TestRunnerPanel component
- [ ] TestResultsViewer component

**Analytics Track:**
- [ ] useWorkerAnalytics hooks
- [ ] MetricCard, DateRangePicker
- [ ] TrendLineChart (daily granularity)
- [ ] WorkerComparisonChart
- [ ] Dashboard page

### Phase 4: Integration & Polish (Day 11-12)
- [ ] Worker detail analytics page
- [ ] Test case manager
- [ ] End-to-end testing
- [ ] Real-time updates

---

## Verification

### Testing Feature
1. Create a test case for an existing workflow
2. Run the test with mock data
3. Verify step-by-step results are captured
4. Verify assertions pass/fail correctly
5. Save and re-run the test case

### Analytics Feature
1. Execute several workflows with different workers
2. View analytics dashboard - verify metrics update
3. Check individual worker detail view
4. Test date range filtering
5. Export report and verify data

---

## Dependencies to Install

```bash
npm install recharts
```

---

## Key Design Decisions

1. **Test Execution via n8n** - Tests run through actual n8n workflows for realistic results
2. **Daily Analytics Granularity** - Good balance of insight vs storage/performance
3. **Parallel Development** - Both features built simultaneously
4. **Hybrid Analytics** - Real-time for current state, pre-computed for historical trends

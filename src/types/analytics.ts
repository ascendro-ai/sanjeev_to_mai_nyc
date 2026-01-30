// ============================================================================
// ANALYTICS TYPES
// ============================================================================

/**
 * Daily metrics for a worker (pre-aggregated)
 */
export interface WorkerDailyMetrics {
  id: string
  workerId: string
  metricDate: string // ISO date string (YYYY-MM-DD)
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  avgExecutionTimeMs: number
  totalStepsExecuted: number
  totalReviewsRequested: number
  reviewsApproved: number
  reviewsRejected: number
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Real-time performance summary for a worker (last 30 days)
 */
export interface WorkerPerformanceSummary {
  id: string
  name: string
  type: 'ai' | 'human'
  status: string
  organizationId: string
  totalExecutions30d: number
  successful30d: number
  failed30d: number
  successRate30d: number
  avgExecutionTimeMs: number
  lastExecutionAt?: Date
}

/**
 * Extended worker analytics with additional computed metrics
 */
export interface WorkerAnalytics extends WorkerPerformanceSummary {
  // Trend indicators
  executionTrend: 'up' | 'down' | 'stable'
  successRateTrend: 'up' | 'down' | 'stable'

  // Comparison to team average
  vsTeamAvgSuccessRate: number // Percentage points above/below team average
  vsTeamAvgExecutions: number // Percentage above/below team average

  // Review metrics
  reviewsRequested30d: number
  reviewApprovalRate: number

  // Workflow assignments
  assignedWorkflowCount: number
  activeWorkflowCount: number
}

/**
 * Time-series data point for trend charts
 */
export interface MetricDataPoint {
  date: string // ISO date string (YYYY-MM-DD)
  value: number
}

/**
 * Time-series data for worker trends
 */
export interface WorkerTrendData {
  workerId: string
  workerName: string
  dateRange: {
    start: string
    end: string
  }
  executions: MetricDataPoint[]
  successRate: MetricDataPoint[]
  avgDuration: MetricDataPoint[]
  stepsExecuted: MetricDataPoint[]
  reviewsRequested: MetricDataPoint[]
}

/**
 * Team-level analytics summary
 */
export interface TeamAnalytics {
  teamId?: string
  teamName?: string
  organizationId: string

  // Aggregate metrics
  totalWorkers: number
  activeWorkers: number
  totalExecutions30d: number
  successfulExecutions30d: number
  failedExecutions30d: number
  overallSuccessRate: number
  avgExecutionTimeMs: number

  // Review metrics
  totalReviewsRequested30d: number
  totalReviewsApproved30d: number
  totalReviewsRejected30d: number
  reviewApprovalRate: number

  // Top performers
  topPerformers: Array<{
    workerId: string
    workerName: string
    successRate: number
    executions: number
  }>

  // Workers needing attention
  workersNeedingAttention: Array<{
    workerId: string
    workerName: string
    issue: 'low_success_rate' | 'high_review_rejection' | 'inactive' | 'error_state'
    metric?: number
  }>
}

/**
 * Comparison data between workers
 */
export interface WorkerComparison {
  workers: Array<{
    id: string
    name: string
    type: 'ai' | 'human'
    executions: number
    successRate: number
    avgDurationMs: number
    reviewApprovalRate: number
  }>
  metrics: ('executions' | 'successRate' | 'avgDurationMs' | 'reviewApprovalRate')[]
}

/**
 * Workload distribution data
 */
export interface WorkloadDistribution {
  total: number
  byWorker: Array<{
    workerId: string
    workerName: string
    workerType: 'ai' | 'human'
    executions: number
    percentage: number
  }>
  byWorkflow: Array<{
    workflowId: string
    workflowName: string
    executions: number
    percentage: number
  }>
}

/**
 * Date range options for analytics queries
 */
export type DateRangePreset =
  | '7d'
  | '14d'
  | '30d'
  | '60d'
  | '90d'
  | 'custom'

/**
 * Filter options for analytics queries
 */
export interface AnalyticsFilters {
  dateRange: DateRangePreset
  startDate?: string
  endDate?: string
  workerIds?: string[]
  workflowIds?: string[]
  workerType?: 'ai' | 'human' | 'all'
  status?: ('active' | 'inactive' | 'paused' | 'error')[]
}

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'json' | 'xlsx'

/**
 * Export request configuration
 */
export interface AnalyticsExportRequest {
  type: 'worker_metrics' | 'team_analytics' | 'trend_data' | 'comparison'
  filters: AnalyticsFilters
  format: ExportFormat
  includeCharts?: boolean
  workerIds?: string[]
}

/**
 * Export response
 */
export interface AnalyticsExportResponse {
  filename: string
  mimeType: string
  data: string // Base64 encoded for binary formats, raw for JSON/CSV
  generatedAt: Date
}

/**
 * KPI card data structure
 */
export interface KPIMetric {
  label: string
  value: number
  unit?: string
  format?: 'number' | 'percentage' | 'duration' | 'currency'
  trend?: {
    direction: 'up' | 'down' | 'stable'
    value: number
    period: string
  }
  target?: number
  status?: 'good' | 'warning' | 'critical'
}

/**
 * Dashboard widget configuration
 */
export interface AnalyticsWidget {
  id: string
  type: 'kpi' | 'line_chart' | 'bar_chart' | 'pie_chart' | 'table' | 'comparison'
  title: string
  size: 'small' | 'medium' | 'large' | 'full'
  dataSource: string
  filters?: Partial<AnalyticsFilters>
  options?: Record<string, unknown>
}

/**
 * Dashboard layout configuration
 */
export interface AnalyticsDashboard {
  id: string
  name: string
  widgets: AnalyticsWidget[]
  defaultFilters: AnalyticsFilters
  refreshInterval?: number // in seconds
}

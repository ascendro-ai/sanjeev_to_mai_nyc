-- Phase 7.1: Database Transaction RPC Functions
-- Purpose: Ensure atomic operations for execution completion and review processing

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

-- Unique constraint for pending reviews (prevents duplicate review requests)
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_review
ON review_requests (execution_id, step_id)
WHERE status = 'pending';

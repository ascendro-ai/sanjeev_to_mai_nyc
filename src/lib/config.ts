/**
 * Centralized configuration for magic numbers and app settings
 */

export const CONFIG = {
  // Polling intervals (milliseconds)
  POLLING: {
    GMAIL_STATUS_MS: 2000,
    LOG_REFRESH_MS: 500,
    REVIEW_STATUS_MS: 3000,
  },

  // Debounce timings (milliseconds)
  DEBOUNCE: {
    WORKFLOW_EXTRACTION_MS: 500,
    SEARCH_INPUT_MS: 300,
  },

  // Limits
  LIMITS: {
    MAX_LOG_ENTRIES: 1000,
    MAX_CONSULTANT_QUESTIONS: 5,
    MAX_RETRIES: 3,
  },

  // Timeouts (milliseconds)
  TIMEOUTS: {
    API_REQUEST_MS: 30000,
    GEMINI_REQUEST_MS: 60000,
    N8N_CALLBACK_MS: 10000,
  },

  // UI
  UI: {
    TOAST_DURATION_MS: 5000,
    ANIMATION_DURATION_MS: 300,
  },
} as const

export default CONFIG

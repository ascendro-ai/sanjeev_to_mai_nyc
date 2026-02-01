/**
 * @fileoverview Centralized configuration for application constants.
 *
 * This module defines all "magic numbers" and timing constants used throughout
 * the application. Centralizing these values:
 * - Makes tuning easier (one place to change)
 * - Documents the purpose of each value
 * - Prevents inconsistent values across files
 * - Enables environment-based overrides if needed
 *
 * @module lib/config
 *
 * @example
 * ```typescript
 * import { CONFIG } from '@/lib/config';
 *
 * // Use in polling
 * setInterval(checkStatus, CONFIG.POLLING.REVIEW_STATUS_MS);
 *
 * // Use in debouncing
 * const debouncedSearch = debounce(search, CONFIG.DEBOUNCE.SEARCH_INPUT_MS);
 *
 * // Use in timeouts
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), CONFIG.TIMEOUTS.API_REQUEST_MS);
 * ```
 */

/**
 * Application configuration constants.
 *
 * All values are in milliseconds unless otherwise noted.
 * The `as const` assertion ensures literal types for better type inference.
 */
export const CONFIG = {
  // ---------------------------------------------------------------------------
  // POLLING INTERVALS
  // ---------------------------------------------------------------------------

  /**
   * Polling intervals for various background checks.
   * Lower values = more responsive but more server load.
   */
  POLLING: {
    /**
     * How often to check Gmail OAuth status during authentication flow.
     * @default 2000 (2 seconds)
     */
    GMAIL_STATUS_MS: 2000,

    /**
     * How often to refresh activity logs in the Control Room.
     * @default 500 (0.5 seconds) - Fast for live feel
     */
    LOG_REFRESH_MS: 500,

    /**
     * How often to check for review request status changes.
     * @default 3000 (3 seconds)
     */
    REVIEW_STATUS_MS: 3000,
  },

  // ---------------------------------------------------------------------------
  // DEBOUNCE TIMINGS
  // ---------------------------------------------------------------------------

  /**
   * Debounce delays for user input handling.
   * Prevents excessive API calls while user is typing.
   */
  DEBOUNCE: {
    /**
     * Delay before triggering Gemini workflow extraction.
     * Allows user to finish typing before making expensive AI call.
     * @default 500 (0.5 seconds)
     */
    WORKFLOW_EXTRACTION_MS: 500,

    /**
     * Delay before triggering search API calls.
     * Standard search-as-you-type debounce.
     * @default 300 (0.3 seconds)
     */
    SEARCH_INPUT_MS: 300,
  },

  // ---------------------------------------------------------------------------
  // LIMITS
  // ---------------------------------------------------------------------------

  /**
   * Maximum values and limits to prevent resource exhaustion.
   */
  LIMITS: {
    /**
     * Maximum activity log entries to display in Control Room.
     * Older entries are not shown but remain in database.
     * @default 1000
     */
    MAX_LOG_ENTRIES: 1000,

    /**
     * Maximum questions Gemini will ask during workflow consultation.
     * Prevents infinite back-and-forth with AI.
     * @default 5
     */
    MAX_CONSULTANT_QUESTIONS: 5,

    /**
     * Maximum retry attempts for failed operations.
     * Used by n8n client for transient errors.
     * @default 3
     */
    MAX_RETRIES: 3,
  },

  // ---------------------------------------------------------------------------
  // TIMEOUTS
  // ---------------------------------------------------------------------------

  /**
   * Request timeouts for various operations.
   * Prevents hanging requests from blocking resources.
   */
  TIMEOUTS: {
    /**
     * Standard API request timeout.
     * Used for most internal and Supabase API calls.
     * @default 30000 (30 seconds)
     */
    API_REQUEST_MS: 30000,

    /**
     * Gemini AI request timeout.
     * Longer because AI responses can take time, especially for complex workflows.
     * @default 60000 (60 seconds)
     */
    GEMINI_REQUEST_MS: 60000,

    /**
     * n8n webhook callback timeout.
     * Time to wait for n8n to respond to resume/callback requests.
     * @default 10000 (10 seconds)
     * @note May need to increase for complex workflows
     */
    N8N_CALLBACK_MS: 10000,
  },

  // ---------------------------------------------------------------------------
  // UI SETTINGS
  // ---------------------------------------------------------------------------

  /**
   * UI-related timing constants.
   */
  UI: {
    /**
     * How long toast notifications remain visible.
     * @default 5000 (5 seconds)
     */
    TOAST_DURATION_MS: 5000,

    /**
     * Duration of CSS transitions/animations.
     * Used for consistent animation timing.
     * @default 300 (0.3 seconds)
     */
    ANIMATION_DURATION_MS: 300,
  },
} as const

/**
 * Type for the CONFIG object.
 * Useful for passing CONFIG as a parameter.
 */
export type AppConfig = typeof CONFIG

/**
 * Default export for convenient importing.
 *
 * @example
 * ```typescript
 * import CONFIG from '@/lib/config';
 * ```
 */
export default CONFIG

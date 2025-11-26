/**
 * Safely extract error message from various error types
 * Prevents "body stream already read" errors that occur when accessing Response objects
 * 
 * @param {Error|Object|string} error - The error object
 * @returns {string} Safe error message
 */
export function getSafeErrorMessage(error) {
  // If it's a string, return as-is
  if (typeof error === 'string') {
    return error
  }

  // If no error, return default
  if (!error) {
    return 'An unknown error occurred'
  }

  // Try to get message property safely (avoid reading Response body)
  try {
    // Common error message properties
    if (error.message && typeof error.message === 'string') {
      return error.message
    }

    // Supabase error structure
    if (error.error && typeof error.error === 'string') {
      return error.error
    }

    // PostgreSQL error details
    if (error.details && typeof error.details === 'string') {
      return error.details
    }

    // Fallback: convert to string but catch any issues
    const stringified = String(error)
    if (stringified && stringified !== '[object Object]') {
      return stringified
    }

    // Last resort
    return 'An unknown error occurred'
  } catch (err) {
    // If we can't safely access the error, return generic message
    console.error('[safeErrorHandler] Error while processing error:', err)
    return 'An unknown error occurred. Please try again.'
  }
}

/**
 * Log error safely without triggering "body stream already read"
 * 
 * @param {string} context - Context/label for the error
 * @param {Error|Object} error - The error object
 */
export function logErrorSafely(context, error) {
  try {
    const message = getSafeErrorMessage(error)
    console.error(`[${context}]`, message)
  } catch (err) {
    // Silent fail - don't let error logging break the app
    console.debug(`[${context}] Failed to log error safely`, err)
  }
}

/**
 * Handle Supabase-specific errors
 * 
 * @param {Object} supabaseError - Error from Supabase
 * @returns {Object} Normalized error { message, code, status }
 */
export function handleSupabaseError(supabaseError) {
  if (!supabaseError) {
    return { message: 'Unknown error', code: null, status: null }
  }

  return {
    message: getSafeErrorMessage(supabaseError),
    code: supabaseError.code || supabaseError.error_code || null,
    status: supabaseError.status || supabaseError.statusCode || null
  }
}

/**
 * Catch and safely display errors in UI
 * 
 * @param {Error|Object} error - The error
 * @param {string} defaultMessage - Fallback message if error can't be extracted
 * @returns {string} Safe message for display
 */
export function getDisplayErrorMessage(error, defaultMessage = 'An error occurred') {
  try {
    const message = getSafeErrorMessage(error)
    return message || defaultMessage
  } catch (err) {
    return defaultMessage
  }
}

/**
 * Format a date with timezone information
 * @param {Date|string} date - The date to format
 * @param {Object} options - Formatting options
 * @param {string} options.timeZone - Optional timezone (defaults to user's local timezone)
 * @param {string} options.format - Format type: 'full', 'date', 'time', or custom options object
 * @returns {string} Formatted date with timezone
 */
export const formatDateWithTimezone = (date, options = {}) => {
  const dateObj = date instanceof Date ? date : new Date(date)
  
  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Invalid date'
  }

  const {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    format = 'full'
  } = options

  let formatOptions = {}

  if (format === 'full') {
    formatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone,
      timeZoneName: 'short'
    }
  } else if (format === 'date') {
    formatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone
    }
  } else if (format === 'time') {
    formatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone,
      timeZoneName: 'short'
    }
  } else if (typeof format === 'object') {
    formatOptions = { ...format, timeZone }
  }

  return new Intl.DateTimeFormat('en-US', formatOptions).format(dateObj)
}

/**
 * Get the user's timezone abbreviation
 * @returns {string} Timezone abbreviation (e.g., 'PST', 'EST', 'UTC')
 */
export const getUserTimezone = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timeZoneName: 'short'
  })
  
  const parts = formatter.formatToParts(new Date())
  const tzPart = parts.find(part => part.type === 'timeZoneName')
  return tzPart ? tzPart.value : 'UTC'
}

/**
 * Format date for Last Updated displays (shorter format with timezone)
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date with timezone
 */
export const formatLastUpdated = (date) => {
  return formatDateWithTimezone(date, {
    format: {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  })
}

/**
 * Format date for display with full timestamp and timezone
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date with timezone
 */
export const formatFullDateTime = (date) => {
  return formatDateWithTimezone(date, { format: 'full' })
}

/**
 * Format date only without time
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date
 */
export const formatDateOnly = (date) => {
  return formatDateWithTimezone(date, { format: 'date' })
}

/**
 * Format time only with timezone
 * @param {Date|string} date - The date/time to format
 * @returns {string} Formatted time with timezone
 */
export const formatTimeOnly = (date) => {
  return formatDateWithTimezone(date, { format: 'time' })
}

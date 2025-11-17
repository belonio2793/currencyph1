/**
 * Format field values for display
 * Converts underscore-separated and lowercase values to Title Case
 * Examples: "one_time" → "One Time", "fixed" → "Fixed", "intermediate" → "Intermediate"
 */
export const formatFieldValue = (value) => {
  if (!value) return value

  return String(value)
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

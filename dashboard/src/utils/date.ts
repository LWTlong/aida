/**
 * Safe date formatting utilities
 */

function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime())
}

/**
 * Format date as "MM-DD"
 * Returns empty string if invalid
 */
export function formatShortDate(ts: string | undefined | null): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    if (!isValidDate(d)) return ''
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

/**
 * Format date as "YYYY-MM-DD"
 * Returns empty string if invalid
 */
export function formatDate(ts: string | undefined | null): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    if (!isValidDate(d)) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

/**
 * Format date as "MM-DD HH:mm"
 * Returns empty string if invalid
 */
export function formatDateTime(ts: string | undefined | null): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    if (!isValidDate(d)) return ''
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

/**
 * Format date as "MM-DD HH:mm:ss"
 * Returns empty string if invalid
 */
export function formatDateTimeSeconds(ts: string | undefined | null): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    if (!isValidDate(d)) return ''
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

/**
 * Format date using browser locale
 * Returns empty string if invalid
 */
export function formatLocalDate(ts: string | undefined | null): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    if (!isValidDate(d)) return ''
    return d.toLocaleDateString()
  } catch {
    return ''
  }
}

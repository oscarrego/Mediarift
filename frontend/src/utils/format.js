/**
 * utils/format.js
 * Pure formatting helpers – no side-effects.
 */

/**
 * Format bytes into a human-readable string.
 * @param {number|null} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return 'Unknown'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let value = bytes
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * Format a view count into a compact human-readable string.
 * @param {number|null} views
 * @returns {string}
 */
export function formatViews(views) {
  if (!views && views !== 0) return 'N/A'
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B views`
  if (views >= 1_000_000)     return `${(views / 1_000_000).toFixed(1)}M views`
  if (views >= 1_000)         return `${(views / 1_000).toFixed(1)}K views`
  return `${views} views`
}

/**
 * Format an ISO-like date string (YYYY-MM-DD) into "Month DD, YYYY".
 * @param {string|null} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr || dateStr === 'Unknown') return 'Unknown'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return dateStr
  }
}

/**
 * Truncate a string to maxLen characters, appending ellipsis if needed.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 80) {
  if (!str) return ''
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str
}

/**
 * Return a platform display name with proper capitalisation.
 * @param {string} platform
 * @returns {string}
 */
export function platformLabel(platform) {
  const map = {
    youtube:   'YouTube',
    instagram: 'Instagram',
    tiktok:    'TikTok',
    twitter:   'Twitter / X',
    facebook:  'Facebook',
    vimeo:     'Vimeo',
    unknown:   'Unknown',
  }
  return map[platform?.toLowerCase()] ?? platform ?? 'Unknown'
}

/**
 * Map a platform key to its brand colour.
 * @param {string} platform
 * @returns {string} CSS hex colour
 */
export function platformColor(platform) {
  const map = {
    youtube:   '#ff0000',
    instagram: '#e1306c',
    tiktok:    '#010101',
    twitter:   '#1da1f2',
    facebook:  '#1877f2',
    vimeo:     '#1ab7ea',
    unknown:   '#6b7280',
  }
  return map[platform?.toLowerCase()] ?? '#6b7280'
}

/**
 * Build a safe filename by replacing illegal chars.
 * @param {string} title
 * @param {string} ext  without leading dot
 * @returns {string}
 */
export function buildFilename(title, ext) {
  const safe = (title || 'download')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200)
  return `${safe}.${ext}`
}

/**
 * Format relative time ("2 hours ago", "just now").
 * @param {string|number|Date} dateInput
 * @returns {string}
 */
export function relativeTime(dateInput) {
  try {
    const now = Date.now()
    const then = new Date(dateInput).getTime()
    const diff = Math.floor((now - then) / 1000) // seconds

    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return formatDate(new Date(then).toISOString().slice(0, 10))
  } catch {
    return ''
  }
}

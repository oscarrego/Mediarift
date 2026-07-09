/**
 * utils/validators.js
 * URL and input validation helpers.
 * Accepts any http/https URL — yt-dlp handles platform detection server-side.
 */

/**
 * Returns true if the URL is syntactically valid (starts with http/https).
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (trimmed.length === 0 || trimmed.length > 4096) return false
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
}

/**
 * Returns the platform name for a URL, or 'unknown'.
 */
export function detectPlatform(url) {
  if (!url) return 'unknown'
  const u = url.trim().toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('instagram.com'))                          return 'instagram'
  if (u.includes('tiktok.com'))                             return 'tiktok'
  if (u.includes('twitter.com') || u.includes('x.com'))    return 'twitter'
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook'
  if (u.includes('vimeo.com'))                              return 'vimeo'
  if (u.includes('pinterest.com') || u.includes('pin.it')) return 'pinterest'
  if (u.includes('reddit.com') || u.includes('redd.it'))   return 'reddit'
  if (u.includes('dailymotion.com'))                        return 'dailymotion'
  if (u.includes('twitch.tv'))                              return 'twitch'
  return 'unknown'
}

/**
 * Validate URL and return { valid: bool, error: string|null, platform: string }.
 * Accepts any http/https URL — backend (yt-dlp) handles platform support.
 */
export function validateUrl(url) {
  if (!url || !url.trim()) {
    return { valid: false, error: 'Please enter a URL.', platform: 'unknown' }
  }
  if (!isValidUrl(url)) {
    return { valid: false, error: 'URL must start with http:// or https://', platform: 'unknown' }
  }
  return { valid: true, error: null, platform: detectPlatform(url) }
}

/**
 * @deprecated kept for backward compat — always returns true for valid URLs
 */
export function isSupportedUrl(url) {
  return isValidUrl(url)
}

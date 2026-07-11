/**
 * utils/storage.js
 * Typed localStorage wrapper with JSON serialization and safe fallbacks.
 */

const PREFIX = 'mediarift_'

export function storageGet(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return defaultValue
    return JSON.parse(raw)
  } catch {
    return defaultValue
  }
}

export function storageSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Quota exceeded or private browsing – fail silently
  }
}

export function storageRemove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch { /* noop */ }
}

export function storageClear() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  } catch { /* noop */ }
}

// ────────────────────────────────────────────
// Typed preference helpers
// ────────────────────────────────────────────

/** 'light' | 'dark' | 'system' */
export const getTheme = () => storageGet('theme', 'system')
export const setTheme = (v) => storageSet('theme', v)

/** '1080p' | 'best' | etc. */
export const getQuality = () => storageGet('quality', 'best')
export const setQuality = (v) => storageSet('quality', v)

/** 'video' | 'audio' */
export const getDownloadType = () => storageGet('downloadType', 'video')
export const setDownloadType = (v) => storageSet('downloadType', v)

/** Last URL typed */
export const getLastUrl = () => storageGet('lastUrl', '')
export const setLastUrl = (v) => storageSet('lastUrl', v)

/** Download history array */
export const getHistory = () => storageGet('history', [])
export const setHistory = (v) => storageSet('history', v)

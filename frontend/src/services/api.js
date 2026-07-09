/**
 * services/api.js
 * All backend API calls for MediaRift.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function _request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE_URL}${path}`, opts)
  if (!res.ok) {
    let data = {}
    try { data = await res.json() } catch {}
    throw { message: data.error || `Error ${res.status}`, code: data.code || 'SERVER_ERROR', status: res.status }
  }
  return res.json()
}

// ── Media info ───────────────────────────────────────────────────────────────

export async function fetchMediaInfo(url) {
  const res = await _request('POST', '/api/info', { url })
  return res.data
}

// ── Downloads ────────────────────────────────────────────────────────────────

/**
 * Start a new download. Returns { id } immediately; progress is polled.
 */
export async function startDownload({ url, format_id, download_type, quality_label, thumbnail_ext }) {
  const res = await _request('POST', '/api/download', {
    url, format_id, download_type, quality_label, thumbnail_ext,
  })
  return res
}

export async function listDownloads() {
  const res = await _request('GET', '/api/downloads')
  return res.data
}

export async function getDownload(id) {
  const res = await _request('GET', `/api/downloads/${id}`)
  return res.data
}

export async function pauseDownload(id) {
  return _request('POST', `/api/downloads/${id}/pause`)
}

export async function resumeDownload(id) {
  return _request('POST', `/api/downloads/${id}/resume`)
}

export async function stopDownload(id) {
  return _request('POST', `/api/downloads/${id}/stop`)
}

export async function deleteDownload(id) {
  return _request('DELETE', `/api/downloads/${id}`)
}

/** Trigger browser save-dialog for a completed download. */
export function serveFile(id, filename) {
  const a = document.createElement('a')
  a.href = `${BASE_URL}/api/downloads/${id}/file`
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Open the folder containing the completed download in the OS file manager. */
export async function openFolder(id) {
  return _request('POST', `/api/downloads/${id}/open-folder`)
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings() {
  const res = await _request('GET', '/api/settings')
  return res.data
}

export async function updateSettings(patch) {
  const res = await _request('POST', '/api/settings', patch)
  return res.data
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth() {
  const res = await _request('GET', '/api/health')
  return res
}

// ── Media Fetcher ─────────────────────────────────────────────────────────────

/**
 * Scrape a webpage and return all media assets found.
 * Returns array of: { url, type, ext, filename, width, height, size_bytes }
 */
export async function fetchPageMedia(url) {
  const res = await _request('POST', '/api/media-fetch', { url })
  if (res.success && (!res.data || res.data.length === 0) && res.message) {
    throw { message: res.message, code: 'NO_MEDIA' }
  }
  return res.data
}

/**
 * Convert an uploaded file to the target format.
 * Returns the converted file as a Blob.
 */
export async function convertFile(file, toFormat, signal) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('toFormat', toFormat)

  const res = await fetch(`${BASE_URL}/api/convert`, {
    method: 'POST',
    body: formData,
    signal,
  })

  if (!res.ok) {
    let data = {}
    try { data = await res.json() } catch {}
    throw new Error(data.error || `Conversion error: ${res.status}`)
  }

  return res.blob()
}



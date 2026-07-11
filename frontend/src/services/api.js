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


export async function fetchMediaInfo(url) {
  const res = await _request('POST', '/api/info', { url })
  return res.data
}


/**
 * Start a new download. Returns { id } immediately; progress is polled.
 */
export async function startDownload({ url, format_id, download_type, quality_label, thumbnail_ext, subtitles_options }) {
  const res = await _request('POST', '/api/download', {
    url, format_id, download_type, quality_label, thumbnail_ext, subtitles_options,
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

export async function restartDownload(id) {
  return _request('POST', `/api/downloads/${id}/restart`)
}

export async function stopDownload(id) {
  return _request('POST', `/api/downloads/${id}/stop`)
}

export async function deleteDownload(id) {
  return _request('DELETE', `/api/downloads/${id}`)
}

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


export async function getSettings() {
  const res = await _request('GET', '/api/settings')
  return res.data
}

export async function updateSettings(patch) {
  const res = await _request('POST', '/api/settings', patch)
  return res.data
}


export async function checkHealth() {
  const res = await _request('GET', '/api/health')
  return res
}


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
export async function convertFile(file, toFormat, taskId, signal) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('toFormat', toFormat)
  if (taskId) formData.append('taskId', taskId)

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

/**
 * Compress an uploaded media file (image/video).
 * Returns the compressed file as a Blob.
 */
export async function compressFile(file, level, taskId, signal) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('level', level)
  if (taskId) formData.append('taskId', taskId)

  const res = await fetch(`${BASE_URL}/api/compress`, {
    method: 'POST',
    body: formData,
    signal,
  })

  if (!res.ok) {
    let data = {}
    try { data = await res.json() } catch {}
    throw new Error(data.error || `Compression error: ${res.status}`)
  }

  return res.blob()
}

/** Get real-time conversion progress percentage. */
export async function fetchConvertProgress(taskId) {
  const res = await fetch(`${BASE_URL}/api/convert/progress/${taskId}`)
  if (!res.ok) return 0
  const data = await res.json()
  return data.progress ?? 0
}

/** Get real-time compression progress percentage. */
export async function fetchCompressProgress(taskId) {
  const res = await fetch(`${BASE_URL}/api/compress/progress/${taskId}`)
  if (!res.ok) return 0
  const data = await res.json()
  return data.progress ?? 0
}

export async function fetchConvertProgressData(taskId) {
  const res = await fetch(`${BASE_URL}/api/convert/progress/${taskId}`)
  if (!res.ok) return { progress: 0 }
  return res.json()
}

export async function fetchCompressProgressData(taskId) {
  const res = await fetch(`${BASE_URL}/api/compress/progress/${taskId}`)
  if (!res.ok) return { progress: 0 }
  return res.json()
}

export async function pauseConvert(taskId) {
  return _request('POST', `/api/convert/${taskId}/pause`)
}

export async function resumeConvert(taskId) {
  return _request('POST', `/api/convert/${taskId}/resume`)
}

export async function cancelConvert(taskId) {
  return _request('POST', `/api/convert/${taskId}/cancel`)
}

export async function pauseCompress(taskId) {
  return _request('POST', `/api/compress/${taskId}/pause`)
}

export async function resumeCompress(taskId) {
  return _request('POST', `/api/compress/${taskId}/resume`)
}

export async function cancelCompress(taskId) {
  return _request('POST', `/api/compress/${taskId}/cancel`)
}

export async function detectClipboard(lastUrl) {
  return _request('POST', '/api/clipboard/detect', { last_url: lastUrl })
}





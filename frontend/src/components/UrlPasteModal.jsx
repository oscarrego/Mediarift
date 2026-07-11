/**
 * components/UrlPasteModal.jsx
 * New Download modal — FDM-style with Save-to location, format/type selector.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './UrlPasteModal.module.css'
import { fetchMediaInfo } from '../services/api'
import CustomSelect from './CustomSelect'

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const PasteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
)

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

const PLATFORMS = [
  { label: 'YouTube',   color: '#ff0000' },
  { label: 'Instagram', color: '#c13584' },
  { label: 'TikTok',    color: '#69c9d0' },
  { label: 'Facebook',  color: '#1877f2' },
  { label: 'Twitter/X', color: '#1da1f2' },
  { label: 'Vimeo',     color: '#1ab7ea' },
  { label: '& more',    color: '#888' },
]

export default function UrlPasteModal({ onClose, onStartDownload, defaultSaveTo, initialUrl }) {
  const [url, setUrl]                 = useState(initialUrl || '')
  const [saveTo, setSaveTo]           = useState(defaultSaveTo || '')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [media, setMedia]             = useState(null)
  const [downloadType, setDownloadType] = useState('video')
  const [selectedFormat, setSelectedFormat] = useState(null)
  const inputRef   = useRef(null)
  const folderRef  = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    if (!initialUrl) {
      navigator.clipboard?.readText?.().then(text => {
        if (text?.startsWith('http')) setUrl(text.trim())
      }).catch(() => {})
    }
  }, [initialUrl])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text.trim())
    } catch {}
  }

  const handleBrowse = () => {
    if (window.showDirectoryPicker) {
      window.showDirectoryPicker().then(h => setSaveTo(h.name)).catch(() => {})
    } else {
      folderRef.current?.click()
    }
  }

  const handleFetch = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) { setError('Please enter a URL.'); return }
    if (!trimmed.startsWith('http')) { setError('URL must start with http:// or https://'); return }
    setError('')
    setLoading(true)
    setMedia(null)
    try {
      const info = await fetchMediaInfo(trimmed)
      setMedia(info)
      setSelectedFormat(info.formats?.[0]?.format_id || 'best')
    } catch (err) {
      setError(err.message || 'Failed to fetch media info.')
    } finally {
      setLoading(false)
    }
  }, [url])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !media) handleFetch()
  }

  const handleDownload = () => {
    if (!media) return
    onStartDownload({
      url: url.trim(),
      format_id: downloadType === 'audio' ? 'bestaudio' : (selectedFormat || 'best'),
      download_type: downloadType,
      quality_label: downloadType === 'audio' ? 'Audio Only'
        : (media.formats?.find(f => f.format_id === selectedFormat)?.label || 'best'),
      save_to: saveTo,
    })
    onClose()
  }

  return (
    <div className={`${styles.backdrop} mr-modal-backdrop`} role="dialog" aria-modal="true" aria-label="New Download">
      <div className={`${styles.modal} mr-modal-box`}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>New download</span>
          <button className={styles.closeBtn} onClick={onClose} id="url-modal-close" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body}>
          {/* Save to row */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="url-save-to">Save to</label>
            <div className={styles.saveToRow}>
              <input
                id="url-save-to"
                className={styles.saveToInput}
                type="text"
                placeholder="C:\Users\...\Downloads"
                value={saveTo}
                onChange={e => setSaveTo(e.target.value)}
              />
              <button
                className={styles.browseBtn}
                onClick={handleBrowse}
                title="Browse for folder"
                id="url-folder-browse"
              >
                <FolderIcon />
              </button>
              {/* Hidden fallback */}
              <input
                ref={folderRef}
                type="file"
                style={{ display: 'none' }}
                webkitdirectory=""
                onChange={e => {
                  const p = e.target.files?.[0]?.webkitRelativePath?.split('/')[0]
                  if (p) setSaveTo(p)
                }}
              />
            </div>
          </div>

          {/* URL input */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="url-modal-input">Paste URL</label>
            <div className={`${styles.urlRow} ${error ? styles.urlRowError : ''}`}>
              <input
                ref={inputRef}
                className={styles.urlInput}
                type="url"
                placeholder="https://youtube.com/watch?v=…"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(''); setMedia(null) }}
                onKeyDown={handleKeyDown}
                id="url-modal-input"
                autoComplete="off"
              />
              <button
                className={styles.pasteBtn}
                onClick={handlePaste}
                title="Paste from clipboard"
                id="url-modal-paste"
              >
                <PasteIcon />
              </button>
            </div>
            {error && <p className={styles.errorMsg}>{error}</p>}
          </div>

          {/* Supported platforms */}
          {!media && !loading && (
            <div className={styles.platforms}>
              {PLATFORMS.map(p => (
                <span key={p.label} className={styles.chip}>
                  <span className={styles.dot} style={{ background: p.color }} />
                  {p.label}
                </span>
              ))}
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className={styles.loadingRow}>
              <span className={styles.spinner} aria-hidden="true" />
              <span className={styles.loadingText}>Fetching media info…</span>
            </div>
          )}

          {/* Media info preview */}
          {media && !loading && (
            <div className={styles.preview}>
              {media.thumbnail && (
                <img className={styles.thumb} src={media.thumbnail} alt="" loading="lazy" />
              )}
              <div className={styles.previewInfo}>
                <div className={styles.previewTitle}>{media.title}</div>
                <div className={styles.previewMeta}>
                  {[media.platform, media.duration, media.best_resolution].filter(Boolean).join(' · ')}
                </div>

                {/* Type selector */}
                <div className={styles.typeRow}>
                  {['video', 'audio', 'thumbnail'].map(t => (
                    <button
                      key={t}
                      className={`${styles.typeBtn} ${downloadType === t ? styles.typeBtnActive : ''}`}
                      onClick={() => setDownloadType(t)}
                      id={`url-modal-type-${t}`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {downloadType === 'video' && media.formats?.filter(f => f.height > 0).length > 0 && (
                  <CustomSelect
                    value={selectedFormat}
                    onChange={setSelectedFormat}
                    options={media.formats.filter(f => f.height > 0).map(f => ({
                      value: f.format_id,
                      label: `${f.label}${f.needs_merge ? ' (needs merge)' : ''}${f.filesize ? ` · ${(f.filesize/1e6).toFixed(0)} MB` : ''}`
                    }))}
                    id="url-modal-format"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} id="url-modal-cancel">Cancel</button>
          {!media ? (
            <button
              className={styles.fetchBtn}
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              id="url-modal-fetch"
            >
              {loading ? 'Fetching…' : 'Fetch Info'}
            </button>
          ) : (
            <button
              className={styles.downloadBtn}
              onClick={handleDownload}
              id="url-modal-download"
            >
              DOWNLOAD
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * components/FileConverter.jsx
 * Full-screen file conversion tool.
 * Supports image, video, and audio format conversions.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import styles from './FileConverter.module.css'
import detailStyles from './DetailPanel.module.css'
import { convertFile } from '../services/api'
import CustomSelect from './CustomSelect'

// ── Icons ─────────────────────────────────────────────────────────────────────

const DownloadDoneIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const ImageCatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const VideoCatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/>
    <rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
)

const AudioCatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
)

const DocCatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
)

const UploadIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

const ConvertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)

const PauseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"/>
    <rect x="14" y="4" width="4" height="16"/>
  </svg>
)

const FileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
    <polyline points="13 2 13 9 20 9"/>
  </svg>
)

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

// ── Conversion Options ────────────────────────────────────────────────────────

const CATEGORIES = {
  image: {
    label: 'Images',
    Icon: ImageCatIcon,
    color: '#6c3fff',
    bg: 'rgba(108,63,255,0.12)',
    accept: 'image/*',
    conversions: [
      { from: 'JPG',  to: ['PNG', 'WEBP', 'BMP', 'GIF', 'TIFF', 'ICO', 'AVIF'] },
      { from: 'PNG',  to: ['JPG', 'WEBP', 'BMP', 'GIF', 'TIFF', 'ICO', 'AVIF'] },
      { from: 'WEBP', to: ['JPG', 'PNG', 'GIF', 'BMP'] },
      { from: 'GIF',  to: ['JPG', 'PNG', 'WEBP', 'BMP'] },
      { from: 'BMP',  to: ['JPG', 'PNG', 'WEBP', 'GIF'] },
      { from: 'TIFF', to: ['JPG', 'PNG', 'WEBP', 'BMP'] },
      { from: 'SVG',  to: ['JPG', 'PNG', 'WEBP'] },
      { from: 'HEIC', to: ['JPG', 'PNG', 'WEBP'] },
      { from: 'AVIF', to: ['JPG', 'PNG', 'WEBP'] },
      { from: 'ICO',  to: ['JPG', 'PNG', 'WEBP'] },
    ],
  },
  video: {
    label: 'Videos',
    Icon: VideoCatIcon,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    accept: 'video/*',
    conversions: [
      { from: 'MP4',  to: ['MKV', 'AVI', 'MOV', 'WEBM', 'FLV', 'WMV', 'GIF', 'MP3', 'AAC', 'WAV'] },
      { from: 'MKV',  to: ['MP4', 'AVI', 'MOV', 'WEBM', 'FLV', 'MP3', 'AAC', 'WAV'] },
      { from: 'AVI',  to: ['MP4', 'MKV', 'MOV', 'WEBM', 'WMV', 'MP3'] },
      { from: 'MOV',  to: ['MP4', 'MKV', 'AVI', 'WEBM', 'MP3', 'AAC'] },
      { from: 'WEBM', to: ['MP4', 'MKV', 'AVI', 'GIF', 'MP3', 'OGG'] },
      { from: 'FLV',  to: ['MP4', 'MKV', 'AVI', 'MP3'] },
      { from: 'WMV',  to: ['MP4', 'MKV', 'AVI', 'MP3'] },
      { from: 'M4V',  to: ['MP4', 'MKV', 'AVI', 'MOV'] },
      { from: 'TS',   to: ['MP4', 'MKV', 'AVI'] },
      { from: '3GP',  to: ['MP4', 'MKV', 'AVI', 'MP3'] },
    ],
  },
  audio: {
    label: 'Audio',
    Icon: AudioCatIcon,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    accept: 'audio/*',
    conversions: [
      { from: 'MP3',  to: ['WAV', 'AAC', 'OGG', 'FLAC', 'M4A', 'OPUS', 'WMA'] },
      { from: 'WAV',  to: ['MP3', 'AAC', 'OGG', 'FLAC', 'M4A', 'OPUS'] },
      { from: 'AAC',  to: ['MP3', 'WAV', 'OGG', 'FLAC', 'M4A'] },
      { from: 'FLAC', to: ['MP3', 'WAV', 'AAC', 'OGG', 'M4A'] },
      { from: 'OGG',  to: ['MP3', 'WAV', 'AAC', 'FLAC', 'M4A'] },
      { from: 'M4A',  to: ['MP3', 'WAV', 'AAC', 'OGG', 'FLAC'] },
      { from: 'WMA',  to: ['MP3', 'WAV', 'AAC', 'OGG'] },
      { from: 'OPUS', to: ['MP3', 'WAV', 'OGG', 'AAC'] },
      { from: 'AIFF', to: ['MP3', 'WAV', 'AAC', 'FLAC'] },
      { from: 'AMR',  to: ['MP3', 'WAV', 'AAC'] },
    ],
  },
  doc: {
    label: 'Doc',
    Icon: DocCatIcon,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    accept: '.pdf,.docx,.doc',
    conversions: [
      { from: 'DOCX', to: ['PDF'] },
      { from: 'PDF',  to: ['DOCX'] },
      { from: 'DOC',  to: ['PDF'] },
    ],
  },
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getExtension(filename) {
  return filename?.split('.').pop()?.toUpperCase() || ''
}

// ── File Item ─────────────────────────────────────────────────────────────────

function FileItem({ file, toFormat, onToFormatChange, onRemove, onDownload, status, category, selected, onClick, onPlay, onPause }) {
  const cat = CATEGORIES[category]
  const fromExt = getExtension(file.name)
  const conversionOptions = cat.conversions.find(c => c.from === fromExt)?.to || cat.conversions[0]?.to || []

  return (
    <div
      className={`${styles.fileItem} ${status === 'done' ? styles.fileItemDone : ''} ${status === 'converting' ? styles.fileItemConverting : ''} mr-file-item`}
      style={selected ? { borderColor: cat.color, backgroundColor: 'var(--color-surface-2)', cursor: 'pointer' } : { cursor: 'pointer' }}
      onClick={onClick}
    >
      <div className={styles.fileLeft}>
        <div className={styles.fileIcon}>
          <FileIcon />
          <span className={styles.fileExt} style={{ color: cat.color }}>{fromExt}</span>
        </div>

        <div className={styles.fileMeta}>
          <span className={styles.fileName} title={file.name}>{file.name}</span>
          <span className={styles.fileSize}>{formatBytes(file.size)}</span>
        </div>
      </div>

      <div className={styles.fileConvertRow}>
        <div className={styles.fromBadge} style={{ color: cat.color, backgroundColor: cat.bg }}>
          {fromExt}
        </div>
        <span className={styles.arrowIcon}><ArrowRightIcon /></span>
        <CustomSelect
          value={toFormat}
          onChange={onToFormatChange}
          options={conversionOptions.map(fmt => ({ value: fmt, label: fmt }))}
          disabled={status === 'done' || status === 'converting'}
          triggerClassName={styles.converterSelectTrigger}
        />
      </div>

      <div className={styles.fileRight}>
        <div className={styles.fileStatus}>
          {status === 'idle' && (
            <div className={styles.statusIdle}>Ready</div>
          )}
          {status === 'converting' && (
            <div className={styles.statusConverting}>
              <span className={styles.convertingDot} />
              Converting…
            </div>
          )}
          {status === 'done' && (
            <button
              className={styles.downloadDoneBtn}
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              title="Download converted file"
            >
              <DownloadDoneIcon />
              Download
            </button>
          )}
          {status === 'error' && (
            <div className={styles.statusError}>Failed</div>
          )}
        </div>

        {/* Individual File Play/Pause action buttons */}
        <div className={styles.rowControls}>
          {(status === 'idle' || status === 'error') && (
            <button
              className={styles.rowControlBtn}
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              title="Start Conversion"
            >
              <PlayIcon />
            </button>
          )}
          {status === 'converting' && (
            <button
              className={styles.rowControlBtn}
              onClick={(e) => { e.stopPropagation(); onPause(); }}
              title="Stop Conversion"
            >
              <PauseIcon />
            </button>
          )}
        </div>

        <button
          className={styles.removeBtn}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove file"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFiles, accept, color, bg }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }

  return (
    <div
      className={`${styles.dropZone} ${dragging ? styles.dropZoneDragging : ''} mr-drop-zone`}
      style={dragging ? { borderColor: color, backgroundColor: bg } : {}}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
      aria-label="Drop files or click to browse"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className={styles.dropInput}
        onChange={e => { if (e.target.files?.length) onFiles(Array.from(e.target.files)) }}
      />
      <div className={styles.dropIcon} style={{ color }}>
        <UploadIcon />
      </div>
      <p className={styles.dropTitle}>Drop files here or <span style={{ color }}>browse</span></p>
      <p className={styles.dropSub}>Supports all major formats · Multiple files at once</p>
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div className={detailStyles.metaRow}>
      <span className={detailStyles.metaLabel}>{label}</span>
      <span className={detailStyles.metaValue} title={value}>{value}</span>
    </div>
  )
}

function SquaresProgressBar({ percent }) {
  const TOTAL = 70
  const filled = Math.round((percent / 100) * TOTAL)
  return (
    <div className={detailStyles.squaresGrid}>
      {Array.from({ length: TOTAL }).map((_, i) => (
        <div
          key={i}
          className={`${detailStyles.square} ${i < filled ? detailStyles.squareFilled : detailStyles.squareEmpty}`}
        />
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FileConverter({ settings, onSettingsChange, onTogglePanel, panelOpen }) {
  const [activeCategory, setActiveCategory] = useState(() => {
    return localStorage.getItem('mediarift_fc_category') || 'image'
  })
  const [files, setFiles] = useState([]) // [{ file, toFormat, status }]
  const [converting, setConverting] = useState(false)
  const [bottomTab, setBottomTab] = useState('General')
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const abortControllersRef = useRef({})

  const selectedFile = files.find(f => f.id === selectedFileId) || (files.length > 0 ? files[0] : null)

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }
    if (selectedFile.file.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile.file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setPreviewUrl(null)
    }
  }, [selectedFile])

  const cat = CATEGORIES[activeCategory]

  function handleAddFiles(newFiles) {
    const items = newFiles.map(file => {
      const fromExt = getExtension(file.name)
      const convOptions = cat.conversions.find(c => c.from === fromExt)?.to || cat.conversions[0]?.to || ['JPG']
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        toFormat: convOptions[0],
        status: 'idle',
      }
    })
    setFiles(prev => {
      const updated = [...prev, ...items]
      if (updated.length > 0 && !selectedFileId) {
        setSelectedFileId(updated[0].id)
      }
      return updated
    })
  }

  function handleRemove(id) {
    const controller = abortControllersRef.current[id]
    if (controller) {
      controller.abort()
      delete abortControllersRef.current[id]
    }
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id)
      if (selectedFileId === id) {
        setSelectedFileId(filtered.length > 0 ? filtered[0].id : null)
      }
      return filtered
    })
  }

  function handleToFormatChange(id, fmt) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, toFormat: fmt } : f))
  }

  function handleClearAll() {
    Object.values(abortControllersRef.current).forEach(c => c.abort())
    abortControllersRef.current = {}
    setFiles([])
    setSelectedFileId(null)
  }

  function handleCategoryChange(cat) {
    Object.values(abortControllersRef.current).forEach(c => c.abort())
    abortControllersRef.current = {}
    setActiveCategory(cat)
    localStorage.setItem('mediarift_fc_category', cat)
    setFiles([])
    setSelectedFileId(null)
  }

  const handleConvertSingle = useCallback(async (id) => {
    const item = files.find(f => f.id === id)
    if (!item || item.status === 'converting') return
    
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'converting' } : f))
    
    const controller = new AbortController()
    abortControllersRef.current[id] = controller
    
    try {
      const convertedBlob = await convertFile(item.file, item.toFormat, controller.signal)
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'done', blob: convertedBlob } : f))
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Conversion failed:', err)
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error' } : f))
      }
    } finally {
      delete abortControllersRef.current[id]
    }
  }, [files])

  const handleCancelSingle = useCallback((id) => {
    const controller = abortControllersRef.current[id]
    if (controller) {
      controller.abort()
      delete abortControllersRef.current[id]
    }
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'idle' } : f))
  }, [])

  // Actual conversion using backend API
  const handleConvertAll = useCallback(async () => {
    const pending = files.filter(f => f.status === 'idle' || f.status === 'error')
    if (!pending.length) return
    setConverting(true)

    for (const item of pending) {
      // Check if it was canceled in-between
      const currentItem = files.find(f => f.id === item.id)
      if (!currentItem || currentItem.status !== 'idle') continue

      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'converting' } : f))
      
      const controller = new AbortController()
      abortControllersRef.current[item.id] = controller

      try {
        const convertedBlob = await convertFile(item.file, item.toFormat, controller.signal)
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', blob: convertedBlob } : f))
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Conversion failed:', err)
          setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f))
        }
      } finally {
        delete abortControllersRef.current[item.id]
      }
    }

    setConverting(false)
  }, [files])

  const readyCount = files.filter(f => f.status === 'idle' || f.status === 'error').length
  const doneCount = files.filter(f => f.status === 'done').length

  return (
    <div className={`${styles.pageContainer} mr-converter-container`}>

        {/* ── Header ── */}
        <div className={`${styles.header} mr-converter-header`}>
          <div className={styles.headerCenter}>
            <div className={styles.headerIcon}>
              <ConvertIcon />
            </div>
            <div>
              <h1 className={styles.headerTitle}>File Converter</h1>
              <p className={styles.headerSub}>Convert images, videos &amp; audio between formats</p>
            </div>
          </div>

          <div className={styles.headerRight}>
            {/* Hamburger panel toggle */}
            <button
              className={`${styles.panelToggleBtn} ${panelOpen ? styles.panelToggleBtnActive : ''}`}
              onClick={onTogglePanel}
              aria-label={panelOpen ? 'Close panel' : 'Open panel'}
              id="fc-panel-toggle"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="16" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            {files.length > 0 && (
              <button className={styles.clearBtn} onClick={handleClearAll}>
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* ── Category Tabs ── */}
        <div className={`${styles.tabs} mr-converter-tabs`}>
          {Object.entries(CATEGORIES).map(([key, info]) => (
            <button
              key={key}
              className={`${styles.tab} ${activeCategory === key ? styles.tabActive : ''}`}
              onClick={() => handleCategoryChange(key)}
              id={`fc-tab-${key}`}
              style={activeCategory === key ? { color: info.color, borderBottomColor: info.color } : {}}
            >
              <span className={styles.tabIcon}>
                <info.Icon />
              </span>
              <span>{info.label}</span>
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className={`${styles.body} mr-converter-body`}>

          {/* ── Left panel: Drop zone + file list ── */}
          <div className={`${styles.mainArea} mr-converter-main`}>

            {/* Drop Zone */}
            <DropZone
              onFiles={handleAddFiles}
              accept={cat.accept}
              color={cat.color}
              bg={cat.bg}
            />

            {/* File list */}
            {files.length > 0 && (
              <div className={styles.fileList}>
                <div className={styles.fileListHeader}>
                  <span className={styles.fileListCount}>
                    {files.length} file{files.length !== 1 ? 's' : ''}
                    {doneCount > 0 && <span className={styles.doneCount}> · {doneCount} converted</span>}
                  </span>
                </div>
                <div className={styles.fileListItems}>
                  {files.map(item => (
                    <FileItem
                      key={item.id}
                      file={item.file}
                      toFormat={item.toFormat}
                      onToFormatChange={fmt => handleToFormatChange(item.id, fmt)}
                      onRemove={() => handleRemove(item.id)}
                      onDownload={() => {
                        // Trigger browser download of the converted file blob
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(item.blob || item.file)
                        a.download = item.file.name.replace(/\.[^.]+$/, '') + '.' + item.toFormat.toLowerCase()
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                      }}
                      status={item.status}
                      category={activeCategory}
                      selected={selectedFile?.id === item.id}
                      onClick={() => setSelectedFileId(item.id)}
                      onPlay={() => handleConvertSingle(item.id)}
                      onPause={() => handleCancelSingle(item.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right panel: Format reference + Convert action ── */}
          <aside className={styles.sidebar}>

            {/* Convert action */}
            <div className={styles.sideSection}>
              <button
                className={styles.convertBtn}
                onClick={handleConvertAll}
                disabled={readyCount === 0 || converting}
                id="fc-convert-btn"
                style={{ '--cat-color': cat.color }}
              >
                {converting ? (
                  <span className={styles.spinner} />
                ) : (
                  <ConvertIcon />
                )}
                <span>
                  {converting
                    ? 'Converting…'
                    : readyCount > 0
                      ? `Convert ${readyCount} file${readyCount !== 1 ? 's' : ''}`
                      : 'Convert Files'}
                </span>
              </button>
              {doneCount > 0 && (
                <p className={styles.doneNote}>
                  ✓ {doneCount} file{doneCount !== 1 ? 's' : ''} converted successfully
                </p>
              )}
            </div>

            {/* Supported formats */}
            <div className={styles.sideSection}>
              <div className={styles.sideSectionLabel}>Supported conversions</div>
              <div className={styles.formatGrid}>
                {cat.conversions.map(({ from, to }) => (
                  <div key={from} className={styles.formatRow}>
                    <span className={styles.formatFrom} style={{ color: cat.color, backgroundColor: cat.bg }}>
                      {from}
                    </span>
                    <span className={styles.formatArrow}>→</span>
                    <span className={styles.formatTos}>
                      {to.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </aside>
        </div>

        {/* ── Bottom: General / Progress + status bar (per-converter context) ── */}
        <div className={detailStyles.panel}>
          <div className={detailStyles.panelHeader}>
            <div className={detailStyles.tabs}>
              {['General', 'Progress'].map(t => (
                <button
                  key={t}
                  className={`${detailStyles.tab} ${bottomTab === t ? detailStyles.tabActive : ''}`}
                  onClick={() => setBottomTab(t)}
                  id={`fc-bottom-tab-${t.toLowerCase()}`}
                >{t}</button>
              ))}
            </div>
          </div>
          <div className={detailStyles.panelBody}>
            {bottomTab === 'General' && (
              selectedFile ? (
                <div className={detailStyles.tabContent}>
                  <div className={detailStyles.generalLeft}>
                    {previewUrl ? (
                      <img src={previewUrl} alt="" className={detailStyles.thumbnail} />
                    ) : (
                      <div className={detailStyles.thumbnailPlaceholder} />
                    )}
                  </div>
                  <div className={detailStyles.generalRight}>
                    <div className={detailStyles.entryTitle}>{selectedFile.file.name}</div>
                    <div className={detailStyles.metaGrid}>
                      <MetaRow label="Category" value={activeCategory.toUpperCase()} />
                      <MetaRow label="Size" value={formatBytes(selectedFile.file.size)} />
                      <MetaRow label="Target Format" value={selectedFile.toFormat} />
                      <MetaRow label="Status" value={selectedFile.status.toUpperCase()} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className={detailStyles.empty}>Load and select a file to see details.</div>
              )
            )}
            {bottomTab === 'Progress' && (
              <div className={detailStyles.tabContent} style={{ width: '100%' }}>
                <div className={detailStyles.progressSection}>
                  <div className={detailStyles.progressHeader}>
                    <span className={detailStyles.progressPct}>{files.length > 0 ? Math.round((doneCount / files.length) * 100) : 0}%</span>
                    <span className={detailStyles.progressOf}>
                      {doneCount} of {files.length} file{files.length !== 1 ? 's' : ''} completed
                    </span>
                  </div>
                  <SquaresProgressBar percent={files.length > 0 ? Math.round((doneCount / files.length) * 100) : 0} />
                  <div className={detailStyles.progressStats}>
                    <div className={detailStyles.stat}>
                      <span className={detailStyles.statLabel}>Total files</span>
                      <span className={detailStyles.statValue}>{files.length}</span>
                    </div>
                    <div className={detailStyles.stat}>
                      <span className={detailStyles.statLabel}>Converting</span>
                      <span className={detailStyles.statValue}>
                        {files.filter(f => f.status === 'converting').length}
                      </span>
                    </div>
                    <div className={detailStyles.stat}>
                      <span className={detailStyles.statLabel}>Done</span>
                      <span className={detailStyles.statValue}>{doneCount}</span>
                    </div>
                    <div className={detailStyles.stat}>
                      <span className={detailStyles.statLabel}>Status</span>
                      <span className={detailStyles.statValue}>{converting ? 'Converting…' : files.length > 0 ? 'Idle' : 'No files'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  )
}

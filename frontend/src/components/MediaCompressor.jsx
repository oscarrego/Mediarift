/**
 * components/MediaCompressor.jsx
 * Full-screen media compression tool.
 * Supports image and video compression with visual size savings metrics.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import styles from './MediaCompressor.module.css'
import detailStyles from './DetailPanel.module.css'
import { compressFile, fetchCompressProgressData, pauseCompress, resumeCompress, cancelCompress } from '../services/api'


const DownloadDoneIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const CompressIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 14h6v6"/>
    <path d="M20 10h-6V4"/>
    <path d="M14 10l7-7"/>
    <path d="M10 14l-7 7"/>
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

const UploadIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
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

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
)

const FileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
    <polyline points="13 2 13 9 20 9"/>
  </svg>
)


function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getExtension(filename) {
  return filename?.split('.').pop()?.toUpperCase() || ''
}

function isVideoFile(filename) {
  const ext = '.' + filename?.split('.').pop()?.toLowerCase()
  return ['.mp4', '.mkv', '.avi', '.mov', '.webm'].includes(ext)
}


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
      aria-label="Drop media files or click to browse"
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
      <p className={styles.dropTitle}>Drop images or videos here or <span style={{ color }}>browse</span></p>
      <p className={styles.dropSub}>Supports MP4, MKV, AVI, MOV, WEBM, JPG, PNG, WEBP · Multiple files</p>
    </div>
  )
}


function FileItem({
  item,
  onLevelChange,
  onRemove,
  onDownload,
  selected,
  onClick,
  onPlay,
  onPause,
  onResume,
  onCancel
}) {
  const isVideo = isVideoFile(item.file.name)
  const fromExt = getExtension(item.file.name)
  const themeColor = isVideo ? '#ef4444' : '#6c3fff'
  const themeBg = isVideo ? 'rgba(239,68,68,0.12)' : 'rgba(108,63,255,0.12)'

  return (
    <div
      className={`${styles.fileItem} ${item.status === 'done' ? styles.fileItemDone : ''} ${item.status === 'converting' ? styles.fileItemConverting : ''} mr-file-item`}
      style={selected ? { borderColor: themeColor, backgroundColor: 'var(--color-surface-2)', cursor: 'pointer' } : { cursor: 'pointer' }}
      onClick={onClick}
    >
      <div className={styles.fileLeft}>
        <div className={styles.fileIcon}>
          <FileIcon />
          <span className={styles.fileExt} style={{ color: themeColor }}>{fromExt}</span>
        </div>

        <div className={styles.fileMeta}>
          <span className={styles.fileName} title={item.file.name}>{item.file.name}</span>
          <span className={styles.fileSize}>{formatBytes(item.file.size)}</span>
        </div>
      </div>

      <div className={styles.compressionControl}>
        <span className={styles.levelLabel}>Level:</span>
        <select
          value={item.level}
          onChange={(e) => onLevelChange(e.target.value)}
          className={styles.levelSelect}
          disabled={item.status === 'done' || item.status === 'converting'}
        >
          <option value="low">Low (Best Quality)</option>
          <option value="medium">Medium (Balanced)</option>
          <option value="high">High (Smallest Size)</option>
        </select>
      </div>

      {item.status === 'done' && item.outputSize && (
        <div className={styles.metricsBadge}>
          <span className={styles.savingsPercent}>-{item.savingPercent}%</span>
          <span>{formatBytes(item.outputSize)}</span>
        </div>
      )}

      <div className={styles.fileRight}>
        <div className={styles.fileStatus}>
          {item.status === 'idle' && (
            <div className={styles.statusIdle}>Ready</div>
          )}
          {item.status === 'converting' && (
            <div className={styles.statusConverting}>
              <span className={styles.convertingDot} />
              {item.isPaused ? 'Paused' : (item.stage || 'Compressing')} ({item.progressPercent || 0}%)
            </div>
          )}
          {item.status === 'done' && (
            <button
              className={styles.downloadDoneBtn}
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              title="Download compressed file"
            >
              <DownloadDoneIcon />
              Download
            </button>
          )}
          {item.status === 'error' && (
            <div className={styles.statusError} title={item.stage}>Failed</div>
          )}
        </div>

        <div className={styles.rowControls}>
          {(item.status === 'idle' || item.status === 'error') && (
            <button
              className={styles.rowControlBtn}
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              title="Compress file"
              id={`action-play-${item.id}`}
            >
              <PlayIcon />
            </button>
          )}
          {item.status === 'converting' && (
            <>
              {item.isPaused ? (
                <button
                  className={styles.rowControlBtn}
                  onClick={(e) => { e.stopPropagation(); onResume(); }}
                  title="Resume compression"
                  id={`action-resume-${item.id}`}
                >
                  <PlayIcon />
                </button>
              ) : (
                <button
                  className={styles.rowControlBtn}
                  onClick={(e) => { e.stopPropagation(); onPause(); }}
                  title="Pause compression"
                  id={`action-pause-${item.id}`}
                >
                  <PauseIcon />
                </button>
              )}
              <button
                className={styles.rowControlBtn}
                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                title="Cancel compression"
                id={`action-cancel-${item.id}`}
              >
                <StopIcon />
              </button>
            </>
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


export default function MediaCompressor({ settings, onSettingsChange, onTogglePanel, panelOpen }) {
  const [files, setFiles] = useState([])
  const [compressing, setCompressing] = useState(false)
  const [bottomTab, setBottomTab] = useState('General')
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const abortControllersRef = useRef({})

  const selectedFile = files.find(f => f.id === selectedFileId) || (files.length > 0 ? files[0] : null)

  // Manage Preview URLs for images
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

  function handleAddFiles(newFiles) {
    const items = newFiles.map(file => {
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        level: 'medium',
        status: 'idle',
        outputBlob: null,
        outputSize: null,
        savingPercent: null,
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

  function handleLevelChange(id, level) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, level } : f))
  }

  function handleClearAll() {
    Object.values(abortControllersRef.current).forEach(c => c.abort())
    abortControllersRef.current = {}
    setFiles([])
    setSelectedFileId(null)
  }

  const handleCompressSingle = useCallback(async (id) => {
    const item = files.find(f => f.id === id)
    if (!item || item.status === 'converting') return

    const taskId = 'compress-' + Math.random().toString(36).slice(2, 11)

    setFiles(prev => prev.map(f => f.id === id ? { 
      ...f, 
      status: 'converting', 
      isPaused: false,
      progressPercent: 0,
      taskId,
      stage: 'Initializing...',
      algorithm: '',
      encoder: '',
      ratio: ''
    } : f))

    const controller = new AbortController()
    abortControllersRef.current[id] = controller

    let intervalId = null
    try {
      intervalId = setInterval(async () => {
        try {
          const data = await fetchCompressProgressData(taskId)
          setFiles(prev => prev.map(f => f.id === id ? { 
            ...f, 
            progressPercent: data.progress ?? 0,
            stage: data.stage || f.stage,
            encoder: data.encoder || f.encoder,
            algorithm: data.algorithm || f.algorithm,
            ratio: data.ratio || f.ratio
          } : f))
        } catch (e) {
          console.error('Failed to fetch progress:', e)
        }
      }, 1000)

      const compressedBlob = await compressFile(item.file, item.level, taskId, controller.signal)
      if (intervalId) clearInterval(intervalId)

      const compressedSize = compressedBlob.size
      const originalSize = item.file.size
      const savedBytes = originalSize - compressedSize
      const savingPercent = Math.max(0, Math.round((savedBytes / originalSize) * 100))

      setFiles(prev => prev.map(f => f.id === id ? {
        ...f,
        status: 'done',
        outputBlob: compressedBlob,
        outputSize: compressedSize,
        savingPercent,
        progressPercent: 100,
        stage: 'Completed'
      } : f))
    } catch (err) {
      if (intervalId) clearInterval(intervalId)
      if (err.name !== 'AbortError') {
        console.error('Compression failed:', err)
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', progressPercent: 0, stage: 'Error: ' + err.message } : f))
      }
    } finally {
      delete abortControllersRef.current[id]
    }
  }, [files])

  const handlePauseSingle = useCallback(async (id) => {
    const item = files.find(f => f.id === id)
    if (!item || !item.taskId) return
    try {
      await pauseCompress(item.taskId)
      setFiles(prev => prev.map(f => f.id === id ? { ...f, isPaused: true, stage: 'Paused' } : f))
    } catch (e) {
      console.error('Failed to pause compression:', e)
    }
  }, [files])

  const handleResumeSingle = useCallback(async (id) => {
    const item = files.find(f => f.id === id)
    if (!item || !item.taskId) return
    try {
      await resumeCompress(item.taskId)
      setFiles(prev => prev.map(f => f.id === id ? { ...f, isPaused: false, stage: 'Resuming...' } : f))
    } catch (e) {
      console.error('Failed to resume compression:', e)
    }
  }, [files])

  const handleCancelSingle = useCallback(async (id) => {
    const item = files.find(f => f.id === id)
    if (item && item.taskId) {
      try {
        await cancelCompress(item.taskId)
      } catch (e) {
        console.error('Failed to cancel compression on backend:', e)
      }
    }
    const controller = abortControllersRef.current[id]
    if (controller) {
      controller.abort()
      delete abortControllersRef.current[id]
    }
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'idle', isPaused: false, progressPercent: 0, stage: '' } : f))
  }, [files])

  const handleCompressAll = useCallback(async () => {
    const pending = files.filter(f => f.status === 'idle' || f.status === 'error')
    if (!pending.length) return
    setCompressing(true)

    for (const item of pending) {
      const currentItem = files.find(f => f.id === item.id)
      if (!currentItem || (currentItem.status !== 'idle' && currentItem.status !== 'error')) continue

      const taskId = 'compress-' + Math.random().toString(36).slice(2, 11)

      setFiles(prev => prev.map(f => f.id === item.id ? { 
        ...f, 
        status: 'converting', 
        isPaused: false,
        progressPercent: 0,
        taskId,
        stage: 'Initializing...',
        algorithm: '',
        encoder: '',
        ratio: ''
      } : f))

      const controller = new AbortController()
      abortControllersRef.current[item.id] = controller

      let intervalId = null
      try {
        intervalId = setInterval(async () => {
          try {
            const data = await fetchCompressProgressData(taskId)
            setFiles(prev => prev.map(f => f.id === item.id ? { 
              ...f, 
              progressPercent: data.progress ?? 0,
              stage: data.stage || f.stage,
              encoder: data.encoder || f.encoder,
              algorithm: data.algorithm || f.algorithm,
              ratio: data.ratio || f.ratio
            } : f))
          } catch {}
        }, 1000)

        const compressedBlob = await compressFile(item.file, item.level, taskId, controller.signal)
        if (intervalId) clearInterval(intervalId)

        const compressedSize = compressedBlob.size
        const originalSize = item.file.size
        const savedBytes = originalSize - compressedSize
        const savingPercent = Math.max(0, Math.round((savedBytes / originalSize) * 100))

        setFiles(prev => prev.map(f => f.id === item.id ? {
          ...f,
          status: 'done',
          outputBlob: compressedBlob,
          outputSize: compressedSize,
          savingPercent,
          progressPercent: 100,
          stage: 'Completed'
        } : f))
      } catch (err) {
        if (intervalId) clearInterval(intervalId)
        if (err.name !== 'AbortError') {
          console.error('Compression failed:', err)
          setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', progressPercent: 0, stage: 'Error: ' + err.message } : f))
        }
      } finally {
        delete abortControllersRef.current[item.id]
      }
    }

    setCompressing(false)
  }, [files])

  const handleDownload = (item) => {
    if (!item.outputBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(item.outputBlob)

    const origName = item.file.name
    const dotIdx = origName.lastIndexOf('.')
    const name = dotIdx !== -1 ? origName.slice(0, dotIdx) : origName
    const ext = dotIdx !== -1 ? origName.slice(dotIdx) : ''
    a.download = `${name}_compressed${ext}`

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const readyCount = files.filter(f => f.status === 'idle' || f.status === 'error').length
  const doneCount = files.filter(f => f.status === 'done').length

    const overallPercent = (() => {
    if (files.length === 0) return 0
    const totalProgress = files.reduce((acc, f) => {
      if (f.status === 'done') return acc + 100
      if (f.status === 'converting') return acc + (f.progressPercent || 0)
      return acc
    }, 0)
    return Math.round(totalProgress / files.length)
  })()

    const totalOriginalBytes = files.reduce((acc, f) => acc + f.file.size, 0)
  const totalCompressedBytes = files.reduce((acc, f) => acc + (f.outputSize || f.file.size), 0)
  const totalSavedBytes = totalOriginalBytes - totalCompressedBytes
  const totalSavingsPercent = totalOriginalBytes > 0 ? Math.max(0, Math.round((totalSavedBytes / totalOriginalBytes) * 100)) : 0

  return (
    <div className={`${styles.pageContainer} mr-compressor-container`}>

            <div className={`${styles.header} mr-compressor-header`}>
        <div className={styles.headerCenter}>
          <div className={styles.headerIcon}>
            <CompressIcon />
          </div>
          <div>
            <h1 className={styles.headerTitle}>Media Compressor</h1>
            <p className={styles.headerSub}>Compress videos &amp; images preserving visual quality</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            className={`${detailStyles.panelToggleBtn || ''} ${panelOpen ? detailStyles.panelToggleBtnActive || '' : ''}`}
            onClick={onTogglePanel}
            aria-label={panelOpen ? 'Close panel' : 'Open panel'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '6px',
              marginRight: '12px',
            }}
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

            <div className={`${styles.body} mr-compressor-body`}>

                <div className={`${styles.mainArea} mr-compressor-main`}>

          <DropZone
            onFiles={handleAddFiles}
            accept="image/*,video/*"
            color="var(--color-accent)"
            bg="var(--color-accent-light, rgba(108,63,255,0.08))"
          />

          {files.length > 0 && (
            <div className={styles.fileList}>
              {files.map(item => (
                <FileItem
                  key={item.id}
                  item={item}
                  onLevelChange={level => handleLevelChange(item.id, level)}
                  onRemove={() => handleRemove(item.id)}
                  onDownload={() => handleDownload(item)}
                  selected={selectedFile?.id === item.id}
                  onClick={() => setSelectedFileId(item.id)}
                  onPlay={() => handleCompressSingle(item.id)}
                  onPause={() => handlePauseSingle(item.id)}
                  onResume={() => handleResumeSingle(item.id)}
                  onCancel={() => handleCancelSingle(item.id)}
                />
              ))}
            </div>
          )}
        </div>

                <aside className={detailStyles.sidebar || ''} style={{
          width: '260px',
          backgroundColor: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border)' }}>
            <button
              className={styles.actionBtn}
              onClick={handleCompressAll}
              disabled={readyCount === 0 || compressing}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {compressing ? (
                <span className={styles.convertingDot} style={{ animation: 'pulse 1s infinite' }} />
              ) : (
                <CompressIcon />
              )}
              <span>
                {compressing
                  ? 'Compressing…'
                  : readyCount > 0
                    ? `Compress ${readyCount} File${readyCount !== 1 ? 's' : ''}`
                    : 'Compress Files'}
              </span>
            </button>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-4)', fontWeight: 'bold' }}>
              Compression Stats
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--color-text-3)' }}>Total Size:</span>
              <span style={{ color: 'var(--color-text-2)', fontWeight: '500' }}>{formatBytes(totalOriginalBytes)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--color-text-3)' }}>Compressed:</span>
              <span style={{ color: 'var(--color-text-2)', fontWeight: '500' }}>{formatBytes(totalCompressedBytes)}</span>
            </div>

            {totalSavedBytes > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                borderRadius: '6px',
                marginTop: '6px'
              }}>
                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '500' }}>Space Saved:</div>
                <div style={{ fontSize: '1.1rem', color: '#10b981', fontWeight: '700' }}>
                  {formatBytes(totalSavedBytes)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#10b981', opacity: 0.8 }}>
                  Reduced overall size by {totalSavingsPercent}%
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

            <div className={detailStyles.panel}>
        <div className={detailStyles.panelHeader}>
          <div className={detailStyles.tabs}>
            {['General', 'Progress'].map(t => (
              <button
                key={t}
                className={`${detailStyles.tab} ${bottomTab === t ? detailStyles.tabActive : ''}`}
                onClick={() => setBottomTab(t)}
                id={`compressor-bottom-tab-${t.toLowerCase()}`}
              >
                {t}
              </button>
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
                    <div className={detailStyles.thumbnailPlaceholder} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--color-surface-2)',
                      width: '80px',
                      height: '80px',
                      borderRadius: '6px',
                      color: 'var(--color-text-4)',
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      fontWeight: 'bold'
                    }}>
                      {isVideoFile(selectedFile.file.name) ? 'Video' : 'No Preview'}
                    </div>
                  )}
                </div>
                <div className={detailStyles.generalRight}>
                  <div className={detailStyles.entryTitle}>{selectedFile.file.name}</div>
                  <div className={detailStyles.metaGrid}>
                    <MetaRow label="Type" value={isVideoFile(selectedFile.file.name) ? 'VIDEO' : 'IMAGE'} />
                    <MetaRow label="Original Size" value={formatBytes(selectedFile.file.size)} />
                    <MetaRow label="Compression Level" value={selectedFile.level.toUpperCase()} />
                    <MetaRow label="Status" value={selectedFile.status.toUpperCase()} />
                    {selectedFile.algorithm && (
                      <MetaRow label="Algorithm" value={selectedFile.algorithm} />
                    )}
                    {selectedFile.encoder && (
                      <MetaRow label="Hardware Encoder" value={selectedFile.encoder} />
                    )}
                    {selectedFile.stage && (
                      <MetaRow label="Current Stage" value={selectedFile.stage} />
                    )}
                    {selectedFile.ratio && (
                      <MetaRow label="Compression Ratio" value={selectedFile.ratio} />
                    )}
                    {selectedFile.outputSize && (
                      <>
                        <MetaRow label="Compressed Size" value={formatBytes(selectedFile.outputSize)} />
                        <MetaRow label="Savings" value={`-${selectedFile.savingPercent}%`} />
                      </>
                    )}
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
                  <span className={detailStyles.progressPct}>{overallPercent}%</span>
                  <span className={detailStyles.progressOf}>
                    {doneCount} of {files.length} file{files.length !== 1 ? 's' : ''} completed
                  </span>
                </div>
                <SquaresProgressBar percent={overallPercent} />
                <div className={detailStyles.progressStats}>
                  <div className={detailStyles.stat}>
                    <span className={detailStyles.statLabel}>Total files</span>
                    <span className={detailStyles.statValue}>{files.length}</span>
                  </div>
                  <div className={detailStyles.stat}>
                    <span className={detailStyles.statLabel}>Compressing</span>
                    <span className={detailStyles.statValue}>
                      {files.filter(f => f.status === 'converting').length}
                    </span>
                  </div>
                  <div className={detailStyles.stat}>
                    <span className={detailStyles.statLabel}>Completed</span>
                    <span className={detailStyles.statValue}>{doneCount}</span>
                  </div>
                  <div className={detailStyles.stat}>
                    <span className={detailStyles.statLabel}>Queue Status</span>
                    <span className={detailStyles.statValue}>
                      {compressing ? 'Compressing…' : files.length > 0 ? 'Idle' : 'No files'}
                    </span>
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

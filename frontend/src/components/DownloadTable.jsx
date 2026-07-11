/**
 * components/DownloadTable.jsx
 * FDM-style download list: checkbox + play/pause toggle in first column, inline progress bars, delete.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import styles from './DownloadTable.module.css'
import { pauseDownload, resumeDownload, restartDownload, stopDownload, deleteDownload, openFolder } from '../services/api'

// ── Icons ───────────────────────────────────────────────────────────────────

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z"/>
  </svg>
)
const PauseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>
)
const StopIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const FolderOpenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    <polyline points="12 11 12 17"/><polyline points="9 14 12 17 15 14"/>
  </svg>
)

// ── File type icon ───────────────────────────────────────────────────────────

function FileIcon({ type, ext }) {
  const color = type === 'audio' ? '#f0a500' : type === 'thumbnail' ? '#e05555' : '#9b6dff'
  const label = ext?.toUpperCase() || (type === 'audio' ? 'MP3' : type === 'thumbnail' ? 'IMG' : 'MP4')
  return (
    <div className={styles.fileIcon} style={{ '--fi-color': color }}>
      <svg width="28" height="34" viewBox="0 0 28 34" aria-hidden="true">
        <rect x="0" y="0" width="28" height="34" rx="3" fill={color} fillOpacity="0.12"/>
        <path d="M17 0 L28 10 L17 10 Z" fill={color} fillOpacity="0.25"/>
        <path d="M17 0 L28 10 L17 10 Z" fill={color}/>
      </svg>
      <span className={styles.fileIconLabel}>{label.slice(0,4)}</span>
    </div>
  )
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (!b) return '—'
  if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB'
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB'
  if (b >= 1e3) return (b / 1e3).toFixed(0) + ' KB'
  return b + ' B'
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtSpeed(bps) {
  if (!bps) return '0 B/s'
  if (bps >= 1e6) return (bps / 1e6).toFixed(1) + ' MB/s'
  if (bps >= 1e3) return (bps / 1e3).toFixed(0) + ' KB/s'
  return bps + ' B/s'
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const mon = d.toLocaleString('en', { month: 'short' })
    return `${mon} ${d.getDate()}`
  } catch { return iso.slice(0, 10) }
}

function stateLabel(entry) {
  if (entry.state === 'retrying') {
    return `Retrying (${entry.retry_count}/${entry.max_retries}) in ${entry.retry_countdown ?? 0}s...`
  }
  switch (entry.state) {
    case 'queued':      return 'Queued'
    case 'fetching':    return 'Fetching…'
    case 'downloading': return 'Downloading'
    case 'paused':      return 'Paused'
    case 'completed':   return 'Completed'
    case 'error':       return 'Error'
    case 'stopped':     return 'Stopped'
    case 'Interrupted': return 'Interrupted'
    case 'Resuming...': return 'Resuming...'
    default:            return entry.state
  }
}

// ── Row ──────────────────────────────────────────────────────────────────────

function DownloadRow({ entry, isSelected, isChecked, onSelect, onCheck, onDelete, onRefresh }) {
  const [actionPending, setActionPending] = useState(false)
  const prevStateRef = useRef(entry.state)

  // Auto-open folder when download transitions to completed
  useEffect(() => {
    if (prevStateRef.current !== 'completed' && entry.state === 'completed') {
      // Small delay so backend has time to finalise the file path
      const timer = setTimeout(() => {
        openFolder(entry.id).catch(() => {})
      }, 800)
      return () => clearTimeout(timer)
    }
    prevStateRef.current = entry.state
  }, [entry.state, entry.id])

  const wrap = async (fn) => {
    if (actionPending) return
    setActionPending(true)
    try { await fn() } finally { setActionPending(false); onRefresh?.() }
  }

  // Single toggle button: if downloading/retrying/resuming → pause; if paused/stopped/error → resume
  const handlePlayPause = (e) => {
    e.stopPropagation()
    if (entry.state === 'downloading' || entry.state === 'retrying' || entry.state === 'Resuming...') {
      wrap(() => pauseDownload(entry.id))
    } else if (entry.state === 'paused' || entry.state === 'stopped' || entry.state === 'error') {
      wrap(() => resumeDownload(entry.id))
    }
  }

  const handleStop = (e) => { e.stopPropagation(); wrap(() => stopDownload(entry.id)) }

  const handleDelete = (e) => { e.stopPropagation(); wrap(async () => {
    await deleteDownload(entry.id)
    onDelete(entry.id)
  }) }

  const handleRestart = (e) => { e.stopPropagation(); wrap(() => restartDownload(entry.id)) }

  const isActive = entry.state === 'downloading' || entry.state === 'paused' || entry.state === 'retrying' || entry.state === 'Resuming...'
  const canPlayPause = entry.state === 'downloading' || entry.state === 'paused' || entry.state === 'stopped' || entry.state === 'error' || entry.state === 'retrying' || entry.state === 'Resuming...'
  const canStop = isActive || entry.state === 'queued' || entry.state === 'fetching'
  const isCompleted = entry.state === 'completed'
  const isError = entry.state === 'error'

  const stateClass = {
    downloading: styles.stateDownloading,
    paused:      styles.statePaused,
    completed:   styles.stateCompleted,
    error:       styles.stateError,
    stopped:     styles.stateStopped,
    queued:      styles.stateQueued,
    fetching:    styles.stateFetching,
    retrying:    styles.stateRetrying,
    "Resuming...": styles.stateResuming,
    "Interrupted": styles.stateInterrupted,
  }[entry.state] || ''

  // Play/pause button appearance
  const isPlaying = entry.state === 'downloading' || entry.state === 'retrying' || entry.state === 'Resuming...'

  return (
    <tr
      className={`${styles.row} ${isSelected ? styles.rowSelected : ''} ${isChecked ? styles.rowChecked : ''} ${isError ? styles.rowError : ''} mr-row`}
      onClick={() => onSelect(entry.id)}
      aria-selected={isSelected}
    >
      {/* Combined checkbox + play/pause cell — FDM style */}
      <td className={`${styles.colCheck} mr-cell mr-col-check`} onClick={e => e.stopPropagation()}>
        <div className={styles.checkPlayCell}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={isChecked}
            onChange={e => onCheck(entry.id, e.target.checked)}
            aria-label={`Select ${entry.title || entry.filename}`}
            id={`check-${entry.id}`}
          />
          {canPlayPause ? (
            <button
              className={`${styles.playPauseBtn} ${isPlaying ? styles.playPauseBtnPausing : styles.playPauseBtnPlaying}`}
              onClick={handlePlayPause}
              title={isPlaying ? 'Pause' : 'Resume'}
              disabled={actionPending}
              id={`action-playpause-${entry.id}`}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
          ) : (
            /* Placeholder so layout doesn't shift */
            <span className={styles.playPausePlaceholder} />
          )}
        </div>
      </td>

      {/* Icon + name */}
      <td className={`${styles.colName} mr-cell mr-col-name`}>
        <div className={styles.nameCell}>
          <FileIcon type={entry.download_type} ext={entry.filename?.split('.').pop()} />
          <div className={styles.nameInfo}>
            <span className={styles.nameTitle} title={entry.title || entry.filename}>
              {entry.title || entry.filename || entry.url}
            </span>
            {entry.filename && entry.title !== entry.filename && (
              <span className={styles.nameSub}>{entry.filename}</span>
            )}
          </div>
        </div>
      </td>

      {/* Size */}
      <td className={`${styles.colSize} mr-cell mr-col-size`}>
        {fmtBytes(entry.total_bytes || 0)}
      </td>

      {/* Status + progress */}
      <td className={`${styles.colStatus} mr-cell mr-col-status`}>
        <div className={styles.statusCell}>
          <span className={`${styles.stateText} ${stateClass}`}>{stateLabel(entry)}</span>
          {isActive && (
            <div className={styles.progressBarWrap}>
              <div
                className={`${styles.progressBar} ${entry.state === 'paused' ? styles.progressBarPaused : ''} ${entry.state === 'retrying' ? styles.progressBarPaused : ''}`}
                style={{ width: `${entry.percent || 0}%` }}
              />
            </div>
          )}
          {isError && (
            <span className={styles.errorTip} title={entry.error}>!</span>
          )}
        </div>
      </td>

      {/* Percent */}
      <td className={`${styles.colPct} mr-cell mr-col-pct`}>
        {`${entry.percent || 0}%`}
      </td>

      {/* Download speed */}
      <td className={`${styles.colSpeed} mr-cell mr-col-speed`}>
        {entry.state === 'downloading' ? fmtSpeed(entry.speed_bps) : '0 B/s'}
      </td>

      {/* Added */}
      <td className={`${styles.colDate} mr-cell mr-col-date`}>{fmtDate(entry.added_at)}</td>

      {/* Actions — open-folder (completed only) + resume/restart/delete */}
      <td className={`${styles.colActions} mr-cell mr-col-actions`} onClick={e => e.stopPropagation()}>
        <div className={styles.actions}>
          {entry.state === 'Interrupted' && (
            <>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnResume}`}
                onClick={e => { e.stopPropagation(); wrap(() => resumeDownload(entry.id)) }}
                title="Resume Download"
                id={`action-resume-interrupted-${entry.id}`}
              >
                ▶
              </button>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnRestart}`}
                onClick={handleRestart}
                title="Restart Download"
                id={`action-restart-interrupted-${entry.id}`}
              >
                ↻
              </button>
            </>
          )}
          {isCompleted && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnFolder}`}
              onClick={e => { e.stopPropagation(); openFolder(entry.id).catch(() => {}) }}
              title="Show in folder"
              id={`action-folder-${entry.id}`}
            >
              <FolderOpenIcon />
            </button>
          )}
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
            onClick={handleDelete}
            title="Delete"
            disabled={actionPending}
            id={`action-delete-${entry.id}`}
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main table ────────────────────────────────────────────────────────────────

const SORT_FIELDS = {
  name:   (a, b) => (a.title || '').localeCompare(b.title || ''),
  size:   (a, b) => (b.total_bytes || 0) - (a.total_bytes || 0),
  status: (a, b) => (a.state || '').localeCompare(b.state || ''),
  date:   (a, b) => (b.added_at || '').localeCompare(a.added_at || ''),
}

export default function DownloadTable({ downloads, searchQuery, selectedId, onSelect, onDelete, onRefresh }) {
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [checkedIds, setCheckedIds] = useState(new Set())

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const getDir = (field) => sortField === field ? sortDir : null

  // Filter
  const q = (searchQuery || '').toLowerCase()
  let rows = downloads.filter(d =>
    !q || (d.title || '').toLowerCase().includes(q) || (d.filename || '').toLowerCase().includes(q) || (d.url || '').toLowerCase().includes(q)
  )

  // Sort
  const sorter = SORT_FIELDS[sortField]
  if (sorter) {
    rows = [...rows].sort((a, b) => sortDir === 'asc' ? sorter(a, b) : sorter(b, a))
  }

  // Checkbox handlers
  const handleCheck = useCallback((id, checked) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }, [])

  const allChecked = rows.length > 0 && rows.every(r => checkedIds.has(r.id))
  const someChecked = rows.some(r => checkedIds.has(r.id))

  const handleCheckAll = (checked) => {
    setCheckedIds(checked ? new Set(rows.map(r => r.id)) : new Set())
  }

  const ColHeader = ({ field, children, className }) => (
    <th
      className={`${styles.th} ${className || ''} ${sortField === field ? styles.thActive : ''}`}
      onClick={() => handleSort(field)}
      aria-sort={getDir(field) === 'asc' ? 'ascending' : getDir(field) === 'desc' ? 'descending' : 'none'}
    >
      {children}
    </th>
  )

  return (
    <div className={`${styles.tableWrap} mr-table-wrap`} role="region" aria-label="Download list">
      <table className={`${styles.table} mr-table`}>
        <thead className="mr-thead">
          <tr className={styles.headerRow}>
            {/* Combined checkbox + play/pause header */}
            <th className={`${styles.th} ${styles.thCheck}`}>
              <div className={styles.checkPlayCell}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                  onChange={e => handleCheckAll(e.target.checked)}
                  aria-label="Select all"
                  id="check-all"
                />
                {/* Play/pause header placeholder */}
                <span className={styles.headerPlayLabel}>▶</span>
              </div>
            </th>
            <ColHeader field="name" className={styles.thName}>Name</ColHeader>
            <ColHeader field="size" className={styles.thSize}>Size</ColHeader>
            <ColHeader field="status" className={styles.thStatus}>Status</ColHeader>
            <th className={`${styles.th} ${styles.thPct}`}>%</th>
            <th className={`${styles.th} ${styles.thSpeed}`}>Download</th>
            <ColHeader field="date" className={styles.thDate}>Added</ColHeader>
            <th className={`${styles.th} ${styles.thActions}`} />
          </tr>
        </thead>
        <tbody className="mr-tbody">
          {rows.map((entry) => (
            <DownloadRow
              key={entry.id}
              entry={entry}
              isSelected={selectedId === entry.id}
              isChecked={checkedIds.has(entry.id)}
              onSelect={onSelect}
              onCheck={handleCheck}
              onDelete={onDelete}
              onRefresh={onRefresh}
            />
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" opacity="0.25">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <p className={styles.emptyText}>
            {searchQuery ? 'No downloads match your search.' : 'No downloads yet - click Add Download to get started.'}
          </p>
        </div>
      )}
    </div>
  )
}

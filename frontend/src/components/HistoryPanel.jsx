/**
 * components/HistoryPanel.jsx
 * Slide-in drawer showing download history stored in localStorage.
 */

import { useEffect, useCallback } from 'react'
import styles from './HistoryPanel.module.css'
import { platformLabel, platformColor, relativeTime, truncate } from '../utils/format'

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
)
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

function HistoryItem({ entry, onRemove, onRedownload }) {
  const color = platformColor(entry.platform)
  return (
    <div className={styles.item}>
      {/* Thumbnail */}
      <div className={styles.thumbWrap}>
        {entry.thumbnail ? (
          <img
            src={entry.thumbnail}
            alt=""
            className={styles.thumb}
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className={styles.thumbFallback} style={{ background: color + '22' }} />
        )}
        <span className={styles.platformDot} style={{ background: color }} />
      </div>

      {/* Info */}
      <div className={styles.info}>
        <p className={styles.title} title={entry.title}>{truncate(entry.title, 55)}</p>
        <div className={styles.meta}>
          <span>{platformLabel(entry.platform)}</span>
          <span>·</span>
          <span>{entry.quality_label}</span>
          <span>·</span>
          <span>{entry.download_type}</span>
        </div>
        <p className={styles.time}>{relativeTime(entry.downloadedAt)}</p>
      </div>

      {/* Actions */}
      <div className={styles.itemActions}>
        <button
          className={styles.redownBtn}
          onClick={() => onRedownload(entry)}
          title="Re-download"
          aria-label={`Re-download ${entry.title}`}
        >
          <DownloadIcon />
        </button>
        <button
          className={styles.removeBtn}
          onClick={() => onRemove(entry.id)}
          title="Remove from history"
          aria-label={`Remove ${entry.title} from history`}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

export default function HistoryPanel({ isOpen, onClose, history, onRemove, onClearAll, onRedownload }) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
        aria-label="Download history"
        aria-hidden={!isOpen}
        role="complementary"
      >
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.heading}>History</h2>
            <p className={styles.subheading}>{history.length} download{history.length !== 1 ? 's' : ''}</p>
          </div>
          <div className={styles.headerActions}>
            {history.length > 0 && (
              <button
                className={styles.clearBtn}
                onClick={onClearAll}
                aria-label="Clear all history"
                id="history-clear-btn"
              >
                Clear All
              </button>
            )}
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close history panel"
              id="history-close-btn"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {history.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>No downloads yet</p>
              <p className={styles.emptySub}>Your download history will appear here.</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {history.map(entry => (
                <li key={entry.id}>
                  <HistoryItem
                    entry={entry}
                    onRemove={onRemove}
                    onRedownload={onRedownload}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}

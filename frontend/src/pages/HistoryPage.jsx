/**
 * pages/HistoryPage.jsx
 * Download history as a full page, not a panel/drawer.
 */

import { useCallback } from 'react'
import styles from './HistoryPage.module.css'
import { platformLabel, platformColor, relativeTime, truncate } from '../utils/format'

/* ── Icons ── */
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
)

const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15 15"/>
  </svg>
)

const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15 15"/>
  </svg>
)

function HistoryItem({ entry, onRemove }) {
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
        <span
          className={styles.platformDot}
          style={{ background: color }}
          title={platformLabel(entry.platform)}
        />
      </div>

      {/* Info */}
      <div className={styles.info}>
        <p className={styles.itemTitle} title={entry.title}>
          {truncate(entry.title, 70)}
        </p>
        <div className={styles.meta}>
          <span className={styles.metaBadge} style={{ borderColor: color + '44', color: color }}>
            {platformLabel(entry.platform)}
          </span>
          <span className={styles.metaChip}>{entry.quality_label}</span>
          <span className={styles.metaChip}>{entry.download_type}</span>
        </div>
        <div className={styles.time}>
          <ClockIcon />
          {relativeTime(entry.downloadedAt)}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.itemActions}>
        {entry.webpage_url && (
          <a
            href={entry.webpage_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.iconBtn}
            title="Open original link"
            aria-label={`Open original link for ${entry.title}`}
          >
            <ExternalLinkIcon />
          </a>
        )}
        <button
          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
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

export default function HistoryPage({ history, onRemove, onClearAll }) {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.heading} id="page-heading">Download History</h1>
          <p className={styles.subheading}>
            {history.length > 0
              ? `${history.length} download${history.length !== 1 ? 's' : ''} recorded`
              : 'Your completed downloads will appear here'}
          </p>
        </div>

        {history.length > 0 && (
          <button
            className={styles.clearAllBtn}
            onClick={onClearAll}
            aria-label="Clear all history"
            id="history-clear-all-btn"
          >
            <TrashIcon />
            Clear All
          </button>
        )}
      </header>

      {history.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <EmptyIcon />
          </div>
          <p className={styles.emptyTitle}>No downloads yet</p>
          <p className={styles.emptySub}>
            When you download media, it will appear here for easy reference.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {history.map(entry => (
            <li key={entry.id}>
              <HistoryItem entry={entry} onRemove={onRemove} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

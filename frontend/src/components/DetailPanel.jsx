/**
 * components/DetailPanel.jsx
 * Bottom panel showing details for the selected download row.
 * Tabs: General | Progress
 */

import { useState } from 'react'
import styles from './DetailPanel.module.css'

const TABS = ['General', 'Progress']

function fmtBytes(b) {
  if (!b) return '0 B'
  if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB'
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB'
  if (b >= 1e3) return (b / 1e3).toFixed(0) + ' KB'
  return b + ' B'
}

function fmtSpeed(bps) {
  if (!bps) return '0 B/s'
  if (bps >= 1e6) return (bps / 1e6).toFixed(2) + ' MB/s'
  if (bps >= 1e3) return (bps / 1e3).toFixed(1) + ' KB/s'
  return bps + ' B/s'
}

function fmtEta(sec) {
  if (!sec) return '—'
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec/60)}m ${sec%60}s`
  return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`
}

function MetaRow({ label, value }) {
  return (
    <div className={styles.metaRow}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue} title={value}>{value}</span>
    </div>
  )
}

function GeneralTab({ entry }) {
  return (
    <div className={`${styles.tabContent} mr-tab-content`}>
      <div className={styles.generalLeft}>
        {entry.thumbnail ? (
          <img className={styles.thumbnail} src={entry.thumbnail} alt="" />
        ) : (
          <div className={styles.thumbnailPlaceholder} />
        )}
      </div>
      <div className={styles.generalRight}>
        <div className={styles.entryTitle}>{entry.title || entry.filename || entry.url}</div>
        <div className={`${styles.metaGrid} mr-meta-grid`}>
          <MetaRow label="File"      value={entry.filename || '—'} />
          <MetaRow label="Platform"  value={entry.platform || '—'} />
          <MetaRow label="Type"      value={entry.download_type || '—'} />
          <MetaRow label="Quality"   value={entry.quality_label || '—'} />
          <MetaRow label="Downloaded" value={fmtBytes(entry.downloaded_bytes)} />
          <MetaRow label="Total size" value={fmtBytes(entry.total_bytes)} />
          <MetaRow label="Added"     value={entry.added_at || '—'} />
          <MetaRow label="Status"    value={entry.state || '—'} />
        </div>
        {entry.url && (
          <div className={styles.urlRow}>
            <span className={styles.metaLabel}>URL</span>
            <a className={styles.urlLink} href={entry.url} target="_blank" rel="noopener noreferrer">
              {entry.url}
            </a>
          </div>
        )}
        {entry.error && (
          <div className={styles.errorRow}>
            <span className={styles.errorIcon}>⚠</span>
            <span>{entry.error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Pixelated squares progress bar (FDM-style) */
function SquaresProgressBar({ percent }) {
  const TOTAL = 70
  const filled = Math.round((percent / 100) * TOTAL)
  return (
    <div className={styles.squaresGrid}>
      {Array.from({ length: TOTAL }).map((_, i) => (
        <div
          key={i}
          className={`${styles.square} ${i < filled ? styles.squareFilled : styles.squareEmpty}`}
        />
      ))}
    </div>
  )
}

function ProgressTab({ entry }) {
  const pct = entry.percent || 0
  return (
    <div className={styles.tabContent}>
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <span className={styles.progressPct}>{pct}%</span>
          <span className={styles.progressOf}>
            {fmtBytes(entry.downloaded_bytes)} of {fmtBytes(entry.total_bytes)}
          </span>
        </div>
        <SquaresProgressBar percent={pct} />
        <div className={styles.progressStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Speed</span>
            <span className={styles.statValue}>{fmtSpeed(entry.speed_bps)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>ETA</span>
            <span className={styles.statValue}>{fmtEta(entry.eta_seconds)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>State</span>
            <span className={styles.statValue}>{entry.state}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Started</span>
            <span className={styles.statValue}>{entry.started_at || '—'}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Completed</span>
            <span className={styles.statValue}>{entry.completed_at || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DetailPanel({ selectedEntry, onClose }) {
  const [activeTab, setActiveTab] = useState('General')

  if (!selectedEntry) {
    return (
      <div className={`${styles.panel} mr-detail-panel`}>
        <div className={`${styles.panelHeader} mr-panel-header`}>
          <div className={`${styles.tabs} mr-tabs`}>
            {TABS.map(t => (
              <button key={t} className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`} onClick={() => setActiveTab(t)} id={`detail-tab-${t.toLowerCase()}`}>{t}</button>
            ))}
          </div>
        </div>
        <div className={styles.empty}>Select a download to see details.</div>
      </div>
    )
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'General':  return <GeneralTab entry={selectedEntry} />
      case 'Progress': return <ProgressTab entry={selectedEntry} />
      default: return null
    }
  }

  return (
    <div className={`${styles.panel} mr-detail-panel`}>
      <div className={`${styles.panelHeader} mr-panel-header`}>
        <div className={`${styles.tabs} mr-tabs`}>
          {TABS.map(t => (
            <button
              key={t}
              className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t)}
              id={`detail-tab-${t.toLowerCase()}`}
            >
              {t}
            </button>
          ))}
        </div>
        {onClose && (
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close detail panel" id="detail-close">✕</button>
        )}
      </div>
      <div className={`${styles.panelBody} mr-panel-body`}>
        {renderTab()}
      </div>
    </div>
  )
}

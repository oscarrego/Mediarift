/**
 * components/ToolBar.jsx
 * Filter tabs (All / Downloading / Completed / Stopped) + active count badge.
 */

import styles from './ToolBar.module.css'

const TABS = [
  { id: 'all',          label: 'All Downloads' },
  { id: 'downloading',  label: 'Downloading'   },
  { id: 'completed',    label: 'Completed'      },
  { id: 'stopped',      label: 'Stopped'        },
]

function countByState(downloads) {
  const c = { all: downloads.length, downloading: 0, completed: 0, stopped: 0 }
  for (const d of downloads) {
    if (d.state === 'downloading' || d.state === 'paused' || d.state === 'queued' || d.state === 'fetching') c.downloading++
    else if (d.state === 'completed') c.completed++
    else if (d.state === 'stopped' || d.state === 'error') c.stopped++
  }
  return c
}

export default function ToolBar({ activeFilter, onFilter, downloads }) {
  const counts = countByState(downloads)

  return (
    <div className={`${styles.toolbar} mr-toolbar`} role="navigation" aria-label="Download filters">
      <div className={`${styles.tabs} mr-tabs`}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeFilter === t.id ? styles.tabActive : ''} mr-tab`}
            onClick={() => onFilter(t.id)}
            id={`filter-tab-${t.id}`}
            aria-current={activeFilter === t.id ? 'page' : undefined}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span className={`${styles.badge} ${activeFilter === t.id ? styles.badgeActive : ''}`}>
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * components/DownloadProgress.jsx
 * Animated progress indicator.
 */

import styles from './DownloadProgress.module.css'

const STAGES = [
  { key: 'preparing',   label: 'Preparing',          percent: 5  },
  { key: 'fetching',    label: 'Fetching Metadata',   percent: 20 },
  { key: 'downloading', label: 'Downloading',         percent: 55 },
  { key: 'merging',     label: 'Merging',             percent: 80 },
  { key: 'finalizing',  label: 'Finalizing',          percent: 92 },
  { key: 'completed',   label: 'Completed',           percent: 100 },
]

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

function getStageInfo(stage) {
  return STAGES.find(s => s.key === stage) ?? STAGES[0]
}

export default function DownloadProgress({ stage, percent }) {
  const stageInfo = getStageInfo(stage)
  const displayPercent = percent ?? stageInfo.percent
  const isCompleted = stage === 'completed'

  return (
    <div
      className={`${styles.wrapper} ${isCompleted ? styles.completed : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`${stageInfo.label} — ${displayPercent}%`}
    >
      {/* Status icon */}
      <div className={styles.iconWrap}>
        {isCompleted ? (
          <span className={styles.checkIcon}><CheckIcon /></span>
        ) : (
          <span className={styles.spinner} aria-hidden="true" />
        )}
      </div>

      {/* Labels + bar */}
      <div className={styles.main}>
        <div className={styles.labelRow}>
          <span className={styles.stageLabel}>{stageInfo.label}</span>
          <span className={styles.percentLabel}>{displayPercent}%</span>
        </div>

        <div
          className={styles.barTrack}
          role="progressbar"
          aria-valuenow={displayPercent}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            className={`${styles.barFill} ${isCompleted ? styles.barCompleted : ''}`}
            style={{ width: `${displayPercent}%` }}
          />
        </div>

        {/* Stage dots */}
        <div className={styles.dots} aria-hidden="true">
          {STAGES.filter(s => s.key !== 'fetching').map((s) => {
            const currentIdx = STAGES.findIndex(x => x.key === stage)
            const myIdx = STAGES.findIndex(x => x.key === s.key)
            const done = myIdx <= currentIdx
            return (
              <span
                key={s.key}
                className={`${styles.dot} ${done ? styles.dotActive : ''}`}
                title={s.label}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

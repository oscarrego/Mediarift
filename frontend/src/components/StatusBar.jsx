/**
 * components/StatusBar.jsx
 * Bottom status bar: snail toggle (ON/OFF), global speed readout, speed preset pills.
 */

import styles from './StatusBar.module.css'

function fmtSpeed(bps) {
  if (!bps || bps < 10) return '0 B/s'
  if (bps >= 1e6) return (bps / 1e6).toFixed(2) + ' MB/s'
  if (bps >= 1e3) return (bps / 1e3).toFixed(1) + ' KB/s'
  return bps + ' B/s'
}

/* Better snail SVG — clean, recognisable */
const SnailIcon = ({ active }) => (
  <svg
    width="17" height="17"
    viewBox="0 0 100 70"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Shell spiral */}
    <circle cx="62" cy="38" r="24" strokeWidth="5.5"/>
    <circle cx="62" cy="38" r="13" strokeWidth="4"/>
    <circle cx="62" cy="38" r="4"  fill="currentColor" stroke="none"/>
    {/* Body/foot */}
    <path d="M38 50 Q20 50 14 58 Q8 66 20 66 L74 66" strokeWidth="5.5"/>
    {/* Neck */}
    <path d="M40 50 Q36 36 44 30" strokeWidth="5"/>
    {/* Head */}
    <circle cx="45" cy="25" r="7" strokeWidth="4.5"/>
    {/* Left antenna */}
    <line x1="41" y1="20" x2="35" y2="10" strokeWidth="3"/>
    <circle cx="34" cy="8" r="3" fill="currentColor" stroke="none"/>
    {/* Right antenna */}
    <line x1="49" y1="19" x2="54" y2="9" strokeWidth="3"/>
    <circle cx="55" cy="7" r="3" fill="currentColor" stroke="none"/>
    {/* Speed lines (only when active/slow) */}
    {active && <>
      <line x1="4" y1="36" x2="18" y2="36" strokeWidth="3" opacity="0.5"/>
      <line x1="2" y1="46" x2="14" y2="46" strokeWidth="3" opacity="0.35"/>
    </>}
  </svg>
)

const PRESETS = [
  { key: 'low',    label: 'LOW' },
  { key: 'medium', label: 'MED' },
  { key: 'high',   label: 'HIGH' },
]

export default function StatusBar({ downloads, settings, onSettingsChange }) {
  const snailOn = settings?.snail_mode ?? false
  const activePreset = settings?.speed_preset ?? 'high'

  const totalSpeedBps = downloads
    .filter(d => d.state === 'downloading')
    .reduce((sum, d) => sum + (d.speed_bps || 0), 0)

  const activeCount = downloads.filter(d => d.state === 'downloading').length
  const totalCount = downloads.length

  const toggleSnail = () => onSettingsChange({ snail_mode: !snailOn })

  const setPreset = (key) =>
    onSettingsChange({
      speed_preset: key,
      snail_mode: false,
      speed_limit_kbps: 0,
      max_concurrent_downloads: settings?.[`preset_${key}_max_downloads`] !== undefined
        ? settings[`preset_${key}_max_downloads`]
        : (key === 'low' ? 2 : key === 'medium' ? 3 : key === 'high' ? 4 : 3)
    })

  return (
    <div className={`${styles.statusbar} mr-statusbar`} role="status" aria-label="Download status">
      {/* Left: snail toggle */}
      <div className={`${styles.left} mr-sb-left`}>
        <button
          className={`${styles.snailBtn} ${snailOn ? styles.snailOn : ''}`}
          onClick={toggleSnail}
          title={snailOn ? 'Snail mode ON — click to disable' : 'Snail mode OFF — click to enable slow mode'}
          id="statusbar-snail"
          aria-pressed={snailOn}
        >
          <SnailIcon active={snailOn} />
          {/* ON / OFF indicator */}
          <span className={`${styles.snailState} ${snailOn ? styles.snailStateOn : styles.snailStateOff}`}>
            {snailOn ? 'ON' : 'OFF'}
          </span>
        </button>

        <div className={styles.divider} />

        <span className={styles.downloadCount}>
          {activeCount > 0 ? `${activeCount} active` : 'idle'}
          {totalCount > 0 && ` · ${totalCount} total`}
        </span>
      </div>

      {/* Centre: speed display */}
      <div className={`${styles.centre} mr-sb-centre`}>
        <span className={styles.speedArrow}>↓</span>
        <span className={styles.speedValue}>{fmtSpeed(totalSpeedBps)}</span>
        {snailOn && <span className={styles.snailBadge}>SNAIL MODE</span>}
      </div>

      {/* Right: speed preset shortcuts */}
      <div className={`${styles.right} mr-sb-right`}>
        {PRESETS.map(p => (
          <button
            key={p.key}
            className={`${styles.presetPill} ${activePreset === p.key && !snailOn ? styles.presetActive : ''}`}
            onClick={() => setPreset(p.key)}
            title={`Set speed to ${p.label}`}
            id={`statusbar-preset-${p.key}`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

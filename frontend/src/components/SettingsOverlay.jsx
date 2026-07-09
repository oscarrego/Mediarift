/**
 * components/SettingsOverlay.jsx
 * Full-screen preferences panel.
 * Sections: General | Network | Traffic Limits | Advanced
 */

import { useState, useRef } from 'react'
import styles from './SettingsOverlay.module.css'

const NAV_SECTIONS = [
  { id: 'general',        label: 'General' },
  { id: 'network',        label: 'Network' },
  { id: 'traffic',        label: 'Traffic Limits' },
  { id: 'advanced',       label: 'Advanced' },
]

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const FolderIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

/* ── Checkbox row ── */
function CheckRow({ id, checked, onChange, label, desc }) {
  return (
    <label className={styles.checkRow} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className={styles.checkInfo}>
        <span className={styles.checkLabel}>{label}</span>
        {desc && <span className={styles.checkDesc}>{desc}</span>}
      </span>
    </label>
  )
}

/* ── GENERAL ── */
function GeneralSection({ settings, onSettingsChange, fontSize, onFontSizeChange }) {
  const folderInputRef = useRef(null)

  const handleBrowse = () => {
    // Fallback to text input since showDirectoryPicker isn't universally supported
    if (window.showDirectoryPicker) {
      window.showDirectoryPicker().then(handle => {
        onSettingsChange({ download_folder: handle.name })
      }).catch(() => {})
    } else {
      folderInputRef.current?.click()
    }
  }

  return (
    <div className={styles.section} aria-labelledby="sec-general">
      <h2 className={styles.sectionTitle} id="sec-general">General</h2>

      {/* Launch at startup */}
      <CheckRow
        id="prefs-startup"
        checked={settings?.launch_at_startup ?? false}
        onChange={v => onSettingsChange({ launch_at_startup: v })}
        label="Launch at startup (minimized)"
      />

      {/* Default download folder */}
      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Default download folder</h3>
        <div className={styles.folderRow}>
          <input
            className={styles.folderInput}
            type="text"
            placeholder="Leave blank to use system Downloads"
            value={settings?.download_folder ?? ''}
            onChange={e => onSettingsChange({ download_folder: e.target.value })}
            id="prefs-folder-path"
          />
          <button className={styles.folderBtn} onClick={handleBrowse} title="Browse" id="prefs-folder-browse">
            <FolderIcon />
          </button>
          {/* Hidden file input as fallback */}
          <input
            ref={folderInputRef}
            type="file"
            style={{ display: 'none' }}
            webkitdirectory=""
            onChange={e => {
              const path = e.target.files?.[0]?.webkitRelativePath?.split('/')[0]
              if (path) onSettingsChange({ download_folder: path })
            }}
          />
        </div>
      </div>

      {/* Downloads section */}
      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Downloads</h3>
        <div className={styles.checkList}>
          <CheckRow
            id="prefs-auto-remove-deleted"
            checked={settings?.auto_remove_deleted ?? true}
            onChange={v => onSettingsChange({ auto_remove_deleted: v })}
            label="Automatically remove deleted files from download list"
          />
          <CheckRow
            id="prefs-auto-remove-completed"
            checked={settings?.auto_remove_completed ?? false}
            onChange={v => onSettingsChange({ auto_remove_completed: v })}
            label="Automatically remove completed downloads from download list"
          />
          <CheckRow
            id="prefs-auto-retry"
            checked={settings?.auto_retry_failed ?? false}
            onChange={v => onSettingsChange({ auto_retry_failed: v })}
            label="Automatically retry failed downloads"
          />
        </div>
      </div>
    </div>
  )
}

/* ── NETWORK ── */
function NetworkSection({ settings, onSettingsChange }) {
  return (
    <div className={styles.section} aria-labelledby="sec-network">
      <h2 className={styles.sectionTitle} id="sec-network">Network</h2>

      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Proxy</h3>
        <div className={styles.infoCard}>
          <p>Proxy settings can be configured in your system network settings or via the <code>.env</code> file in the backend directory using <code>HTTP_PROXY</code> and <code>HTTPS_PROXY</code> environment variables.</p>
        </div>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Snail Mode Speed</h3>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <span className={styles.rowLabel}>Speed when snail mode is active</span>
          </div>
          <div className={styles.numGroup}>
            <input
              className={styles.numInput}
              type="number"
              min="1"
              max="10240"
              value={settings?.snail_speed_kbps ?? 50}
              onChange={e => onSettingsChange({ snail_speed_kbps: parseInt(e.target.value) || 50 })}
              id="prefs-snail-speed"
            />
            <span className={styles.numUnit}>KB/s</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── TRAFFIC LIMITS ── */
function TrafficSection({ settings, onSettingsChange }) {
  const customLimitEnabled = (settings?.speed_limit_kbps ?? 0) > 0

  return (
    <div className={styles.section} aria-labelledby="sec-traffic">
      <h2 className={styles.sectionTitle} id="sec-traffic">Traffic Limits</h2>

      {/* Download speed preset table — FDM style */}
      <div className={styles.block}>
        <div className={styles.trafficTable}>
          {/* Header row */}
          <div className={styles.trafficHeaderRow}>
            <div className={styles.trafficLabel} />
            <div className={styles.trafficCol}>
              <span className={`${styles.colHead} ${settings?.speed_preset === 'low' && !customLimitEnabled ? styles.colHeadActive : ''}`}>Low</span>
            </div>
            <div className={styles.trafficCol}>
              <span className={`${styles.colHead} ${settings?.speed_preset === 'medium' && !customLimitEnabled ? styles.colHeadActive : ''}`}>Medium</span>
            </div>
            <div className={styles.trafficCol}>
              <span className={`${styles.colHead} ${settings?.speed_preset === 'high' && !customLimitEnabled ? styles.colHeadActive : ''}`}>High</span>
            </div>
            <div className={styles.trafficCol}>
              <span className={`${styles.colHead} ${settings?.speed_preset === 'max' && !customLimitEnabled ? styles.colHeadActive : ''}`}>Max</span>
            </div>
          </div>

          {/* Download speed row */}
          <div className={styles.trafficRow}>
            <div className={styles.trafficLabel}>Download speed</div>
            {['low','medium','high','max'].map(k => (
              <button
                key={k}
                className={`${styles.presetCell} ${settings?.speed_preset === k && !customLimitEnabled ? styles.presetCellActive : ''}`}
                onClick={() => onSettingsChange({ speed_preset: k, speed_limit_kbps: 0 })}
                id={`traffic-preset-${k}`}
              >
                {k === 'low' ? '256 KB/s' : k === 'medium' ? '2 MB/s' : 'Unlimited'}
              </button>
            ))}
          </div>

          {/* Max simultaneous connections */}
          <div className={styles.trafficRow}>
            <div className={styles.trafficLabel}>Max simultaneous connections</div>
            {['15','50','200','200'].map((v, i) => (
              <div key={i} className={styles.trafficStaticCell}>{v}</div>
            ))}
          </div>

          {/* Max connections per server */}
          <div className={styles.trafficRow}>
            <div className={styles.trafficLabel}>Max connections per server</div>
            {['5','8','15','15'].map((v, i) => (
              <div key={i} className={styles.trafficStaticCell}>{v}</div>
            ))}
          </div>

          {/* Max simultaneous downloads */}
          <div className={styles.trafficRow}>
            <div className={styles.trafficLabel}>Max simultaneous downloads</div>
            {['2','3','4','Unlimited'].map((v, i) => (
              <div key={i} className={styles.trafficStaticCell}>{v}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom speed limit */}
      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Custom Speed Limit</h3>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <span className={styles.rowLabel}>Custom KB/s (overrides preset above)</span>
            <span className={styles.rowDesc}>Set to 0 to use the preset</span>
          </div>
          <div className={styles.numGroup}>
            <input
              className={styles.numInput}
              type="number"
              min="0"
              max="999999"
              step="64"
              value={settings?.speed_limit_kbps ?? 0}
              onChange={e => {
                const n = parseInt(e.target.value) || 0
                onSettingsChange({ speed_limit_kbps: n, speed_preset: n > 0 ? 'custom' : (settings?.speed_preset || 'high') })
              }}
              id="prefs-custom-limit"
            />
            <span className={styles.numUnit}>KB/s</span>
          </div>
        </div>
      </div>

      {/* Max concurrent downloads */}
      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Concurrency</h3>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <span className={styles.rowLabel}>Maximum number of simultaneous downloads</span>
          </div>
          <div className={styles.numGroup}>
            <input
              className={styles.numInput}
              type="number"
              min="1"
              max="10"
              value={settings?.max_concurrent_downloads ?? 3}
              onChange={e => onSettingsChange({ max_concurrent_downloads: parseInt(e.target.value) || 1 })}
              id="prefs-max-concurrent"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── ADVANCED ── */
function AdvancedSection() {
  return (
    <div className={styles.section} aria-labelledby="sec-advanced">
      <h2 className={styles.sectionTitle} id="sec-advanced">Advanced</h2>
      <div className={styles.infoCard}>
        <p>Advanced settings are configured via the <code>.env</code> file in the backend directory.
        Options include FFmpeg path, proxy settings, and cookie files for authenticated downloads.</p>
        <br />
        <p>Restart the backend server after modifying <code>.env</code> for changes to take effect.</p>
      </div>
    </div>
  )
}

/* ── ROOT ── */
export default function SettingsOverlay({ settings, onSettingsChange, fontSize, onFontSizeChange, onClose, inPanel }) {
  const [activeSection, setActiveSection] = useState('general')

  const renderSection = () => {
    switch (activeSection) {
      case 'general':  return <GeneralSection  settings={settings} onSettingsChange={onSettingsChange} fontSize={fontSize} onFontSizeChange={onFontSizeChange} />
      case 'network':  return <NetworkSection  settings={settings} onSettingsChange={onSettingsChange} />
      case 'traffic':  return <TrafficSection  settings={settings} onSettingsChange={onSettingsChange} />
      case 'advanced': return <AdvancedSection />
      default: return null
    }
  }

  // ── Embedded in-panel mode ───────────────────────────────────────────────
  if (inPanel) {
    return (
      <div className={styles.inPanelWrap}>
        {/* Compact vertical nav */}
        <nav className={styles.inPanelNav} aria-label="Preference sections">
          {NAV_SECTIONS.map(s => (
            <button
              key={s.id}
              className={`${styles.inPanelNavItem} ${activeSection === s.id ? styles.inPanelNavItemActive : ''}`}
              onClick={() => setActiveSection(s.id)}
              id={`prefs-panel-nav-${s.id}`}
              aria-current={activeSection === s.id ? 'page' : undefined}
            >
              {s.label}
            </button>
          ))}
        </nav>
        {/* Scrollable content */}
        <div className={styles.inPanelContent}>
          {renderSection()}
        </div>
      </div>
    )
  }

  // ── Full-screen overlay mode (default) ───────────────────────────────────
  return (
    <div className={styles.overlay} role="dialog" aria-label="Preferences" aria-modal="true">
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.panelHeader}>
          <button className={styles.backBtn} onClick={onClose} id="prefs-back-btn" aria-label="Close Preferences">
            <BackIcon />
            <span>Back</span>
          </button>
          <span className={styles.panelTitle}>Preferences</span>
        </div>

        <div className={styles.panelBody}>
          {/* Left nav */}
          <nav className={styles.sideNav} aria-label="Preference sections">
            {NAV_SECTIONS.map(s => (
              <button
                key={s.id}
                className={`${styles.navItem} ${activeSection === s.id ? styles.navItemActive : ''}`}
                onClick={() => setActiveSection(s.id)}
                id={`prefs-nav-${s.id}`}
                aria-current={activeSection === s.id ? 'page' : undefined}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <main className={styles.content} id="prefs-content">
            {renderSection()}
          </main>
        </div>
      </div>
    </div>
  )
}

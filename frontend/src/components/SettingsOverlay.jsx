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
  { id: 'compression',    label: 'Compression' },
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
        <h3 className={styles.blockLabel}>Downloads & Subtitles</h3>
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
          
          <div className={styles.inlineFieldRow}>
            <label htmlFor="prefs-max-retries" className={styles.inlineFieldLabel}>Max retries:</label>
            <input
              id="prefs-max-retries"
              className={styles.numInputSmall}
              type="number"
              min="0"
              max="10"
              value={settings?.max_retries ?? 3}
              onChange={e => onSettingsChange({ max_retries: parseInt(e.target.value) || 0 })}
            />
          </div>

          <CheckRow
            id="prefs-auto-download-subs"
            checked={settings?.auto_download_subtitles ?? false}
            onChange={v => onSettingsChange({ auto_download_subtitles: v })}
            label="Auto-download subtitles"
          />

          {settings?.auto_download_subtitles && (
            <div className={styles.subFieldsBlock}>
              <div className={styles.inlineFieldRow}>
                <label htmlFor="prefs-sub-format" className={styles.inlineFieldLabel}>Subtitle Format:</label>
                <select
                  id="prefs-sub-format"
                  className={styles.selectInputSmall}
                  value={settings?.subtitle_format ?? 'srt'}
                  onChange={e => onSettingsChange({ subtitle_format: e.target.value })}
                >
                  <option value="srt">SRT</option>
                  <option value="vtt">VTT</option>
                  <option value="ass">ASS</option>
                </select>
              </div>

              <div className={styles.inlineFieldRow}>
                <label htmlFor="prefs-sub-langs" className={styles.inlineFieldLabel}>Subtitle Languages (comma-separated):</label>
                <input
                  id="prefs-sub-langs"
                  className={styles.textInputSmall}
                  type="text"
                  placeholder="en,es"
                  value={settings?.subtitle_languages ?? 'en'}
                  onChange={e => onSettingsChange({ subtitle_languages: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clipboard Monitoring section */}
      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Clipboard Monitoring</h3>
        <div className={styles.checkList}>
          <CheckRow
            id="prefs-enable-clipboard"
            checked={settings?.enable_clipboard_monitoring ?? true}
            onChange={v => onSettingsChange({ enable_clipboard_monitoring: v })}
            label="Enable clipboard monitoring"
            desc="Automatically check the clipboard for valid media links to download."
          />

          {settings?.enable_clipboard_monitoring && (
            <div className={styles.inlineFieldRow}>
              <label htmlFor="prefs-clipboard-interval" className={styles.inlineFieldLabel}>Check interval (seconds):</label>
              <input
                id="prefs-clipboard-interval"
                className={styles.numInputSmall}
                type="number"
                min="1"
                max="60"
                value={settings?.clipboard_monitoring_interval ?? 2}
                onChange={e => onSettingsChange({ clipboard_monitoring_interval: parseInt(e.target.value) || 2 })}
              />
            </div>
          )}
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

/* Helper component for editable cells in Traffic Limits table */
function TableCellInput({ value, onChange, isSpeed = false, isDownloads = false, isActive }) {
  const [focused, setFocused] = useState(false)
  const [tempValue, setTempValue] = useState(null)

  let formattedDisplay = ''
  if (value === 0 && (isSpeed || isDownloads)) {
    formattedDisplay = 'Unlimited'
  } else if (isSpeed) {
    if (value >= 1024 && value % 1024 === 0) {
      formattedDisplay = `${value / 1024} MB/s`
    } else {
      formattedDisplay = `${value} KB/s`
    }
  } else {
    formattedDisplay = value.toString()
  }

  const displayValue = focused 
    ? (tempValue !== null ? tempValue : (value === 0 && (isSpeed || isDownloads) ? '' : value.toString()))
    : formattedDisplay

  return (
    <input
      type="text"
      className={`${styles.cellInput} ${isActive ? styles.cellInputActive : ''}`}
      value={displayValue}
      onFocus={() => {
        setFocused(true)
        setTempValue(value === 0 && (isSpeed || isDownloads) ? '' : value.toString())
      }}
      onChange={e => {
        const val = e.target.value
        if (/^\d*$/.test(val)) {
          setTempValue(val)
        }
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = parseInt(tempValue) || 0
        onChange(parsed)
        setTempValue(null)
      }}
    />
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
            {['low','medium','high','max'].map(k => {
              const active = settings?.speed_preset === k && !customLimitEnabled;
              return (
                <div key={k} className={styles.trafficCol}>
                  <button
                    className={`${styles.colHeadBtn} ${active ? styles.colHeadActive : ''}`}
                    onClick={() => onSettingsChange({
                      speed_preset: k,
                      speed_limit_kbps: 0,
                      max_concurrent_downloads: settings?.[`preset_${k}_max_downloads`] !== undefined
                        ? settings[`preset_${k}_max_downloads`]
                        : (k === 'low' ? 2 : k === 'medium' ? 3 : k === 'high' ? 4 : 3)
                    })}
                  >
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Download speed row */}
          <div className={styles.trafficRow}>
            <div className={styles.trafficLabel}>Download speed</div>
            {['low','medium','high','max'].map(k => {
              const active = settings?.speed_preset === k && !customLimitEnabled;
              return (
                <div key={k} className={styles.trafficCell}>
                  <TableCellInput
                    value={settings?.[`preset_${k}_speed_kbps`] ?? (k === 'low' ? 256 : k === 'medium' ? 2048 : 0)}
                    onChange={v => onSettingsChange({ [`preset_${k}_speed_kbps`]: v })}
                    isSpeed={true}
                    isActive={active}
                  />
                </div>
              );
            })}
          </div>

          {/* Max simultaneous connections */}
          <div className={styles.trafficRow}>
            <div className={styles.trafficLabel}>Max simultaneous connections</div>
            {['low','medium','high','max'].map(k => {
              const active = settings?.speed_preset === k && !customLimitEnabled;
              return (
                <div key={k} className={styles.trafficCell}>
                  <TableCellInput
                    value={settings?.[`preset_${k}_max_conn`] ?? (k === 'low' ? 15 : k === 'medium' ? 50 : 200)}
                    onChange={v => onSettingsChange({ [`preset_${k}_max_conn`]: v })}
                    isActive={active}
                  />
                </div>
              );
            })}
          </div>

          {/* Max connections per server */}
          <div className={styles.trafficRow}>
            <div className={styles.trafficLabel}>Max connections per server</div>
            {['low','medium','high','max'].map(k => {
              const active = settings?.speed_preset === k && !customLimitEnabled;
              return (
                <div key={k} className={styles.trafficCell}>
                  <TableCellInput
                    value={settings?.[`preset_${k}_server_conn`] ?? (k === 'low' ? 5 : k === 'medium' ? 8 : 15)}
                    onChange={v => onSettingsChange({ [`preset_${k}_server_conn`]: v })}
                    isActive={active}
                  />
                </div>
              );
            })}
          </div>

          {/* Max simultaneous downloads */}
          <div className={styles.trafficRow}>
            <div className={styles.trafficLabel}>Max simultaneous downloads</div>
            {['low','medium','high','max'].map(k => {
              const active = settings?.speed_preset === k && !customLimitEnabled;
              return (
                <div key={k} className={styles.trafficCell}>
                  <TableCellInput
                    value={settings?.[`preset_${k}_max_downloads`] ?? (k === 'low' ? 2 : k === 'medium' ? 3 : k === 'high' ? 4 : 0)}
                    onChange={v => {
                      onSettingsChange({ [`preset_${k}_max_downloads`]: v });
                      if (active) {
                        onSettingsChange({ max_concurrent_downloads: v });
                      }
                    }}
                    isDownloads={true}
                    isActive={active}
                  />
                </div>
              );
            })}
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

/* ── COMPRESSION ── */
function CompressionSection({ settings, onSettingsChange }) {
  return (
    <div className={styles.section} aria-labelledby="sec-compression">
      <h2 className={styles.sectionTitle} id="sec-compression">Compression</h2>
      
      {/* Preferred GPU Encoder */}
      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Preferred GPU Encoder</h3>
        <select
          className={styles.selectInput}
          value={settings?.preferred_gpu_encoder ?? 'auto'}
          onChange={e => onSettingsChange({ preferred_gpu_encoder: e.target.value })}
          id="prefs-gpu-encoder"
        >
          <option value="auto">Auto (Best Available)</option>
          <option value="cpu">CPU (None)</option>
          <option value="nvenc">NVIDIA NVENC</option>
          <option value="qsv">Intel Quick Sync (QSV)</option>
          <option value="amf">AMD AMF</option>
        </select>
      </div>

      {/* Compression Preset */}
      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Compression Preset</h3>
        <select
          className={styles.selectInput}
          value={settings?.compression_preset ?? 'balanced'}
          onChange={e => onSettingsChange({ compression_preset: e.target.value })}
          id="prefs-compress-preset"
        >
          <option value="fast">Fast (Lower Compression)</option>
          <option value="balanced">Balanced (Recommended)</option>
          <option value="max_compression">Maximum Compression (Slowest)</option>
          <option value="archival_quality">Archival Quality (Large File)</option>
        </select>
      </div>

      {/* Preferred Video Codec */}
      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Preferred Video Codec</h3>
        <select
          className={styles.selectInput}
          value={settings?.preferred_video_codec ?? 'h264'}
          onChange={e => onSettingsChange({ preferred_video_codec: e.target.value })}
          id="prefs-video-codec"
        >
          <option value="h264">H.264 (Most Compatible)</option>
          <option value="h265">H.265 / HEVC</option>
          <option value="vp9">VP9 (Google/WebM)</option>
          <option value="av1">AV1 (Next-Gen Open Format)</option>
        </select>
      </div>

      {/* Preferred Audio Codec */}
      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Preferred Audio Codec</h3>
        <select
          className={styles.selectInput}
          value={settings?.preferred_audio_codec ?? 'aac'}
          onChange={e => onSettingsChange({ preferred_audio_codec: e.target.value })}
          id="prefs-audio-codec"
        >
          <option value="aac">AAC (Advanced Audio Coding)</option>
          <option value="mp3">MP3 (MPEG Audio Layer 3)</option>
          <option value="opus">Opus (High Performance)</option>
          <option value="flac">FLAC (Lossless)</option>
        </select>
      </div>

      {/* Audio Quality */}
      <div className={styles.block}>
        <h3 className={styles.blockLabel}>Audio Quality</h3>
        <select
          className={styles.selectInput}
          value={settings?.audio_quality ?? 'high'}
          onChange={e => onSettingsChange({ audio_quality: e.target.value })}
          id="prefs-audio-quality"
        >
          <option value="low">Low (VBR Joint Stereo, 96 kbps)</option>
          <option value="medium">Medium (VBR Joint Stereo, 128 kbps)</option>
          <option value="high">High (Psychoacoustic, 192+ kbps)</option>
        </select>
      </div>

      {/* Max Quality Algorithms Checkbox */}
      <CheckRow
        id="prefs-use-max-quality"
        checked={settings?.use_max_quality_algorithms ?? false}
        onChange={v => onSettingsChange({ use_max_quality_algorithms: v })}
        label="Use maximum-quality algorithms"
        desc="Enables optimal Huffman tables, 4:4:4 color subsampling, and maximum encoder effort."
      />
    </div>
  )
}

/* ── ROOT ── */
export default function SettingsOverlay({ settings, onSettingsChange, fontSize, onFontSizeChange, onClose, inPanel }) {
  const [activeSection, setActiveSection] = useState('general')

  const renderSection = () => {
    switch (activeSection) {
      case 'general':     return <GeneralSection  settings={settings} onSettingsChange={onSettingsChange} fontSize={fontSize} onFontSizeChange={onFontSizeChange} />
      case 'network':     return <NetworkSection  settings={settings} onSettingsChange={onSettingsChange} />
      case 'traffic':     return <TrafficSection  settings={settings} onSettingsChange={onSettingsChange} />
      case 'compression': return <CompressionSection settings={settings} onSettingsChange={onSettingsChange} />
      case 'advanced':    return <AdvancedSection />
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

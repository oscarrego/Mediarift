/**
 * components/MediaFetcher.jsx
 * Full-screen media extractor window.
 * Pastes a URL → backend scrapes page → displays images/GIFs/SVGs/videos/audio.
 * Filter by type, select items, download selected.
 */

import { useState, useCallback, useRef } from 'react'
import styles from './MediaFetcher.module.css'
import detailStyles from './DetailPanel.module.css'
import { fetchPageMedia } from '../services/api'

// ── Icons ────────────────────────────────────────────────────────────────────

const BackArrowIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)


const FetchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const LinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)

const ImageIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const VideoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18"/>
    <line x1="10" y1="15" x2="10" y2="9"/>
    <line x1="14" y1="15" x2="14" y2="9"/>
  </svg>
)

const AudioIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
)

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_GROUPS = {
  image: { label: 'Images',  color: '#6c3fff', bg: 'rgba(108,63,255,0.12)' },
  gif:   { label: 'GIFs',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  svg:   { label: 'SVGs',    color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ico:   { label: 'ICOs',    color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  video: { label: 'Videos',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  audio: { label: 'Audio',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '–'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function TypeBadge({ type }) {
  const info = TYPE_GROUPS[type] || { label: type?.toUpperCase() || 'FILE', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' }
  return (
    <span className={styles.typeBadge} style={{ color: info.color, backgroundColor: info.bg }}>
      {info.label}
    </span>
  )
}

function MediaCardSkeleton() {
  return (
    <div className={styles.cardSkeleton}>
      <div className={styles.skeletonThumb} />
      <div className={styles.skeletonMeta}>
        <div className={styles.skeletonLine} style={{ width: '60%' }} />
        <div className={styles.skeletonLine} style={{ width: '40%' }} />
      </div>
    </div>
  )
}

function MediaCard({ item, selected, onToggle }) {
  const [imgError, setImgError] = useState(false)
  const isImage = item.type === 'image' || item.type === 'gif' || item.type === 'svg' || item.type === 'ico'
  const isVideo = item.type === 'video'
  const isAudio = item.type === 'audio'

  function handleDownload(e) {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = item.url
    a.download = item.filename || 'media'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function handleCopyLink(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(item.url).catch(() => {})
  }

  return (
    <div
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onToggle()}
    >
      {/* Selection checkbox */}
      <div className={`${styles.checkMark} ${selected ? styles.checkMarkActive : ''}`}>
        {selected && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>

      {/* Thumbnail */}
      <div className={styles.thumb}>
        {isImage && !imgError ? (
          <img
            src={item.url}
            alt={item.filename}
            onError={() => setImgError(true)}
            loading="lazy"
            className={styles.thumbImg}
          />
        ) : isVideo ? (
          <div className={styles.thumbFallback}>
            <VideoIcon />
          </div>
        ) : isAudio ? (
          <div className={styles.thumbFallback}>
            <AudioIcon />
          </div>
        ) : (
          <div className={styles.thumbFallback}>
            <ImageIcon />
          </div>
        )}

        {/* Hover actions */}
        <div className={styles.thumbActions}>
          <button className={styles.thumbAction} onClick={handleCopyLink} title="Copy URL">
            <LinkIcon />
          </button>
          <button className={styles.thumbAction} onClick={handleDownload} title="Download">
            <DownloadIcon />
          </button>
        </div>

        {/* Dimension badge */}
        {item.width && item.height && (
          <div className={styles.dimBadge}>{item.width}×{item.height}</div>
        )}
      </div>

      {/* Meta */}
      <div className={styles.cardMeta}>
        <TypeBadge type={item.type} />
        <span className={styles.cardSize}>{formatBytes(item.size_bytes)}</span>
      </div>
      <p className={styles.cardFilename} title={item.filename}>{item.filename}</p>
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function MediaFetcher({ settings, onSettingsChange, onTogglePanel, panelOpen }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [media, setMedia] = useState([]) // raw list from backend
  const [selected, setSelected] = useState(new Set())
  const [activeFilters, setActiveFilters] = useState(new Set()) // empty = all
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef(null)

  // Filtered view
  const filtered = media.filter(item => {
    const passType = activeFilters.size === 0 || activeFilters.has(item.type)
    const passSearch = !searchTerm || item.filename?.toLowerCase().includes(searchTerm.toLowerCase()) || item.url?.toLowerCase().includes(searchTerm.toLowerCase())
    return passType && passSearch
  })

  // Counts per type
  const counts = media.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1
    return acc
  }, {})

  async function handleFetch() {
    const trimmed = url.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setMedia([])
    setSelected(new Set())
    try {
      const result = await fetchPageMedia(trimmed)
      setMedia(result)
    } catch (err) {
      setError(err?.message || 'Failed to fetch media. Check the URL and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleFetch()
    if (e.key === 'Escape') onClose()
  }

  function toggleFilter(type) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function toggleItem(url) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const handleSelectAll = useCallback(() => {
    setSelected(new Set(filtered.map(i => i.url)))
  }, [filtered])

  const handleDeselectAll = useCallback(() => {
    setSelected(new Set())
  }, [])

  function handleDownloadSelected() {
    const toDownload = filtered.filter(i => selected.has(i.url))
    toDownload.forEach((item, idx) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = item.url
        a.download = item.filename || 'media'
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }, idx * 150) // stagger to avoid browser blocking
    })
  }

  const selectedCount = filtered.filter(i => selected.has(i.url)).length
  const detailItem = filtered.find(i => selected.has(i.url)) || (filtered.length > 0 ? filtered[0] : null)
  const [bottomTab, setBottomTab] = useState('General')

  return (
    <div className={`${styles.pageContainer} mr-fetcher-container`} role="main" aria-label="Media Fetcher">

        {/* ── Header ── */}
        <div className={`${styles.header} mr-fetcher-header`}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div>
              <h1 className={styles.headerTitle}>Media Fetcher</h1>
              <p className={styles.headerSub}>Extract all media from any website</p>
            </div>
          </div>
          {/* Hamburger panel toggle */}
          <button
            className={`${styles.panelToggleBtn} ${panelOpen ? styles.panelToggleBtnActive : ''}`}
            onClick={onTogglePanel}
            aria-label={panelOpen ? 'Close panel' : 'Open panel'}
            id="mf-panel-toggle"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="16" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── URL Bar ── */}
        <div className={`${styles.urlBar} mr-fetcher-urlbar`}>
          <div className={styles.urlInputWrap}>
            <svg className={styles.urlBarGlobe} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <input
              ref={inputRef}
              className={styles.urlInput}
              type="url"
              placeholder="https://example.com - paste any website URL"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              id="mf-url-input"
              aria-label="Website URL"
              spellCheck={false}
            />
            {url && (
              <button className={styles.urlClearBtn} onClick={() => { setUrl(''); inputRef.current?.focus() }} aria-label="Clear URL">
                <CloseIcon />
              </button>
            )}
          </div>
          <button
            className={styles.fetchBtn}
            onClick={handleFetch}
            disabled={loading || !url.trim()}
            id="mf-fetch-btn"
          >
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              <FetchIcon />
            )}
            <span>{loading ? 'Fetching…' : 'Fetch Media'}</span>
          </button>
        </div>

        {/* ── Body ── */}
        <div className={`${styles.body} mr-fetcher-body`}>

          {/* ── Sidebar ── */}
          <aside className={`${styles.sidebar} mr-fetcher-sidebar`}>

            {/* Filter by type */}
            <div className={styles.sideSection}>
              <div className={styles.sideSectionLabel}>Filter by type</div>
              <div className={styles.filterChips}>
                {Object.entries(TYPE_GROUPS).map(([type, info]) => {
                  const count = counts[type] || 0
                  const active = activeFilters.has(type)
                  return (
                    <button
                      key={type}
                      className={`${styles.filterChip} ${active ? styles.filterChipActive : ''} ${count === 0 ? styles.filterChipEmpty : ''}`}
                      onClick={() => toggleFilter(type)}
                      style={active ? { color: info.color, backgroundColor: info.bg, borderColor: info.color + '55' } : {}}
                      id={`mf-filter-${type}`}
                      disabled={count === 0}
                    >
                      <span>{info.label}</span>
                      {count > 0 && <span className={styles.filterCount}>{count}</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Search */}
            {media.length > 0 && (
              <div className={styles.sideSection}>
                <div className={styles.sideSectionLabel}>Search</div>
                <div className={styles.searchWrap}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    className={styles.searchInput}
                    type="search"
                    placeholder="Filter by filename / URL…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    id="mf-search"
                    aria-label="Search media"
                  />
                </div>
              </div>
            )}

            {/* Selection controls */}
            <div className={styles.sideSection}>
              <div className={styles.sideSectionLabel}>Download</div>
              <div className={styles.selectionControls}>
                <button
                  className={styles.selBtn}
                  onClick={handleSelectAll}
                  disabled={filtered.length === 0}
                  id="mf-select-all"
                >
                  Select all
                </button>
                <button
                  className={styles.selBtn}
                  onClick={handleDeselectAll}
                  disabled={selectedCount === 0}
                  id="mf-deselect-all"
                >
                  Deselect all
                </button>
              </div>
              <button
                className={styles.downloadBtn}
                onClick={handleDownloadSelected}
                disabled={selectedCount === 0}
                id="mf-download-selected"
              >
                <DownloadIcon />
                <span>Download selected{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
              </button>
            </div>

            {/* Stats */}
            {media.length > 0 && (
              <div className={styles.sideSection}>
                <div className={styles.stats}>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Total found</span>
                    <span className={styles.statValue}>{media.length}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Showing</span>
                    <span className={styles.statValue}>{filtered.length}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Selected</span>
                    <span className={styles.statValue}>{selectedCount}</span>
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* ── Grid ── */}
          <main className={`${styles.gridArea} mr-fetcher-grid-area`} id="mf-grid">

            {/* Empty / initial state */}
            {!loading && media.length === 0 && !error && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <h2 className={styles.emptyTitle}>Paste a URL to extract media</h2>
                <p className={styles.emptySub}>Enter any website URL above and click Fetch Media. Images, GIFs, SVGs, videos and audio will be displayed here.</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className={styles.errorState}>
                <div className={styles.errorIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <p className={styles.errorMsg}>{error}</p>
                <button className={styles.retryBtn} onClick={handleFetch}>Try again</button>
              </div>
            )}

            {/* Loading skeletons */}
            {loading && (
              <div className={styles.grid}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <MediaCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Results */}
            {!loading && filtered.length > 0 && (
              <>
                <div className={styles.gridHeader}>
                  <span className={styles.gridCount}>
                    Showing <strong>{filtered.length}</strong> of <strong>{media.length}</strong> media items
                    {activeFilters.size > 0 && ' (filtered)'}
                  </span>
                </div>
                <div className={styles.grid}>
                  {filtered.map((item, idx) => (
                    <MediaCard
                      key={item.url + idx}
                      item={item}
                      selected={selected.has(item.url)}
                      onToggle={() => toggleItem(item.url)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* No results after filter */}
            {!loading && media.length > 0 && filtered.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No media matches your filters</p>
                <button className={styles.retryBtn} onClick={() => { setActiveFilters(new Set()); setSearchTerm('') }}>
                  Clear filters
                </button>
              </div>
            )}
          </main>
        </div>

        {/* ── Bottom: General / Progress + status bar ── */}
        <div className={detailStyles.panel}>
          <div className={detailStyles.panelHeader}>
            <div className={detailStyles.tabs}>
              {['General', 'Progress'].map(t => (
                <button
                  key={t}
                  className={`${detailStyles.tab} ${bottomTab === t ? detailStyles.tabActive : ''}`}
                  onClick={() => setBottomTab(t)}
                  id={`mf-bottom-tab-${t.toLowerCase()}`}
                >{t}</button>
              ))}
            </div>
          </div>
          <div className={detailStyles.panelBody}>
            {bottomTab === 'General' && (
              detailItem ? (
                <div className={detailStyles.tabContent}>
                  <div className={detailStyles.generalLeft}>
                    {(detailItem.type === 'image' || detailItem.type === 'gif') ? (
                      <img src={detailItem.url} alt="" className={detailStyles.thumbnail} onError={e => { e.target.style.display='none' }} />
                    ) : (
                      <div className={detailStyles.thumbnailPlaceholder} />
                    )}
                  </div>
                  <div className={detailStyles.generalRight}>
                    <div className={detailStyles.entryTitle}>{detailItem.filename || 'Unknown file'}</div>
                    <div className={detailStyles.metaGrid}>
                      <MetaRow label="Type" value={detailItem.type || '—'} />
                      <MetaRow label="Size" value={detailItem.size_bytes ? formatBytes(detailItem.size_bytes) : '—'} />
                      {detailItem.width ? (
                        <MetaRow label="Dimensions" value={`${detailItem.width}×${detailItem.height}`} />
                      ) : (
                        <MetaRow label="Dimensions" value="—" />
                      )}
                      <MetaRow label="Index" value={`${media.indexOf(detailItem) + 1} of ${media.length}`} />
                    </div>
                    {detailItem.url && (
                      <div className={detailStyles.urlRow}>
                        <span className={detailStyles.metaLabel}>URL</span>
                        <a className={detailStyles.urlLink} href={detailItem.url} target="_blank" rel="noopener noreferrer">
                          {detailItem.url}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={detailStyles.empty}>Select or fetch media to see details.</div>
              )
            )}
            {bottomTab === 'Progress' && (
              <div className={detailStyles.tabContent} style={{ width: '100%' }}>
                <div className={detailStyles.progressSection}>
                  <div className={detailStyles.progressHeader}>
                    <span className={detailStyles.progressPct}>
                      {loading ? '0%' : media.length > 0 ? '100%' : '0%'}
                    </span>
                    <span className={detailStyles.progressOf}>
                      {loading ? 'Fetching media...' : media.length > 0 ? 'Completed' : 'Idle'}
                    </span>
                  </div>
                  <SquaresProgressBar percent={loading ? 0 : media.length > 0 ? 100 : 0} />
                  <div className={detailStyles.progressStats}>
                    <div className={detailStyles.stat}>
                      <span className={detailStyles.statLabel}>Selected</span>
                      <span className={detailStyles.statValue}>{selectedCount} item{selectedCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className={detailStyles.stat}>
                      <span className={detailStyles.statLabel}>Showing</span>
                      <span className={detailStyles.statValue}>{filtered.length}</span>
                    </div>
                    <div className={detailStyles.stat}>
                      <span className={detailStyles.statLabel}>Total found</span>
                      <span className={detailStyles.statValue}>{media.length}</span>
                    </div>
                    <div className={detailStyles.stat}>
                      <span className={detailStyles.statLabel}>Status</span>
                      <span className={detailStyles.statValue}>{loading ? 'Fetching…' : media.length > 0 ? 'Ready' : 'Idle'}</span>
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

/**
 * App.jsx
 * Root component — left sidebar nav + main content area.
 * Right panel floats over content (does NOT push it).
 * Pages: Download Manager, Media Fetcher, File Converter — each with their own status/detail bottom bar.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import styles from './App.module.css'

import LoadingScreen  from './components/LoadingScreen'
import LeftSidebar    from './components/LeftSidebar'
import TopBar         from './components/TopBar'
import ToolBar        from './components/ToolBar'
import DownloadTable  from './components/DownloadTable'
import DetailPanel    from './components/DetailPanel'
import StatusBar      from './components/StatusBar'
import UrlPasteModal  from './components/UrlPasteModal'
import SettingsOverlay from './components/SettingsOverlay'
import BugReportModal from './components/BugReportModal'
import RightPanel     from './components/RightPanel'
import MediaFetcher   from './components/MediaFetcher'
import FileConverter  from './components/FileConverter'
import MediaCompressor from './components/MediaCompressor'
import AboutModal     from './components/AboutModal'

import { listDownloads, getSettings, updateSettings, startDownload } from './services/api'
import { useTheme } from './hooks/useTheme'
import EasterEgg from './components/EasterEgg'

const POLL_INTERVAL = 1500

const DEFAULT_SETTINGS = {
  theme: 'dark',
  speed_preset: 'high',
  speed_limit_kbps: 0,
  max_concurrent_downloads: 3,
  snail_mode: false,
  snail_speed_kbps: 50,
  download_folder: '',
  launch_at_startup: false,
  auto_remove_on_delete: true,
  auto_remove_deleted: true,
  auto_remove_completed: false,
  auto_retry_failed: false,
  font_size: 13,
}

export default function App() {
    const [appReady, setAppReady] = useState(() => {
    return sessionStorage.getItem('mediarift_loading_shown') === 'true'
  })

    const { resolved, setTheme } = useTheme()

    const [activePage, setActivePage] = useState(() => {
    const hash = window.location.hash.slice(1)
    if (['downloads', 'fetcher', 'converter', 'compressor'].includes(hash)) {
      return hash
    }
    return localStorage.getItem('mediarift_active_page') || 'downloads'
  })

  // Sync hash routing and window history
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (['downloads', 'fetcher', 'converter', 'compressor'].includes(hash)) {
        setActivePage(hash)
        localStorage.setItem('mediarift_active_page', hash)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    
    const currentHash = window.location.hash.slice(1)
    if (!currentHash) {
      window.location.hash = activePage
    } else if (currentHash !== activePage) {
      setActivePage(currentHash)
    }

    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [activePage])

    const [downloads, setDownloads]   = useState([])
  const [manualSelectedId, setManualSelectedId] = useState(null)
  const [filter, setFilter]         = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

    const [settings, setSettings] = useState(DEFAULT_SETTINGS)

    const [fontSize, setFontSizeState] = useState(15)

  useEffect(() => {
    // Font size is fixed at 15px via index.css — no dynamic override needed
  }, [fontSize])

  const setFontSize = useCallback((px) => {
    const clamped = Math.min(18, Math.max(11, px))
    setFontSizeState(clamped)
  }, [])

    const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [rightPanelOpen, setRightPanelOpen]       = useState(false)
  const [prefsOpen, setPrefsOpen]                 = useState(false)
  const [bugReportOpen, setBugReportOpen]         = useState(false)
  const [aboutOpen, setAboutOpen]                 = useState(false)

    useEffect(() => {
    getSettings()
      .then(s => {
        const merged = { ...DEFAULT_SETTINGS, ...s }
        setSettings(merged)
        if (merged.theme) setTheme(merged.theme)
        if (merged.font_size) setFontSize(merged.font_size)
      })
      .catch(() => {})
  }, []) // eslint-disable-line

    const pollRef = useRef(null)

  const fetchDownloads = useCallback(async () => {
    try {
      const data = await listDownloads()
      setDownloads(data)
    } catch {}
  }, [])

  useEffect(() => {
    fetchDownloads()
    pollRef.current = setInterval(fetchDownloads, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [fetchDownloads])

    const handleSettingsChange = useCallback(async (patch) => {
    const merged = { ...settings, ...patch }
    setSettings(merged)
    if (patch.theme) setTheme(patch.theme)
    if (patch.font_size !== undefined) setFontSize(patch.font_size)
    try {
      const saved = await updateSettings(patch)
      setSettings(prev => ({ ...prev, ...saved }))
    } catch {}
  }, [settings, setTheme, setFontSize])

  const handleFontSizeChange = useCallback((px) => {
    setFontSize(px)
    clearTimeout(handleFontSizeChange._timer)
    handleFontSizeChange._timer = setTimeout(() => {
      updateSettings({ font_size: px }).catch(() => {})
      setSettings(prev => ({ ...prev, font_size: px }))
    }, 400)
  }, [setFontSize])

    const handleStartDownload = useCallback(async (params) => {
    try {
      await startDownload(params)
      fetchDownloads()
    } catch (err) {
      console.error('Start download failed:', err)
    }
  }, [fetchDownloads])

    const filteredDownloads = downloads.filter(d => {
    if (filter === 'all')         return true
    if (filter === 'downloading') return ['downloading','paused','queued','fetching'].includes(d.state)
    if (filter === 'completed')   return d.state === 'completed'
    if (filter === 'stopped')     return d.state === 'stopped' || d.state === 'error'
    return true
  })

    const effectiveSelectedId = (() => {
    if (manualSelectedId && downloads.some(d => d.id === manualSelectedId)) {
      return manualSelectedId
    }
    const activeDownloads = downloads.filter(d =>
      d.state === 'downloading' || d.state === 'fetching' || d.state === 'paused'
    )
    if (activeDownloads.length > 0) {
      const sorted = [...activeDownloads].sort((a, b) =>
        (b.added_at || '').localeCompare(a.added_at || '')
      )
      return sorted[0].id
    }
    if (downloads.length > 0) {
      const sorted = [...downloads].sort((a, b) =>
        (b.added_at || '').localeCompare(a.added_at || '')
      )
      return sorted[0].id
    }
    return null
  })()

  const selectedEntry = downloads.find(d => d.id === effectiveSelectedId) || null

  const handleDelete = useCallback((id) => {
    setDownloads(prev => prev.filter(d => d.id !== id))
    if (manualSelectedId === id) setManualSelectedId(null)
  }, [manualSelectedId])

  const handleSelect = useCallback((id) => {
    setManualSelectedId(id)
  }, [])

  const handleNavigate = useCallback((page) => {
    window.location.hash = page
    setActivePage(page)
    localStorage.setItem('mediarift_active_page', page)
    setRightPanelOpen(false)
  }, [])

  return (
    <>
            {!appReady && (
        <LoadingScreen
          onDone={() => {
            sessionStorage.setItem('mediarift_loading_shown', 'true')
            setAppReady(true)
          }}
        />
      )}

      <div className={`${styles.app} mr-app-root`} data-theme={resolved}>

                <LeftSidebar activePage={activePage} onNavigate={handleNavigate} />

                <div className={`${styles.mainContent} mr-main-content`}>

                    {activePage === 'downloads' && (
            <>
              <TopBar
                onAddDownload={() => setDownloadModalOpen(true)}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
                onTogglePanel={() => setRightPanelOpen(v => !v)}
                panelOpen={rightPanelOpen}
              />
              <ToolBar
                activeFilter={filter}
                onFilter={setFilter}
                downloads={downloads}
              />
              <div className={`${styles.tableArea} mr-table-area`}>
                <DownloadTable
                  downloads={filteredDownloads}
                  searchQuery={searchQuery}
                  selectedId={effectiveSelectedId}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  onRefresh={fetchDownloads}
                />
              </div>
              <DetailPanel
                selectedEntry={selectedEntry}
                onClose={() => setManualSelectedId(null)}
              />
              <StatusBar
                downloads={downloads}
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
            </>
          )}

                    {activePage === 'fetcher' && (
            <MediaFetcher
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onTogglePanel={() => setRightPanelOpen(v => !v)}
              panelOpen={rightPanelOpen}
            />
          )}

                    {activePage === 'converter' && (
            <FileConverter
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onTogglePanel={() => setRightPanelOpen(v => !v)}
              panelOpen={rightPanelOpen}
            />
          )}

                    {activePage === 'compressor' && (
            <MediaCompressor
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onTogglePanel={() => setRightPanelOpen(v => !v)}
              panelOpen={rightPanelOpen}
            />
          )}
        </div>

                <RightPanel
          open={rightPanelOpen}
          onClose={() => setRightPanelOpen(false)}
          onBugReport={() => { setRightPanelOpen(false); setBugReportOpen(true) }}
          onOpenMediaFetcher={() => { setActivePage('fetcher') }}
          onOpenFileConverter={() => { setActivePage('converter') }}
          onOpenPrefs={() => setPrefsOpen(true)}
          onAbout={() => setAboutOpen(true)}
        />

                {downloadModalOpen && (
          <UrlPasteModal
            onClose={() => setDownloadModalOpen(false)}
            onStartDownload={handleStartDownload}
            defaultSaveTo={settings.download_folder}
          />
        )}
        {prefsOpen && (
          <SettingsOverlay
            settings={settings}
            onSettingsChange={handleSettingsChange}
            fontSize={fontSize}
            onFontSizeChange={handleFontSizeChange}
            onClose={() => setPrefsOpen(false)}
          />
        )}
        {bugReportOpen && (
          <BugReportModal
            onClose={() => setBugReportOpen(false)}
          />
        )}
        {aboutOpen && (
          <AboutModal
            onClose={() => setAboutOpen(false)}
          />
        )}

                <EasterEgg />
      </div>
    </>
  )
}

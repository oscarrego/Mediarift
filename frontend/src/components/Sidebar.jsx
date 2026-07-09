/**
 * components/Sidebar.jsx
 * Vertical navigation sidebar with logo, nav items, theme toggle, and collapse.
 */

import styles from './Sidebar.module.css'
import logoImg from '../../assets/mediariftlogo.png'

/* ── High-quality SVG icons ── */

const LogoMark = () => (
  <img src={logoImg} alt="MediaRift Logo" width="28" height="28" style={{ objectFit: 'contain' }} />
)

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15 15"/>
  </svg>
)

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

const NAV_ITEMS = [
  { id: 'download', label: 'Download', Icon: DownloadIcon },
  { id: 'history',  label: 'History',  Icon: HistoryIcon  },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
]

export default function Sidebar({
  activePage,
  onNavigate,
  resolved,
  toggleTheme,
  historyCount,
  collapsed,
  onToggleCollapse,
}) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}
        aria-label="Application navigation"
      >
        {/* Brand */}
        <div className={styles.brand}>
          <button
            className={styles.logoBtn}
            onClick={() => onNavigate('download')}
            aria-label="Mediarift — Go to download"
          >
            <span className={styles.logoMark}><LogoMark /></span>
            {!collapsed && (
              <span className={styles.logoText}>
                Media<span className={styles.logoAccent}>rift</span>
              </span>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className={styles.divider} aria-hidden="true" />

        {/* Navigation */}
        <nav className={styles.nav} aria-label="Main navigation">
          <ul className={styles.navList}>
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  className={`${styles.navItem} ${activePage === id ? styles.navItemActive : ''}`}
                  onClick={() => onNavigate(id)}
                  aria-current={activePage === id ? 'page' : undefined}
                  aria-label={collapsed ? label : undefined}
                  id={`nav-${id}`}
                  title={collapsed ? label : undefined}
                >
                  <span className={styles.navIcon}>
                    <Icon />
                  </span>
                  {!collapsed && <span className={styles.navLabel}>{label}</span>}
                  {!collapsed && id === 'history' && historyCount > 0 && (
                    <span className={styles.badge} aria-label={`${historyCount} items`}>
                      {historyCount > 99 ? '99+' : historyCount}
                    </span>
                  )}
                  {collapsed && id === 'history' && historyCount > 0 && (
                    <span className={styles.badgeDot} aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom controls */}
        <div className={styles.bottom}>
          <div className={styles.divider} aria-hidden="true" />

          {/* Theme toggle */}
          <button
            className={styles.themeBtn}
            onClick={toggleTheme}
            aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
            id="sidebar-theme-toggle"
          >
            <span className={styles.navIcon}>
              {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
            </span>
            {!collapsed && (
              <span className={styles.navLabel}>
                {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
              </span>
            )}
          </button>

          {/* Collapse button */}
          <button
            className={styles.collapseBtn}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            id="sidebar-collapse-btn"
          >
            <span className={styles.navIcon}>
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </span>
            {!collapsed && <span className={styles.navLabel}>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className={styles.mobileBar} aria-label="Mobile navigation">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`${styles.mobileItem} ${activePage === id ? styles.mobileItemActive : ''}`}
            onClick={() => onNavigate(id)}
            aria-label={label}
            aria-current={activePage === id ? 'page' : undefined}
            id={`mobile-nav-${id}`}
          >
            <span className={styles.mobileIcon}><Icon /></span>
            <span className={styles.mobileLabel}>{label}</span>
            {id === 'history' && historyCount > 0 && (
              <span className={styles.mobileBadgeDot} aria-hidden="true" />
            )}
          </button>
        ))}
      </nav>
    </>
  )
}

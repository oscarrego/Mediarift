/**
 * components/LeftSidebar.jsx
 * Minimal left sidebar — logo + Download Manager only.
 * Media Fetcher and File Converter are accessed via the right panel menu.
 */

import styles from './LeftSidebar.module.css'
import logoImg from '../../assets/mediariftlogo.png'

const DownloadManagerIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const MediaFetcherIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const FileConverterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="17 1 21 5 17 9"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
)



const LogoIcon = () => (
  <img src={logoImg} alt="MediaRift Logo" width="22" height="22" style={{ objectFit: 'contain' }} />
)

const NAV_ITEMS = [
  { id: 'downloads', label: 'Download Manager', Icon: DownloadManagerIcon },
  { id: 'fetcher',   label: 'Media Fetcher',    Icon: MediaFetcherIcon },
  { id: 'converter', label: 'File Converter',   Icon: FileConverterIcon },
]

export default function LeftSidebar({ activePage, onNavigate }) {
  return (
    <nav className={`${styles.sidebar} mr-sidebar`} aria-label="Main navigation">
      {/* Logo */}
      <div className={`${styles.logo} mr-logo`}>
        <LogoIcon />
        <span className={styles.logoText}>
          Media<span className={styles.logoAccent}>Rift</span>
        </span>
      </div>

      {/* Nav items */}
      <div className={`${styles.navGroup} mr-nav-group`}>
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`${styles.navItem} ${activePage === id ? styles.navItemActive : ''} mr-nav-item`}
            onClick={() => onNavigate(id)}
            id={`sidebar-nav-${id}`}
            aria-current={activePage === id ? 'page' : undefined}
            title={label}
          >
            <span className={styles.navIcon}>
              <Icon />
            </span>
            <span className={styles.navLabel}>{label}</span>
            {activePage === id && <span className={styles.activeBar} />}
          </button>
        ))}
      </div>
    </nav>
  )
}

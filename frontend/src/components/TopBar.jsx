/**
 * components/TopBar.jsx
 * FDM-style top bar: logo, add-download button, search, panel toggle button.
 */

import styles from './TopBar.module.css'
import logoImg from '../../assets/mediariftlogo.png'

const LogoIcon = () => (
  <img src={logoImg} alt="MediaRift Logo" width="20" height="20" style={{ objectFit: 'contain' }} />
)

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

/** Hamburger / panel-toggle icon — three lines, rightmost short */
const PanelToggleIcon = ({ active }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" aria-hidden="true"
    style={{
      transition: 'transform 280ms cubic-bezier(0.4,0,0.2,1)',
      transform: active ? 'rotate(180deg)' : 'rotate(0deg)',
      display: 'block',
    }}
  >
    {active ? (
      /* When open — show chevron right (pointing toward panel) */
      <polyline points="15 18 9 12 15 6"/>
    ) : (
      /* When closed — show right-aligned panel icon */
      <>
        <line x1="3"  y1="6"  x2="21" y2="6"/>
        <line x1="3"  y1="12" x2="16" y2="12"/>
        <line x1="3"  y1="18" x2="21" y2="18"/>
        {/* Right accent line to hint at panel */}
        <line x1="19" y1="9"  x2="21" y2="9"  strokeOpacity="0"/>
      </>
    )}
  </svg>
)

export default function TopBar({ onAddDownload, searchQuery, onSearch, onTogglePanel, panelOpen }) {
  return (
    <header className={`${styles.topbar} mr-topbar`} role="banner">
      {/* Brand */}
      <div className={`${styles.brand} mr-brand`}>
        <LogoIcon />
        <span className={styles.brandName}>
          Media<span className={styles.brandAccent}>Rift</span>
        </span>
      </div>

      {/* Spacer */}
      <div className={styles.spacer} />

      {/* Add download — right side, left of search */}
      <button
        className={`${styles.addBtn} mr-add-btn`}
        onClick={onAddDownload}
        id="topbar-add-download"
        aria-label="Add download"
      >
        <PlusIcon />
        <span>Add Download</span>
      </button>

      {/* Search */}
      <div className={`${styles.searchWrap} mr-search-wrap`}>
        <SearchIcon />
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search downloads…"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          id="topbar-search"
          aria-label="Search downloads"
        />
      </div>

      {/* Panel toggle button */}
      <div className={styles.panelToggleWrap}>
        <button
          className={`${styles.panelToggleBtn} ${panelOpen ? styles.panelToggleBtnActive : ''}`}
          onClick={onTogglePanel}
          id="topbar-panel-toggle-btn"
          aria-label={panelOpen ? 'Close panel' : 'Open panel'}
          aria-expanded={panelOpen}
          aria-haspopup="true"
        >
          <PanelToggleIcon active={panelOpen} />
        </button>
      </div>
    </header>
  )
}

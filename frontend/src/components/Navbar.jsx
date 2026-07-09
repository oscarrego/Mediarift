/**
 * components/Navbar.jsx
 * Top navigation bar with logo, theme toggle, and history toggle.
 */

import { useCallback } from 'react'
import styles from './Navbar.module.css'

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const HistoryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="12 8 12 12 14 14"/>
    <path d="M3.05 11a9 9 0 1 0 .5-4.4"/>
    <polyline points="3 3 3 11 11 11"/>
  </svg>
)

const BoltIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
)

export default function Navbar({ resolved, toggleTheme, onHistoryOpen, historyCount }) {
  return (
    <header className={styles.navbar} role="banner">
      <div className={styles.inner}>
        {/* Logo */}
        <a href="/" className={styles.logo} aria-label="Meidarift App – Home">
          <span className={styles.logoIcon}>
            <BoltIcon />
          </span>
          <span className={styles.logoText}>Mediarift<span className={styles.logoAccent}>App</span></span>
        </a>

        {/* Actions */}
        <div className={styles.actions}>
          {/* History button */}
          <button
            className={styles.actionBtn}
            onClick={onHistoryOpen}
            aria-label={`Download history (${historyCount} items)`}
            title="Download History"
            id="nav-history-btn"
          >
            <HistoryIcon />
            {historyCount > 0 && (
              <span className={styles.badge} aria-hidden="true">
                {historyCount > 99 ? '99+' : historyCount}
              </span>
            )}
          </button>

          {/* Theme toggle */}
          <button
            className={styles.actionBtn}
            onClick={toggleTheme}
            aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
            id="nav-theme-toggle"
          >
            {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>
    </header>
  )
}

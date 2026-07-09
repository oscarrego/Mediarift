/**
 * components/RightPanel.jsx
 * Floating right-side popover/dropdown menu (FDM-style).
 * Height fits content, shadow is removed, and clicks outside close the panel.
 */

import { useRef } from 'react'
import styles from './RightPanel.module.css'

// ── Icons ────────────────────────────────────────────────────────────────────

const PrefsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6"/>
    <line x1="4" y1="12" x2="14" y2="12"/>
    <line x1="4" y1="18" x2="18" y2="18"/>
  </svg>
)



const BugIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2c0 2 2 3 2 4H14c0-1 2-2 2-4"/>
    <path d="M12 6C8.7 6 6 8.7 6 12v4a6 6 0 0 0 12 0v-4c0-3.3-2.7-6-6-6z"/>
    <path d="M6 9H2m20 0h-4M6 15H2m20 0h-4"/>
  </svg>
)

const HeartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

const PowerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
    <line x1="12" y1="2" x2="12" y2="12"/>
  </svg>
)

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function RightPanel({
  open,
  onClose,
  onBugReport,
  onOpenMediaFetcher,
  onOpenFileConverter,
  onOpenPrefs,
  onAbout,
}) {
  const panelRef = useRef(null)

  return (
    <>
      {/* Backdrop — transparent overlay to detect close clicks */}
      <div
        className={`${styles.backdrop} ${open ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover panel container (height fits options, no shadow) */}
      <aside
        ref={panelRef}
        className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
        role="dialog"
        aria-label="Navigation menu"
      >
        <div className={styles.panelBody}>
          <nav className={styles.nav} aria-label="Quick menu">



            {/* ── Settings ── */}
            <div className={styles.sectionLabel}>Settings</div>

            <button
              className={styles.navItem}
              onClick={() => { onClose(); setTimeout(onOpenPrefs, 55) }}
              id="rpanel-preferences"
            >
              <span className={styles.navIcon}><PrefsIcon /></span>
              <span className={styles.navLabel}>Preferences</span>
            </button>

            <div className={styles.divider} />

            {/* ── Help ── */}
            <div className={styles.sectionLabel}>Help</div>

            <button
              className={styles.navItem}
              onClick={() => { onBugReport?.(); onClose() }}
              id="rpanel-bug-report"
            >
              <span className={styles.navIcon}><BugIcon /></span>
              <span className={styles.navLabel}>Submit a Bug Report</span>
            </button>

            <button
              className={styles.navItem}
              onClick={() => { onClose() }}
              id="rpanel-support-project"
            >
              <span className={styles.navIcon}><HeartIcon /></span>
              <span className={styles.navLabel}>Support the Project</span>
            </button>

            {/* About button placed directly below Support the Project */}
            <button
              className={styles.navItem}
              onClick={() => { onAbout?.(); onClose() }}
              id="rpanel-about"
            >
              <span className={styles.navIcon}><InfoIcon /></span>
              <span className={styles.navLabel}>About</span>
            </button>

            <div className={styles.divider} />

            <button
              className={`${styles.navItem} ${styles.navItemDanger}`}
              onClick={() => window.close()}
              id="rpanel-quit"
            >
              <span className={styles.navIcon}><PowerIcon /></span>
              <span className={styles.navLabel}>Quit</span>
            </button>

          </nav>
        </div>
      </aside>
    </>
  )
}

/**
 * components/SettingsDropdown.jsx
 * FDM-style flat menu dropdown — no nested panels.
 * Items: Preferences | Contact support | Submit a bug report | Support the project | About | Quit
 */

import { forwardRef } from 'react'
import styles from './SettingsDropdown.module.css'

const MenuIcon = ({ children }) => <span className={styles.menuIcon} aria-hidden="true">{children}</span>

const PrefsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6"/>
    <line x1="4" y1="12" x2="14" y2="12"/>
    <line x1="4" y1="18" x2="18" y2="18"/>
  </svg>
)

const SupportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
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

const SettingsDropdown = forwardRef(function SettingsDropdown(
  { onOpenPrefs, onBugReport, onClose },
  ref
) {
  const item = (id, icon, label, onClick, variant) => (
    <button
      className={`${styles.item} ${variant ? styles[variant] : ''}`}
      onClick={() => { onClick(); onClose() }}
      role="menuitem"
      id={id}
    >
      <span className={styles.itemIcon}>{icon}</span>
      <span className={styles.itemLabel}>{label}</span>
    </button>
  )

  return (
    <div ref={ref} className={styles.dropdown} role="menu" aria-label="Settings menu">
      {item('dd-preferences',    <PrefsIcon />,   'Preferences',          onOpenPrefs)}
      <div className={styles.divider} />
      {item('dd-contact',        <SupportIcon />, 'Contact support',      () => { window.location.href = 'mailto:oscarrego@gmail.com' })}
      {item('dd-bug-report',     <BugIcon />,     'Submit a bug report',  onBugReport)}
      <div className={styles.divider} />
      {item('dd-support',        <HeartIcon />,   'Support the project',  () => {})}
      <div className={styles.divider} />
      {item('dd-about',          <InfoIcon />,    'About',                () => {})}
      {item('dd-quit',           <PowerIcon />,   'Quit',                 () => window.close(), 'itemDanger')}
    </div>
  )
})

export default SettingsDropdown

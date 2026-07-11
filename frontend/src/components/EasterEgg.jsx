/**
 * EasterEgg.jsx
 * Listens globally for the user typing "/oscar" in sequence.
 * When triggered, shows a clean, modern dev popup.
 */

import { useEffect, useState } from 'react'
import styles from './EasterEgg.module.css'

const TRIGGER = '/oscar'

const DevIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
)

export default function EasterEgg() {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    let buffer = ''
    let dismissTimer = null

    const handleKey = (e) => {
      if (e.key.length > 1) {
        buffer = ''
        return
      }
      buffer += e.key
      if (buffer.length > TRIGGER.length * 2) {
        buffer = buffer.slice(-TRIGGER.length * 2)
      }
      if (buffer.toLowerCase().endsWith(TRIGGER.toLowerCase())) {
        buffer = ''
        setExiting(false)
        setVisible(true)
        clearTimeout(dismissTimer)
        dismissTimer = setTimeout(() => {
          setExiting(true)
          setTimeout(() => setVisible(false), 300)
        }, 3000)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      clearTimeout(dismissTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div className={`${styles.overlay} ${exiting ? styles.overlayExit : styles.overlayEnter}`} aria-live="polite">
      <div className={`${styles.card} ${exiting ? styles.cardExit : styles.cardEnter}`}>
        
        <div className={styles.iconWrapper}>
          <DevIcon />
        </div>

        <div className={styles.content}>
          <div className={styles.badge}>✦ Developer</div>
          <h2 className={styles.name}>Developed by Oscar</h2>
          
        </div>

        <div className={styles.progressTrack}>
          <div className={styles.progressFill} />
        </div>
      </div>
    </div>
  )
}


/**
 * EasterEgg.jsx
 * Listens globally for the user typing "/oscar" in sequence.
 * When triggered, shows an animated popup that auto-dismisses after 3 seconds.
 */

import { useEffect, useState } from 'react'
import styles from './EasterEgg.module.css'

const TRIGGER = '/oscar'

export default function EasterEgg() {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const bufferRef = { current: '' }

  useEffect(() => {
    let buffer = ''
    let dismissTimer = null

    const handleKey = (e) => {
      // Only track printable characters
      if (e.key.length > 1) {
        buffer = ''
        return
      }
      buffer += e.key
      // Keep last N chars matching trigger length
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
          setTimeout(() => setVisible(false), 600)
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
        {/* Stars / sparkles */}
        <div className={styles.stars} aria-hidden="true">
          {[...Array(12)].map((_, i) => (
            <span key={i} className={styles.star} style={{ '--i': i }} />
          ))}
        </div>

        {/* Avatar ring */}
        <div className={styles.avatarRing}>
          <div className={styles.avatar}>O</div>
        </div>

        <div className={styles.content}>
          <div className={styles.badge}>✦ Easter Egg Unlocked</div>
          <h2 className={styles.name}>Developed by Oscar</h2>
          <p className={styles.tagline}>Crafted with passion &amp; purple vibes 💜</p>
        </div>

        {/* Progress bar showing auto-dismiss */}
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} />
        </div>
      </div>
    </div>
  )
}

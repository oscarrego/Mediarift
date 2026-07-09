/**
 * components/LoadingScreen.jsx
 * Animated loading screen — spinning purple ring that expands
 * and fades away to reveal the app.
 */

import { useEffect, useState } from 'react'
import styles from './LoadingScreen.module.css'
import logoImg from '../../assets/mediariftlogo.png'

export default function LoadingScreen({ onDone }) {
  const [phase, setPhase] = useState('spin') // 'spin' | 'expand' | 'done'

  useEffect(() => {
    // After 1.4s of spinning, trigger the expand-reveal animation
    const t1 = setTimeout(() => setPhase('expand'), 1400)
    // After expansion completes (~600ms), notify parent
    const t2 = setTimeout(() => {
      setPhase('done')
      onDone?.()
    }, 2000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  if (phase === 'done') return null

  return (
    <div className={`${styles.screen} ${phase === 'expand' ? styles.screenExpand : ''}`}>
      <div className={styles.center}>
        {/* Outer glow ring */}
        <div className={`${styles.glowRing} ${phase === 'expand' ? styles.glowExpand : ''}`} />

        {/* Spinning arc */}
        <svg
          className={`${styles.spinner} ${phase === 'expand' ? styles.spinnerExpand : ''}`}
          viewBox="0 0 100 100"
          width="72"
          height="72"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="rgba(155,109,255,0.12)"
            strokeWidth="5"
          />
          {/* Spinning arc */}
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="url(#spinGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="80 172"
            className={styles.arc}
          />
          <defs>
            <linearGradient id="spinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9b6dff" />
              <stop offset="100%" stopColor="#6c3fff" />
            </linearGradient>
          </defs>
        </svg>

        <div className={`${styles.logoMark} ${phase === 'expand' ? styles.logoMarkExpand : ''}`}>
          <img src={logoImg} alt="MediaRift Logo" width="28" height="28" style={{ objectFit: 'contain' }} />
        </div>
      </div>

      {/* App name */}
      <div className={`${styles.brand} ${phase === 'expand' ? styles.brandFade : ''}`}>
        Media<span className={styles.brandAccent}>Rift</span>
      </div>
    </div>
  )
}

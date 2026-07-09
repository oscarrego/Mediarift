import styles from './AboutModal.module.css'
import logoImg from '../../assets/mediariftlogo.png'

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)



const LogoIcon = () => (
  <img src={logoImg} alt="MediaRift Logo" width="32" height="32" style={{ objectFit: 'contain' }} />
)

export default function AboutModal({ onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="About MediaRift">
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>About</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.brandRow}>
            <div className={styles.logoWrapper}>
              <LogoIcon />
            </div>
            <div className={styles.brandText}>
              <div className={styles.appName}>MediaRift</div>
              <div className={styles.version}>Version 1.0.0</div>
            </div>
          </div>

          <div className={styles.infoBlock}>
            <div className={styles.featuresList}>
              <div className={styles.featureRow}>
                <span className={styles.bullet}>✦</span>
                <span>Download Manager with speed limits &amp; presets</span>
              </div>
              <div className={styles.featureRow}>
                <span className={styles.bullet}>✦</span>
                <span>Media Fetcher to extract assets from any website</span>
              </div>
              <div className={styles.featureRow}>
                <span className={styles.bullet}>✦</span>
                <span>File Converter supporting video, audio, &amp; images</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <div className={styles.devBy}>
              Developed by <span className={styles.devName}>Oscar @ 2026</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

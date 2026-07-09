/**
 * components/ErrorMessage.jsx
 * Structured error with icon, title, detail, and optional retry.
 */

import styles from './ErrorMessage.module.css'

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const BanIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
  </svg>
)

const WifiOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
    <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
    <line x1="12" y1="20" x2="12.01" y2="20"/>
  </svg>
)

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const CODE_META = {
  PRIVATE_MEDIA:        { title: 'Private Media',        Icon: LockIcon  },
  AGE_RESTRICTED:       { title: 'Age Restricted',       Icon: LockIcon  },
  MEDIA_UNAVAILABLE:    { title: 'Media Unavailable',    Icon: BanIcon   },
  COPYRIGHT_BLOCKED:    { title: 'Copyright Blocked',    Icon: BanIcon   },
  AUTH_REQUIRED:        { title: 'Sign-In Required',     Icon: LockIcon  },
  NO_FORMATS:           { title: 'No Formats Found',     Icon: AlertIcon },
  FFMPEG_MISSING:       { title: 'FFmpeg Not Found',     Icon: AlertIcon },
  TIMEOUT:              { title: 'Request Timed Out',    Icon: ClockIcon },
  NETWORK_ERROR:        { title: 'Network Error',        Icon: WifiOffIcon },
  UNSUPPORTED_PLATFORM: { title: 'Unsupported Platform', Icon: BanIcon   },
  VALIDATION_ERROR:     { title: 'Invalid URL',          Icon: AlertIcon },
  SERVER_ERROR:         { title: 'Server Error',         Icon: AlertIcon },
  DOWNLOAD_ERROR:       { title: 'Download Failed',      Icon: AlertIcon },
}

export default function ErrorMessage({ message, code, onRetry }) {
  const meta = CODE_META[code] ?? { title: 'Something went wrong', Icon: AlertIcon }
  const { title, Icon } = meta

  return (
    <div className={styles.wrapper} role="alert">
      <span className={styles.iconWrap} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {message && <p className={styles.detail}>{message}</p>}
      </div>
      {onRetry && (
        <button className={styles.retryBtn} onClick={onRetry} id="error-retry-btn">
          Try Again
        </button>
      )}
    </div>
  )
}

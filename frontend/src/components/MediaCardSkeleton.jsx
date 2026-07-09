/**
 * components/MediaCardSkeleton.jsx
 * Loading skeleton that mirrors MediaCard layout.
 */

import styles from './MediaCardSkeleton.module.css'

export default function MediaCardSkeleton() {
  return (
    <div className={styles.card} aria-busy="true" aria-label="Loading media info">
      {/* Thumbnail */}
      <div className={`skeleton ${styles.thumb}`} />

      {/* Content */}
      <div className={styles.content}>
        <div className={`skeleton ${styles.titleLine}`} />
        <div className={`skeleton ${styles.titleLineShort}`} />
        <div className={`skeleton ${styles.subtitle}`} />

        <div className={styles.metaRow}>
          <div className={`skeleton ${styles.metaChip}`} />
          <div className={`skeleton ${styles.metaChip}`} />
          <div className={`skeleton ${styles.metaChip}`} />
        </div>

        <div className={`skeleton ${styles.tabs}`} />
        <div className={`skeleton ${styles.btn}`} />
      </div>
    </div>
  )
}

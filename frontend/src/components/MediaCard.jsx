/**
 * components/MediaCard.jsx
 * Displays fetched media info with download controls.
 */

import { useState, useCallback } from 'react'
import styles from './MediaCard.module.css'
import { formatBytes, formatViews, formatDate, platformLabel, platformColor, truncate } from '../utils/format'
import { getQuality, setQuality, getDownloadType, setDownloadType } from '../utils/storage'

/* ── Icons ── */
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

const ImagePlaceholderIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const FlashIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
)

const QUALITY_ORDER = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p']

function sortFormats(formats) {
  const video = formats.filter(f => f.label !== 'Audio Only')
  const audio = formats.filter(f => f.label === 'Audio Only')
  video.sort((a, b) => {
    const ai = QUALITY_ORDER.indexOf(a.label)
    const bi = QUALITY_ORDER.indexOf(b.label)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
  return [...video, ...audio]
}

const DOWNLOAD_TYPES = [
  { id: 'video',     label: 'Video' },
  { id: 'audio',     label: 'Audio' },
  { id: 'thumbnail', label: 'Thumbnail' },
]

const THUMB_FORMATS = [
  { id: 'jpg',  label: 'JPG' },
  { id: 'png',  label: 'PNG' },
  { id: 'webp', label: 'WEBP' },
]

export default function MediaCard({ media, onDownload, isDownloading, onCopyTitle, onCopyUrl }) {
  const videoFormats = media.formats.filter(f => f.label !== 'Audio Only')
  const sorted = sortFormats(media.formats)

  const [downloadType, setDownloadTypeState] = useState(() => getDownloadType())
  const [selectedFormat, setSelectedFormat] = useState(() => {
    const saved = getQuality()
    const match = sorted.find(f => f.label === saved)
    return match ?? (videoFormats[0] ?? sorted[0] ?? null)
  })
  const [thumbExt, setThumbExt] = useState('jpg')
  const [imgError, setImgError] = useState(false)

  const handleTypeChange = useCallback((type) => {
    setDownloadTypeState(type)
    setDownloadType(type)
    if (type === 'audio') {
      const audioFmt = media.formats.find(f => f.label === 'Audio Only')
      if (audioFmt) setSelectedFormat(audioFmt)
    } else if (type === 'thumbnail') {
      setSelectedFormat(null)
    } else {
      const saved = getQuality()
      const match = videoFormats.find(f => f.label === saved)
      setSelectedFormat(match ?? videoFormats[0] ?? null)
    }
  }, [media.formats, videoFormats])

  const handleFormatSelect = useCallback((fmt) => {
    setSelectedFormat(fmt)
    setQuality(fmt.label)
  }, [])

  const handleDownload = useCallback(() => {
    if (isDownloading) return
    onDownload({
      format_id:     selectedFormat?.format_id ?? 'best',
      download_type: downloadType,
      quality_label: selectedFormat?.label ?? 'best',
      thumbnail_ext: thumbExt,
    })
  }, [isDownloading, onDownload, selectedFormat, downloadType, thumbExt])

  const platformBgColor = platformColor(media.platform)

  // Dynamic size: show size for the selected format, or fallback to total estimate
  const displaySize = (() => {
    if (downloadType === 'video' && selectedFormat?.filesize) {
      return formatBytes(selectedFormat.filesize)
    }
    if (downloadType === 'audio') {
      const audioFmt = media.formats.find(f => f.label === 'Audio Only')
      if (audioFmt?.filesize) return formatBytes(audioFmt.filesize)
    }
    if (media.filesize_approx) return formatBytes(media.filesize_approx)
    return null
  })()

  const btnLabel = isDownloading
    ? 'Downloading…'
    : downloadType === 'thumbnail'
      ? `Download Thumbnail · ${thumbExt.toUpperCase()}`
      : downloadType === 'audio'
        ? 'Download Audio'
        : `Download ${selectedFormat?.label ?? 'Video'}`

  return (
    <div className={styles.card}>
      {/* ── Left: Thumbnail ── */}
      <div className={styles.thumbCol}>
        <div className={styles.thumbWrap}>
          {!imgError && media.thumbnail ? (
            <img
              src={media.thumbnail}
              alt={`Thumbnail for ${media.title}`}
              className={styles.thumbnail}
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className={styles.thumbPlaceholder}>
              <ImagePlaceholderIcon />
            </div>
          )}
          {/* Badges */}
          <span
            className={styles.platformBadge}
            style={{ background: platformBgColor }}
          >
            {platformLabel(media.platform)}
          </span>
          <span className={styles.typeBadge}>{media.video_type}</span>
        </div>
      </div>

      {/* ── Right: Content ── */}
      <div className={styles.content}>
        {/* Title */}
        <div className={styles.titleRow}>
          <h2 className={styles.title} title={media.title}>{media.title}</h2>
          <div className={styles.titleActions}>
            <button
              className={styles.iconBtn}
              onClick={onCopyTitle}
              title="Copy title"
              aria-label="Copy title"
              id="media-copy-title"
            >
              <CopyIcon />
            </button>
            {media.webpage_url && (
              <a
                className={styles.iconBtn}
                href={media.webpage_url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open original URL"
                aria-label="Open in new tab"
                id="media-open-url"
              >
                <ExternalLinkIcon />
              </a>
            )}
          </div>
        </div>

        {media.uploader && (
          <p className={styles.uploader}>{media.uploader}</p>
        )}

        {/* Metadata — Duration · Uploaded · Size (dynamic) */}
        <dl className={styles.meta}>
          <div className={styles.metaItem}>
            <dt>Duration</dt>
            <dd>{media.duration}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Uploaded</dt>
            <dd>{formatDate(media.upload_date)}</dd>
          </div>
          {displaySize && (
            <div className={styles.metaItem}>
              <dt>Size (est.)</dt>
              <dd>{displaySize}</dd>
            </div>
          )}
          {media.views != null && (
            <div className={styles.metaItem}>
              <dt>Views</dt>
              <dd>{formatViews(media.views)}</dd>
            </div>
          )}
        </dl>

        {/* Divider */}
        <div className={styles.divider} aria-hidden="true" />

        {/* Type selector */}
        <div className={styles.typeTabs} role="tablist" aria-label="Download type">
          {DOWNLOAD_TYPES.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={downloadType === id}
              className={`${styles.typeTab} ${downloadType === id ? styles.activeTab : ''}`}
              onClick={() => handleTypeChange(id)}
              id={`tab-${id}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Quality grid — video */}
        {downloadType === 'video' && videoFormats.length > 0 && (
          <div className={styles.formatGrid} role="group" aria-label="Select quality">
            {sorted.filter(f => f.label !== 'Audio Only').map((fmt) => (
              <button
                key={fmt.format_id}
                className={`${styles.formatChip} ${selectedFormat?.format_id === fmt.format_id ? styles.selectedChip : ''}`}
                onClick={() => handleFormatSelect(fmt)}
                title={`${fmt.label} · ${fmt.has_audio ? 'With audio' : 'No audio'} · ${formatBytes(fmt.filesize)}`}
                id={`fmt-${fmt.format_id}`}
                aria-pressed={selectedFormat?.format_id === fmt.format_id}
              >
                {fmt.label}
                {fmt.needs_merge && (
                  <span className={styles.mergeTag} title="Requires FFmpeg merge">
                    <FlashIcon />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Thumbnail format selector */}
        {downloadType === 'thumbnail' && (
          <div className={styles.thumbFormatRow} role="group" aria-label="Thumbnail format">
            <span className={styles.thumbFormatLabel}>Format</span>
            <div className={styles.thumbFormatChips}>
              {THUMB_FORMATS.map(({ id, label }) => (
                <button
                  key={id}
                  className={`${styles.formatChip} ${thumbExt === id ? styles.selectedChip : ''}`}
                  onClick={() => setThumbExt(id)}
                  aria-pressed={thumbExt === id}
                  id={`thumb-fmt-${id}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button
            className={`${styles.downloadBtn} ${isDownloading ? styles.busy : ''}`}
            onClick={handleDownload}
            disabled={isDownloading || (downloadType === 'video' && !selectedFormat)}
            id="media-download-btn"
            aria-label={btnLabel}
          >
            {isDownloading ? (
              <span className={styles.spinnerRing} aria-hidden="true" />
            ) : (
              <DownloadIcon />
            )}
            {btnLabel}
          </button>

          <button
            className={styles.copyUrlBtn}
            onClick={onCopyUrl}
            title="Copy URL"
            aria-label="Copy URL"
            id="media-copy-url"
          >
            <CopyIcon />
            Copy URL
          </button>
        </div>
      </div>
    </div>
  )
}

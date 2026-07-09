/**
 * pages/HomePage.jsx
 * Download page: header, URL input, and results.
 */

import { useState, useCallback } from 'react'
import styles from './HomePage.module.css'
import UrlInput from '../components/UrlInput'
import MediaCard from '../components/MediaCard'
import MediaCardSkeleton from '../components/MediaCardSkeleton'
import DownloadProgress from '../components/DownloadProgress'
import ErrorMessage from '../components/ErrorMessage'
import { fetchMediaInfo, downloadMedia } from '../services/api'
import { validateUrl } from '../utils/validators'
import { setLastUrl } from '../utils/storage'

const PLATFORMS = [
  { label: 'YouTube',     color: '#ff0000' },
  { label: 'Instagram',   color: '#e1306c' },
  { label: 'TikTok',      color: '#69c9d0' },
  { label: 'Facebook',    color: '#1877f2' },
  { label: 'Twitter / X', color: '#1da1f2' },
  { label: 'Pinterest',   color: '#e60023' },
  { label: 'Vimeo',       color: '#1ab7ea' },
  { label: '& more',      color: '#7c3aed' },
]

export default function HomePage({ onDownloadComplete, addToast }) {
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState(null)

  const [isFetching, setIsFetching] = useState(false)
  const [media, setMedia] = useState(null)
  const [fetchError, setFetchError] = useState(null)

  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadStage, setDownloadStage] = useState('preparing')
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [downloadError, setDownloadError] = useState(null)

  const handleUrlChange = useCallback((val) => {
    setUrl(val)
    setUrlError(null)
    if (media) { setMedia(null); setFetchError(null); setDownloadError(null) }
    setLastUrl(val)
  }, [media])

  const handleAnalyze = useCallback(async () => {
    const trimmed = url.trim()
    const { valid, error } = validateUrl(trimmed)
    if (!valid) {
      setUrlError(error)
      return
    }

    setIsFetching(true)
    setMedia(null)
    setFetchError(null)
    setDownloadError(null)

    try {
      const data = await fetchMediaInfo(trimmed)
      setMedia(data)
    } catch (err) {
      setFetchError(err)
      addToast(err.message || 'Failed to fetch media info.', 'error')
    } finally {
      setIsFetching(false)
    }
  }, [url, addToast])

  const handleDownload = useCallback(async ({ format_id, download_type, quality_label, thumbnail_ext }) => {
    if (!media) return
    setIsDownloading(true)
    setDownloadError(null)
    setDownloadStage('preparing')
    setDownloadPercent(5)

    try {
      await downloadMedia({
        url: url.trim(),
        format_id,
        download_type,
        quality_label,
        thumbnail_ext,
        onProgress: ({ stage, percent }) => {
          setDownloadStage(stage)
          setDownloadPercent(percent)
        },
      })

      setDownloadStage('completed')
      setDownloadPercent(100)
      addToast('Download started!', 'success')

      onDownloadComplete({
        title:         media.title,
        thumbnail:     media.thumbnail,
        platform:      media.platform,
        uploader:      media.uploader,
        webpage_url:   media.webpage_url,
        download_type,
        quality_label,
      })

      setTimeout(() => {
        setIsDownloading(false)
        setDownloadStage('preparing')
        setDownloadPercent(0)
      }, 2500)
    } catch (err) {
      setDownloadError(err)
      setIsDownloading(false)
      addToast(err.message || 'Download failed.', 'error')
    }
  }, [media, url, addToast, onDownloadComplete])

  const handleCopyTitle = useCallback(() => {
    if (!media?.title) return
    navigator.clipboard.writeText(media.title).then(() => addToast('Title copied!', 'success'))
  }, [media, addToast])

  const handleCopyUrl = useCallback(() => {
    const u = media?.webpage_url || url
    if (!u) return
    navigator.clipboard.writeText(u).then(() => addToast('URL copied!', 'success'))
  }, [media, url, addToast])

  return (
    <div className={styles.page}>
      {/* Page header */}
      <header className={styles.pageHeader}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden="true" />
          Free — Fast — Private
        </div>
        <h1 className={styles.heading} id="page-heading">
          Download Any<br />
          <span className={styles.headingAccent}>Media, Anywhere</span>
        </h1>
       
      </header>

      {/* URL Input */}
      <section className={styles.inputSection} aria-label="URL input">
        <UrlInput
          url={url}
          onChange={handleUrlChange}
          onAnalyze={handleAnalyze}
          isLoading={isFetching}
          error={urlError}
        />

        <div className={styles.platformRow} aria-label="Supported platforms">
          <span className={styles.platformLabel}>Supports</span>
          {PLATFORMS.map(p => (
            <span key={p.label} className={styles.platformChip}>
              <span className={styles.platformChipDot} style={{ backgroundColor: p.color }} aria-hidden="true" />
              {p.label}
            </span>
          ))}
        </div>
      </section>

      {/* Results */}
      <section className={styles.results} aria-live="polite">
        {isFetching && <MediaCardSkeleton />}

        {!isFetching && fetchError && (
          <ErrorMessage
            message={fetchError.message}
            code={fetchError.code}
            onRetry={handleAnalyze}
          />
        )}

        {!isFetching && media && !fetchError && (
          <>
            <MediaCard
              media={media}
              onDownload={handleDownload}
              isDownloading={isDownloading}
              onCopyTitle={handleCopyTitle}
              onCopyUrl={handleCopyUrl}
            />

            {isDownloading && (
              <DownloadProgress stage={downloadStage} percent={downloadPercent} />
            )}

            {downloadError && !isDownloading && (
              <ErrorMessage
                message={downloadError.message}
                code={downloadError.code}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}

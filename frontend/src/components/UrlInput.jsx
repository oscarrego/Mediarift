/**
 * components/UrlInput.jsx
 * URL input with paste, clear, and analyze buttons.
 */

import { useState, useRef, useCallback } from 'react'
import styles from './UrlInput.module.css'
import { validateUrl } from '../utils/validators'

const ClipboardIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const XIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className={styles.spinSvg}>
    <circle cx="12" cy="12" r="9" strokeOpacity="0.2"/>
    <path d="M12 3a9 9 0 0 1 9 9" />
  </svg>
)

export default function UrlInput({ url, onChange, onAnalyze, isLoading, error }) {
  const inputRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        onChange(text.trim())
        inputRef.current?.focus()
      }
    } catch {
      inputRef.current?.focus()
    }
  }, [onChange])

  const handleClear = useCallback(() => {
    onChange('')
    inputRef.current?.focus()
  }, [onChange])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !isLoading) {
      onAnalyze()
    }
  }, [onAnalyze, isLoading])

  const validation = url ? validateUrl(url) : null
  const showError = error || (validation && !validation.valid && url.length > 10)

  return (
    <div className={styles.wrapper}>
      <div
        className={`${styles.inputRow} ${isFocused ? styles.focused : ''} ${showError ? styles.hasError : ''}`}
      >
        {/* Left icon */}
        <span className={styles.leftIcon} aria-hidden="true">
          <LinkIcon />
        </span>

        {/* Input */}
        <input
          ref={inputRef}
          id="url-input"
          type="url"
          className={styles.input}
          placeholder="Paste any video or media link…"
          value={url}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          aria-label="Media URL"
          aria-describedby={showError ? 'url-error' : undefined}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Clear button */}
        {url && !isLoading && (
          <button
            className={styles.clearBtn}
            onClick={handleClear}
            aria-label="Clear URL"
            title="Clear"
            id="url-clear-btn"
            type="button"
          >
            <XIcon />
          </button>
        )}

        {/* Paste button */}
        {!url && !isLoading && (
          <button
            className={styles.pasteBtn}
            onClick={handlePaste}
            aria-label="Paste from clipboard"
            title="Paste"
            id="url-paste-btn"
            type="button"
          >
            <ClipboardIcon />
            <span>Paste</span>
          </button>
        )}

        {/* Analyze button — right inside input row */}
        <button
          className={`${styles.analyzeBtn} ${isLoading ? styles.loading : ''}`}
          onClick={onAnalyze}
          disabled={!url || isLoading}
          id="url-analyze-btn"
          type="button"
          aria-label="Fetch media info"
        >
          {isLoading ? (
            <span className={styles.spinnerWrap} aria-hidden="true">
              <SpinnerIcon />
            </span>
          ) : (
            <ArrowRightIcon />
          )}
          <span>{isLoading ? 'Analyzing' : 'Fetch'}</span>
        </button>
      </div>

      {/* Validation error */}
      {showError && (
        <p className={styles.error} id="url-error" role="alert">
          {error || validation?.error}
        </p>
      )}
    </div>
  )
}

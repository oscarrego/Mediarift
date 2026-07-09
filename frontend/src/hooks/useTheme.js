/**
 * hooks/useTheme.js
 * Manages light/dark/system theme, persists to localStorage,
 * and applies [data-theme] to <html>.
 */

import { useState, useEffect, useCallback } from 'react'
import { getTheme, setTheme as persistTheme } from '../utils/storage'

function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => getTheme())
  const [resolved, setResolved] = useState(() => {
    const t = getTheme()
    if (t === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return t
  })

  useEffect(() => {
    applyTheme(theme)
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setResolved(isDark ? 'dark' : 'light')
  }, [theme])

  // Listen for OS-level theme change when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      applyTheme('system')
      setResolved(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next) => {
    setThemeState(next)
    persistTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setTheme])

  return { theme, resolved, setTheme, toggleTheme }
}

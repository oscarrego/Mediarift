/**
 * hooks/useDownloadHistory.js
 * Reads and writes the download history stored in localStorage.
 */

import { useState, useCallback } from 'react'
import { getHistory, setHistory } from '../utils/storage'

const MAX_HISTORY = 50

/**
 * @returns {{
 *   history: Array,
 *   addEntry: Function,
 *   removeEntry: Function,
 *   clearHistory: Function
 * }}
 */
export function useDownloadHistory() {
  const [history, setHistoryState] = useState(() => getHistory())

  const _persist = useCallback((next) => {
    setHistoryState(next)
    setHistory(next)
  }, [])

  /**
   * Add a download to history.
   * @param {object} entry
   */
  const addEntry = useCallback((entry) => {
    const newEntry = {
      id: Date.now().toString(),
      downloadedAt: new Date().toISOString(),
      ...entry,
    }
    _persist(prev => {
      const updated = [newEntry, ...prev].slice(0, MAX_HISTORY)
      setHistory(updated)
      return updated
    })
  }, [_persist])

  const removeEntry = useCallback((id) => {
    _persist(prev => {
      const updated = prev.filter(e => e.id !== id)
      setHistory(updated)
      return updated
    })
  }, [_persist])

  const clearHistory = useCallback(() => {
    _persist([])
  }, [_persist])

  return { history, addEntry, removeEntry, clearHistory }
}

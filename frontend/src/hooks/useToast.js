/**
 * hooks/useToast.js
 * Lightweight toast notification system.
 * Returns { toasts, addToast, removeToast } and a <ToastContainer /> component.
 */

import { useState, useCallback, useRef } from 'react'

let _idCounter = 0

/**
 * @returns {{ toasts: Array, addToast: Function, removeToast: Function }}
 */
export function useToast() {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  /**
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {number} duration  ms (0 = sticky)
   */
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_idCounter
    setToasts(prev => [...prev, { id, message, type, exiting: false }])
    if (duration > 0) {
      timers.current[id] = setTimeout(() => removeToast(id), duration)
    }
    return id
  }, [removeToast])

  return { toasts, addToast, removeToast }
}

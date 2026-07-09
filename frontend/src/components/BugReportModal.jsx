/**
 * components/BugReportModal.jsx
 * FDM-style "Submit a bug report" modal.
 * Sends report via mailto: to oscarrego789@gmail.com
 */

import { useState, useEffect, useRef } from 'react'
import styles from './BugReportModal.module.css'

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

export default function BugReportModal({ onClose }) {
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [attachLogs, setAttachLogs] = useState(true)
  const [errors, setErrors]     = useState({})
  const [submitted, setSubmitted] = useState(false)
  const titleRef = useRef(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const validate = () => {
    const e = {}
    if (!title.trim()) e.title = 'Title is required'
    if (!desc.trim())  e.desc  = 'Description is required'
    if (!email.trim()) e.email = 'E-mail is required'
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    const subject = encodeURIComponent(`[MediaRift Bug] ${title}`)
    const body = encodeURIComponent(
      `Title: ${title}\n\nDescription:\n${desc}\n\nFrom: ${name || 'Anonymous'}\nEmail: ${email}${attachLogs ? '\n\n[Log files attached]' : ''}`
    )
    window.location.href = `mailto:oscarrego789@gmail.com?subject=${subject}&body=${body}`
    setSubmitted(true)
    setTimeout(onClose, 800)
  }

  return (
    <div className={`${styles.backdrop} mr-modal-backdrop`} role="dialog" aria-modal="true" aria-label="Submit a bug report">
      <div className={`${styles.modal} mr-modal-box`}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Submit a bug report</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close" id="bug-modal-close">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="bug-title">
              Title <span className={styles.req}>*</span>
            </label>
            <input
              ref={titleRef}
              id="bug-title"
              className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setErrors(p => ({...p, title: ''})) }}
            />
            {errors.title && <span className={styles.errMsg}>{errors.title}</span>}
          </div>

          {/* Description */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="bug-desc">
              Description <span className={styles.req}>*</span>
            </label>
            <textarea
              id="bug-desc"
              className={`${styles.textarea} ${errors.desc ? styles.inputError : ''}`}
              rows={5}
              value={desc}
              onChange={e => { setDesc(e.target.value); setErrors(p => ({...p, desc: ''})) }}
            />
            {errors.desc && <span className={styles.errMsg}>{errors.desc}</span>}
          </div>

          {/* Name + Email row */}
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="bug-name">Name</label>
              <input
                id="bug-name"
                className={styles.input}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="bug-email">
                E-mail <span className={styles.req}>*</span>
              </label>
              <input
                id="bug-email"
                className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({...p, email: ''})) }}
              />
              {errors.email && <span className={styles.errMsg}>{errors.email}</span>}
            </div>
          </div>

          {/* Attach logs */}
          <label className={styles.checkRow} htmlFor="bug-attach">
            <input
              id="bug-attach"
              type="checkbox"
              checked={attachLogs}
              onChange={e => setAttachLogs(e.target.checked)}
              className={styles.checkbox}
            />
            <span>Attach MediaRift log files <span className={styles.recommended}>(recommended)</span></span>
          </label>

          <p className={styles.reqNote}>* Required fields</p>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} id="bug-cancel">CANCEL</button>
          <button
            className={`${styles.submitBtn} ${submitted ? styles.submitDone : ''}`}
            onClick={handleSubmit}
            id="bug-submit"
            disabled={submitted}
          >
            {submitted ? 'SENT ✓' : 'SUBMIT'}
          </button>
        </div>
      </div>
    </div>
  )
}

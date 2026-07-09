import { useState, useRef, useEffect } from 'react'
import styles from './CustomSelect.module.css'

export default function CustomSelect({
  value,
  onChange,
  options,
  disabled = false,
  triggerClassName = '',
  dropdownClassName = '',
  id = ''
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(opt => opt.value === value)

  const handleToggle = (e) => {
    e.stopPropagation()
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const handleSelect = (e, val) => {
    e.stopPropagation()
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.selectContainer} ${isOpen ? styles.isOpen : ''} ${disabled ? styles.disabled : ''}`}
      id={id}
    >
      <button
        type="button"
        className={`${styles.trigger} ${triggerClassName}`}
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={styles.selectedLabel}>{selectedOption ? selectedOption.label : 'Select...'}</span>
        <svg className={styles.arrow} width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className={`${styles.dropdown} ${dropdownClassName}`} role="listbox">
          {options.map(opt => (
            <div
              key={opt.value}
              className={`${styles.option} ${opt.value === value ? styles.optionSelected : ''}`}
              role="option"
              aria-selected={opt.value === value}
              onClick={(e) => handleSelect(e, opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

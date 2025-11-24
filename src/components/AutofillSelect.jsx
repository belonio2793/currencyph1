import React, { useState } from 'react'

/**
 * Reusable autofill select component for address fields
 * @param {string} name - Input field name
 * @param {string} value - Current value
 * @param {array} dataList - Full list of available options
 * @param {function} searchFunction - Function to filter results (takes query string)
 * @param {function} onChange - Callback when value changes
 * @param {string} placeholder - Input placeholder text
 * @param {string} label - Field label
 * @param {number} maxResults - Maximum results to display (default: 10)
 * @param {string} resultCountLabel - Label for "Showing X of Y" message
 */
export default function AutofillSelect({
  name,
  value,
  dataList,
  searchFunction,
  onChange,
  placeholder = '',
  label = '',
  maxResults = 10,
  resultCountLabel = 'items',
  required = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [filtered, setFiltered] = useState(dataList)

  const handleInputChange = (e) => {
    const query = e.target.value.toLowerCase()
    onChange(e)

    if (query) {
      const results = searchFunction(e.target.value)
      setFiltered(results.slice(0, 100)) // Limit internal to 100 for performance
      setIsOpen(true)
    } else {
      setFiltered(dataList)
      setIsOpen(false)
    }
  }

  const handleFocus = () => {
    setIsOpen(true)
    setFiltered(dataList)
  }

  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 200)
  }

  const handleSelect = (item) => {
    // Create synthetic event for onChange handler
    const event = {
      target: {
        name,
        value: item
      }
    }
    onChange(event)
    setIsOpen(false)
  }

  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          name={name}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
        {isOpen && filtered.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderTop: 'none',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              borderRadius: '0 0 4px 4px'
            }}
          >
            {filtered.slice(0, maxResults).map((item, idx) => (
              <div
                key={`${item}-${idx}`}
                onClick={() => handleSelect(item)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                  backgroundColor: item === value ? '#f5f5f5' : 'white',
                  transition: 'background-color 0.2s',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) =>
                  e.currentTarget.style.backgroundColor = item === value ? '#f5f5f5' : 'white'
                }
              >
                {item}
              </div>
            ))}
            {filtered.length > maxResults && (
              <div
                style={{
                  padding: '10px',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '12px',
                  borderTop: '1px solid #f0f0f0'
                }}
              >
                Showing {maxResults} of {filtered.length} {resultCountLabel}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

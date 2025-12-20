/**
 * Utility to enhance all select elements with search functionality
 * Can be applied globally to make all dropdowns searchable
 */

/**
 * Convert standard HTML select to searchable input with dropdown
 * @param {HTMLSelectElement} selectElement - The select element to enhance
 * @param {Object} options - Configuration options
 */
export function enhanceSelect(selectElement, options = {}) {
  if (!selectElement || selectElement.tagName !== 'SELECT') {
    console.warn('enhanceSelect: Element must be a SELECT tag')
    return null
  }

  const {
    placeholder = 'Search or select...',
    debounceMs = 200,
    maxResults = 10,
    allowCustom = false,
    caseSensitive = false
  } = options

  // Create wrapper
  const wrapper = document.createElement('div')
  wrapper.className = 'searchable-select-wrapper'
  wrapper.style.position = 'relative'

  // Create search input
  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.placeholder = placeholder
  searchInput.className = selectElement.className
  searchInput.setAttribute('autocomplete', 'off')
  searchInput.style.width = '100%'
  searchInput.style.padding = selectElement.style.padding || '8px 12px'
  searchInput.style.border = selectElement.style.border || '1px solid #ccc'
  searchInput.style.borderRadius = selectElement.style.borderRadius || '4px'

  // Create dropdown container
  const dropdown = document.createElement('div')
  dropdown.className = 'searchable-select-dropdown'
  dropdown.style.position = 'absolute'
  dropdown.style.top = '100%'
  dropdown.style.left = '0'
  dropdown.style.right = '0'
  dropdown.style.marginTop = '4px'
  dropdown.style.backgroundColor = 'white'
  dropdown.style.border = '1px solid #ccc'
  dropdown.style.borderRadius = '4px'
  dropdown.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'
  dropdown.style.maxHeight = '300px'
  dropdown.style.overflowY = 'auto'
  dropdown.style.zIndex = '1000'
  dropdown.style.display = 'none'

  // Get original options
  const originalOptions = Array.from(selectElement.options).map((opt, idx) => ({
    value: opt.value,
    label: opt.textContent,
    disabled: opt.disabled,
    selected: opt.selected,
    index: idx,
    element: opt
  }))

  // Update dropdown display
  const updateDropdown = (searchTerm = '') => {
    const filtered = filterOptions(originalOptions, searchTerm, caseSensitive, maxResults)

    dropdown.innerHTML = ''

    if (filtered.length === 0) {
      const emptyMsg = document.createElement('div')
      emptyMsg.style.padding = '10px'
      emptyMsg.style.color = '#999'
      emptyMsg.textContent = 'No results found'
      dropdown.appendChild(emptyMsg)
    } else {
      filtered.forEach(opt => {
        const div = document.createElement('div')
        div.style.padding = '10px 12px'
        div.style.cursor = opt.disabled ? 'not-allowed' : 'pointer'
        div.style.backgroundColor = opt.selected ? '#f5f5f5' : 'white'
        div.style.borderBottom = '1px solid #f0f0f0'
        div.textContent = opt.label

        // Highlight search term
        if (searchTerm) {
          const regex = new RegExp(`(${escapeRegex(searchTerm)})`, caseSensitive ? 'g' : 'gi')
          div.innerHTML = opt.label.replace(regex, '<strong>$1</strong>')
        }

        div.addEventListener('mouseover', () => {
          div.style.backgroundColor = '#f5f5f5'
        })

        div.addEventListener('mouseout', () => {
          div.style.backgroundColor = opt.selected ? '#f5f5f5' : 'white'
        })

        div.addEventListener('click', () => {
          if (!opt.disabled) {
            selectOption(opt)
          }
        })

        dropdown.appendChild(div)
      })
    }
  }

  // Select option
  const selectOption = (opt) => {
    // Update original select
    selectElement.value = opt.value

    // Trigger change event
    selectElement.dispatchEvent(new Event('change', { bubbles: true }))

    // Update input
    searchInput.value = opt.label

    // Close dropdown
    dropdown.style.display = 'none'
  }

  // Handle input
  let debounceTimer
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      updateDropdown(term)

      // Autofill if single result
      const filtered = filterOptions(originalOptions, term, caseSensitive, maxResults)
      if (filtered.length === 1 && term.length > 0) {
        selectOption(filtered[0])
      }
    }, debounceMs)

    dropdown.style.display = filtered.length > 0 ? 'block' : 'none'
  })

  // Focus/blur handling
  searchInput.addEventListener('focus', () => {
    dropdown.style.display = 'block'
    updateDropdown(searchInput.value)
  })

  searchInput.addEventListener('blur', () => {
    setTimeout(() => {
      dropdown.style.display = 'none'
    }, 200)
  })

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      dropdown.style.display = 'block'
      const items = dropdown.querySelectorAll('div:not(:first-child)')
      if (items.length > 0) items[0].focus()
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none'
    }
  })

  // Setup wrapper
  selectElement.parentNode.insertBefore(wrapper, selectElement)
  wrapper.appendChild(searchInput)
  wrapper.appendChild(dropdown)
  wrapper.appendChild(selectElement)

  // Hide original select
  selectElement.style.display = 'none'

  // Initialize dropdown
  const filtered = filterOptions(originalOptions, '', caseSensitive, maxResults)
  const selected = originalOptions.find(opt => opt.selected)
  if (selected) {
    searchInput.value = selected.label
  }

  return {
    wrapper,
    searchInput,
    dropdown,
    destroy: () => {
      wrapper.parentNode.insertBefore(selectElement, wrapper)
      wrapper.remove()
      selectElement.style.display = ''
    }
  }
}

/**
 * Filter options based on search term
 */
function filterOptions(options, searchTerm, caseSensitive = false, maxResults = 10) {
  let filtered = options

  if (searchTerm) {
    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase()
    filtered = options.filter(opt => {
      const label = caseSensitive ? opt.label : opt.label.toLowerCase()
      return label.includes(term)
    })
  }

  return filtered.slice(0, maxResults)
}

/**
 * Escape regex special characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Enhance all select elements on page
 */
export function enhanceAllSelects(options = {}) {
  const selects = document.querySelectorAll('select:not([data-searchable="true"])')
  const enhanced = []

  selects.forEach(select => {
    const result = enhanceSelect(select, options)
    if (result) {
      select.setAttribute('data-searchable', 'true')
      enhanced.push(result)
    }
  })

  return enhanced
}

/**
 * Configuration for common dropdown types with pre-configured options
 */
export const selectConfigs = {
  currency: {
    placeholder: 'Search currency...',
    debounceMs: 150,
    caseSensitive: false
  },
  country: {
    placeholder: 'Search country...',
    debounceMs: 150,
    caseSensitive: false
  },
  category: {
    placeholder: 'Search category...',
    debounceMs: 200,
    maxResults: 15
  },
  date: {
    placeholder: 'Select date...',
    debounceMs: 100
  },
  number: {
    placeholder: 'Select number...',
    debounceMs: 100
  }
}

/**
 * Enhance select with predefined config
 */
export function enhanceSelectWithConfig(selectElement, configType) {
  const config = selectConfigs[configType] || {}
  return enhanceSelect(selectElement, config)
}

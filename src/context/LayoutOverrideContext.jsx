import React, { createContext, useContext, useState, useEffect } from 'react'

const LayoutOverrideContext = createContext(null)

export function LayoutOverrideProvider({ children }) {
  const [layoutOverride, setLayoutOverride] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Load layout override from localStorage on mount
    try {
      const stored = localStorage.getItem('dev_layout_override')
      if (stored) {
        setLayoutOverride(stored)
      }
    } catch (e) {
      console.warn('Could not load layout override from localStorage', e)
    }
    setIsInitialized(true)
  }, [])

  const setLayout = (layout) => {
    setLayoutOverride(layout)
    try {
      if (layout) {
        localStorage.setItem('dev_layout_override', layout)
      } else {
        localStorage.removeItem('dev_layout_override')
      }
    } catch (e) {
      console.warn('Could not save layout override to localStorage', e)
    }
  }

  return (
    <LayoutOverrideContext.Provider value={{ layoutOverride, setLayout, isInitialized }}>
      {children}
    </LayoutOverrideContext.Provider>
  )
}

export function useLayoutOverride() {
  const context = useContext(LayoutOverrideContext)
  if (!context) {
    throw new Error('useLayoutOverride must be used within LayoutOverrideProvider')
  }
  return context
}

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useDeviceDetection } from '../lib/useDeviceDetection'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const actualDevice = useDeviceDetection()
  const [effectiveDevice, setEffectiveDevice] = useState(actualDevice)
  const [layoutOverride, setLayoutOverride] = useState(null)

  // Function to apply layout override
  const applyLayoutOverride = (actualDev) => {
    try {
      const stored = localStorage.getItem('dev_layout_override')

      if (!stored) {
        // No override, use actual device detection
        setEffectiveDevice(actualDev)
        setLayoutOverride(null)
        return
      }

      // Apply layout override
      if (stored === 'mobile') {
        // Force mobile layout
        setEffectiveDevice({
          ...actualDev,
          isMobile: true,
          isTablet: false,
          isDesktop: false,
          deviceType: 'mobile',
          screenSize: 'sm'
        })
        setLayoutOverride('mobile')
      } else if (stored === 'desktop') {
        // Force desktop layout
        setEffectiveDevice({
          ...actualDev,
          isMobile: false,
          isTablet: false,
          isDesktop: true,
          deviceType: 'desktop',
          screenSize: 'lg'
        })
        setLayoutOverride('desktop')
      }
    } catch (e) {
      console.warn('Could not apply layout override', e)
      setEffectiveDevice(actualDev)
      setLayoutOverride(null)
    }
  }

  // Apply override when actual device changes
  useEffect(() => {
    applyLayoutOverride(actualDevice)
  }, [actualDevice])

  // Listen for layout override changes from LayoutOverrideContext
  useEffect(() => {
    const handleLayoutOverrideChange = () => {
      applyLayoutOverride(actualDevice)
    }

    window.addEventListener('layoutOverrideChanged', handleLayoutOverrideChange)
    return () => window.removeEventListener('layoutOverrideChanged', handleLayoutOverrideChange)
  }, [actualDevice])

  return (
    <DeviceContext.Provider value={effectiveDevice}>
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) {
    throw new Error('useDevice must be used within DeviceProvider')
  }
  return context
}

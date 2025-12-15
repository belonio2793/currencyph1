import React, { createContext, useContext, useState, useEffect } from 'react'
import { useDeviceDetection } from '../lib/useDeviceDetection'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const actualDevice = useDeviceDetection()
  const [effectiveDevice, setEffectiveDevice] = useState(actualDevice)

  useEffect(() => {
    // Load layout override from localStorage
    try {
      const stored = localStorage.getItem('dev_layout_override')

      if (!stored) {
        // No override, use actual device detection
        setEffectiveDevice(actualDevice)
        return
      }

      // Apply layout override
      if (stored === 'mobile') {
        // Force mobile layout
        setEffectiveDevice({
          ...actualDevice,
          isMobile: true,
          isTablet: false,
          isDesktop: false,
          deviceType: 'mobile',
          screenSize: 'sm'
        })
      } else if (stored === 'desktop') {
        // Force desktop layout
        setEffectiveDevice({
          ...actualDevice,
          isMobile: false,
          isTablet: false,
          isDesktop: true,
          deviceType: 'desktop',
          screenSize: 'lg'
        })
      }
    } catch (e) {
      console.warn('Could not apply layout override', e)
      setEffectiveDevice(actualDevice)
    }
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

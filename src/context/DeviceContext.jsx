import React, { createContext, useContext } from 'react'
import { useDeviceDetection } from '../lib/useDeviceDetection'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const device = useDeviceDetection()

  return (
    <DeviceContext.Provider value={device}>
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

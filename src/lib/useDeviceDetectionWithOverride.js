import { useState, useEffect } from 'react'
import { useLayoutOverride } from '../context/LayoutOverrideContext'

export function useDeviceDetectionWithOverride(actualDevice) {
  const { layoutOverride } = useLayoutOverride()
  const [effectiveDevice, setEffectiveDevice] = useState(actualDevice)

  useEffect(() => {
    if (!layoutOverride) {
      // No override, use actual device detection
      setEffectiveDevice(actualDevice)
      return
    }

    // Apply layout override
    if (layoutOverride === 'mobile') {
      // Force mobile layout
      setEffectiveDevice({
        ...actualDevice,
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        deviceType: 'mobile',
        screenSize: 'sm'
      })
    } else if (layoutOverride === 'desktop') {
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
  }, [layoutOverride, actualDevice])

  return effectiveDevice
}

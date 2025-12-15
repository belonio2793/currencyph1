import { useState, useEffect } from 'react'

export function useDeviceDetection() {
  const [device, setDevice] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenSize: 'lg',
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    deviceType: 'desktop',
    orientation: typeof window !== 'undefined' ? (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait') : 'portrait'
  })

  useEffect(() => {
    function detectDevice() {
      const width = window.innerWidth
      const height = window.innerHeight
      const userAgent = navigator.userAgent

      // Detect device type from User Agent
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
      const isTabletDevice = /iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent) || (width >= 768 && width < 1024)
      const isDesktopDevice = !isMobileDevice && !isTabletDevice

      // Determine screen size breakpoint
      let screenSize = 'lg'
      if (width < 640) screenSize = 'xs'
      else if (width < 768) screenSize = 'sm'
      else if (width < 1024) screenSize = 'md'
      else if (width < 1280) screenSize = 'lg'
      else screenSize = 'xl'

      const orientation = width > height ? 'landscape' : 'portrait'

      // Mobile is anything under 768px OR a mobile device detected
      const isMobile = (width < 768) || (isMobileDevice && !isTabletDevice)
      const isTablet = isTabletDevice && width >= 768
      const isDesktop = !isMobile && !isTablet

      setDevice({
        isMobile,
        isTablet,
        isDesktop,
        screenSize,
        width,
        height,
        deviceType: isMobile ? 'mobile' : (isTablet ? 'tablet' : 'desktop'),
        orientation,
        isMobileDevice,
        isTabletDevice,
        isDesktopDevice
      })
    }

    // Initial detection
    detectDevice()

    // Listen to resize events
    window.addEventListener('resize', detectDevice)
    window.addEventListener('orientationchange', detectDevice)

    return () => {
      window.removeEventListener('resize', detectDevice)
      window.removeEventListener('orientationchange', detectDevice)
    }
  }, [])

  return device
}

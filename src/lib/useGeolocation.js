import { useState, useEffect, useRef } from 'react'

export function useGeolocation() {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState(null)
  const isMountedRef = useRef(true)
  const controllersRef = useRef([])

  const requestLocation = () => {
    try {
      if (!navigator.geolocation) {
        setError('Geolocation not supported')
        setLoading(false)
        return
      }

      setLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isMountedRef.current) return

          const { latitude, longitude } = position.coords
          setLocation({ latitude, longitude })
          setError(null)

          // Try reverse geocoding to get city name - with full isolation
          const reverseGeocode = async () => {
            if (!isMountedRef.current) return

            try {
              const MAPTILER_KEY = import.meta?.env?.VITE_MAPTILER_API_KEY || import.meta?.env?.MAPTILER_API_KEY

              if (MAPTILER_KEY) {
                try {
                  const url = `https://api.maptiler.com/geocoding/reverse/${longitude},${latitude}.json?key=${encodeURIComponent(MAPTILER_KEY)}`
                  const controller = new AbortController()
                  controllersRef.current.push(controller)
                  let timedOut = false

                  const timeoutId = setTimeout(() => {
                    if (timedOut) return // Already timed out, skip
                    timedOut = true
                    try {
                      controller?.abort?.()
                    } catch (e) {
                      // Silently ignore all abort errors
                    }
                  }, 3000)

                  try {
                    const resp = await fetch(url, { signal: controller.signal }).catch(() => null) // Suppress fetch errors
                    clearTimeout(timeoutId)

                    if (resp?.ok && isMountedRef.current) {
                      try {
                        const data = await resp.json()
                        if (data?.features?.[0]?.properties) {
                          const props = data.features[0].properties
                          setCity(props.city || props.town || props.village || props.county || props.state || null)
                          return true
                        }
                      } catch (parseErr) {
                        // JSON parse error - silently ignore
                      }
                    }
                  } catch (fetchErr) {
                    clearTimeout(timeoutId)
                    // Silently ignore all fetch errors including AbortError
                  }
                } catch (e) {
                  // Silently fail - try fallback
                }
              }

              // Fallback to Nominatim
              try {
                const controller = new AbortController()
                controllersRef.current.push(controller)
                let timedOut = false

                const timeoutId = setTimeout(() => {
                  if (timedOut) return // Already timed out, skip
                  timedOut = true
                  try {
                    controller?.abort?.()
                  } catch (e) {
                    // Silently ignore all abort errors
                  }
                }, 3000)

                try {
                  const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                    { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
                  ).catch(() => null) // Suppress fetch errors

                  clearTimeout(timeoutId)

                  if (response?.ok && isMountedRef.current) {
                    try {
                      const nom = await response.json()
                      setCity(
                        nom.address?.city || nom.address?.town || nom.address?.village || nom.address?.county || null
                      )
                    } catch (parseErr) {
                      // JSON parse error - silently ignore
                    }
                  }
                } catch (fetchErr) {
                  clearTimeout(timeoutId)
                  // Silently ignore all fetch errors including AbortError
                }
              } catch (e) {
                // Silently fail - any network error is acceptable
              }
            } catch (e) {
              // Outer catch for any uncaught errors
              // Silently fail
            } finally {
              try {
                if (isMountedRef.current) {
                  setLoading(false)
                }
              } catch (e) {
                // ignore any state-setting errors
              }
            }
          }

          // Execute reverse geocoding without letting errors bubble up
          reverseGeocode().catch((err) => {
            // Silently catch any errors that somehow escape, including AbortError
            // Do not log or re-throw
            void err
          }).catch(() => {
            // Double-catch to ensure no errors escape
          })
        },
        (err) => {
          if (isMountedRef.current) {
            console.debug('Geolocation error:', err?.message || 'Unknown error')
            setError(err?.message || 'Location not available')
            setLoading(false)
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  useEffect(() => {
    isMountedRef.current = true

    // Suppress unhandled AbortError rejections from geolocation operations
    const unhandledRejectionHandler = (event) => {
      if (event?.reason?.name === 'AbortError' ||
          event?.message?.includes?.('signal is aborted')) {
        event.preventDefault?.()
      }
    }
    window.addEventListener('unhandledrejection', unhandledRejectionHandler)

    requestLocation()

    // Watch position for continuous updates
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!isMountedRef.current) return

        const { latitude, longitude } = position.coords
        setLocation({ latitude, longitude })
      },
      (err) => {
        console.debug('Geolocation error:', err)
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    )

    // listen for external refresh requests
    const handler = () => { requestLocation() }
    window.addEventListener('geolocation:refresh', handler)

    return () => {
      isMountedRef.current = false
      try {
        navigator.geolocation.clearWatch(watchId)
      } catch (e) {
        // ignore clearWatch errors
      }
      // Abort all pending fetch requests safely
      const controllers = controllersRef.current || []
      controllers.forEach(controller => {
        try {
          if (controller?.abort && controller.signal && !controller.signal.aborted) {
            controller.abort()
          }
        } catch (e) {
          // ignore individual abort errors
        }
      })
      controllersRef.current = []
      window.removeEventListener('geolocation:refresh', handler)
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler)
    }
  }, [])

  return { location, error, loading, city }
}

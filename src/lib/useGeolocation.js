import { useState, useEffect, useRef } from 'react'

export function useGeolocation() {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState(null)
  const isMountedRef = useRef(true)
  const controllersRef = useRef([])

  useEffect(() => {
    isMountedRef.current = true

    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      setLoading(false)
      return
    }

    const requestLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isMountedRef.current) return

          const { latitude, longitude } = position.coords
          setLocation({ latitude, longitude })
          setError(null)

          // Try reverse geocoding to get city name
          ;(async () => {
            if (!isMountedRef.current) return

            try {
              const MAPTILER_KEY = import.meta?.env?.VITE_MAPTILER_API_KEY || import.meta?.env?.MAPTILER_API_KEY || null
              let data = null

              if (MAPTILER_KEY) {
                const url = `https://api.maptiler.com/geocoding/reverse/${longitude},${latitude}.json?key=${encodeURIComponent(MAPTILER_KEY)}`
                const controller = new AbortController()
                controllersRef.current.push(controller)

                let timeoutId = null
                try {
                  timeoutId = setTimeout(() => {
                    try {
                      if (!controller.signal.aborted) {
                        controller.abort()
                      }
                    } catch (e) {
                      // ignore abort errors
                    }
                  }, 7000)

                  const resp = await fetch(url, { signal: controller.signal })
                  if (timeoutId) clearTimeout(timeoutId)

                  if (resp.ok && isMountedRef.current) {
                    data = await resp.json()
                  }
                } catch (e) {
                  if (timeoutId) clearTimeout(timeoutId)
                  // Silently fail for network/abort errors - not user-facing
                  const isNetworkError = e.name === 'AbortError' || e.code === 'ABORT_ERR' || e.message === 'Failed to fetch'
                  if (!isNetworkError) {
                    console.debug('MapTiler reverse geocoding failed:', e.message)
                  }
                }

                if (data && data.features && data.features.length && isMountedRef.current) {
                  const props = data.features[0].properties || {}
                  setCity(props.city || props.town || props.village || props.county || props.state || null)
                  setLoading(false)
                  return
                }
              }

              if (!isMountedRef.current) return

              // Fallback to Nominatim
              try {
                const controller2 = new AbortController()
                controllersRef.current.push(controller2)

                let timeoutId = null
                try {
                  timeoutId = setTimeout(() => {
                    try {
                      if (!controller2.signal.aborted) {
                        controller2.abort()
                      }
                    } catch (e) {
                      // ignore abort errors
                    }
                  }, 7000)

                  const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                    { signal: controller2.signal, headers: { 'Accept-Language': 'en' } }
                  )
                  if (timeoutId) clearTimeout(timeoutId)

                  if (response.ok && isMountedRef.current) {
                    const nom = await response.json()
                    setCity(
                      nom.address?.city || nom.address?.town || nom.address?.village || nom.address?.county || null
                    )
                  }
                } catch (err) {
                  if (timeoutId) clearTimeout(timeoutId)
                  // Silently fail for network/abort errors - not user-facing
                  const isNetworkError = err.name === 'AbortError' || err.code === 'ABORT_ERR' || err.message === 'Failed to fetch'
                  if (!isNetworkError) {
                    console.debug('Nominatim reverse geocoding failed:', err.message)
                  }
                }
              } catch (err) {
                // Silently ignore outer catch
              }

              // Always reset loading state when done
              if (isMountedRef.current) {
                setLoading(false)
              }
            } catch (err) {
              // Silently ignore outer error
              if (isMountedRef.current) {
                setLoading(false)
              }
            }
          })().catch(err => {
            // Final safety catch to prevent unhandled promise rejections
            console.debug('Reverse geocoding error:', err?.message)
            if (isMountedRef.current) {
              setLoading(false)
            }
          })
        },
        (err) => {
          if (isMountedRef.current) {
            setError(err.message)
            setLoading(false)
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }

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

    return () => {
      isMountedRef.current = false
      try {
        navigator.geolocation.clearWatch(watchId)
      } catch (e) {
        // ignore clearWatch errors
      }
      // Abort all pending fetch requests
      try {
        controllersRef.current.forEach(controller => {
          try {
            if (controller && controller.signal && !controller.signal.aborted) {
              controller.abort()
            }
          } catch (e) {
            // ignore individual abort errors
          }
        })
      } catch (e) {
        // ignore overall abort errors
      }
      controllersRef.current = []
    }
  }, [])

  return { location, error, loading, city }
}

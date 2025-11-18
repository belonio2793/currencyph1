import { useState, useEffect, useRef } from 'react'

export function useGeolocation() {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState(null)
  const isMountedRef = useRef(true)
  const abortControllersRef = useRef([])

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
                  abortControllersRef.current.push(controller)
                  let timedOut = false

                  const timeoutId = setTimeout(() => {
                    if (isMountedRef.current) {
                      timedOut = true
                      try {
                        controller.abort()
                      } catch (e) {
                        // Ignore abort errors
                      }
                    }
                  }, 3000)

                  try {
                    const resp = await fetch(url, { signal: controller.signal })
                    if (timedOut || !isMountedRef.current) {
                      clearTimeout(timeoutId)
                      return
                    }
                    clearTimeout(timeoutId)

                    if (resp?.ok && isMountedRef.current) {
                      try {
                        const data = await resp.json()
                        if (isMountedRef.current && data?.features?.[0]?.properties) {
                          const props = data.features[0].properties
                          setCity(props.city || props.town || props.village || props.county || props.state || null)
                          return true
                        }
                      } catch (parseErr) {
                        // Silently ignore JSON parse errors
                      }
                    }
                  } catch (fetchErr) {
                    clearTimeout(timeoutId)
                    // Check if it's an AbortError from timeout or component unmount
                    if (fetchErr?.name === 'AbortError' || timedOut) {
                      return
                    }
                    if (isMountedRef.current) {
                      console.debug('MapTiler fetch error:', fetchErr?.message)
                    }
                  }
                } catch (e) {
                  // Silently fail MapTiler, try fallback
                }
              }

              // Fallback to Nominatim
              try {
                const controller = new AbortController()
                abortControllersRef.current.push(controller)
                let timedOut = false

                const timeoutId = setTimeout(() => {
                  if (isMountedRef.current) {
                    timedOut = true
                    try {
                      controller.abort()
                    } catch (e) {
                      // Ignore abort errors
                    }
                  }
                }, 3000)

                try {
                  const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                    {
                      headers: { 'Accept-Language': 'en' },
                      signal: controller.signal
                    }
                  )
                  if (timedOut || !isMountedRef.current) {
                    clearTimeout(timeoutId)
                    return
                  }
                  clearTimeout(timeoutId)

                  if (response?.ok && isMountedRef.current) {
                    try {
                      const nom = await response.json()
                      if (isMountedRef.current) {
                        setCity(
                          nom.address?.city || nom.address?.town || nom.address?.village || nom.address?.county || null
                        )
                      }
                    } catch (parseErr) {
                      // Silently ignore JSON parse errors
                    }
                  }
                } catch (fetchErr) {
                  clearTimeout(timeoutId)
                  // Check if it's an AbortError from timeout or component unmount
                  if (fetchErr?.name === 'AbortError' || timedOut) {
                    return
                  }
                  if (isMountedRef.current) {
                    console.debug('Nominatim fetch error:', fetchErr?.message)
                  }
                }
              } catch (e) {
                // Silently fail Nominatim fallback
              }
            } catch (e) {
              // Silently fail reverse geocoding
            } finally {
              try {
                if (isMountedRef.current) {
                  setLoading(false)
                }
              } catch (e) {}
            }
          }

          reverseGeocode().catch(() => {})
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

      // Abort all pending fetch requests
      try {
        abortControllersRef.current.forEach(controller => {
          try {
            controller.abort()
          } catch (e) {}
        })
        abortControllersRef.current = []
      } catch (e) {}

      try {
        navigator.geolocation.clearWatch(watchId)
      } catch (e) {}
      window.removeEventListener('geolocation:refresh', handler)
    }
  }, [])

  return { location, error, loading, city }
}

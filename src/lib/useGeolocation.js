import { useState, useEffect, useRef } from 'react'

export function useGeolocation() {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState(null)
  const isMountedRef = useRef(true)

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
                  let timedOut = false

                  const timeoutId = setTimeout(() => {
                    timedOut = true
                    try {
                      controller.abort()
                    } catch (e) {}
                  }, 3000)

                  try {
                    const resp = await fetch(url, { signal: controller.signal })
                    clearTimeout(timeoutId)

                    if (resp?.ok && isMountedRef.current) {
                      try {
                        const data = await resp.json()
                        if (data?.features?.[0]?.properties) {
                          const props = data.features[0].properties
                          setCity(props.city || props.town || props.village || props.county || props.state || null)
                          return true
                        }
                      } catch (parseErr) {}
                    }
                  } catch (fetchErr) {
                    clearTimeout(timeoutId)
                    if (fetchErr?.name === 'AbortError' && timedOut) {
                      // Expected timeout, silently ignore
                    } else if (fetchErr?.name !== 'AbortError') {
                      // Unexpected error
                    }
                  }
                } catch (e) {
                  // Silently fail MapTiler, try fallback
                }
              }

              // Fallback to Nominatim
              try {
                const controller = new AbortController()
                let completed = false

                const timeoutId = setTimeout(() => {
                  if (!completed) {
                    controller.abort()
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
                  completed = true
                  clearTimeout(timeoutId)

                  if (response?.ok && isMountedRef.current) {
                    try {
                      const nom = await response.json()
                      setCity(
                        nom.address?.city || nom.address?.town || nom.address?.village || nom.address?.county || null
                      )
                    } catch (parseErr) {}
                  }
                } catch (fetchErr) {
                  completed = true
                  clearTimeout(timeoutId)
                  if (fetchErr.name !== 'AbortError') {
                    // Only log non-abort errors
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
      try {
        navigator.geolocation.clearWatch(watchId)
      } catch (e) {}
      window.removeEventListener('geolocation:refresh', handler)
    }
  }, [])

  return { location, error, loading, city }
}

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

                  const timeoutId = setTimeout(() => {
                    try {
                      if (controller && controller.signal && !controller.signal.aborted) controller.abort()
                    } catch (e) {
                      // ignore
                    }
                  }, 5000)

                  try {
                    const resp = await fetch(url, { signal: controller.signal })
                    clearTimeout(timeoutId)

                    if (resp.ok && isMountedRef.current) {
                      const data = await resp.json()
                      if (data?.features?.[0]?.properties) {
                        const props = data.features[0].properties
                        setCity(props.city || props.town || props.village || props.county || props.state || null)
                        return true
                      }
                    }
                  } catch (e) {
                    clearTimeout(timeoutId)
                    // Silently fail - network error
                  }
                } catch (e) {
                  // Silently fail
                }
              }

              // Fallback to Nominatim
              try {
                const controller = new AbortController()
                controllersRef.current.push(controller)

                const timeoutId = setTimeout(() => {
                  try {
                    controller.abort()
                  } catch (e) {
                    // ignore
                  }
                }, 5000)

                try {
                  const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                    { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
                  )
                  clearTimeout(timeoutId)

                  if (response.ok && isMountedRef.current) {
                    const nom = await response.json()
                    setCity(
                      nom.address?.city || nom.address?.town || nom.address?.village || nom.address?.county || null
                    )
                  }
                } catch (e) {
                  clearTimeout(timeoutId)
                  // Silently fail - network error
                }
              } catch (e) {
                // Silently fail
              }
            } finally {
              if (isMountedRef.current) {
                setLoading(false)
              }
            }
          }

          // Execute reverse geocoding without letting errors bubble up
          Promise.resolve().then(reverseGeocode).catch(() => {
            // Catch any errors that somehow escape
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

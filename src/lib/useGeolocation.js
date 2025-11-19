import { useState, useEffect, useRef } from 'react'
import { reverseGeocode } from './nominatimService.js'

export function useGeolocation() {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isMountedRef = useRef(true)
  const abortControllersRef = useRef([])

  const requestLocation = (isRefresh = false) => {
    try {
      if (!navigator.geolocation) {
        setError('Geolocation not supported')
        if (!isRefresh) setLoading(false)
        else setIsRefreshing(false)
        return
      }

      if (isRefresh) setIsRefreshing(true)
      else setLoading(true)
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
              const GOOGLE_API_KEY = import.meta?.env?.VITE_GOOGLE_API_KEY || import.meta?.env?.GOOGLE_API_KEY

              if (MAPTILER_KEY) {
                try {
                  const url = `https://api.maptiler.com/geocoding/reverse/${longitude},${latitude}.json?key=${encodeURIComponent(MAPTILER_KEY)}`
                  const controller = new AbortController()
                  abortControllersRef.current.push(controller)
                  let timedOut = false

                  const timeoutId = setTimeout(() => {
                  if (isMountedRef.current && !timedOut) {
                    timedOut = true
                    try {
                      controller.abort('Geocoding timeout')
                    } catch (e) {
                      // Ignore abort errors
                    }
                  }
                }, 3000)

                try {
                  const resp = await fetch(url, { signal: controller.signal })
                  if (!isMountedRef.current) {
                    clearTimeout(timeoutId)
                    return
                  }
                  clearTimeout(timeoutId)
                  if (timedOut) return

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

              // Fallback to Nominatim with improved error handling and retries
              try {
                const result = await reverseGeocode(latitude, longitude)
                if (isMountedRef.current && result?.city) {
                  setCity(result.city)
                  return
                }
              } catch (e) {
                if (isMountedRef.current) {
                  console.debug('Nominatim fallback error:', e?.message)
                }
              }

              // Fallback to Google Geocoding API
              if (GOOGLE_API_KEY && isMountedRef.current) {
                try {
                  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${encodeURIComponent(GOOGLE_API_KEY)}`
                  const controller = new AbortController()
                  abortControllersRef.current.push(controller)
                  let timedOut = false

                  const timeoutId = setTimeout(() => {
                    if (isMountedRef.current && !timedOut) {
                      timedOut = true
                      try {
                        controller.abort('Google Geocoding timeout')
                      } catch (e) {
                        // Ignore abort errors
                      }
                    }
                  }, 3000)

                  try {
                    const resp = await fetch(url, { signal: controller.signal })
                    if (!isMountedRef.current) {
                      clearTimeout(timeoutId)
                      return
                    }
                    clearTimeout(timeoutId)
                    if (timedOut) return

                    if (resp?.ok && isMountedRef.current) {
                      try {
                        const data = await resp.json()
                        if (data?.results && data.results.length > 0) {
                          const result = data.results[0]
                          const addressComponents = result.address_components || []

                          // Try to find city/locality from address components
                          let city = null
                          for (const component of addressComponents) {
                            if (component.types.includes('locality')) {
                              city = component.long_name
                              break
                            }
                            if (component.types.includes('administrative_area_level_2')) {
                              city = component.long_name
                              break
                            }
                          }

                          if (isMountedRef.current && city) {
                            setCity(city)
                            return
                          }
                        }
                      } catch (parseErr) {
                        // Silently ignore JSON parse errors
                      }
                    }
                  } catch (fetchErr) {
                    clearTimeout(timeoutId)
                    if (fetchErr?.name === 'AbortError' || timedOut) {
                      return
                    }
                    if (isMountedRef.current) {
                      console.debug('Google Geocoding fetch error:', fetchErr?.message)
                    }
                  }
                } catch (e) {
                  // Silently fail Google geocoding
                }
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
            if (controller && typeof controller.abort === 'function') {
              controller.abort('Component unmounted')
            }
          } catch (e) {
            // Ignore abort errors during cleanup
          }
        })
        abortControllersRef.current = []
      } catch (e) {
        // Ignore cleanup errors
      }

      try {
        navigator.geolocation.clearWatch(watchId)
      } catch (e) {
        // Ignore clearWatch errors
      }
      window.removeEventListener('geolocation:refresh', handler)
    }
  }, [])

  return { location, error, loading, city }
}

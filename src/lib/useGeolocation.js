import { useState, useEffect } from 'react'

export function useGeolocation() {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      setLoading(false)
      return
    }

    // Request geolocation
    const requestLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setLocation({ latitude, longitude })
          setError(null)

          // Try reverse geocoding to get city name — run async work and catch errors to avoid unhandled promise rejections
          ;(async () => {
            try {
              const MAPTILER_KEY = import.meta?.env?.VITE_MAPTILER_API_KEY || import.meta?.env?.MAPTILER_API_KEY || null
              let data = null

              if (MAPTILER_KEY) {
                // MapTiler reverse geocoding
                const url = `https://api.maptiler.com/geocoding/reverse/${longitude},${latitude}.json?key=${encodeURIComponent(MAPTILER_KEY)}`
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 7000)
                try {
                  const resp = await fetch(url, { signal: controller.signal })
                  clearTimeout(timeout)
                  if (resp.ok) data = await resp.json()
                } catch (e) {
                  clearTimeout(timeout)
                  console.debug('MapTiler reverse geocoding failed:', e)
                }

                if (data && data.features && data.features.length) {
                  const props = data.features[0].properties || {}
                  setCity(props.city || props.town || props.village || props.county || props.state || null)
                  return
                }
              }

              // Fallback to Nominatim (may be subject to CORS/policy limits)
              try {
                const controller2 = new AbortController()
                const timeout2 = setTimeout(() => controller2.abort(), 7000)
                const response = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                  { signal: controller2.signal, headers: { 'Accept-Language': 'en' } }
                )
                clearTimeout(timeout2)
                if (response.ok) {
                  const nom = await response.json()
                  setCity(
                    nom.address?.city || nom.address?.town || nom.address?.village || nom.address?.county || null
                  )
                }
              } catch (err) {
                console.debug('Nominatim reverse geocoding failed:', err)
              }
            } catch (err) {
              console.debug('Reverse geocoding failed:', err)
            } finally {
              setLoading(false)
            }
          })()
        },
        (err) => {
          setError(err.message)
          setLoading(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }

    requestLocation()

    // Watch position for continuous updates
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setLocation({ latitude, longitude })
      },
      (err) => {
        console.debug('Geolocation error:', err)
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  return { location, error, loading, city }
}

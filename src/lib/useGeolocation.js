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
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
              )
              if (response.ok) {
                const data = await response.json()
                setCity(
                  data.address?.city ||
                  data.address?.town ||
                  data.address?.village ||
                  data.address?.county ||
                  null
                )
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

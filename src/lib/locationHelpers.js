/**
 * Request location permission from the user
 * This will trigger the browser's native location permission dialog
 */
export async function requestLocationPermission() {
  try {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return false
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Permission granted
          console.log('Location permission granted:', position)
          resolve(true)
        },
        (error) => {
          // Permission denied or error
          console.warn('Location permission error:', error)
          
          if (error.code === 1) { // PERMISSION_DENIED
            alert(
              'Location permission denied. Please enable location access in your browser settings:\n\n' +
              '1. Click the lock icon in your address bar\n' +
              '2. Find "Location" in the permissions list\n' +
              '3. Change it from "Block" to "Allow"\n' +
              '4. Refresh this page'
            )
          } else if (error.code === 3) { // TIMEOUT
            alert('Location request timed out. Please try again.')
          } else {
            alert('Unable to get your location. Please check your settings.')
          }
          
          resolve(false)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })
  } catch (err) {
    console.error('Error requesting location permission:', err)
    return false
  }
}

/**
 * Opens browser settings for location permissions (different per browser/OS)
 * This is a best-effort attempt
 */
export function openLocationSettings() {
  const userAgent = navigator.userAgent.toLowerCase()
  
  if (userAgent.includes('chrome') || userAgent.includes('chromium')) {
    alert(
      'To enable location for this site:\n\n' +
      '1. Click the lock icon 🔒 in the address bar\n' +
      '2. Find "Location" in permissions\n' +
      '3. Select "Allow"\n' +
      '4. Refresh the page'
    )
  } else if (userAgent.includes('firefox')) {
    alert(
      'To enable location for this site:\n\n' +
      '1. Type "about:preferences" in the address bar\n' +
      '2. Go to "Privacy & Security"\n' +
      '3. Find "Permissions" → "Location"\n' +
      '4. Add this site to allow list\n' +
      '5. Refresh this page'
    )
  } else if (userAgent.includes('safari')) {
    alert(
      'To enable location for this site:\n\n' +
      '1. Open Safari Settings\n' +
      '2. Go to "Websites" → "Location Services"\n' +
      '3. Find this website and select "Allow"\n' +
      '4. Refresh the page'
    )
  } else {
    alert(
      'To enable location for this site:\n\n' +
      'Look for a permissions or location setting in your browser settings. ' +
      'You may need to add this website to your allowed sites list.'
    )
  }
}

/**
 * Check if location is available on device
 */
export function isLocationAvailable() {
  return !!navigator.geolocation
}

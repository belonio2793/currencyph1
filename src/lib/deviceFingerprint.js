export const deviceFingerprint = {
  /**
   * Generate a unique device fingerprint based on browser and device characteristics
   */
  async generate() {
    try {
      const components = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown',
        maxTouchPoints: navigator.maxTouchPoints || 0,
        vendor: navigator.vendor,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth,
        timezone_offset: new Date().getTimezoneOffset(),
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        plugins: this.getPluginsList(),
        canvas: await this.getCanvasFingerprint()
      }

      const fingerprint = await this.hashComponents(components)
      return fingerprint
    } catch (error) {
      console.warn('Error generating device fingerprint:', error)
      return this.generateFallback()
    }
  },

  /**
   * Get list of installed plugins
   */
  getPluginsList() {
    const plugins = []
    if (navigator.plugins) {
      for (let i = 0; i < navigator.plugins.length; i++) {
        const plugin = navigator.plugins[i]
        plugins.push({
          name: plugin.name,
          description: plugin.description
        })
      }
    }
    return plugins
  },

  /**
   * Generate canvas fingerprint
   */
  async getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const text = 'Canvas fingerprint'
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText(text, 2, 15)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillText(text, 4, 17)
      return canvas.toDataURL()
    } catch (error) {
      return 'canvas-not-available'
    }
  },

  /**
   * Hash the fingerprint components
   */
  async hashComponents(components) {
    const str = JSON.stringify(components)
    const buffer = new TextEncoder().encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  },

  /**
   * Generate fallback fingerprint if crypto not available
   */
  generateFallback() {
    const str = navigator.userAgent + navigator.language + window.screen.width + window.screen.height
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  },

  /**
   * Store fingerprint in localStorage with timestamp
   */
  store(fingerprint, userId) {
    try {
      const data = {
        fingerprint,
        userId,
        timestamp: Date.now(),
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
      }
      localStorage.setItem('device_fingerprint', JSON.stringify(data))
    } catch (error) {
      console.warn('Error storing device fingerprint:', error)
    }
  },

  /**
   * Retrieve stored fingerprint
   */
  retrieve() {
    try {
      const stored = localStorage.getItem('device_fingerprint')
      if (!stored) return null

      const data = JSON.parse(stored)

      // Check if fingerprint has expired
      if (data.expiresAt && data.expiresAt < Date.now()) {
        localStorage.removeItem('device_fingerprint')
        return null
      }

      return data
    } catch (error) {
      console.warn('Error retrieving device fingerprint:', error)
      return null
    }
  },

  /**
   * Clear stored fingerprint
   */
  clear() {
    try {
      localStorage.removeItem('device_fingerprint')
    } catch (error) {
      console.warn('Error clearing device fingerprint:', error)
    }
  },

  /**
   * Verify if current device matches stored fingerprint
   */
  async verify() {
    try {
      const stored = this.retrieve()
      if (!stored) return false

      const current = await this.generate()
      return current === stored.fingerprint
    } catch (error) {
      console.warn('Error verifying device fingerprint:', error)
      return false
    }
  }
}

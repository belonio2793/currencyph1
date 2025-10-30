// Network diagnostics utility for debugging connection issues
export const networkDiagnostics = {
  async checkSupabaseConnection() {
    try {
      const url = import.meta.env.VITE_PROJECT_URL
      if (!url) {
        return { success: false, error: 'VITE_PROJECT_URL not configured' }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(`${url}/rest/v1/`, {
          method: 'GET',
          signal: controller.signal
        })
        clearTimeout(timeout)
        return { success: response.ok, status: response.status, url }
      } finally {
        clearTimeout(timeout)
      }
    } catch (err) {
      return { success: false, error: err.message, type: 'network' }
    }
  },

  async checkCoingeckoConnection() {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
          signal: controller.signal
        })
        clearTimeout(timeout)
        return { success: response.ok, status: response.status }
      } finally {
        clearTimeout(timeout)
      }
    } catch (err) {
      return { success: false, error: err.message, type: 'network' }
    }
  },

  async runDiagnostics() {
    console.log('🔍 Running network diagnostics...')
    const results = {
      supabase: await this.checkSupabaseConnection(),
      coingecko: await this.checkCoingeckoConnection(),
      timestamp: new Date().toISOString()
    }

    console.table(results)
    return results
  },

  logEnvironment() {
    console.log('📋 Environment Configuration:')
    console.log({
      PROJECT_URL: import.meta.env.VITE_PROJECT_URL ? '✅ Set' : '❌ Not set',
      SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set',
      SUPABASE_SERVICE_ROLE_KEY: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set'
    })
  }
}

// Auto-log environment on module load in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  networkDiagnostics.logEnvironment()
}

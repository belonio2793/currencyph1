import { supabase } from './supabaseClient'
import { propertyTycoonEngine } from './propertyTycoonEngine'

// Track which characters have collected income today
const incomeCollectedToday = new Set()

// Reset collected income tracking every day
const resetDailyTracking = () => {
  const now = new Date()
  const nextReset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const timeUntilReset = nextReset.getTime() - now.getTime()

  setTimeout(() => {
    incomeCollectedToday.clear()
    resetDailyTracking()
  }, timeUntilReset)
}

resetDailyTracking()

export const propertyIncomeCollector = {
  /**
   * Collect income for a single character
   * Should be called once per day per character
   */
  async collectDailyIncome(characterId) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const key = `${characterId}_${today}`

      // Prevent double collection
      if (incomeCollectedToday.has(key)) {
        console.log(`Income already collected for ${characterId} today`)
        return { collected: false, reason: 'already_collected_today' }
      }

      const result = await propertyTycoonEngine.collectPropertyIncome(characterId)

      if (result.totalIncome > 0) {
        incomeCollectedToday.add(key)

        // Create notification
        await supabase
          .from('game_notifications')
          .insert([{
            character_id: characterId,
            type: 'income',
            title: 'Property Income Collected',
            message: `You earned ₱${result.totalIncome.toLocaleString()} from your properties!`,
            data: result,
            is_read: false
          }])
          .then(() => {}) // Ignore if table doesn't exist
          .catch(() => {}) // Continue even if notification fails

        return { collected: true, totalIncome: result.totalIncome, properties: result.properties }
      } else {
        incomeCollectedToday.add(key)
        return { collected: true, totalIncome: 0, properties: [] }
      }
    } catch (err) {
      console.error('Error collecting daily income:', err)
      return { collected: false, error: err.message }
    }
  },

  /**
   * Check if character can collect income today
   */
  canCollectIncome(characterId) {
    const today = new Date().toISOString().split('T')[0]
    const key = `${characterId}_${today}`
    return !incomeCollectedToday.has(key)
  },

  /**
   * Collect income from all active characters (batch operation)
   * Should be called periodically by a background job
   */
  async collectIncomeForAllCharacters() {
    try {
      const { data: characters } = await supabase
        .from('game_characters')
        .select('id')
        .is('archived_at', null) // Only active characters

      if (!characters || characters.length === 0) {
        return { success: true, charactersProcessed: 0, totalIncomeDistributed: 0 }
      }

      let totalIncomeDistributed = 0

      for (const character of characters) {
        try {
          const result = await this.collectDailyIncome(character.id)
          if (result.collected) {
            totalIncomeDistributed += result.totalIncome || 0
          }
        } catch (err) {
          console.error(`Error collecting income for character ${character.id}:`, err)
        }
      }

      return {
        success: true,
        charactersProcessed: characters.length,
        totalIncomeDistributed
      }
    } catch (err) {
      console.error('Error in batch income collection:', err)
      return { success: false, error: err.message }
    }
  },

  /**
   * Start automatic income collection at scheduled times
   * Call this once when the app initializes
   */
  startAutomaticIncomeCollection() {
    // Collect income at specific times: 6 AM, 12 PM, 6 PM, 12 AM (UTC)
    const collectionTimes = [0, 6, 12, 18] // Hours in UTC

    const scheduleNextCollection = () => {
      const now = new Date()
      const currentHour = now.getUTCHours()

      // Find next collection time
      let nextHour = collectionTimes.find(h => h > currentHour)
      if (!nextHour) {
        nextHour = collectionTimes[0] // Next day first collection
      }

      const nextCollectionTime = new Date()
      nextCollectionTime.setUTCHours(nextHour, 0, 0, 0)

      if (nextCollectionTime <= now) {
        nextCollectionTime.setDate(nextCollectionTime.getDate() + 1)
      }

      const timeUntilCollection = nextCollectionTime.getTime() - now.getTime()

      console.log(`Next property income collection scheduled for ${nextCollectionTime.toISOString()}`)

      setTimeout(() => {
        this.collectIncomeForAllCharacters()
          .then(result => {
            console.log('Batch income collection completed:', result)
          })
          .catch(err => {
            console.error('Batch income collection failed:', err)
          })
          .finally(() => {
            scheduleNextCollection()
          })
      }, timeUntilCollection)
    }

    scheduleNextCollection()
  },

  /**
   * Get income projection for a character
   */
  async getIncomeProjection(characterId) {
    try {
      const properties = await propertyTycoonEngine.getCharacterProperties(characterId)

      const dailyIncome = properties.reduce((sum, p) => sum + (p.revenue_per_day || 0), 0)
      const weeklyIncome = dailyIncome * 7
      const monthlyIncome = dailyIncome * 30
      const yearlyIncome = dailyIncome * 365

      return {
        dailyIncome,
        weeklyIncome,
        monthlyIncome,
        yearlyIncome,
        propertyCount: properties.length
      }
    } catch (err) {
      console.error('Error calculating income projection:', err)
      return { dailyIncome: 0, weeklyIncome: 0, monthlyIncome: 0, yearlyIncome: 0, propertyCount: 0 }
    }
  }
}

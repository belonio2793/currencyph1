import { supabase } from './supabaseClient'

export class CurrencyGameEngine {
  constructor(characterId) {
    this.characterId = characterId
    this.properties = []
    this.balance = 0
    this.incomeTimer = null
    this.incomeMultiplier = 1.0
  }

  async loadCharacter(characterId) {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .select('*')
        .eq('id', characterId)
        .single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('Failed to load character:', err)
      return null
    }
  }

  async loadProperties(characterId) {
    try {
      const { data, error } = await supabase
        .from('game_properties')
        .select('*')
        .eq('owner_id', characterId)
      if (error) throw error
      this.properties = data || []
      return this.properties
    } catch (err) {
      console.error('Failed to load properties:', err)
      return []
    }
  }

  async purchaseProperty(characterId, propertyData) {
    try {
      const character = await this.loadCharacter(characterId)
      if (!character) throw new Error('Character not found')

      if (character.money < propertyData.purchase_price) {
        throw new Error('Insufficient funds')
      }

      const { data, error } = await supabase
        .from('game_properties')
        .insert([{
          owner_id: characterId,
          ...propertyData,
          current_value: propertyData.purchase_price
        }])
        .select()
        .single()

      if (error) throw error

      await supabase
        .from('game_characters')
        .update({ money: character.money - propertyData.purchase_price })
        .eq('id', characterId)

      return data
    } catch (err) {
      console.error('Failed to purchase property:', err)
      throw err
    }
  }

  async sellProperty(characterId, propertyId, salePrice) {
    try {
      const { data: property, error: propError } = await supabase
        .from('game_properties')
        .select('*')
        .eq('id', propertyId)
        .eq('owner_id', characterId)
        .single()

      if (propError) throw new Error('Property not found')

      await supabase
        .from('game_properties')
        .delete()
        .eq('id', propertyId)

      const character = await this.loadCharacter(characterId)
      await supabase
        .from('game_characters')
        .update({ money: character.money + salePrice })
        .eq('id', characterId)

      return { success: true, salePrice }
    } catch (err) {
      console.error('Failed to sell property:', err)
      throw err
    }
  }

  async upgradeProperty(propertyId, upgradeCost) {
    try {
      const { data, error } = await supabase
        .from('game_properties')
        .select('*')
        .eq('id', propertyId)
        .single()

      if (error) throw error

      const newValue = (data.current_value || 0) + upgradeCost
      const newRevenue = (data.revenue_per_day || 0) * 1.25

      const { data: updated, error: updateError } = await supabase
        .from('game_properties')
        .update({
          current_value: newValue,
          revenue_per_day: newRevenue
        })
        .eq('id', propertyId)
        .select()
        .single()

      if (updateError) throw updateError
      return updated
    } catch (err) {
      console.error('Failed to upgrade property:', err)
      throw err
    }
  }

  async startIncomeGeneration(characterId) {
    if (this.incomeTimer) clearInterval(this.incomeTimer)

    this.incomeTimer = setInterval(async () => {
      try {
        const properties = await this.loadProperties(characterId)
        const dailyIncome = properties.reduce((sum, p) => sum + (p.revenue_per_day || 0), 0)

        if (dailyIncome > 0) {
          const character = await this.loadCharacter(characterId)
          const newBalance = (character.money || 0) + (dailyIncome / 1440)

          await supabase
            .from('game_characters')
            .update({ money: newBalance })
            .eq('id', characterId)
        }
      } catch (err) {
        console.warn('Income generation error:', err)
      }
    }, 60000)
  }

  stopIncomeGeneration() {
    if (this.incomeTimer) {
      clearInterval(this.incomeTimer)
      this.incomeTimer = null
    }
  }

  getTotalDailyIncome() {
    return this.properties.reduce((sum, p) => sum + (p.revenue_per_day || 0), 0)
  }

  getTotalPropertyValue() {
    return this.properties.reduce((sum, p) => sum + (p.current_value || 0), 0)
  }

  getPropertyROI(property) {
    if (!property.current_value) return 0
    return ((property.revenue_per_day * 365) / property.current_value * 100).toFixed(2)
  }

  destroy() {
    this.stopIncomeGeneration()
  }
}

export default CurrencyGameEngine

import { supabase } from './supabaseClient'

/**
 * Monopoly Game Engine
 * Handles property mechanics, income generation, upgrades, and monopoly bonuses
 * Adapted for Philippines RPG - free-roam, no turns/dice
 */

export const monopolyGameEngine = {
  // INCOME CALCULATION
  
  /**
   * Calculate passive income rate for a property based on house level
   * Uses classic Monopoly rent progression
   */
  calculatePropertyIncome(property, playerPropertyOwnership, isMonopolyOwned = false) {
    if (!property || !playerPropertyOwnership) return 0
    if (playerPropertyOwnership.mortgaged) return 0

    const houses = playerPropertyOwnership.houses
    const incomeLevels = property.income_levels || [0, 10, 30, 90, 160, 250]
    
    let baseIncome = incomeLevels[Math.min(houses, incomeLevels.length - 1)] || property.base_income
    
    // Apply monopoly bonus (2x income) if player owns all properties in color group
    const monopolyMultiplier = isMonopolyOwned && houses === 0 ? 2.0 : 1.0
    
    return baseIncome * monopolyMultiplier
  },

  /**
   * Check if player owns all properties in a color group
   */
  async isMonopolyOwned(playerId, colorGroup) {
    try {
      const { data: properties } = await supabase
        .from('monopoly_properties')
        .select('id')
        .eq('color_group', colorGroup)

      if (!properties || properties.length === 0) return false

      const propertyIds = properties.map(p => p.id)

      const { data: ownedCount, error } = await supabase
        .from('player_property_ownership')
        .select('id', { count: 'exact' })
        .eq('player_id', playerId)
        .in('property_id', propertyIds)

      if (error) throw error

      return ownedCount?.length === propertyIds.length && propertyIds.length > 0
    } catch (err) {
      console.error('Error checking monopoly:', err)
      return false
    }
  },

  /**
   * Calculate total passive income per tick (usually hourly or every 5 minutes)
   */
  async calculatePlayerPassiveIncome(playerId) {
    try {
      const { data: ownerships, error } = await supabase
        .from('player_property_ownership')
        .select('*, monopoly_properties(*)')
        .eq('player_id', playerId)

      if (error) throw error

      let totalIncome = 0

      for (const ownership of ownerships || []) {
        const property = ownership.monopoly_properties
        const isMonopoly = await this.isMonopolyOwned(playerId, property.color_group)
        const income = this.calculatePropertyIncome(property, ownership, isMonopoly)
        totalIncome += income
      }

      return totalIncome
    } catch (err) {
      console.error('Error calculating passive income:', err)
      return 0
    }
  },

  // PROPERTY OWNERSHIP

  /**
   * Purchase a property
   */
  async purchaseProperty(playerId, propertyId) {
    try {
      const { data: property, error: propErr } = await supabase
        .from('monopoly_properties')
        .select('*')
        .eq('id', propertyId)
        .single()

      if (propErr) throw propErr

      // Check player money
      const { data: character, error: charErr } = await supabase
        .from('game_characters')
        .select('money')
        .eq('user_id', playerId)
        .single()

      if (charErr) throw charErr

      if ((character?.money || 0) < property.base_price) {
        throw new Error('Insufficient funds')
      }

      // Create ownership record
      const { data: ownership, error: owError } = await supabase
        .from('player_property_ownership')
        .insert([{
          player_id: playerId,
          property_id: propertyId,
          houses: 0,
          passive_income_rate: property.base_income
        }])
        .select()
        .single()

      if (owError) throw owError

      // Deduct money
      await supabase
        .from('game_characters')
        .update({ money: (character.money || 0) - property.base_price })
        .eq('user_id', playerId)

      // Log income
      await supabase
        .from('income_history')
        .insert([{
          player_id: playerId,
          property_id: propertyId,
          amount: -property.base_price,
          income_source: 'property_purchase'
        }])

      return ownership
    } catch (err) {
      console.error('Error purchasing property:', err)
      throw err
    }
  },

  /**
   * Upgrade a property (add houses/hotels)
   */
  async upgradeProperty(playerId, propertyOwnershipId) {
    try {
      const { data: ownership, error: ownErr } = await supabase
        .from('player_property_ownership')
        .select('*, monopoly_properties(*)')
        .eq('id', propertyOwnershipId)
        .single()

      if (ownErr) throw ownErr

      const property = ownership.monopoly_properties
      const currentHouses = ownership.houses

      if (currentHouses >= 5) {
        throw new Error('Property already has a hotel')
      }

      // Check player money
      const { data: character, error: charErr } = await supabase
        .from('game_characters')
        .select('money')
        .eq('user_id', playerId)
        .single()

      if (charErr) throw charErr

      const upgradeCost = property.house_cost
      if ((character?.money || 0) < upgradeCost) {
        throw new Error('Insufficient funds for upgrade')
      }

      // Update house count
      const { data: updated, error: updateErr } = await supabase
        .from('player_property_ownership')
        .update({ 
          houses: currentHouses + 1,
          updated_at: new Date()
        })
        .eq('id', propertyOwnershipId)
        .select()
        .single()

      if (updateErr) throw updateErr

      // Deduct money
      await supabase
        .from('game_characters')
        .update({ money: (character.money || 0) - upgradeCost })
        .eq('user_id', playerId)

      // Recalculate income rate
      const incomeLevels = property.income_levels || [0, 10, 30, 90, 160, 250]
      const newIncome = incomeLevels[currentHouses + 1] || property.base_income

      await supabase
        .from('player_property_ownership')
        .update({ passive_income_rate: newIncome })
        .eq('id', propertyOwnershipId)

      // Log upgrade
      await supabase
        .from('property_upgrades')
        .insert([{
          property_ownership_id: propertyOwnershipId,
          upgrade_level: currentHouses + 1,
          upgrade_cost: upgradeCost
        }])

      return updated
    } catch (err) {
      console.error('Error upgrading property:', err)
      throw err
    }
  },

  /**
   * Mortgage a property to get half its value
   */
  async mortgageProperty(playerId, propertyOwnershipId) {
    try {
      const { data: ownership, error: ownErr } = await supabase
        .from('player_property_ownership')
        .select('*, monopoly_properties(*)')
        .eq('id', propertyOwnershipId)
        .single()

      if (ownErr) throw ownErr

      if (ownership.mortgaged) {
        throw new Error('Property already mortgaged')
      }

      const property = ownership.monopoly_properties
      const mortgageValue = property.mortgage_value

      // Add money to player
      const { data: character, error: charErr } = await supabase
        .from('game_characters')
        .select('money')
        .eq('user_id', playerId)
        .single()

      if (charErr) throw charErr

      await supabase
        .from('game_characters')
        .update({ money: (character.money || 0) + mortgageValue })
        .eq('user_id', playerId)

      // Update ownership
      const { data: updated, error: updateErr } = await supabase
        .from('player_property_ownership')
        .update({ 
          mortgaged: true,
          mortgage_received: mortgageValue,
          passive_income_rate: 0,
          updated_at: new Date()
        })
        .eq('id', propertyOwnershipId)
        .select()
        .single()

      if (updateErr) throw updateErr

      return updated
    } catch (err) {
      console.error('Error mortgaging property:', err)
      throw err
    }
  },

  /**
   * Unmortgage a property
   */
  async unmortgageProperty(playerId, propertyOwnershipId) {
    try {
      const { data: ownership, error: ownErr } = await supabase
        .from('player_property_ownership')
        .select('*, monopoly_properties(*)')
        .eq('id', propertyOwnershipId)
        .single()

      if (ownErr) throw ownErr

      if (!ownership.mortgaged) {
        throw new Error('Property is not mortgaged')
      }

      const property = ownership.monopoly_properties
      const unmortgageCost = Math.ceil(ownership.mortgage_received * 1.1) // 10% interest

      // Check player money
      const { data: character, error: charErr } = await supabase
        .from('game_characters')
        .select('money')
        .eq('user_id', playerId)
        .single()

      if (charErr) throw charErr

      if ((character?.money || 0) < unmortgageCost) {
        throw new Error('Insufficient funds to unmortgage')
      }

      // Deduct money
      await supabase
        .from('game_characters')
        .update({ money: (character.money || 0) - unmortgageCost })
        .eq('user_id', playerId)

      // Restore income
      const incomeLevels = property.income_levels || [0, 10, 30, 90, 160, 250]
      const restoredIncome = incomeLevels[Math.min(ownership.houses, incomeLevels.length - 1)]

      // Update ownership
      const { data: updated, error: updateErr } = await supabase
        .from('player_property_ownership')
        .update({ 
          mortgaged: false,
          mortgage_received: 0,
          passive_income_rate: restoredIncome,
          updated_at: new Date()
        })
        .eq('id', propertyOwnershipId)
        .select()
        .single()

      if (updateErr) throw updateErr

      return updated
    } catch (err) {
      console.error('Error unmortgaging property:', err)
      throw err
    }
  },

  // UNLOCKING

  /**
   * Check if player can access a property (based on level)
   */
  async canAccessProperty(playerId, propertyId) {
    try {
      const { data: property, error: propErr } = await supabase
        .from('monopoly_properties')
        .select('unlock_level')
        .eq('id', propertyId)
        .single()

      if (propErr) throw propErr

      const { data: character, error: charErr } = await supabase
        .from('game_characters')
        .select('level')
        .eq('user_id', playerId)
        .single()

      if (charErr) throw charErr

      return (character?.level || 0) >= (property?.unlock_level || 0)
    } catch (err) {
      console.error('Error checking property access:', err)
      return false
    }
  },

  /**
   * Unlock a property for the player
   */
  async unlockProperty(playerId, propertyId, reason = 'level_reached') {
    try {
      const { data, error } = await supabase
        .from('unlocked_properties')
        .insert([{
          player_id: playerId,
          property_id: propertyId,
          unlock_reason: reason
        }])
        .select()
        .single()

      if (error && error.code === '23505') {
        // Already unlocked
        return true
      }

      if (error) throw error

      return true
    } catch (err) {
      console.error('Error unlocking property:', err)
      throw err
    }
  },

  /**
   * Get all available properties player can access
   */
  async getAvailableProperties(playerId) {
    try {
      const { data: character, error: charErr } = await supabase
        .from('game_characters')
        .select('level')
        .eq('user_id', playerId)
        .single()

      if (charErr) throw charErr

      const playerLevel = character?.level || 0

      const { data: properties, error } = await supabase
        .from('monopoly_properties')
        .select('*')
        .lte('unlock_level', playerLevel)
        .order('base_price', { ascending: true })

      if (error) throw error

      return properties || []
    } catch (err) {
      console.error('Error fetching available properties:', err)
      return []
    }
  },

  // PROPERTY INFO

  /**
   * Get detailed player property with all related data
   */
  async getPlayerPropertyDetails(propertyOwnershipId) {
    try {
      const { data, error } = await supabase
        .from('player_property_ownership')
        .select(`
          *,
          monopoly_properties(*),
          property_upgrades(*),
          property_leases(*)
        `)
        .eq('id', propertyOwnershipId)
        .single()

      if (error) throw error
      return data
    } catch (err) {
      console.error('Error fetching property details:', err)
      return null
    }
  },

  /**
   * Get all properties owned by player
   */
  async getPlayerProperties(playerId) {
    try {
      const { data, error } = await supabase
        .from('player_property_ownership')
        .select(`
          *,
          monopoly_properties(*)
        `)
        .eq('player_id', playerId)
        .order('acquired_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching player properties:', err)
      return []
    }
  },

  /**
   * Get property suggestions based on player wealth
   */
  async getPropertySuggestions(playerMoney, playerLevel = 1) {
    try {
      // Suggest properties player can almost afford or just afforded
      const { data, error } = await supabase
        .from('monopoly_properties')
        .select('*')
        .lte('unlock_level', playerLevel)
        .lte('base_price', playerMoney * 1.5) // Show properties within 1.5x their wealth
        .order('base_price', { ascending: false })
        .limit(3)

      if (error) throw error

      return (data || []).map(prop => ({
        ...prop,
        estimatedROI: ((prop.base_income / prop.base_price) * 100).toFixed(1),
        roiMonths: Math.ceil(prop.base_price / (prop.base_income * 30))
      }))
    } catch (err) {
      console.error('Error fetching property suggestions:', err)
      return []
    }
  },

  // PASSIVE INCOME COLLECTION

  /**
   * Collect passive income tick for all properties
   * Called every 5-60 minutes depending on game balance
   */
  async collectPassiveIncomeForPlayer(playerId) {
    try {
      const { data: properties, error: propsErr } = await supabase
        .from('player_property_ownership')
        .select('*, monopoly_properties(*)')
        .eq('player_id', playerId)

      if (propsErr) throw propsErr

      let totalIncome = 0

      for (const ownership of properties || []) {
        const property = ownership.monopoly_properties
        const isMonopoly = await this.isMonopolyOwned(playerId, property.color_group)
        const income = this.calculatePropertyIncome(property, ownership, isMonopoly)
        totalIncome += income
      }

      if (totalIncome > 0) {
        const { data: character, error: charErr } = await supabase
          .from('game_characters')
          .select('money')
          .eq('user_id', playerId)
          .single()

        if (charErr) throw charErr

        // Credit player
        await supabase
          .from('game_characters')
          .update({ money: (character.money || 0) + totalIncome })
          .eq('user_id', playerId)

        // Log income
        await supabase
          .from('income_history')
          .insert([{
            player_id: playerId,
            amount: totalIncome,
            income_source: 'passive_generation'
          }])
      }

      return totalIncome
    } catch (err) {
      console.error('Error collecting passive income:', err)
      return 0
    }
  }
}

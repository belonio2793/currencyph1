import { supabase } from './supabaseClient'
import { gameAPI } from './gameAPI'

// Property type definitions with base prices and income
const PROPERTY_TYPES = {
  house: {
    name: 'House',
    emoji: '🏠',
    basePrice: 50000,
    baseDailyIncome: 100,
    maxUpgrades: 5,
    upgradeCostMultiplier: 1.5,
    description: 'Residential property generating steady income'
  },
  apartment: {
    name: 'Apartment',
    emoji: '🏢',
    basePrice: 75000,
    baseDailyIncome: 200,
    maxUpgrades: 5,
    upgradeCostMultiplier: 1.6,
    description: 'Multi-unit residential generating higher income'
  },
  business: {
    name: 'Business',
    emoji: '🏪',
    basePrice: 100000,
    baseDailyIncome: 500,
    maxUpgrades: 6,
    upgradeCostMultiplier: 1.7,
    description: 'Commercial business with significant daily returns'
  },
  farm: {
    name: 'Farm',
    emoji: '🌾',
    basePrice: 80000,
    baseDailyIncome: 300,
    maxUpgrades: 5,
    upgradeCostMultiplier: 1.5,
    description: 'Agricultural property with seasonal variations'
  },
  factory: {
    name: 'Factory',
    emoji: '🏭',
    basePrice: 200000,
    baseDailyIncome: 1200,
    maxUpgrades: 7,
    upgradeCostMultiplier: 2.0,
    description: 'Industrial facility with high-yield production'
  },
  hotel: {
    name: 'Hotel',
    emoji: '🏨',
    basePrice: 300000,
    baseDailyIncome: 2000,
    maxUpgrades: 8,
    upgradeCostMultiplier: 2.2,
    description: 'Hospitality business with premium revenue'
  }
}

// Upgrade tiers for visual progression
const UPGRADE_TIERS = {
  0: { name: 'Basic', multiplier: 1.0, maxWorkers: 1, description: 'Original property' },
  1: { name: 'Improved', multiplier: 1.3, maxWorkers: 3, description: 'Minor improvements' },
  2: { name: 'Enhanced', multiplier: 1.7, maxWorkers: 5, description: 'Significant upgrades' },
  3: { name: 'Premium', multiplier: 2.2, maxWorkers: 8, description: 'Premium quality' },
  4: { name: 'Luxury', multiplier: 2.8, maxWorkers: 12, description: 'High-end property' },
  5: { name: 'Elite', multiplier: 3.5, maxWorkers: 15, description: 'Elite tier' },
  6: { name: 'Legendary', multiplier: 4.5, maxWorkers: 20, description: 'Legendary status' },
  7: { name: 'Mythical', multiplier: 5.5, maxWorkers: 25, description: 'Mythical tier' },
  8: { name: 'Divine', multiplier: 6.5, maxWorkers: 30, description: 'Divine power' }
}

export const propertyTycoonEngine = {
  // PROPERTY ACQUISITION
  async purchaseProperty(characterId, propertyType, propertyData = {}) {
    try {
      const typeDef = PROPERTY_TYPES[propertyType]
      if (!typeDef) throw new Error('Invalid property type')

      const character = await gameAPI.getCharacter(characterId)
      const totalCost = typeDef.basePrice + (propertyData.locationPremium || 0)

      if ((character?.money || 0) < totalCost) {
        throw new Error(`Insufficient funds. Need ₱${totalCost}, have ₱${character?.money || 0}`)
      }

      // Create property
      const { data: property, error } = await supabase
        .from('game_properties')
        .insert([{
          owner_id: characterId,
          property_type: propertyType,
          name: propertyData.name || `${typeDef.name} #${Math.floor(Math.random() * 10000)}`,
          description: propertyData.description || typeDef.description,
          location_x: propertyData.location_x || Math.random() * 300,
          location_y: propertyData.location_y || Math.random() * 350,
          province: propertyData.province || 'Manila',
          city: propertyData.city || 'Manila',
          purchase_price: totalCost,
          current_value: totalCost,
          revenue_per_day: typeDef.baseDailyIncome,
          upgrade_level: 0,
          workers_count: 0,
          max_workers: UPGRADE_TIERS[0].maxWorkers,
          status: 'active'
        }])
        .select()
        .single()

      if (error) throw error

      // Deduct money from character
      await gameAPI.updateCharacterStats(characterId, {
        money: (character?.money || 0) - totalCost
      })

      // Log transaction
      await supabase
        .from('game_transactions')
        .insert([{
          buyer_id: characterId,
          property_id: property.id,
          total_price: totalCost,
          transaction_type: 'property_purchase',
          status: 'completed'
        }])

      return property
    } catch (err) {
      console.error('Error purchasing property:', err)
      throw err
    }
  },

  // PROPERTY MANAGEMENT
  async upgradeProperty(propertyId, characterId) {
    try {
      const { data: property } = await supabase
        .from('game_properties')
        .select('*')
        .eq('id', propertyId)
        .eq('owner_id', characterId)
        .single()

      if (!property) throw new Error('Property not found or not owned')

      const typeDef = PROPERTY_TYPES[property.property_type]
      const currentUpgrade = property.upgrade_level || 0
      const nextUpgrade = currentUpgrade + 1

      if (nextUpgrade > typeDef.maxUpgrades) {
        throw new Error(`Property has reached max upgrade level: ${typeDef.maxUpgrades}`)
      }

      // Calculate upgrade cost (increases exponentially)
      const upgradeCost = Math.floor(
        (typeDef.basePrice / 2) * Math.pow(typeDef.upgradeCostMultiplier, currentUpgrade)
      )

      const character = await gameAPI.getCharacter(characterId)
      if ((character?.money || 0) < upgradeCost) {
        throw new Error(`Insufficient funds for upgrade. Need ₱${upgradeCost}`)
      }

      const nextTierDef = UPGRADE_TIERS[nextUpgrade]
      const newDailyIncome = Math.floor(typeDef.baseDailyIncome * nextTierDef.multiplier)
      const newValue = Math.floor(property.purchase_price * (1 + (nextUpgrade * 0.15)))

      // Update property
      const { data: upgraded, error } = await supabase
        .from('game_properties')
        .update({
          upgrade_level: nextUpgrade,
          revenue_per_day: newDailyIncome,
          current_value: newValue,
          max_workers: nextTierDef.maxWorkers,
          updated_at: new Date()
        })
        .eq('id', propertyId)
        .select()
        .single()

      if (error) throw error

      // Deduct upgrade cost
      await gameAPI.updateCharacterStats(characterId, {
        money: (character?.money || 0) - upgradeCost
      })

      // Add experience
      await gameAPI.addExperience(characterId, 50 + (nextUpgrade * 10), 'business_upgrade', propertyId)

      return { property: upgraded, upgradeCost, newDailyIncome }
    } catch (err) {
      console.error('Error upgrading property:', err)
      throw err
    }
  },

  async hireWorker(propertyId, characterId) {
    try {
      const { data: property } = await supabase
        .from('game_properties')
        .select('*')
        .eq('id', propertyId)
        .eq('owner_id', characterId)
        .single()

      if (!property) throw new Error('Property not found')

      if ((property.workers_count || 0) >= (property.max_workers || 1)) {
        throw new Error('Property is at max worker capacity')
      }

      const workerCost = 5000 + (property.workers_count || 0) * 2000
      const character = await gameAPI.getCharacter(characterId)

      if ((character?.money || 0) < workerCost) {
        throw new Error('Insufficient funds to hire worker')
      }

      // Increase daily income for each worker
      const incomeBoost = Math.floor(property.revenue_per_day * 0.2)

      const { data: updated, error } = await supabase
        .from('game_properties')
        .update({
          workers_count: (property.workers_count || 0) + 1,
          revenue_per_day: (property.revenue_per_day || 0) + incomeBoost,
          updated_at: new Date()
        })
        .eq('id', propertyId)
        .select()
        .single()

      if (error) throw error

      await gameAPI.updateCharacterStats(characterId, {
        money: (character?.money || 0) - workerCost
      })

      return { property: updated, workerCost, incomeBoost }
    } catch (err) {
      console.error('Error hiring worker:', err)
      throw err
    }
  },

  async sellProperty(propertyId, characterId) {
    try {
      const { data: property } = await supabase
        .from('game_properties')
        .select('*')
        .eq('id', propertyId)
        .eq('owner_id', characterId)
        .single()

      if (!property) throw new Error('Property not found')

      // Sell price is based on current value with a small loss
      const salePrice = Math.floor(property.current_value * 0.95)

      const character = await gameAPI.getCharacter(characterId)
      await gameAPI.updateCharacterStats(characterId, {
        money: (character?.money || 0) + salePrice
      })

      // Mark property as sold
      await supabase
        .from('game_properties')
        .update({ status: 'sold', updated_at: new Date() })
        .eq('id', propertyId)

      // Log transaction
      await supabase
        .from('game_transactions')
        .insert([{
          seller_id: characterId,
          property_id: propertyId,
          total_price: salePrice,
          transaction_type: 'property_sale',
          status: 'completed'
        }])

      return { salePrice, loss: property.current_value - salePrice }
    } catch (err) {
      console.error('Error selling property:', err)
      throw err
    }
  },

  // INCOME GENERATION
  async collectPropertyIncome(characterId) {
    try {
      const { data: properties } = await supabase
        .from('game_properties')
        .select('*')
        .eq('owner_id', characterId)
        .eq('status', 'active')

      if (!properties || properties.length === 0) {
        return { totalIncome: 0, properties: [] }
      }

      let totalIncome = 0
      const incomeDetails = []

      for (const property of properties) {
        const dailyIncome = property.revenue_per_day || 0
        totalIncome += dailyIncome

        incomeDetails.push({
          propertyId: property.id,
          propertyName: property.name,
          income: dailyIncome
        })

        // Slightly increase property value over time
        const valueIncrease = Math.floor(property.current_value * 0.001)
        await supabase
          .from('game_properties')
          .update({ 
            current_value: (property.current_value || 0) + valueIncrease,
            updated_at: new Date()
          })
          .eq('id', property.id)
      }

      // Add income to character
      const character = await gameAPI.getCharacter(characterId)
      await gameAPI.updateCharacterStats(characterId, {
        money: (character?.money || 0) + totalIncome
      })

      // Log income
      await supabase
        .from('game_transactions')
        .insert([{
          seller_id: characterId,
          total_price: totalIncome,
          transaction_type: 'property_income',
          status: 'completed'
        }])

      return { totalIncome, properties: incomeDetails }
    } catch (err) {
      console.error('Error collecting property income:', err)
      throw err
    }
  },

  // Get all properties for a character with detailed stats
  async getCharacterProperties(characterId) {
    try {
      const { data, error } = await supabase
        .from('game_properties')
        .select('*')
        .eq('owner_id', characterId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []).map(prop => ({
        ...prop,
        type: PROPERTY_TYPES[prop.property_type] || {},
        upgradeTier: UPGRADE_TIERS[prop.upgrade_level || 0] || {},
        monthlyIncome: (prop.revenue_per_day || 0) * 30,
        totalWorth: prop.current_value || 0
      }))
    } catch (err) {
      console.error('Error fetching properties:', err)
      return []
    }
  },

  // Calculate character wealth
  async calculateCharacterWealth(characterId) {
    try {
      const character = await gameAPI.getCharacter(characterId)
      const properties = await this.getCharacterProperties(characterId)

      const propertyValue = properties.reduce((sum, p) => sum + (p.current_value || 0), 0)
      const liquidAssets = character?.money || 0
      const totalWealth = propertyValue + liquidAssets

      return {
        liquidAssets,
        propertyValue,
        totalWealth,
        propertyCount: properties.length,
        monthlyIncome: properties.reduce((sum, p) => sum + (p.revenue_per_day || 0), 0) * 30
      }
    } catch (err) {
      console.error('Error calculating wealth:', err)
      return { liquidAssets: 0, propertyValue: 0, totalWealth: 0, propertyCount: 0, monthlyIncome: 0 }
    }
  },

  // Get property suggestions based on budget and preferences
  getPropertySuggestions(budget, preferences = {}) {
    const suggestions = []

    for (const [key, typeDef] of Object.entries(PROPERTY_TYPES)) {
      if (typeDef.basePrice <= budget) {
        const roi = (typeDef.baseDailyIncome * 365) / typeDef.basePrice
        suggestions.push({
          type: key,
          ...typeDef,
          estimatedROI: (roi * 100).toFixed(1),
          monthlyIncome: typeDef.baseDailyIncome * 30,
          roiMonths: Math.ceil(typeDef.basePrice / (typeDef.baseDailyIncome * 30))
        })
      }
    }

    // Sort by ROI
    return suggestions.sort((a, b) => parseFloat(b.estimatedROI) - parseFloat(a.estimatedROI))
  },

  // Get property type definitions
  getPropertyTypes() {
    return PROPERTY_TYPES
  },

  getUpgradeTiers() {
    return UPGRADE_TIERS
  }
}

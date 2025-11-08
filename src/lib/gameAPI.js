import { supabase } from './supabaseClient'

export const gameAPI = {
  // CHARACTER MANAGEMENT
  async createCharacter(userId, name, appearance, homeCity = 'Manila') {
    try {
        // Normalize avatar thumbnail: support appearance.thumbnail or appearance.avatar_url
      let finalAppearance = { ...(appearance || {}) }
      const incomingThumb = appearance?.thumbnail || appearance?.avatar_url || null
      if (incomingThumb && typeof incomingThumb === 'string' && !incomingThumb.includes('supabase')) {
        try {
          const res = await fetch(incomingThumb)
          if (res.ok) {
            const blob = await res.blob()
            const ext = blob.type?.split('/')?.[1] || 'png'
            const path = `${userId}/${name}-${Date.now()}.${ext}`
            const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob)
            if (!upErr) {
              const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path)
              finalAppearance = { ...finalAppearance, thumbnail: publicData.publicUrl }
            }
          }
        } catch (e) {
          console.warn('Failed to upload avatar thumbnail:', e.message)
        }
      }

      const { data, error } = await supabase
        .from('game_characters')
        .insert([{
          user_id: userId,
          name,
          appearance: finalAppearance,
          home_city: homeCity,
          current_location: homeCity
        }])
        .select()
        .single()
      if (error) throw error

      // Create default bank account
      await this.createBankAccount(data.id, 'savings', 'PHP', 1000)

      return data
    } catch (err) {
      console.error('Error creating character:', err)
      throw err
    }
  },

  async getCharacter(userId) {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .select('*')
        .eq('user_id', userId)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data || null
    } catch (err) {
      console.error('Error fetching character:', err)
      return null
    }
  },

  async updateCharacterAppearance(characterId, appearance) {
    try {
      // Keep appearance shape simple and avoid ReadyPlayer.me specific nesting
      const cleanedAppearance = {
        ...(appearance || {})
      }

      const { data, error } = await supabase
        .from('game_characters')
        .update({ appearance: cleanedAppearance, updated_at: new Date() })
        .eq('id', characterId)
        .select()
        .single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error updating appearance:', err)
      throw err
    }
  },

  async getCharacterAppearance(characterId) {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .select('id, appearance')
        .eq('id', characterId)
        .single()
      if (error) throw error
      return data?.appearance || null
    } catch (err) {
      console.error('Error fetching character appearance:', err)
      return null
    }
  },

  getAvatarUrl(appearance) {
    if (!appearance) return null

    // Try to get avatar URL from different possible locations
    return (
      appearance?.avatar_url ||
      appearance?.model_url ||
      appearance?.thumbnail ||
      null
    )
  },

  getAvatarThumbnail(appearance) {
    if (!appearance) return null

    return (
      appearance?.thumbnail ||
      appearance?.avatar_url ||
      null
    )
  },

  async updateCharacterPosition(characterId, x, y, location) {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .update({ 
          position_x: x, 
          position_y: y,
          current_location: location,
          updated_at: new Date() 
        })
        .eq('id', characterId)
        .select()
        .single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error updating position:', err)
      throw err
    }
  },

  async updateCharacterStats(characterId, updates) {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .update({ ...updates, updated_at: new Date() })
        .eq('id', characterId)
        .select()
        .single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error updating stats:', err)
      throw err
    }
  },

  async addExperience(characterId, amount, source, referenceId = null) {
    try {
      const character = await supabase
        .from('game_characters')
        .select('experience, level')
        .eq('id', characterId)
        .single()
      
      const newExperience = (character.data?.experience || 0) + amount
      const expPerLevel = 1000
      const newLevel = Math.floor(newExperience / expPerLevel)
      
      const { data, error } = await supabase
        .from('game_characters')
        .update({ 
          experience: newExperience, 
          level: newLevel,
          updated_at: new Date() 
        })
        .eq('id', characterId)
        .select()
        .single()
      
      if (error) throw error
      
      // Log experience
      await supabase
        .from('game_experience_log')
        .insert([{
          character_id: characterId,
          amount,
          source,
          reference_id: referenceId
        }])
      
      return { character: data, leveledUp: newLevel > (character.data?.level || 0) }
    } catch (err) {
      console.error('Error adding experience:', err)
      throw err
    }
  },

  // INVENTORY MANAGEMENT
  async addItemToInventory(characterId, itemId, quantity = 1) {
    try {
      const { data: existing } = await supabase
        .from('game_inventory')
        .select('id, quantity')
        .eq('character_id', characterId)
        .eq('item_id', itemId)
        .single()
      
      if (existing) {
        return await supabase
          .from('game_inventory')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id)
          .select()
          .single()
      } else {
        return await supabase
          .from('game_inventory')
          .insert([{ character_id: characterId, item_id: itemId, quantity }])
          .select()
          .single()
      }
    } catch (err) {
      console.error('Error adding item:', err)
      throw err
    }
  },

  async getInventory(characterId) {
    try {
      const { data, error } = await supabase
        .from('game_inventory')
        .select('*, game_items(*)')
        .eq('character_id', characterId)
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching inventory:', err)
      return []
    }
  },

  async removeItemFromInventory(characterId, itemId, quantity = 1) {
    try {
      const { data: existing } = await supabase
        .from('game_inventory')
        .select('id, quantity')
        .eq('character_id', characterId)
        .eq('item_id', itemId)
        .single()
      
      if (!existing) return null
      
      if (existing.quantity > quantity) {
        return await supabase
          .from('game_inventory')
          .update({ quantity: existing.quantity - quantity })
          .eq('id', existing.id)
          .select()
          .single()
      } else {
        await supabase
          .from('game_inventory')
          .delete()
          .eq('id', existing.id)
        return null
      }
    } catch (err) {
      console.error('Error removing item:', err)
      throw err
    }
  },

  // EQUIPMENT MANAGEMENT
  async equipItem(characterId, equipmentSlot, itemId) {
    try {
      const { data, error } = await supabase
        .from('game_character_equipment')
        .upsert([{
          character_id: characterId,
          equipment_slot: equipmentSlot,
          item_id: itemId,
          equipped_at: new Date()
        }])
        .select()
        .single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error equipping item:', err)
      throw err
    }
  },

  async getEquipment(characterId) {
    try {
      const { data, error } = await supabase
        .from('game_character_equipment')
        .select('*, game_items(*)')
        .eq('character_id', characterId)
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching equipment:', err)
      return []
    }
  },

  // ITEMS
  async getAllItems() {
    try {
      const { data, error } = await supabase
        .from('game_items')
        .select('*')
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching items:', err)
      return []
    }
  },

  async createItem(itemData) {
    try {
      const { data, error } = await supabase
        .from('game_items')
        .insert([itemData])
        .select()
        .single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error creating item:', err)
      throw err
    }
  },

  // PROPERTIES
  async purchaseProperty(characterId, propertyData) {
    try {
      const character = await supabase
        .from('game_characters')
        .select('money')
        .eq('id', characterId)
        .single()
      
      if ((character.data?.money || 0) < propertyData.purchase_price) {
        throw new Error('Insufficient funds')
      }
      
      const { data: property, error: propError } = await supabase
        .from('game_properties')
        .insert([{ owner_id: characterId, ...propertyData }])
        .select()
        .single()
      
      if (propError) throw propError
      
      // Deduct money
      await supabase
        .from('game_characters')
        .update({ money: (character.data?.money || 0) - propertyData.purchase_price })
        .eq('id', characterId)
      
      return property
    } catch (err) {
      console.error('Error purchasing property:', err)
      throw err
    }
  },

  async getProperties(characterId) {
    try {
      const { data, error } = await supabase
        .from('game_properties')
        .select('*')
        .eq('owner_id', characterId)
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching properties:', err)
      return []
    }
  },

  async updatePropertyRevenue(propertyId, revenuePerDay) {
    try {
      const { data, error } = await supabase
        .from('game_properties')
        .update({ revenue_per_day: revenuePerDay, updated_at: new Date() })
        .eq('id', propertyId)
        .select()
        .single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error updating property:', err)
      throw err
    }
  },

  // MARKETPLACE
  async createMarketplaceListing(characterId, listingData) {
    try {
      const { data, error } = await supabase
        .from('game_marketplace_listings')
        .insert([{ seller_id: characterId, ...listingData }])
        .select()
        .single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error creating listing:', err)
      throw err
    }
  },

  async getMarketplaceListings(filters = {}) {
    try {
      let query = supabase
        .from('game_marketplace_listings')
        .select('*, game_items(*), game_properties(*), seller:game_characters(name)')
        .eq('status', 'active')
      
      if (filters.item_type) {
        query = query.eq('listing_type', filters.item_type)
      }
      if (filters.province) {
        query = query.eq('game_properties.province', filters.province)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching listings:', err)
      return []
    }
  },

  async purchaseFromMarketplace(buyerId, listingId) {
    try {
      const { data: listing } = await supabase
        .from('game_marketplace_listings')
        .select('*')
        .eq('id', listingId)
        .single()
      
      const buyer = await supabase
        .from('game_characters')
        .select('money')
        .eq('id', buyerId)
        .single()
      
      if ((buyer.data?.money || 0) < listing.total_price) {
        throw new Error('Insufficient funds')
      }
      
      // Update buyer inventory
      if (listing.item_id) {
        await this.addItemToInventory(buyerId, listing.item_id, listing.quantity)
      }
      
      // Transfer money
      await supabase
        .from('game_characters')
        .update({ money: (buyer.data?.money || 0) - listing.total_price })
        .eq('id', buyerId)
      
      const { data: sellerChar } = await supabase
        .from('game_characters')
        .select('money')
        .eq('id', listing.seller_id)
        .single()
      await supabase
        .from('game_characters')
        .update({ money: (sellerChar?.money || 0) + listing.total_price })
        .eq('id', listing.seller_id)
      
      // Mark listing as sold
      await supabase
        .from('game_marketplace_listings')
        .update({ status: 'sold' })
        .eq('id', listingId)
      
      // Log transaction
      await supabase
        .from('game_transactions')
        .insert([{
          buyer_id: buyerId,
          seller_id: listing.seller_id,
          item_id: listing.item_id,
          quantity: listing.quantity,
          unit_price: listing.unit_price,
          total_price: listing.total_price,
          transaction_type: 'buy'
        }])
      
      return true
    } catch (err) {
      console.error('Error purchasing:', err)
      throw err
    }
  },

  // COMBAT
  async startCombat(characterId, enemyType, enemyLevel = 1) {
    try {
      const character = await supabase
        .from('game_characters')
        .select('health, max_health, level')
        .eq('id', characterId)
        .single()
      
      const characterLevel = character.data?.level || 0
      const playerPower = characterLevel + 5
      const enemyPower = enemyLevel + Math.random() * 3
      
      const won = playerPower > enemyPower
      const xpGain = won ? Math.floor((enemyLevel + 1) * 50) : 0
      const itemsDropped = won ? this.generateLoot(enemyType, enemyLevel) : []
      
      const { data, error } = await supabase
        .from('game_combat_log')
        .insert([{
          character_id: characterId,
          enemy_type: enemyType,
          enemy_level: enemyLevel,
          result: won ? 'win' : 'loss',
          xp_gained: xpGain,
          items_dropped: itemsDropped,
          location_x: 0,
          location_y: 0
        }])
        .select()
        .single()
      
      if (won && xpGain > 0) {
        await this.addExperience(characterId, xpGain, 'combat', data.id)
      }
      
      return { won, xpGain, itemsDropped, combatLog: data }
    } catch (err) {
      console.error('Error in combat:', err)
      throw err
    }
  },

  generateLoot(enemyType, level) {
    const loot = []
    const chance = Math.random()
    if (chance > 0.7) {
      loot.push({ type: 'common_item', name: `${enemyType}_drop` })
    }
    return loot
  },

  // BANKING
  async createBankAccount(characterId, accountType, currencyCode, initialBalance = 0) {
    try {
      const { data, error } = await supabase
        .from('game_bank_accounts')
        .insert([{
          character_id: characterId,
          account_type: accountType,
          currency_code: currencyCode,
          balance: initialBalance
        }])
        .select()
        .single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error creating bank account:', err)
      throw err
    }
  },

  async getBankAccounts(characterId) {
    try {
      const { data, error } = await supabase
        .from('game_bank_accounts')
        .select('*')
        .eq('character_id', characterId)
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching bank accounts:', err)
      return []
    }
  },

  async transferMoney(fromAccountId, toAccountId, amount, currencyCode = 'PHP') {
    try {
      const { data: fromAcc } = await supabase
        .from('game_bank_accounts')
        .select('balance')
        .eq('id', fromAccountId)
        .single()
      
      if ((fromAcc?.balance || 0) < amount) {
        throw new Error('Insufficient funds')
      }
      
      await supabase
        .from('game_bank_accounts')
        .update({ balance: (fromAcc?.balance || 0) - amount })
        .eq('id', fromAccountId)
      
      const { data: toAcc } = await supabase
        .from('game_bank_accounts')
        .select('balance')
        .eq('id', toAccountId)
        .single()
      
      await supabase
        .from('game_bank_accounts')
        .update({ balance: (toAcc?.balance || 0) + amount })
        .eq('id', toAccountId)
      
      await supabase
        .from('game_bank_transactions')
        .insert([{
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount,
          currency_code: currencyCode,
          transaction_type: 'transfer'
        }])
      
      return true
    } catch (err) {
      console.error('Error transferring money:', err)
      throw err
    }
  },

  // QUESTS
  async getAvailableQuests(characterLevel) {
    try {
      const { data, error } = await supabase
        .from('game_quests')
        .select('*')
        .lte('min_level', characterLevel)
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching quests:', err)
      return []
    }
  },

  async startQuest(characterId, questId) {
    try {
      const { data, error } = await supabase
        .from('game_character_quests')
        .insert([{
          character_id: characterId,
          quest_id: questId,
          status: 'active'
        }])
        .select()
        .single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error starting quest:', err)
      throw err
    }
  },

  async completeQuest(characterId, questId) {
    try {
      const { data: quest } = await supabase
        .from('game_quests')
        .select('xp_reward, money_reward, item_rewards')
        .eq('id', questId)
        .single()
      
      await this.addExperience(characterId, quest?.xp_reward || 0, 'quest', questId)
      
      const { data: charMoney } = await supabase
        .from('game_characters')
        .select('money')
        .eq('id', characterId)
        .single()
      await supabase
        .from('game_characters')
        .update({ money: (charMoney?.money || 0) + (quest?.money_reward || 0) })
        .eq('id', characterId)
      
      const { data, error } = await supabase
        .from('game_character_quests')
        .update({ status: 'completed', completed_at: new Date() })
        .eq('character_id', characterId)
        .eq('quest_id', questId)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error completing quest:', err)
      throw err
    }
  },

  // DAILY REWARDS
  async getOrCreateDailyReward(characterId) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('game_daily_rewards')
        .select('*')
        .eq('character_id', characterId)
        .eq('reward_date', today)
        .single()
      
      if (existing) {
        return existing
      }
      
      // Get last streak
      const { data: lastReward } = await supabase
        .from('game_daily_rewards')
        .select('reward_date, streak_days')
        .eq('character_id', characterId)
        .order('reward_date', { ascending: false })
        .limit(1)
        .single()
      
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const streakDays = lastReward?.reward_date === yesterday ? (lastReward?.streak_days || 0) + 1 : 1
      
      const xpReward = 50 + (streakDays * 10)
      const moneyReward = 100 + (streakDays * 20)
      
      const { data, error } = await supabase
        .from('game_daily_rewards')
        .insert([{
          character_id: characterId,
          reward_date: today,
          xp_earned: xpReward,
          money_earned: moneyReward,
          streak_days: streakDays
        }])
        .select()
        .single()
      
      if (error) throw error
      
      // Apply rewards
      await this.addExperience(characterId, xpReward, 'daily_login')
      const { data: charMoney2 } = await supabase
        .from('game_characters')
        .select('money')
        .eq('id', characterId)
        .single()
      await supabase
        .from('game_characters')
        .update({ money: (charMoney2?.money || 0) + moneyReward })
        .eq('id', characterId)
      
      return data
    } catch (err) {
      console.error('Error with daily reward:', err)
      throw err
    }
  }
}

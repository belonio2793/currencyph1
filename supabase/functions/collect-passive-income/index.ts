import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Get all players with properties
    const { data: ownerships, error: ownError } = await supabase
      .from('player_property_ownership')
      .select(`
        id,
        player_id,
        property_id,
        houses,
        mortgaged,
        monopoly_properties:property_id (
          id,
          color_group,
          income_levels,
          base_income
        )
      `)
      .eq('mortgaged', false)

    if (ownError) throw ownError

    const playerIncomeMap = new Map<string, number>()

    // Calculate income for each property
    for (const ownership of ownerships || []) {
      const property = ownership.monopoly_properties as any
      const houses = ownership.houses || 0

      if (!property) continue

      const incomeLevels = property.income_levels || [0, 10, 30, 90, 160, 250]
      let income = incomeLevels[Math.min(houses, incomeLevels.length - 1)] || property.base_income

      // Check for monopoly bonus (player owns all properties in color group)
      const { data: groupProperties, error: groupError } = await supabase
        .from('monopoly_properties')
        .select('id')
        .eq('color_group', property.color_group)

      if (!groupError && groupProperties) {
        const propertyIds = groupProperties.map((p: any) => p.id)

        const { data: ownedCount, error: countError } = await supabase
          .from('player_property_ownership')
          .select('id', { count: 'exact' })
          .eq('player_id', ownership.player_id)
          .in('property_id', propertyIds)

        if (!countError && ownedCount?.length === propertyIds.length && propertyIds.length > 0) {
          // Has monopoly, apply bonus if no houses
          if (houses === 0) {
            income *= 2
          }
        }
      }

      // Accumulate income per player
      const current = playerIncomeMap.get(ownership.player_id) || 0
      playerIncomeMap.set(ownership.player_id, current + income)

      // Update ownership last income collection
      await supabase
        .from('player_property_ownership')
        .update({ last_income_collected_at: new Date().toISOString() })
        .eq('id', ownership.id)
    }

    // Apply income to each player
    const incomeEntries = []
    for (const [playerId, totalIncome] of playerIncomeMap) {
      // Update character money
      const { data: character, error: charError } = await supabase
        .from('game_characters')
        .select('money')
        .eq('user_id', playerId)
        .single()

      if (!charError && character) {
        await supabase
          .from('game_characters')
          .update({ money: (character.money || 0) + totalIncome })
          .eq('user_id', playerId)

        // Log income event
        incomeEntries.push({
          player_id: playerId,
          amount: totalIncome,
          income_source: 'passive_generation',
          generated_at: new Date().toISOString(),
          period_type: 'hourly'
        })
      }
    }

    // Batch insert income history
    if (incomeEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('income_history')
        .insert(incomeEntries)

      if (insertError) throw insertError
    }

    return new Response(
      JSON.stringify({
        success: true,
        playersProcessed: playerIncomeMap.size,
        totalIncome: Array.from(playerIncomeMap.values()).reduce((a, b) => a + b, 0)
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error collecting passive income:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

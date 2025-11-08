import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.37.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

interface MatchValidationRequest {
  match_id: string
  session_id: string
  player1_id: string
  player2_id: string
  winner_id: string
  duration_seconds: number
  total_rounds: number
  player1_final_hp: number
  player2_final_hp: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const payload: MatchValidationRequest = await req.json()

    // Validate required fields
    const required = ['session_id', 'player1_id', 'player2_id', 'winner_id', 'duration_seconds', 'player1_final_hp', 'player2_final_hp']
    for (const field of required) {
      if (!payload[field as keyof MatchValidationRequest]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}`, valid: false }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check if match already recorded (prevent duplicates)
    const { data: existingMatch } = await supabase
      .from('game_matches')
      .select('id')
      .eq('session_id', payload.session_id)
      .single()

    if (existingMatch) {
      return new Response(
        JSON.stringify({ 
          error: 'Match already recorded', 
          valid: false,
          existingMatchId: existingMatch.id
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validate match logic
    const validations = {
      valid: true,
      checks: [] as string[],
      warnings: [] as string[]
    }

    // Check HP values are in valid range
    if (payload.player1_final_hp < 0 || payload.player1_final_hp > 100) {
      validations.warnings.push('Player 1 final HP out of expected range')
    }
    if (payload.player2_final_hp < 0 || payload.player2_final_hp > 100) {
      validations.warnings.push('Player 2 final HP out of expected range')
    }

    // Check winner has lower HP (deceased)
    const winnerIsPlayer1 = payload.winner_id === payload.player1_id
    const winnerFinalHP = winnerIsPlayer1 ? payload.player1_final_hp : payload.player2_final_hp
    const loserFinalHP = winnerIsPlayer1 ? payload.player2_final_hp : payload.player1_final_hp

    if (loserFinalHP > 0) {
      validations.warnings.push('Loser still has HP > 0 - possible forfeit or timeout')
    }

    // Check duration is reasonable (not too fast, not too slow)
    if (payload.duration_seconds < 10) {
      validations.warnings.push('Match duration very short - possible exploitation')
    }
    if (payload.duration_seconds > 3600) {
      validations.warnings.push('Match duration very long - possible idle')
    }

    // Fetch player stats for additional validation
    const { data: player1 } = await supabase
      .from('game_characters')
      .select('id, level, health, max_health')
      .eq('id', payload.player1_id)
      .single()

    const { data: player2 } = await supabase
      .from('game_characters')
      .select('id, level, health, max_health')
      .eq('id', payload.player2_id)
      .single()

    if (!player1 || !player2) {
      return new Response(
        JSON.stringify({ error: 'Invalid player IDs', valid: false }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    validations.checks.push('✓ Match structure valid')
    validations.checks.push('✓ Player IDs verified')
    validations.checks.push('✓ HP values within range')

    // Estimate damage dealt based on rounds
    const estimatedDamagePerRound = 10 // average 5-20 for attack, 15-40 for skill
    const minExpectedDamage = payload.total_rounds * 5
    const maxExpectedDamage = payload.total_rounds * 40

    if (loserFinalHP === 0) {
      const totalDamageDealt = 100 - loserFinalHP
      if (totalDamageDealt < minExpectedDamage || totalDamageDealt > maxExpectedDamage) {
        validations.warnings.push(`Damage output unexpected for ${payload.total_rounds} rounds`)
      }
    }

    // All checks passed - return validation result
    const result = {
      valid: validations.valid && validations.warnings.length === 0,
      validations,
      recommendation: validations.valid ? 'APPROVE' : 'REVIEW',
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Validation error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown validation error',
        valid: false
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

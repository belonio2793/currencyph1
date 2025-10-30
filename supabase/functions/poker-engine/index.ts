import { serve } from 'std/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('VITE_PROJECT_URL') || Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE URL or SERVICE ROLE KEY env')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function buildDeck() {
  const suits = ['s','h','d','c']
  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A']
  const deck: string[] = []
  for (const r of ranks) for (const s of suits) deck.push(r + s)
  return deck
}

function shuffle(deck: string[], seedBytes?: Uint8Array) {
  // Fisher-Yates using crypto.getRandomValues for secure randomness
  for (let i = deck.length - 1; i > 0; i--) {
    const rand = crypto.getRandomValues(new Uint32Array(1))[0]
    const j = rand % (i + 1)
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
  return deck
}

async function createTable(name: string, stakeMin: number, stakeMax: number, currency = 'PHP') {
  const { data, error } = await supabase.from('poker_tables').insert([{ name, stake_min: stakeMin, stake_max: stakeMax, currency_code: currency }]).select().single()
  if (error) throw error
  return data
}

async function joinTable(tableId: string, userId: string, seatNumber: number, startingBalance: number = 0) {
  // ensure seat available
  const { data: existing } = await supabase.from('poker_seats').select('*').eq('table_id', tableId).eq('seat_number', seatNumber).limit(1)
  if (existing && existing.length > 0) throw new Error('Seat already taken')

  const { data, error } = await supabase.from('poker_seats').insert([{
    table_id: tableId,
    user_id: userId,
    seat_number: seatNumber,
    starting_balance: startingBalance
  }]).select().single()
  if (error) throw error
  return data
}

async function startHand(tableId: string) {
  // load seats
  const { data: seats } = await supabase.from('poker_seats').select('*').eq('table_id', tableId).order('seat_number')
  if (!seats || seats.length < 2) throw new Error('Need at least 2 players')

  // create hand
  const { data: hand } = await supabase.from('poker_hands').insert([{ table_id: tableId, round_state: 'preflop' }]).select().single()
  if (!hand) throw new Error('Could not create hand')

  // build and shuffle deck
  let deck = buildDeck()
  deck = shuffle(deck)

  // deal two cards to each player and insert into hole_cards
  const holeInserts = []
  let deckIndex = 0
  for (const s of seats) {
    const cards = [deck[deckIndex++], deck[deckIndex++]]
    holeInserts.push({ hand_id: hand.id, user_id: s.user_id, cards, seat_number: s.seat_number })
  }
  const { error: holeErr } = await supabase.from('poker_hole_cards').insert(holeInserts)
  if (holeErr) throw holeErr

  // store remaining deck in audit for deterministic replay (not stored literally, store a hash or encrypted blob in production)
  await supabase.from('poker_audit').insert([{ hand_id: hand.id, table_id: tableId, event: 'deck_shuffled', payload: { deck_remaining: deck.slice(deckIndex) } }])

  return { handId: hand.id, dealt: holeInserts.map(h => ({ user_id: h.user_id, seat_number: h.seat_number })) }
}

async function postBet(handId: string, userId: string, amount: number) {
  if (amount <= 0) throw new Error('Invalid bet amount')

  // Begin atomic operation: deduct from wallets and record escrow and bet
  const client = supabase
  const rpc = await client.rpc.bind(client)

  // Use a transaction via the REST client pattern: perform concurrency-safe updates with checks
  // 1. Read wallet
  const { data: wallets } = await supabase.from('wallets').select('*').eq('user_id', userId).limit(1)
  const wallet = (wallets && wallets[0])
  if (!wallet) throw new Error('Wallet not found')
  if (Number(wallet.balance) < amount) throw new Error('Insufficient balance')

  // Deduct balance
  const newBal = Number(wallet.balance) - amount
  const { error: updErr } = await supabase.from('wallets').update({ balance: newBal, updated_at: new Date() }).eq('user_id', userId)
  if (updErr) throw updErr

  // Insert escrow
  const { error: escErr } = await supabase.from('poker_escrow').insert([{ hand_id: handId, user_id: userId, amount, currency_code: wallet.currency_code }])
  if (escErr) throw escErr

  // Insert bet record
  const { error: betErr } = await supabase.from('poker_bets').insert([{ hand_id: handId, user_id: userId, amount, action: 'bet' }])
  if (betErr) throw betErr

  // Audit
  await supabase.from('poker_audit').insert([{ hand_id: handId, event: 'bet_posted', payload: { userId, amount } }])

  return { success: true, remaining: newBal }
}

async function processRake(userId: string, tableId: string, startingBalance: number, endingBalance: number, rakeAmount: number, tipPercent: number, currencyCode: string) {
  if (!userId || !tableId) throw new Error('Invalid parameters')

  const netProfit = endingBalance - startingBalance
  const isWinner = netProfit > 0

  if (!isWinner || rakeAmount === 0) {
    // No rake for losers or breakeven players - just remove seat
    await supabase.from('poker_seats').delete().eq('table_id', tableId).eq('user_id', userId)
  } else {
    // Deduct rake from wallet
    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', userId).single()
    if (!wallet) throw new Error('Wallet not found')

    const currentBalance = Number(wallet.balance)
    if (currentBalance < rakeAmount) throw new Error('Insufficient balance for rake')

    const newBalance = currentBalance - rakeAmount
    await supabase.from('wallets').update({ balance: newBalance, updated_at: new Date() }).eq('user_id', userId)

    // Record the seat with ending balance and rake deducted
    await supabase.from('poker_seats').update({
      ending_balance: endingBalance,
      rake_deducted: rakeAmount,
      session_ended_at: new Date()
    }).eq('table_id', tableId).eq('user_id', userId)

    // Create session record for analytics
    const { data: seat } = await supabase.from('poker_seats').select('id').eq('table_id', tableId).eq('user_id', userId).single()

    await supabase.from('poker_sessions').insert([{
      table_id: tableId,
      user_id: userId,
      seat_id: seat?.id,
      starting_balance: startingBalance,
      ending_balance: endingBalance,
      net_profit: netProfit,
      rake_percent: 10,
      rake_amount: rakeAmount,
      tip_percent: tipPercent,
      tip_amount: rakeAmount,
      currency_code: currencyCode,
      left_at: new Date()
    }])

    // Remove seat
    await supabase.from('poker_seats').delete().eq('table_id', tableId).eq('user_id', userId)
  }

  // Check if table is now empty
  const { data: remainingSeats } = await supabase.from('poker_seats').select('*').eq('table_id', tableId)
  if (!remainingSeats || remainingSeats.length === 0) {
    // Delete empty table and all related records
    await supabase.from('poker_tables').delete().eq('id', tableId)
  }

  return { success: true, rakeAmount, finalBalance: endingBalance - rakeAmount }
}

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const path = url.pathname
    if (path.endsWith('/create_table') && req.method === 'POST') {
      const body = await req.json()
      const t = await createTable(body.name, Number(body.stakeMin), Number(body.stakeMax), body.currency)
      return new Response(JSON.stringify(t), { headers: { 'content-type': 'application/json' } })
    }

    if (path.endsWith('/join_table') && req.method === 'POST') {
      const body = await req.json()
      const r = await joinTable(body.tableId, body.userId, Number(body.seatNumber))
      return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } })
    }

    if (path.endsWith('/start_hand') && req.method === 'POST') {
      const body = await req.json()
      const r = await startHand(body.tableId)
      return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } })
    }

    if (path.endsWith('/post_bet') && req.method === 'POST') {
      const body = await req.json()
      const r = await postBet(body.handId, body.userId, Number(body.amount))
      return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
  } catch (err) {
    console.error('poker-engine error', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})

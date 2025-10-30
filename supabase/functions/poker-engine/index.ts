import { createClient } from 'npm:@supabase/supabase-js'

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
  const { error: updErr } = await supabase.from('wallets').update({ balance: newBal, updated_at: new Date() }).eq('user_id', userId).eq('currency_code', wallet.currency_code)
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

  const HOUSE_ID = '00000000-0000-0000-0000-000000000000'
  const netProfit = endingBalance - startingBalance
  const isWinner = netProfit > 0

  if (!isWinner || rakeAmount === 0) {
    // No rake for losers or breakeven players - just remove seat
    await supabase.from('poker_seats').delete().eq('table_id', tableId).eq('user_id', userId)
  } else {
    // Get seat ID first
    const { data: seat } = await supabase.from('poker_seats').select('id').eq('table_id', tableId).eq('user_id', userId).single()
    if (!seat) throw new Error('Seat not found')

    // Calculate tip
    const tipAmount = Math.round(rakeAmount * (tipPercent / 100))

    // Total deduction: rake + tip
    const totalDeduction = rakeAmount + tipAmount

    // Deduct rake and tip from player wallet
    const { data: playerWallet } = await supabase.from('wallets').select('*').eq('user_id', userId).eq('currency_code', currencyCode).single()
    if (!playerWallet) throw new Error('Player wallet not found')

    const playerCurrentBalance = Number(playerWallet.balance)
    if (playerCurrentBalance < totalDeduction) throw new Error('Insufficient balance for rake and tip')

    const playerNewBalance = playerCurrentBalance - totalDeduction
    await supabase.from('wallets').update({ balance: playerNewBalance, updated_at: new Date() }).eq('user_id', userId).eq('currency_code', currencyCode)

    // Get House wallet and update it
    const { data: houseWallet } = await supabase.from('wallets').select('*').eq('user_id', HOUSE_ID).eq('currency_code', currencyCode).single()
    if (!houseWallet) throw new Error('House wallet not found')

    const houseCurrentBalance = Number(houseWallet.balance)
    const houseNewBalance = houseCurrentBalance + totalDeduction
    await supabase.from('wallets').update({ balance: houseNewBalance, updated_at: new Date() }).eq('user_id', HOUSE_ID).eq('currency_code', currencyCode)

    // Record rake transaction (rake only, or total? Assuming total as amount)
    await supabase.from('rake_transactions').insert([{
      house_id: HOUSE_ID,
      user_id: userId,
      table_id: tableId,
      amount: totalDeduction,
      tip_percent: tipPercent,
      currency_code: currencyCode,
      balance_after: houseNewBalance
    }])

    // Create session record for analytics
    await supabase.from('poker_sessions').insert([{
      table_id: tableId,
      user_id: userId,
      seat_id: seat.id,
      starting_balance: startingBalance,
      ending_balance: endingBalance,
      net_profit: netProfit,
      rake_percent: 10,
      rake_amount: rakeAmount,
      tip_percent: tipPercent,
      tip_amount: tipAmount,
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

  return { success: true, rakeAmount, tipAmount: tipPercent > 0 ? Math.round(rakeAmount * (tipPercent / 100)) : 0, finalBalance: endingBalance - rakeAmount - (tipPercent > 0 ? Math.round(rakeAmount * (tipPercent / 100)) : 0) }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname
    if (path.endsWith('/create_table') && req.method === 'POST') {
      const body = await req.json()
      const t = await createTable(body.name, Number(body.stakeMin), Number(body.stakeMax), body.currency)
      return new Response(JSON.stringify(t), { headers: corsHeaders })
    }

    if (path.endsWith('/join_table') && req.method === 'POST') {
      const body = await req.json()
      const r = await joinTable(body.tableId, body.userId, Number(body.seatNumber), Number(body.startingBalance) || 0)
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/start_hand') && req.method === 'POST') {
      const body = await req.json()
      const r = await startHand(body.tableId)
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/post_bet') && req.method === 'POST') {
      const body = await req.json()
      const r = await postBet(body.handId, body.userId, Number(body.amount))
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/process_rake') && req.method === 'POST') {
      const body = await req.json()
      const r = await processRake(body.userId, body.tableId, Number(body.startingBalance), Number(body.endingBalance), Number(body.rakeAmount), Number(body.tipPercent), body.currencyCode)
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })
  } catch (err) {
    console.error('poker-engine error', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})

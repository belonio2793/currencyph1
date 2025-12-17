import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('VITE_PROJECT_URL') || Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE URL or SERVICE ROLE KEY env')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Chip system constant
const HOUSE_ID = '00000000-0000-0000-0000-000000000000'

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

async function getPlayerChips(userId: string): Promise<bigint> {
  const { data, error } = await supabase.from('player_poker_chips').select('total_chips').eq('user_id', userId).single()
  if (error && error.code !== 'PGRST116') throw error
  return BigInt(data?.total_chips || 0)
}

async function updatePlayerChips(userId: string, chipAmount: bigint): Promise<void> {
  const { error } = await supabase.from('player_poker_chips').upsert({
    user_id: userId,
    total_chips: chipAmount.toString(),
    updated_at: new Date()
  }, { onConflict: 'user_id' })
  if (error) throw error
}

async function createTable(name: string, stakeMin: number, stakeMax: number, currency = 'CHIPS', userId?: string) {
  const { data, error } = await supabase.from('poker_tables').insert([{ name, stake_min: stakeMin, stake_max: stakeMax, currency_code: currency, created_by: userId || null, is_default: false }]).select().single()
  if (error) throw error
  return data
}

async function joinTable(tableId: string, userId: string, seatNumber: number, chipsBuyIn: number = 0) {
  // Ensure seat available
  const { data: existing } = await supabase.from('poker_seats').select('*').eq('table_id', tableId).eq('seat_number', seatNumber).limit(1)
  if (existing && existing.length > 0) throw new Error('Seat already taken')

  // Check player has enough chips
  const playerChips = await getPlayerChips(userId)
  if (playerChips < BigInt(chipsBuyIn)) throw new Error('Insufficient chips. Buy more chips to join.')

  // Deduct chips from player inventory
  const newChipBalance = playerChips - BigInt(chipsBuyIn)
  await updatePlayerChips(userId, newChipBalance)

  const { data, error } = await supabase.from('poker_seats').insert([{
    table_id: tableId,
    user_id: userId,
    seat_number: seatNumber,
    starting_balance: chipsBuyIn,
    chip_balance: chipsBuyIn,
    chip_starting_balance: chipsBuyIn
  }]).select().single()
  if (error) throw error
  return data
}

async function startHand(tableId: string) {
  // load seats
  const { data: seats } = await supabase.from('poker_seats').select('*').eq('table_id', tableId).order('seat_number')
  if (!seats || seats.length < 2) throw new Error('Need at least 2 players')

  // Determine dealer position (rotate for next hand)
  const { data: lastHand } = await supabase
    .from('poker_hands')
    .select('dealer_seat')
    .eq('table_id', tableId)
    .order('created_at', { ascending: false })
    .limit(1)

  const currentDealerSeat = lastHand && lastHand[0]?.dealer_seat ? lastHand[0].dealer_seat : 0
  const nextDealerSeat = (currentDealerSeat % seats.length) + 1

  // create hand
  const { data: hand } = await supabase
    .from('poker_hands')
    .insert([{
      table_id: tableId,
      round_state: 'preflop',
      dealer_seat: nextDealerSeat
    }])
    .select()
    .single()
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

  // store remaining deck in audit for deterministic replay
  await supabase.from('poker_audit').insert([{
    hand_id: hand.id,
    table_id: tableId,
    event: 'hand_started',
    payload: {
      dealer_seat: nextDealerSeat,
      num_players: seats.length,
      deck_remaining: deck.slice(deckIndex)
    }
  }])

  return {
    handId: hand.id,
    dealerSeat: nextDealerSeat,
    smallBlindSeat: nextDealerSeat === seats.length ? 1 : nextDealerSeat + 1,
    bigBlindSeat: nextDealerSeat === seats.length - 1 ? 1 : (nextDealerSeat === seats.length ? 2 : nextDealerSeat + 2),
    actionOnSeat: nextDealerSeat === seats.length - 1 ? 1 : (nextDealerSeat === seats.length ? 2 : nextDealerSeat + 2),
    dealt: holeInserts.map(h => ({ user_id: h.user_id, seat_number: h.seat_number }))
  }
}

async function postBet(handId: string, userId: string, amount: number, action: string = 'bet') {
  if (action === 'fold' || action === 'check') {
    // No amount for fold/check
    const { error: betErr } = await supabase.from('poker_bets').insert([{ hand_id: handId, user_id: userId, amount: 0, chip_amount: 0, action }])
    if (betErr) throw betErr

    await supabase.from('poker_audit').insert([{ hand_id: handId, event: action, payload: { userId } }])
    return { success: true, action }
  }

  if (amount <= 0) throw new Error('Invalid bet amount')

  // For bet/raise/call: deduct from player chip balance at table and record escrow and bet
  const { data: hand } = await supabase.from('poker_hands').select('table_id').eq('id', handId).single()
  if (!hand) throw new Error('Hand not found')
  
  const { data: seatData } = await supabase.from('poker_seats').select('*').eq('table_id', hand.table_id).eq('user_id', userId).single()
  if (!seatData) throw new Error('Seat not found')

  const currentChipBalance = Number(seatData.chip_balance)
  if (currentChipBalance < amount) throw new Error('Insufficient chips for this bet')

  // Deduct chips from seat
  const newChipBalance = currentChipBalance - amount
  const { error: updErr } = await supabase.from('poker_seats').update({ chip_balance: newChipBalance, updated_at: new Date() }).eq('id', seatData.id)
  if (updErr) throw updErr

  // Insert escrow
  const { error: escErr } = await supabase.from('poker_escrow').insert([{ hand_id: handId, user_id: userId, amount, chip_amount: amount, currency_code: 'CHIPS' }])
  if (escErr) throw escErr

  // Insert bet record
  const { error: betErr } = await supabase.from('poker_bets').insert([{ hand_id: handId, user_id: userId, amount, chip_amount: amount, action }])
  if (betErr) throw betErr

  // Audit
  await supabase.from('poker_audit').insert([{ hand_id: handId, event: action, payload: { userId, amount } }])

  return { success: true, remaining: newChipBalance, action }
}

async function processRake(userId: string, tableId: string, startingChips: number, endingChips: number, rakePercent: number, tipPercent: number) {
  if (!userId || !tableId) throw new Error('Invalid parameters')

  const netProfit = endingChips - startingChips
  const isWinner = netProfit > 0

  if (!isWinner || rakePercent === 0) {
    // No rake for losers or breakeven players - just return chips to player
    const playerChips = await getPlayerChips(userId)
    await updatePlayerChips(userId, playerChips + BigInt(endingChips))
    
    // Remove seat
    await supabase.from('poker_seats').delete().eq('table_id', tableId).eq('user_id', userId)
  } else {
    // Get seat ID first
    const { data: seat } = await supabase.from('poker_seats').select('id').eq('table_id', tableId).eq('user_id', userId).single()
    if (!seat) throw new Error('Seat not found')

    // Calculate rake and tip in chips (all chip-based now)
    const rakeChips = Math.round(netProfit * (rakePercent / 100))
    const tipChips = Math.round(rakeChips * (tipPercent / 100))
    const totalDeductionChips = rakeChips + tipChips

    // Return remaining chips to player
    const playerChipsRemaining = endingChips - totalDeductionChips
    const playerChips = await getPlayerChips(userId)
    await updatePlayerChips(userId, playerChips + BigInt(playerChipsRemaining))

    // Add rake and tip to house (in chips)
    const totalHouseChips = rakeChips + tipChips
    const houseChips = await getPlayerChips(HOUSE_ID)
    await updatePlayerChips(HOUSE_ID, houseChips + BigInt(totalHouseChips))

    // Record rake transaction (in chips only)
    await supabase.from('rake_transactions').insert([{
      house_id: HOUSE_ID,
      user_id: userId,
      table_id: tableId,
      amount: totalHouseChips,
      tip_percent: tipPercent,
      currency_code: 'CHIPS'
    }])

    // Create session record for analytics
    await supabase.from('poker_sessions').insert([{
      table_id: tableId,
      user_id: userId,
      seat_id: seat.id,
      starting_balance: startingChips,
      ending_balance: endingChips,
      net_profit: netProfit,
      rake_percent: rakePercent,
      rake_amount: rakeChips,
      tip_percent: tipPercent,
      tip_amount: tipChips,
      currency_code: 'CHIPS',
      left_at: new Date()
    }])

    // Remove seat
    await supabase.from('poker_seats').delete().eq('table_id', tableId).eq('user_id', userId)
  }

  // Check if table is now empty
  const { data: remainingSeats } = await supabase.from('poker_seats').select('*').eq('table_id', tableId)
  if (!remainingSeats || remainingSeats.length === 0) {
    // Only delete user-created tables (not default tables)
    const { data: tableData } = await supabase.from('poker_tables').select('is_default').eq('id', tableId).single()
    if (tableData && !tableData.is_default) {
      // Delete empty user-created table and all related records
      await supabase.from('poker_tables').delete().eq('id', tableId)
    }
  }

  return { success: true, chipsRaked: Math.round(netProfit * (rakePercent / 100)), chipsReturned: endingChips - Math.round(netProfit * (rakePercent / 100)) - Math.round(Math.round(netProfit * (rakePercent / 100)) * (tipPercent / 100)) }
}

async function purchaseChips(userId: string, packageId: string): Promise<any> {
  // Get package details
  const { data: pkg, error: pkgErr } = await supabase.from('poker_chip_packages').select('*').eq('id', packageId).single()
  if (pkgErr) throw new Error('Package not found')

  // Add chips to player inventory
  const playerChips = await getPlayerChips(userId)
  const totalChipsToAdd = BigInt(pkg.chip_amount) + BigInt(pkg.bonus_chips || 0)
  await updatePlayerChips(userId, playerChips + totalChipsToAdd)

  // Record purchase
  const { data: purchase, error: purchaseErr } = await supabase.from('chip_purchases').insert([{
    user_id: userId,
    package_id: packageId,
    chips_purchased: pkg.chip_amount,
    bonus_chips_awarded: pkg.bonus_chips || 0,
    total_chips_received: pkg.chip_amount + (pkg.bonus_chips || 0),
    usd_price_paid: pkg.usd_price,
    payment_status: 'completed',
    created_at: new Date()
  }]).select().single()
  if (purchaseErr) throw purchaseErr

  return {
    success: true,
    chipsPurchased: pkg.chip_amount,
    bonusChips: pkg.bonus_chips || 0,
    totalChips: totalChipsToAdd.toString(),
    newBalance: (playerChips + totalChipsToAdd).toString()
  }
}

async function getHouseChips(): Promise<any> {
  const houseChips = await getPlayerChips(HOUSE_ID)
  return {
    houseChips: houseChips.toString()
  }
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
      const t = await createTable(body.name, Number(body.stakeMin), Number(body.stakeMax), 'CHIPS', body.userId)
      return new Response(JSON.stringify(t), { headers: corsHeaders })
    }

    if (path.endsWith('/join_table') && req.method === 'POST') {
      const body = await req.json()
      const r = await joinTable(body.tableId, body.userId, Number(body.seatNumber), Number(body.chipsBuyIn) || 0)
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/start_hand') && req.method === 'POST') {
      const body = await req.json()
      const r = await startHand(body.tableId)
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/post_bet') && req.method === 'POST') {
      const body = await req.json()
      const r = await postBet(body.handId, body.userId, Number(body.amount), body.action || 'bet')
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/fold') && req.method === 'POST') {
      const body = await req.json()
      const r = await postBet(body.handId, body.userId, 0, 'fold')
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/check') && req.method === 'POST') {
      const body = await req.json()
      const r = await postBet(body.handId, body.userId, 0, 'check')
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/call') && req.method === 'POST') {
      const body = await req.json()
      const r = await postBet(body.handId, body.userId, Number(body.amount) || 0, 'call')
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/raise') && req.method === 'POST') {
      const body = await req.json()
      const r = await postBet(body.handId, body.userId, Number(body.amount), 'raise')
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/process_rake') && req.method === 'POST') {
      const body = await req.json()
      const r = await processRake(body.userId, body.tableId, Number(body.startingChips), Number(body.endingChips), Number(body.rakePercent), Number(body.tipPercent))
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/purchase_chips') && req.method === 'POST') {
      const body = await req.json()
      const r = await purchaseChips(body.userId, body.packageId)
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    if (path.endsWith('/get_player_chips') && req.method === 'POST') {
      const body = await req.json()
      const chips = await getPlayerChips(body.userId)
      return new Response(JSON.stringify({ chips: chips.toString() }), { headers: corsHeaders })
    }

    if (path.endsWith('/get_house_chips') && req.method === 'POST') {
      const r = await getHouseChips()
      return new Response(JSON.stringify(r), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })
  } catch (err) {
    console.error('poker-engine error', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})

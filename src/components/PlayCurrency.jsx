import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

// Lightweight, self-contained RPG-like game tailored for MVP.
// Stores and syncs with Supabase when available (uses tables: game_characters, game_assets, game_presence, game_leaderboard, game_daily_rewards).

const STARTING_PROPERTIES = [
  { id: 'sari-sari', name: 'Sari-Sari Store', price: 500, income: 5 },
  { id: 'food-cart', name: 'Food Cart', price: 1200, income: 15 },
  { id: 'tricycle', name: 'Tricycle Business', price: 3000, income: 40 }
]

const JOBS = [
  { id: 'delivery', name: 'Delivery Job', reward: 50, xp: 10, duration: 3000 },
  { id: 'bartender', name: 'Bartender Shift', reward: 120, xp: 25, duration: 5000 },
  { id: 'developer', name: 'Freelance Dev Task', reward: 300, xp: 60, duration: 7000 }
]

function formatMoney(n) {
  return `P${Number(n || 0).toLocaleString()}`
}

export default function PlayCurrency({ userId, userEmail, onShowAuth }) {
  const [loading, setLoading] = useState(true)
  const [character, setCharacter] = useState(null)
  const [isWorking, setIsWorking] = useState(false)
  const [workProgress, setWorkProgress] = useState(0)
  const [properties, setProperties] = useState([])
  const [market, setMarket] = useState(STARTING_PROPERTIES)
  const [error, setError] = useState('')
  const [onlinePlayers, setOnlinePlayers] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const passiveTimerRef = useRef(null)
  const presenceChannelRef = useRef(null)
  const presenceTimerRef = useRef(null)
  const [isIsometric, setIsIsometric] = useState(false)
  const [mapSettings, setMapSettings] = useState({ avatarSpeed: 2, cameraSpeed: 1, zoomLevel: 1 })
  const [characterPosition, setCharacterPosition] = useState({ x: 0, y: 0, city: 'Manila' })
  const [matchRequests, setMatchRequests] = useState([])

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        setLoading(true)
        // Try to load character from DB if logged in
        if (userId) {
          const { data, error: e } = await supabase
            .from('game_characters')
            .select('*')
            .eq('user_id', userId)
            .limit(1)
            .single()
            .catch(err => ({ data: null, error: err }))
          if (!e && data) {
            if (mounted) {
              setCharacter(data)
              setProperties(data.properties || [])
            }
          } else {
            // no character -> leave null so UI prompts creation
            setCharacter(null)
          }
        } else {
          // Guest view: create ephemeral character in memory
          setCharacter((c) => c || {
            id: 'guest-' + Math.random().toString(36).slice(2, 9),
            name: 'Guest',
            user_id: null,
            wealth: 200,
            income_rate: 0,
            xp: 0,
            level: 1,
            last_daily: null,
            properties: []
          })
        }

        // Load market (could be dynamic from DB later)
        setMarket(STARTING_PROPERTIES)

        // Leaderboard fetch
        await loadLeaderboard()

        // Start passive income ticker
        startPassiveIncome()

        // Setup presence/realtime if supabase enabled
        if (userId) await setupPresence()
      } catch (err) {
        console.error('Init error', err)
        setError('Could not initialize game: ' + (err.message || String(err)))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()

    return () => {
      mounted = false
      stopPassiveIncome()
      teardownPresence()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Passive income adds character.income_rate to wealth every 10 seconds
  const startPassiveIncome = () => {
    stopPassiveIncome()
    passiveTimerRef.current = setInterval(async () => {
      setCharacter((c) => {
        if (!c) return c
        const updated = { ...c, wealth: Number(c.wealth || 0) + Number(c.income_rate || 0) }
        // persist small update
        persistCharacterPartial(updated)
        return updated
      })
      // Refresh leaderboard occasionally
      if (Math.random() < 0.05) loadLeaderboard()
    }, 10000)
  }

  const stopPassiveIncome = () => {
    if (passiveTimerRef.current) {
      clearInterval(passiveTimerRef.current)
      passiveTimerRef.current = null
    }
  }

  const persistCharacterPartial = async (char) => {
    if (!userId) return
    try {
      await supabase.from('game_characters').upsert({
        id: char.id,
        user_id: userId,
        name: char.name,
        wealth: char.wealth,
        income_rate: char.income_rate,
        xp: char.xp,
        level: char.level,
        properties: char.properties || [],
        last_daily: char.last_daily || null
      }, { onConflict: 'id' })
    } catch (e) {
      // ignore persistence errors but log
      console.warn('persistCharacterPartial failed', e)
    }
  }

  const saveCharacterToDB = async (char) => {
    if (!userId) return
    try {
      const payload = {
        id: char.id,
        user_id: userId,
        name: char.name,
        wealth: char.wealth,
        income_rate: char.income_rate,
        xp: char.xp,
        level: char.level,
        properties: char.properties || [],
        last_daily: char.last_daily || null
      }
      const { error: e } = await supabase.from('game_characters').upsert(payload, { onConflict: 'id' })
      if (e) throw e
      // update leaderboard table also
      await supabase.from('game_leaderboard').upsert({ user_id: userId, name: char.name, wealth: char.wealth }, { onConflict: 'user_id' }).catch(() => {})
    } catch (err) {
      console.warn('saveCharacterToDB failed', err)
      setError('Could not save character: ' + (err.message || String(err)))
    }
  }

  const createCharacter = async ({ name, starterJob }) => {
    const newChar = {
      id: userId ? `ch_${userId}` : 'guest_' + Math.random().toString(36).slice(2, 9),
      name: name || (userEmail || 'Player'),
      user_id: userId || null,
      wealth: 500,
      income_rate: starterJob === 'business' ? 2 : 0,
      xp: 0,
      level: 1,
      properties: [],
      last_daily: null
    }
    setCharacter(newChar)
    if (userId) await saveCharacterToDB(newChar)
    // announce presence/leaderboard
    if (userId) updatePresence({ action: 'join', char: { id: newChar.id, name: newChar.name } })
  }

  const performJob = async (job) => {
    if (!character) return
    if (isWorking) return
    setIsWorking(true)
    setWorkProgress(0)
    const start = Date.now()
    const duration = job.duration
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100))
      setWorkProgress(pct)
      if (pct >= 100) {
        clearInterval(tick)
      }
    }, 100)

    setTimeout(async () => {
      // reward
      setCharacter((c) => {
        if (!c) return c
        const updated = { ...c, wealth: Number(c.wealth || 0) + job.reward, xp: Number(c.xp || 0) + job.xp }
        // level up logic
        const newLevel = Math.max(1, Math.floor((updated.xp || 0) / 100) + 1)
        if (newLevel !== updated.level) updated.level = newLevel
        // persist
        persistCharacterPartial(updated)
        return updated
      })
      setIsWorking(false)
      setWorkProgress(0)
      await loadLeaderboard()
      if (userId) saveCharacterToDB(character)
    }, duration + 200)
  }

  const buyProperty = async (asset) => {
    if (!character) return
    if ((character.wealth || 0) < asset.price) {
      setError('Not enough money')
      return
    }
    const updated = { ...character }
    updated.wealth = Number(updated.wealth || 0) - asset.price
    updated.properties = (updated.properties || []).concat({ ...asset, purchased_at: new Date().toISOString() })
    updated.income_rate = Number(updated.income_rate || 0) + Number(asset.income || 0)
    setCharacter(updated)
    persistCharacterPartial(updated)
    if (userId) saveCharacterToDB(updated)
    await loadLeaderboard()
  }

  const sellProperty = async (assetId) => {
    if (!character) return
    const idx = (character.properties || []).findIndex(p => p.id === assetId)
    if (idx === -1) return
    const asset = character.properties[idx]
    const updated = { ...character }
    updated.properties = (updated.properties || []).filter(p => p.id !== assetId)
    // sell for 70% of price
    const refund = Math.floor((asset.price || 0) * 0.7)
    updated.wealth = Number(updated.wealth || 0) + refund
    updated.income_rate = Math.max(0, Number(updated.income_rate || 0) - Number(asset.income || 0))
    setCharacter(updated)
    persistCharacterPartial(updated)
    if (userId) saveCharacterToDB(updated)
    await loadLeaderboard()
  }

  const claimDaily = async () => {
    if (!character) return
    const now = Date.now()
    const last = character.last_daily ? new Date(character.last_daily).getTime() : 0
    if (now - last < 24 * 60 * 60 * 1000) {
      setError('Daily reward already claimed within 24 hours')
      return
    }
    const reward = 200 + Math.floor(Math.random() * 300)
    const updated = { ...character, wealth: Number(character.wealth || 0) + reward, last_daily: new Date().toISOString() }
    setCharacter(updated)
    persistCharacterPartial(updated)
    if (userId) saveCharacterToDB(updated)
    // log daily reward table
    if (userId) {
      try {
        await supabase.from('game_daily_rewards').insert({ user_id: userId, amount: reward }).catch(() => {})
      } catch (e) { /* ignore */ }
    }
    await loadLeaderboard()
  }

  const loadLeaderboard = async () => {
    try {
      const { data, error: e } = await supabase.from('game_characters').select('name,user_id,wealth').order('wealth', { ascending: false }).limit(10)
        .catch(err => ({ data: null, error: err }))
      if (!e && data) {
        setLeaderboard(data.map(r => ({ name: r.name, wealth: r.wealth || 0, user_id: r.user_id })))
      } else {
        // fallback: if DB not present, construct from local char only
        if (character) setLeaderboard([{ name: character.name, wealth: character.wealth }])
      }
    } catch (err) {
      console.warn('loadLeaderboard failed', err)
    }
  }

  // Presence: publish simple join/leave and listen for presence list
  const setupPresence = async () => {
    try {
      teardownPresence()
      const channel = supabase.channel('public:game_presence')

      // Handle generic broadcasts for presence, matchmaking and updates
      channel.on('broadcast', { event: 'character_update' }, (payload) => {
        // payload: { action, char, user_id }
        try {
          const p = payload?.payload
          if (!p) return
          if (p.action === 'join' && p.char) {
            setOnlinePlayers((prev) => {
              if (prev.find(x => x.user_id === p.char.id || x.name === p.char.name)) return prev
              return prev.concat({ user_id: p.char.id, name: p.char.name, status: 'online' })
            })
          }
          if (p.action === 'leave' && p.char) {
            setOnlinePlayers((prev) => prev.filter(x => x.user_id !== p.char.id && x.name !== p.char.name))
          }
          // Refresh leaderboard on updates
          loadLeaderboard()
        } catch (e) { console.warn(e) }
      })

      channel.on('broadcast', { event: 'presence_heartbeat' }, (payload) => {
        const p = payload?.payload
        if (!p) return
        setOnlinePlayers((prev) => {
          const idx = prev.findIndex(x => x.user_id === p.user_id || x.name === p.name)
          if (idx === -1) return prev.concat({ user_id: p.user_id, name: p.name, status: p.status || 'online' })
          const copy = [...prev]
          copy[idx] = { ...copy[idx], last_seen: new Date().toISOString(), status: p.status || 'online' }
          return copy
        })
      })

      // Matchmaking requests
      channel.on('broadcast', { event: 'match_request' }, (payload) => {
        const p = payload?.payload
        if (!p) return
        // add incoming request if it's not from us
        if (p.user_id !== (userId || character?.id)) {
          setMatchRequests((prev) => prev.concat(p))
          // auto-respond with simple acceptance for demo: send match_response
          setTimeout(() => {
            try { channel.send({ type: 'broadcast', event: 'match_response', payload: { to: p.user_id, from: userId || character?.id, accepted: true } }) } catch(e){}
          }, 1000 + Math.floor(Math.random() * 3000))
        }
      })

      channel.on('broadcast', { event: 'match_response' }, (payload) => {
        const p = payload?.payload
        if (!p) return
        // handle responses to our requests
        if (p.to === (userId || character?.id)) {
          // simple notification: add to onlinePlayers or handle a match
          setOnlinePlayers((prev) => prev.concat({ user_id: p.from, name: p.from_name || 'Opponent', status: p.accepted ? 'matched' : 'rejected' }))
        }
      })

      await channel.subscribe()
      presenceChannelRef.current = channel

      // broadcast join
      await updatePresence({ action: 'join', char: { id: character?.id, name: character?.name }, user_id: userId || character?.id })

      // start heartbeat to announce presence every 15s
      presenceTimerRef.current = setInterval(() => {
        try {
          updatePresence({ action: 'heartbeat', user_id: userId || character?.id, name: character?.name, status: 'online' })
        } catch (e) {}
      }, 15000)

    } catch (err) {
      console.warn('setupPresence failed', err)
    }
  }

  const teardownPresence = async () => {
    try {
      if (presenceTimerRef.current) { clearInterval(presenceTimerRef.current); presenceTimerRef.current = null }
      if (presenceChannelRef.current) {
        try { await presenceChannelRef.current.unsubscribe() } catch (e) {}
        presenceChannelRef.current = null
      }
    } catch (err) { /* ignore */ }
  }

  const updatePresence = async (data) => {
    try {
      if (!presenceChannelRef.current) return
      // choose event by action
      const event = data && data.action === 'heartbeat' ? 'presence_heartbeat' : (data && data.type) || 'character_update'
      await presenceChannelRef.current.send({ type: 'broadcast', event, payload: data })
    } catch (err) {
      console.warn('updatePresence failed', err)
    }
  }

  const handleNameChange = (name) => {
    setCharacter((c) => ({ ...c, name }))
  }

  const handleCreateAndSave = async (name) => {
    if (!name) return
    const starterJob = 'business'
    const newChar = {
      id: userId ? `ch_${userId}` : 'guest_' + Math.random().toString(36).slice(2, 9),
      name,
      user_id: userId || null,
      wealth: 800,
      income_rate: starterJob === 'business' ? 2 : 0,
      xp: 0,
      level: 1,
      properties: [],
      last_daily: null
    }
    setCharacter(newChar)
    if (userId) await saveCharacterToDB(newChar)
    if (userId) updatePresence({ action: 'join', char: { id: newChar.id, name: newChar.name } })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center text-slate-100">
          <div className="text-4xl font-bold mb-2">Play Currency — Loading</div>
          <p className="text-slate-300">Initializing game...</p>
        </div>
      </div>
    )
  }

  if (!character || !character.name) {
    // Character creation UI
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-slate-800/60 border border-slate-700 rounded-lg p-8 text-slate-100">
          <h1 className="text-3xl font-bold mb-4">Create Your Character</h1>
          <p className="text-slate-400 mb-6">Begin your journey: create a name and a starter background.</p>
          <CharacterCreator onCreate={handleCreateAndSave} onShowAuth={onShowAuth} userId={userId} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: World / Map */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/40 border border-slate-700 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Game World</h2>
                  <p className="text-xs text-slate-400">Click a location to perform tasks and earn income.</p>
                </div>
                <div className="text-xs text-slate-400">Players online: {onlinePlayers.length}</div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-slate-400">Interact with the world below.</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsIsometric(!isIsometric)} className="px-2 py-1 text-xs bg-slate-700 rounded">{isIsometric ? 'Switch to Grid' : 'Isometric View'}</button>
                    <button onClick={() => requestMatch()} className="px-2 py-1 text-xs bg-amber-600 rounded text-black">Find Match</button>
                  </div>
                </div>

                {isIsometric ? (
                  <div style={{ height: 520 }} className="border border-slate-700 rounded">
                    <IsometricGameMap
                      properties={character.properties || []}
                      character={character}
                      city={character.current_location || character.home_city || 'Manila'}
                      onPropertyClick={(property) => {
                        // open quick buy modal: for now, give click reward
                        const reward = 20 + Math.floor(Math.random() * 80)
                        setCharacter((c) => {
                          const updated = { ...c, wealth: Number(c.wealth || 0) + reward, xp: Number(c.xp || 0) + 5 }
                          persistCharacterPartial(updated)
                          if (userId) saveCharacterToDB(updated)
                          return updated
                        })
                        loadLeaderboard()
                      }}
                      mapSettings={mapSettings}
                      onCharacterMove={(pos) => setCharacterPosition(pos)}
                    />
                  </div>
                ) : (
                  <WorldMap onClickLocation={async (loc) => {
                    // Simple click reward
                    const reward = 10 + Math.floor(Math.random() * 40)
                    setCharacter((c) => {
                      const updated = { ...c, wealth: Number(c.wealth || 0) + reward, xp: Number(c.xp || 0) + 5 }
                      persistCharacterPartial(updated)
                      if (userId) saveCharacterToDB(updated)
                      return updated
                    })
                    loadLeaderboard()
                  }} />
                )}

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {JOBS.map(job => (
                    <div key={job.id} className="p-3 bg-slate-800/60 border border-slate-700 rounded-lg">
                      <div className="font-semibold text-slate-100">{job.name}</div>
                      <div className="text-xs text-slate-400">Reward: {formatMoney(job.reward)} • XP: {job.xp}</div>
                      <div className="mt-3">
                        <button disabled={isWorking} onClick={() => performJob(job)} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium">Work</button>
                      </div>
                      {isWorking && <div className="mt-2 text-xs text-slate-300">Progress: {workProgress}%</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                <h3 className="text-lg font-bold mb-2">Marketplace</h3>
                <p className="text-xs text-slate-400 mb-3">Buy assets that generate passive income.</p>
                <div className="space-y-3">
                  {market.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-900/20 p-3 rounded">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-slate-400">Income: {formatMoney(item.income)}/10s • Price: {formatMoney(item.price)}</div>
                      </div>
                      <div>
                        <button onClick={() => buyProperty(item)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white">Buy</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                <h3 className="text-lg font-bold mb-2">Your Properties</h3>
                <p className="text-xs text-slate-400 mb-3">Owned assets that provide passive income.</p>
                <div className="space-y-3">
                  {(character.properties || []).length === 0 && <div className="text-slate-400 text-sm">You do not own any properties yet.</div>}
                  {(character.properties || []).map(prop => (
                    <div key={prop.id + (prop.purchased_at || '')} className="flex items-center justify-between bg-slate-900/20 p-3 rounded">
                      <div>
                        <div className="font-medium">{prop.name}</div>
                        <div className="text-xs text-slate-400">Income: {formatMoney(prop.income)}</div>
                      </div>
                      <div>
                        <button onClick={() => sellProperty(prop.id)} className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white">Sell</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Right: Character Card & Leaderboard */}
          <div>
            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4 mb-4">
              <h2 className="text-xl font-bold">{character.name}</h2>
              <p className="text-xs text-slate-400">Level {character.level} • XP {character.xp}</p>
              <div className="mt-4 space-y-2">
                <div className="p-3 bg-slate-900/30 rounded">
                  <div className="text-xs text-slate-400">Total Wealth</div>
                  <div className="text-2xl font-bold text-yellow-300">{formatMoney(character.wealth)}</div>
                </div>
                <div className="p-3 bg-slate-900/30 rounded">
                  <div className="text-xs text-slate-400">Income Rate</div>
                  <div className="text-xl font-bold text-emerald-300">{formatMoney(character.income_rate)}/10s</div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={claimDaily} className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white">Claim Daily</button>
                  {!userId && (
                    <button onClick={() => onShowAuth && onShowAuth('login')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white">Login</button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-bold mb-2">Leaderboard</h3>
              <ol className="list-decimal list-inside text-sm space-y-2">
                {leaderboard.map((p, idx) => (
                  <li key={p.user_id || p.name} className="flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-slate-300">{formatMoney(p.wealth)}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-bold mb-2">Players Online</h3>
              <div className="text-sm text-slate-300 space-y-2">
                {onlinePlayers.length === 0 && <div className="text-slate-400">No players currently online.</div>}
                {onlinePlayers.map(p => (
                  <div key={p.user_id} className="flex items-center justify-between">
                    <div>{p.name || 'Anonymous'}</div>
                    <div className="text-xs text-slate-400">{p.status || 'online'}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}


// Small helpers / subcomponents
function CharacterCreator({ onCreate, onShowAuth, userId }) {
  const [name, setName] = useState('')

  return (
    <div>
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1">Character Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded bg-slate-900/20 border border-slate-700 text-white" placeholder="Enter a name" />
      </div>

      <div className="flex gap-2">
        <button onClick={() => onCreate(name)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white">Create</button>
        {!userId && (
          <button onClick={() => onShowAuth && onShowAuth('login')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white">Login to Save</button>
        )}
      </div>
    </div>
  )
}

function WorldMap({ onClickLocation }) {
  // Simple clickable map made of city tiles to keep visuals light and responsive.
  const cities = [
    { id: 'manila', name: 'Manila' },
    { id: 'cebu', name: 'Cebu' },
    { id: 'davao', name: 'Davao' },
    { id: 'bacolod', name: 'Bacolod' },
    { id: 'baguio', name: 'Baguio' }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {cities.map(city => (
        <div key={city.id} className="bg-slate-900/20 border border-slate-700 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="font-semibold text-slate-100">{city.name}</div>
            <div className="text-xs text-slate-400 mt-1">Click to perform a local task and earn income.</div>
          </div>
          <div className="mt-3 text-right">
            <button onClick={() => onClickLocation(city)} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 rounded text-white">Visit</button>
          </div>
        </div>
      ))}
    </div>
  )
}

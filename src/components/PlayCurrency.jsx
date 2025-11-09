import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import IsometricGameMap from './game/IsometricGameMap'
import DuelMatch from './game/DuelMatch'
import MatchHistory from './game/MatchHistory'
import CharacterCustomizer from './game/CharacterCustomizer'
import PlayerTradingUI from './game/PlayerTradingUI'
import GuildManager from './game/GuildManager'
import MarketEconomyUI from './game/MarketEconomyUI'
import MatchSpectator from './game/MatchSpectator'
import { validateCosmetics, DEFAULT_COSMETICS } from '../lib/characterCosmetics'

// Lightweight, self-contained RPG-like game tailored for MVP.
// Stores and syncs with Supabase when available (uses tables: game_characters, game_assets, game_presence, game_leaderboard, game_daily_rewards).

const STARTING_PROPERTIES = [
  { id: 'sari-sari', name: 'Sari-Sari Store', price: 500, income: 5 },
  { id: 'food-cart', name: 'Food Cart', price: 1200, income: 15 },
  { id: 'tricycle', name: 'Tricycle Business', price: 3000, income: 40 }
]

// Comprehensive job database with 80+ realistic occupations
const JOB_DATABASE = {
  // Traditional/Manual Jobs
  manual: [
    { name: 'Tricycle Driver', reward: 45, xp: 10, duration: 2500, difficulty: 1 },
    { name: 'Construction Worker', reward: 80, xp: 18, duration: 3500, difficulty: 2 },
    { name: 'Jeepney Driver', reward: 60, xp: 12, duration: 3000, difficulty: 1 },
    { name: 'Street Vendor', reward: 35, xp: 8, duration: 2000, difficulty: 1 },
    { name: 'Farm Laborer', reward: 50, xp: 11, duration: 3000, difficulty: 1 },
    { name: 'Gardener', reward: 45, xp: 9, duration: 2800, difficulty: 1 },
    { name: 'Janitor', reward: 40, xp: 8, duration: 2500, difficulty: 1 },
    { name: 'Electrician', reward: 120, xp: 25, duration: 4000, difficulty: 3 },
    { name: 'Plumber', reward: 110, xp: 23, duration: 3800, difficulty: 3 },
    { name: 'Welder', reward: 100, xp: 22, duration: 3800, difficulty: 3 },
    { name: 'Carpenter', reward: 95, xp: 20, duration: 3600, difficulty: 2 },
    { name: 'Mason', reward: 85, xp: 18, duration: 3400, difficulty: 2 },
  ],

  // Service Industry Jobs
  service: [
    { name: 'Restaurant Waiter', reward: 55, xp: 12, duration: 3000, difficulty: 1 },
    { name: 'Bartender', reward: 75, xp: 16, duration: 3200, difficulty: 2 },
    { name: 'Security Guard', reward: 65, xp: 14, duration: 3500, difficulty: 2 },
    { name: 'Hotel Receptionist', reward: 70, xp: 15, duration: 3300, difficulty: 2 },
    { name: 'Hair Stylist', reward: 80, xp: 17, duration: 3000, difficulty: 2 },
    { name: 'Massage Therapist', reward: 85, xp: 18, duration: 3200, difficulty: 2 },
    { name: 'Taxi Driver', reward: 60, xp: 13, duration: 3100, difficulty: 1 },
    { name: 'Delivery Person', reward: 50, xp: 11, duration: 2800, difficulty: 1 },
    { name: 'Grocery Store Clerk', reward: 45, xp: 10, duration: 2600, difficulty: 1 },
    { name: 'Cinema Staff', reward: 40, xp: 9, duration: 2400, difficulty: 1 },
    { name: 'Tourist Guide', reward: 90, xp: 20, duration: 4000, difficulty: 2 },
    { name: 'Event Coordinator', reward: 100, xp: 22, duration: 4200, difficulty: 3 },
  ],

  // Agricultural & Farming Jobs
  farming: [
    { name: 'Rice Farmer', reward: 55, xp: 12, duration: 4000, difficulty: 2 },
    { name: 'Corn Planter', reward: 50, xp: 11, duration: 3800, difficulty: 1 },
    { name: 'Vegetable Gardener', reward: 48, xp: 10, duration: 3600, difficulty: 1 },
    { name: 'Coconut Harvester', reward: 65, xp: 14, duration: 3500, difficulty: 2 },
    { name: 'Banana Plantation Worker', reward: 60, xp: 13, duration: 3400, difficulty: 2 },
    { name: 'Fisherman', reward: 75, xp: 16, duration: 4500, difficulty: 2 },
    { name: 'Fish Farmer', reward: 70, xp: 15, duration: 4000, difficulty: 2 },
    { name: 'Livestock Herder', reward: 55, xp: 12, duration: 3600, difficulty: 2 },
    { name: 'Poultry Farmer', reward: 60, xp: 13, duration: 3500, difficulty: 2 },
    { name: 'Crop Inspector', reward: 85, xp: 18, duration: 3800, difficulty: 3 },
  ],

  // Tech & IT Jobs
  tech: [
    { name: 'Junior Programmer', reward: 150, xp: 35, duration: 4000, difficulty: 3 },
    { name: 'Full Stack Developer', reward: 250, xp: 55, duration: 5000, difficulty: 4 },
    { name: 'Web Developer', reward: 180, xp: 40, duration: 4200, difficulty: 3 },
    { name: 'Mobile App Developer', reward: 200, xp: 45, duration: 4500, difficulty: 4 },
    { name: 'Python Developer', reward: 190, xp: 42, duration: 4300, difficulty: 4 },
    { name: 'Database Administrator', reward: 210, xp: 48, duration: 4600, difficulty: 4 },
    { name: 'System Administrator', reward: 170, xp: 38, duration: 4100, difficulty: 3 },
    { name: 'IT Support Specialist', reward: 100, xp: 22, duration: 3500, difficulty: 2 },
    { name: 'QA Tester', reward: 130, xp: 28, duration: 3800, difficulty: 2 },
    { name: 'UI/UX Designer', reward: 160, xp: 36, duration: 4100, difficulty: 3 },
    { name: 'Cybersecurity Analyst', reward: 240, xp: 52, duration: 4800, difficulty: 4 },
    { name: 'DevOps Engineer', reward: 220, xp: 50, duration: 4700, difficulty: 4 },
  ],

  // Internet & Digital Jobs
  internet: [
    { name: 'Freelance Writer', reward: 95, xp: 21, duration: 3600, difficulty: 2 },
    { name: 'Content Creator', reward: 120, xp: 26, duration: 3800, difficulty: 2 },
    { name: 'Social Media Manager', reward: 110, xp: 24, duration: 3700, difficulty: 2 },
    { name: 'SEO Specialist', reward: 140, xp: 31, duration: 4000, difficulty: 3 },
    { name: 'Digital Marketer', reward: 130, xp: 29, duration: 3900, difficulty: 3 },
    { name: 'Email Campaign Manager', reward: 100, xp: 22, duration: 3500, difficulty: 2 },
    { name: 'Graphic Designer', reward: 120, xp: 26, duration: 3800, difficulty: 2 },
    { name: 'Video Editor', reward: 125, xp: 27, duration: 3900, difficulty: 2 },
    { name: 'Virtual Assistant', reward: 85, xp: 19, duration: 3300, difficulty: 2 },
    { name: 'Affiliate Marketer', reward: 105, xp: 23, duration: 3700, difficulty: 2 },
    { name: 'Influencer Campaign Manager', reward: 135, xp: 30, duration: 3950, difficulty: 3 },
    { name: 'Online Seller', reward: 90, xp: 20, duration: 3400, difficulty: 2 },
  ],

  // AI & Machine Learning Jobs
  ai: [
    { name: 'Machine Learning Engineer', reward: 280, xp: 62, duration: 5200, difficulty: 5 },
    { name: 'AI Trainer', reward: 200, xp: 45, duration: 4500, difficulty: 3 },
    { name: 'Data Scientist', reward: 260, xp: 58, duration: 5000, difficulty: 5 },
    { name: 'Deep Learning Specialist', reward: 290, xp: 64, duration: 5300, difficulty: 5 },
    { name: 'NLP Engineer', reward: 270, xp: 60, duration: 5100, difficulty: 5 },
    { name: 'Computer Vision Specialist', reward: 280, xp: 62, duration: 5200, difficulty: 5 },
    { name: 'AI Research Assistant', reward: 220, xp: 49, duration: 4700, difficulty: 4 },
    { name: 'Prompt Engineer', reward: 160, xp: 36, duration: 4100, difficulty: 3 },
    { name: 'Data Annotator', reward: 110, xp: 24, duration: 3700, difficulty: 2 },
    { name: 'Model Evaluator', reward: 140, xp: 31, duration: 3950, difficulty: 3 },
    { name: 'AI Ethics Consultant', reward: 250, xp: 55, duration: 4900, difficulty: 4 },
  ],

  // Business & Corporate Jobs
  business: [
    { name: 'Sales Representative', reward: 110, xp: 24, duration: 3700, difficulty: 2 },
    { name: 'Business Analyst', reward: 155, xp: 34, duration: 4050, difficulty: 3 },
    { name: 'Project Manager', reward: 170, xp: 38, duration: 4150, difficulty: 3 },
    { name: 'Accountant', reward: 140, xp: 31, duration: 3950, difficulty: 3 },
    { name: 'Human Resources Manager', reward: 145, xp: 32, duration: 4000, difficulty: 3 },
    { name: 'Marketing Manager', reward: 150, xp: 33, duration: 4050, difficulty: 3 },
    { name: 'Customer Service Manager', reward: 120, xp: 26, duration: 3800, difficulty: 2 },
    { name: 'Office Manager', reward: 105, xp: 23, duration: 3700, difficulty: 2 },
  ],

  // Professional Jobs
  professional: [
    { name: 'Consultant', reward: 200, xp: 45, duration: 4500, difficulty: 4 },
    { name: 'Financial Advisor', reward: 180, xp: 40, duration: 4200, difficulty: 3 },
    { name: 'Accountant', reward: 160, xp: 36, duration: 4100, difficulty: 3 },
    { name: 'Lawyer (Contract Review)', reward: 220, xp: 49, duration: 4700, difficulty: 4 },
    { name: 'Tax Advisor', reward: 190, xp: 42, duration: 4300, difficulty: 4 },
  ],

  // Education Jobs
  education: [
    { name: 'Tutor', reward: 80, xp: 17, duration: 3200, difficulty: 2 },
    { name: 'Online Teacher', reward: 100, xp: 22, duration: 3500, difficulty: 2 },
    { name: 'Course Instructor', reward: 140, xp: 31, duration: 4000, difficulty: 3 },
    { name: 'Language Tutor', reward: 95, xp: 21, duration: 3400, difficulty: 2 },
  ],
}

// Helper to get jobs and rotate them
const getAvailableJobs = (seed) => {
  const allJobs = Object.values(JOB_DATABASE).flat()
  // Shuffle jobs based on seed (changes per play session)
  const shuffled = allJobs
    .map((job, idx) => ({ ...job, sortKey: Math.sin(idx + seed) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 3)
    .map(({ sortKey, ...job }) => job)
  return shuffled
}

function formatMoney(n) {
  return `P${Number(n || 0).toLocaleString()}`
}

// Normalize property to ensure all required fields exist for minimap rendering
const normalizeProperty = (prop, index) => {
  if (!prop) return null
  return {
    ...prop,
    location_x: prop.location_x !== undefined ? prop.location_x : (index * 50 + Math.random() * 100) % 300,
    location_y: prop.location_y !== undefined ? prop.location_y : (index * 50 + Math.random() * 100) % 350,
    current_value: prop.current_value || prop.price || 100000,
    owner_id: prop.owner_id || 'player',
    upgrade_level: prop.upgrade_level || 0,
    property_type: prop.property_type || prop.type || 'business'
  }
}

export default function PlayCurrency({ userId, userEmail, onShowAuth }) {
  const [loading, setLoading] = useState(true)
  const [character, setCharacter] = useState(null)
  const [charactersList, setCharactersList] = useState([])
  const [loadingChars, setLoadingChars] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [workingJobId, setWorkingJobId] = useState(null)
  const [workProgress, setWorkProgress] = useState(0)
  const [properties, setProperties] = useState([])
  const [market, setMarket] = useState(STARTING_PROPERTIES)
  const [jobs, setJobs] = useState([])
  const [jobSeed, setJobSeed] = useState(Math.random() * 10000)
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
  const [cityFocus, setCityFocus] = useState('Manila')
  const [cityStats, setCityStats] = useState({})
  const [cosmetics, setCosmetics] = useState(DEFAULT_COSMETICS)
  const [customizationOpen, setCustomizationOpen] = useState(false)
  const [initialAvatarPos, setInitialAvatarPos] = useState(null)
  const [phases, setPhases] = useState({
    // Basic phases
    didJob: false,
    boughtAsset: false,
    claimedDaily: false,
    visitedCities: {},
    winDuel: false,
    // Intermediate phases
    earnedWealth500: false,
    ownedMultipleAssets: false,
    reachedLevel5: false,
    completedDailyStreak3: false,
    // Advanced phases
    earnedWealth5000: false,
    visitedAllCities: false,
    reachedLevel10: false,
    wonMultipleDuels: false,
    achievedPassiveIncome100: false
  })
  const lastAutosaveRef = useRef(0)
  const dailyStreakRef = useRef(0)
  const lastDailyClaimRef = useRef(0)

  // AUTOSAVE SYSTEM DOCUMENTATION:
  // - Uses localStorage for lightweight metadata (position/city) - very efficient, minimal memory impact
  // - Debounced to 800ms to prevent excessive writes
  // - Supabase persistCharacterPartial syncs game state asynchronously
  // - Each save only replaces previous data (no accumulation), so memory usage is constant
  // - No UI notifications - saves happen silently in background

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        setLoading(true)
        // Try to load characters from DB if logged in
        if (userId) {
          setLoadingChars(true)
          const { data, error: e } = await supabase
            .from('game_characters')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
          if (!e && data) {
            if (mounted) {
              setCharactersList(data || [])
              // try to restore last-played from localStorage, otherwise pick most recent (ordered by updated_at desc)
              const lastPlayedId = typeof window !== 'undefined' ? localStorage.getItem('game_last_played') : null
              let selected = null
              if (lastPlayedId) selected = (data || []).find(d => d.id === lastPlayedId)
              if (!selected && data && data.length > 0) selected = data[0]
              if (selected) {
                setCharacter(selected)
                setProperties(selected.properties || [])
                // Load cosmetics from character or use defaults
                if (selected.cosmetics) {
                  setCosmetics(validateCosmetics(selected.cosmetics))
                }
              } else {
                setCharacter(null)
              }
            }
          } else {
            setCharactersList([])
            setCharacter(null)
          }
          setLoadingChars(false)
        } else {
          // Guest view: create ephemeral character in memory
          const guestChar = {
            id: 'guest-' + Math.random().toString(36).slice(2, 9),
            name: 'Guest',
            user_id: null,
            wealth: 200,
            income_rate: 0,
            xp: 0,
            level: 1,
            last_daily: null,
            properties: [],
            cosmetics: DEFAULT_COSMETICS
          }
          setCharacter(guestChar)
          setCosmetics(DEFAULT_COSMETICS)
        }

        // Load market (could be dynamic from DB later)
        setMarket(STARTING_PROPERTIES)

        // Initialize jobs for first city
        const initialJobs = getAvailableJobs(jobSeed)
        setJobs(initialJobs)

        // Initialize city stats
        setCityStats({
          Manila: { jobsCompleted: 0, moneyEarned: 0 },
          Cebu: { jobsCompleted: 0, moneyEarned: 0 },
          Davao: { jobsCompleted: 0, moneyEarned: 0 },
          Bacolod: { jobsCompleted: 0, moneyEarned: 0 },
          Baguio: { jobsCompleted: 0, moneyEarned: 0 }
        })

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
        if (mounted) {
          setLoading(false)
          setLoadingChars(false)
        }
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

  // Load saved map state for this character
  useEffect(() => {
    try {
      if (!character || !character.id) return
      const key = `pc_saved_position_${character.id}`
      const raw = localStorage.getItem(key)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
          setInitialAvatarPos({ x: saved.x, y: saved.y })
        }
        if (saved && saved.city) setCityFocus(saved.city)
      }
    } catch (e) { /* ignore */ }
  }, [character?.id])

  // Load phases from localStorage for this character
  useEffect(() => {
    if (!character || !character.id) return
    try {
      const raw = localStorage.getItem(`pc_phases_${character.id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') setPhases(parsed)
      }
    } catch (e) { /* ignore */ }
  }, [character?.id])

  // Debounced autosave of position/city (silent, background)
  useEffect(() => {
    if (!character || !character.id) return
    const now = Date.now()
    if (now - lastAutosaveRef.current < 800) return
    lastAutosaveRef.current = now
    try {
      const key = `pc_saved_position_${character.id}`
      const payload = { x: Math.round(characterPosition.x || 0), y: Math.round(characterPosition.y || 0), city: cityFocus }
      localStorage.setItem(key, JSON.stringify(payload))
      // Silently save - no UI notification needed
    } catch (e) { /* ignore */ }
  }, [characterPosition, cityFocus, character?.id])

  // Ensure character.current_location reflects UI cityFocus and persist lightly
  useEffect(() => {
    if (!character) return
    if (character.current_location !== cityFocus) {
      const updated = { ...character, current_location: cityFocus }
      setCharacter(updated)
      persistCharacterPartial(updated)
      if (userId) saveCharacterToDB(updated)
    }
  }, [cityFocus])

  // Rotate jobs based on city and seed
  const rotateJobs = () => {
    const newSeed = jobSeed + 1
    setJobSeed(newSeed)
    const newJobs = getAvailableJobs(newSeed)
    setJobs(newJobs)
  }

  // Handle city click - changes location and rotates jobs
  const handleCityClick = (cityName) => {
    setCityFocus(cityName)
    setCharacterPosition({ ...characterPosition, city: cityName })
    rotateJobs()
    markVisitedCity(cityName)
  }

  // Update cosmetics and persist to character
  const handleUpdateCosmetics = (newCosmetics) => {
    const validated = validateCosmetics(newCosmetics)
    setCosmetics(validated)

    // Persist to character if loaded
    if (character) {
      const updated = { ...character, cosmetics: validated }
      persistCharacterPartial(updated)
      if (userId) saveCharacterToDB(updated)
    }
  }

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

  const savePhases = (next) => {
    try {
      if (!character || !character.id) return
      localStorage.setItem(`pc_phases_${character.id}`, JSON.stringify(next))
    } catch (e) { /* ignore */ }
  }

  const markVisitedCity = (name) => {
    setPhases(prev => {
      const visited = { ...(prev.visitedCities || {}), [name]: true }
      const updated = { ...prev, visitedCities: visited }
      // Check if visited all cities
      if (Object.keys(visited).length >= 5) {
        updated.visitedAllCities = true
      }
      savePhases(updated)
      return updated
    })
  }

  const checkAndUpdatePhases = (updatedChar) => {
    setPhases(prev => {
      let next = { ...prev }
      if (updatedChar.wealth >= 500 && !next.earnedWealth500) next.earnedWealth500 = true
      if (updatedChar.wealth >= 5000 && !next.earnedWealth5000) next.earnedWealth5000 = true
      if (updatedChar.level >= 5 && !next.reachedLevel5) next.reachedLevel5 = true
      if (updatedChar.level >= 10 && !next.reachedLevel10) next.reachedLevel10 = true
      if ((updatedChar.properties || []).length >= 2 && !next.ownedMultipleAssets) next.ownedMultipleAssets = true
      if (updatedChar.income_rate >= 100 && !next.achievedPassiveIncome100) next.achievedPassiveIncome100 = true
      if (Object.keys(prev).length !== Object.keys(next).length) savePhases(next)
      return next
    })
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
        cosmetics: char.cosmetics || null,
        last_daily: char.last_daily || null,
        current_location: char.current_location || null,
        home_city: char.home_city || null
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
        cosmetics: char.cosmetics || null,
        last_daily: char.last_daily || null,
        current_location: char.current_location || null,
        home_city: char.home_city || null
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
    if (!name || !name.trim()) {
      throw new Error('Character name is required')
    }

    const newChar = {
      name: name.trim(),
      user_id: userId || null,
      level: 1,
      experience: 0,
      money: starterJob === 'business' ? 2000 : 500,
      home_city: 'Manila',
      current_location: 'Manila',
      health: 100,
      max_health: 100,
      energy: 100,
      max_energy: 100,
      hunger: 100,
      base_speed: 5,
      appearance: {
        gender: 'male',
        skin_tone: 'medium',
        hair_style: 'short',
        height: 175,
        build: 'average',
        hair_color: 'black'
      },
      wealth: starterJob === 'business' ? 2000 : 500,
      income_rate: starterJob === 'business' ? 2 : 0,
      xp: 0,
      properties: [],
      last_daily: null
    }

    setCharacter(newChar)

    if (userId) {
      try {
        const { data: inserted, error: insertErr } = await supabase
          .from('game_characters')
          .insert([newChar])
          .select()
          .single()

        if (insertErr) {
          console.error('Insert error:', insertErr)
          throw insertErr
        }

        if (inserted) {
          setCharacter(inserted)
          setCharactersList((prev) => (prev || []).concat(inserted))
        }
      } catch (e) {
        console.error('Character creation failed:', e)
        throw new Error('Failed to create character: ' + (e.message || String(e)))
      }

      try {
        await loadCharactersForUser()
      } catch(e) {
        console.warn('Could not reload characters', e)
      }
    } else {
      setCharactersList((prev) => (prev || []).concat(newChar))
    }

    if (userId) {
      updatePresence({ action: 'join', char: { name: newChar.name } })
    }
  }

  const performJob = async (job) => {
    if (!character) return
    if (isWorking) return
    setIsWorking(true)
    setWorkingJobId(job.name)
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
      // reward with skill scaling based on difficulty and character level
      setCharacter((c) => {
        if (!c) return c
        const charLevel = c.level || 1
        const difficultyMultiplier = 0.8 + (job.difficulty * 0.1) // Higher difficulty = higher base reward
        const levelMultiplier = 1 + (charLevel * 0.15) // Higher level = higher rewards (scales 15% per level)

        // Scale reward and XP based on character level
        const scaledReward = Math.floor(job.reward * levelMultiplier)
        const scaledXP = Math.floor(job.xp * levelMultiplier)

        const updated = { ...c, wealth: Number(c.wealth || 0) + scaledReward, xp: Number(c.xp || 0) + scaledXP }

        // level up logic (every 100 xp = 1 level)
        const newLevel = Math.max(1, Math.floor((updated.xp || 0) / 100) + 1)
        if (newLevel !== updated.level) updated.level = newLevel

        // persist
        persistCharacterPartial(updated)
        // Save using the updated object (avoid stale closure)
        if (userId) saveCharacterToDB(updated).catch((e)=>{console.warn('saveCharacterToDB after job failed', e)})
        // Check phase progression
        checkAndUpdatePhases(updated)
        return updated
      })

      // Update city stats
      setCityStats((prev) => {
        const scaledReward = Math.floor(job.reward * (1 + ((character && character.level) ? character.level * 0.15 : 0)))
        return {
          ...prev,
          [cityFocus]: {
            jobsCompleted: (prev[cityFocus]?.jobsCompleted || 0) + 1,
            moneyEarned: (prev[cityFocus]?.moneyEarned || 0) + scaledReward
          }
        }
      })

      setIsWorking(false)
      setWorkingJobId(null)
      setWorkProgress(0)
      setPhases(prev => { const next = { ...prev, didJob: true }; savePhases(next); return next })
      await loadLeaderboard()
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
    updated.properties = (updated.properties || []).concat({
      ...asset,
      purchased_at: new Date().toISOString(),
      location_x: Math.random() * 300,
      location_y: Math.random() * 350,
      current_value: asset.price,
      owner_id: character.id || 'player',
      upgrade_level: 0,
      property_type: asset.type || 'business'
    })
    updated.income_rate = Number(updated.income_rate || 0) + Number(asset.income || 0)
    setCharacter(updated)
    persistCharacterPartial(updated)
    if (userId) saveCharacterToDB(updated)
    setPhases(prev => { const next = { ...prev, boughtAsset: true }; savePhases(next); return next })
    checkAndUpdatePhases(updated)
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
    // Track daily streak
    const timeSinceLast = now - last
    const oneDayMs = 24 * 60 * 60 * 1000
    let streak = 1
    if (timeSinceLast > oneDayMs && timeSinceLast < oneDayMs * 2) {
      streak = (dailyStreakRef.current || 0) + 1
    }
    dailyStreakRef.current = streak

    const reward = 200 + Math.floor(Math.random() * 300) + (streak > 1 ? streak * 10 : 0) // Bonus for streaks
    const updated = { ...character, wealth: Number(character.wealth || 0) + reward, last_daily: new Date().toISOString() }
    setCharacter(updated)
    persistCharacterPartial(updated)
    if (userId) saveCharacterToDB(updated)

    setPhases(prev => {
      const next = { ...prev, claimedDaily: true }
      if (streak >= 3 && !next.completedDailyStreak3) {
        next.completedDailyStreak3 = true
      }
      savePhases(next)
      return next
    })
    // log daily reward table
    if (userId) {
      try {
        await supabase.from('game_daily_rewards').insert({ user_id: userId, amount: reward, streak }).catch(() => {})
      } catch (e) { /* ignore */ }
    }
    checkAndUpdatePhases(updated)
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

  // Load all characters for a user
  const loadCharactersForUser = async () => {
    if (!userId) return
    setLoadingChars(true)
    try {
      const { data, error } = await supabase.from('game_characters').select('*').eq('user_id', userId).order('created_at', { ascending: true })
      if (!error && data) {
        setCharactersList(data)
      }
    } catch (e) {
      console.warn('loadCharactersForUser failed', e)
    } finally {
      setLoadingChars(false)
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
          if (p.accepted) {
            // create a session and notify accepter (if they didn't send one) and start duel locally
            const sessionId = `ms_${Date.now()}_${Math.floor(Math.random()*10000)}`
            try { channel.send({ type: 'broadcast', event: 'match_started', payload: { sessionId, to: p.to, from: p.from, from_name: p.from_name, opponent_name: p.from_name } }) } catch(e){}
            startDuel(sessionId, { id: p.from, name: p.from_name || 'Opponent' })
          } else {
            setOnlinePlayers((prev) => prev.concat({ user_id: p.from, name: p.from_name || 'Opponent', status: 'rejected' }))
          }
        }
      })

      channel.on('broadcast', { event: 'match_started' }, (payload) => {
        const p = payload?.payload
        if (!p) return
        // if this match_started is targeting us, open duel
        if (p.to === (userId || character?.id)) {
          startDuel(p.sessionId, { id: p.from, name: p.from_name || p.opponent_name || 'Opponent' })
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
        try { await presenceChannelRef.current.send({ type: 'broadcast', event: 'character_update', payload: { action: 'leave', char: { id: character?.id, name: character?.name } } }) } catch(e){}
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

  // Simple matchmaking request broadcast
  const requestMatch = async () => {
    try {
      if (!presenceChannelRef.current) return
      const payload = { user_id: userId || character?.id, name: character?.name, timestamp: Date.now() }
      await presenceChannelRef.current.send({ type: 'broadcast', event: 'match_request', payload })
      setMatchRequests((prev) => prev.concat({ ...payload, status: 'sent' }))
    } catch (e) {
      console.warn('requestMatch failed', e)
    }
  }

  const acceptMatch = async (req) => {
    try {
      if (!presenceChannelRef.current) return
      // send response to requester
      await presenceChannelRef.current.send({ type: 'broadcast', event: 'match_response', payload: { to: req.user_id, from: userId || character?.id, from_name: character?.name, accepted: true } })
      // remove request locally
      setMatchRequests((prev) => prev.filter(m => m !== req))
      // optionally start a duel/minigame: for now just notify
      alert(`Match accepted with ${req.name || req.user_id}`)
    } catch (e) {
      console.warn('acceptMatch failed', e)
    }
  }

  const rejectMatch = async (req) => {
    try {
      if (!presenceChannelRef.current) return
      await presenceChannelRef.current.send({ type: 'broadcast', event: 'match_response', payload: { to: req.user_id, from: userId || character?.id, from_name: character?.name, accepted: false } })
      setMatchRequests((prev) => prev.filter(m => m !== req))
    } catch (e) {
      console.warn('rejectMatch failed', e)
    }
  }

  const consumeEnergy = (amount = 1) => {
    setCharacter((c) => {
      if (!c) return c
      const maxE = c.max_energy || 100
      const next = { ...c, energy: Math.max(0, (c.energy ?? maxE) - amount) }
      persistCharacterPartial(next)
      if (userId) saveCharacterToDB(next)
      return next
    })
  }

  const [duelSession, setDuelSession] = useState(null)

  const handleNameChange = (name) => {
    setCharacter((c) => ({ ...c, name }))
  }

  const startDuel = (sessionId, opponent) => {
    setDuelSession({ sessionId, opponent })
  }

  const endDuel = async ({ winner }) => {
    setDuelSession(null)
    // award small reward to winner locally
    try {
      if (winner && character && winner === character.name) {
        const updated = { ...character, wealth: Number(character.wealth || 0) + 100, xp: Number(character.xp || 0) + 20 }
        setCharacter(updated)
        persistCharacterPartial(updated)
        if (userId) saveCharacterToDB(updated)
      }
    } catch (e) { console.warn('endDuel update failed', e) }
  }

  // delete a character
  const deleteCharacter = async (id) => {
    if (!id) return
    try {
      if (userId) {
        await supabase.from('game_characters').delete().eq('id', id)
      }
      setCharactersList((prev) => (prev || []).filter(c => c.id !== id))
      if (character && character.id === id) {
        setCharacter(null)
      }
      // clear last-played if it referenced this id
      try { if (typeof window !== 'undefined') { const last = localStorage.getItem('game_last_played'); if (last === id) localStorage.removeItem('game_last_played') } } catch(e){}
      try { await loadCharactersForUser() } catch(e) {}
    } catch (e) {
      console.warn('deleteCharacter failed', e)
      setError('Could not delete character')
    }
  }

  const markCharacterPlayed = async (c) => {
    if (!c) return
    try {
      // touch DB row so updated_at changes and it becomes the most-recently-played
      if (userId) {
        await supabase.from('game_characters').update({}).eq('id', c.id).select()
      }
    } catch (e) { console.warn('markCharacterPlayed failed', e) }
    try { if (typeof window !== 'undefined') localStorage.setItem('game_last_played', c.id) } catch(e){}
  }

  const renameCharacter = async (id, newName) => {
    if (!id || !newName) return
    try {
      if (userId) {
        const { data, error } = await supabase.from('game_characters').update({ name: newName }).eq('id', id).select().single()
        if (!error && data) {
          setCharactersList((prev) => (prev || []).map(ch => ch.id === id ? data : ch))
          if (character && character.id === id) setCharacter(data)
        }
      } else {
        setCharactersList((prev) => (prev || []).map(ch => ch.id === id ? { ...ch, name: newName } : ch))
        if (character && character.id === id) setCharacter((c) => ({ ...c, name: newName }))
      }
    } catch (e) {
      console.warn('renameCharacter failed', e)
      setError('Could not rename character')
    }
  }

  const handleCreateAndSave = async (name) => {
    if (!name || !name.trim()) {
      setError('Character name is required')
      return
    }

    const starterJob = 'business'
    const newChar = {
      name: name.trim(),
      user_id: userId || null,
      level: 1,
      experience: 0,
      money: 800,
      home_city: 'Manila',
      current_location: 'Manila',
      health: 100,
      max_health: 100,
      energy: 100,
      max_energy: 100,
      hunger: 100,
      base_speed: 5,
      appearance: {
        gender: 'male',
        skin_tone: 'medium',
        hair_style: 'short',
        height: 175,
        build: 'average',
        hair_color: 'black'
      },
      wealth: 800,
      income_rate: starterJob === 'business' ? 2 : 0,
      xp: 0,
      properties: [],
      last_daily: null
    }

    setCharacter(newChar)
    setError('')

    if (userId) {
      try {
        const { data: inserted, error: insertErr } = await supabase
          .from('game_characters')
          .insert([newChar])
          .select()
          .single()

        if (insertErr) {
          console.error('Insert error:', insertErr)
          setError('Failed to save character: ' + (insertErr.message || 'Unknown error'))
          return
        }

        if (inserted) {
          setCharacter(inserted)
          setCharactersList((prev) => (prev || []).concat(inserted))
        }
      } catch (e) {
        console.error('Character creation failed:', e)
        setError('Failed to create character: ' + (e.message || String(e)))
        return
      }

      try {
        await loadCharactersForUser()
      } catch(e) {
        console.warn('Could not reload characters', e)
      }
    } else {
      setCharactersList((prev) => (prev || []).concat(newChar))
    }

    if (userId) {
      updatePresence({ action: 'join', char: { name: newChar.name } })
    }
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
    // Character selection/creation UI
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6 flex items-center justify-center">
        <div className="w-full max-w-3xl bg-slate-800/60 border border-slate-700 rounded-lg p-6 text-slate-100">
          <h1 className="text-3xl font-bold mb-2">Create Your Character</h1>
          <p className="text-slate-400 mb-4">Begin your journey: choose an existing character or create a new one.</p>

          {userId ? (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Your Characters</h3>
              {loadingChars && <div className="text-sm text-slate-400">Loading characters...</div>}
              {!loadingChars && (charactersList || []).length === 0 && (
                <div className="text-sm text-slate-400 mb-4">You have no saved characters yet. Create one below.</div>
              )}
              <div className="space-y-3 mb-4">
                {(charactersList || []).map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-slate-900/20 p-3 rounded">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-slate-400">Level {c.level} • Wealth: P{Number(c.wealth || 0).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={async () => { await markCharacterPlayed(c); setCharacter(c); setProperties(c.properties || []) }} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white">Play</button>
                      <button onClick={() => { const newName = prompt('Rename character', c.name); if (newName) renameCharacter(c.id, newName) }} className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white">Rename</button>
                      <button onClick={() => { if (confirm('Delete character?')) deleteCharacter(c.id) }} className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-6 text-sm text-slate-400">You are playing as a guest. Create a character locally or login to save characters.</div>
          )}

          <div className="bg-slate-900/20 p-4 rounded">
            <CharacterCreator onCreate={handleCreateAndSave} onShowAuth={onShowAuth} userId={userId} />
          </div>
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
                  <div className="text-sm text-slate-400">Now in <span className="font-semibold text-emerald-400">{cityFocus}</span> • Interact with available jobs.</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => rotateJobs()} className="px-2 py-1 text-xs bg-violet-600 hover:bg-violet-700 rounded text-white font-medium">Refresh Jobs</button>
                    <button onClick={() => setIsIsometric(!isIsometric)} className="px-2 py-1 text-xs bg-slate-700 rounded">{isIsometric ? 'Switch to Grid' : 'Isometric View'}</button>
                    <button onClick={() => requestMatch()} className="px-2 py-1 text-xs bg-amber-600 rounded text-black">Find Match</button>
                  </div>
                </div>

                {isIsometric ? (
                  <div style={{ height: 520 }} className="border border-slate-700 rounded">
                    <IsometricGameMap
                      properties={(character.properties || []).map(normalizeProperty)}
                      character={character}
                      city={cityFocus}
                      initialAvatarPos={initialAvatarPos}
                      onConsumeEnergy={(amt) => consumeEnergy(amt)}
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
                      cosmetics={cosmetics}
                      isWorking={isWorking}
                      workProgress={workProgress}
                      workingJobId={workingJobId}
                    />
                  </div>
                ) : (
                  <WorldMap
                    currentCity={cityFocus}
                    cityStats={cityStats}
                    onClickLocation={(loc) => {
                      handleCityClick(loc.name)
                      // Small bonus for visiting
                      const reward = 5 + Math.floor(Math.random() * 15)
                      setCharacter((c) => {
                        const updated = { ...c, wealth: Number(c.wealth || 0) + reward, xp: Number(c.xp || 0) + 3 }
                        persistCharacterPartial(updated)
                        if (userId) saveCharacterToDB(updated)
                        return updated
                      })
                      loadLeaderboard()
                    }}
                  />
                )}

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {jobs.map((job, idx) => (
                    <div key={`job-${idx}-${jobSeed}`} className={`p-3 border rounded-lg transition-all ${workingJobId === job.name ? 'bg-blue-600/30 border-blue-500' : 'bg-slate-800/60 border-slate-700'}`}>
                      <div className="font-semibold text-slate-100">{job.name}</div>
                      <div className="text-xs text-slate-400">Reward: {formatMoney(job.reward)} • XP: {job.xp}</div>
                      <div className="text-xs text-slate-500 mt-1">Difficulty: {'⭐'.repeat(job.difficulty)}</div>
                      <div className="mt-3">
                        <button
                          disabled={isWorking && workingJobId !== job.name}
                          onClick={() => performJob(job)}
                          className={`w-full px-3 py-2 rounded text-white font-medium transition-colors ${
                            isWorking && workingJobId === job.name
                              ? 'bg-blue-700 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {workingJobId === job.name ? 'Working...' : 'Work'}
                        </button>
                      </div>
                      {workingJobId === job.name && (
                        <div className="mt-2">
                          <div className="w-full bg-slate-700 rounded h-2">
                            <div className="bg-emerald-500 h-2 rounded transition-all" style={{width: `${workProgress}%`}}></div>
                          </div>
                          <div className="text-xs text-slate-300 mt-1 text-center">{workProgress}%</div>
                        </div>
                      )}
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
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{character.name}</h2>
                  <p className="text-xs text-slate-400">Level {character.level} • XP {character.xp}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setCustomizationOpen(true)} className="w-full px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded font-medium transition-colors">Customize</button>
                  <button onClick={() => setCharacter(null)} className="w-full px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium transition-colors">My Account</button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="p-3 bg-slate-900/30 rounded">
                  <div className="text-xs text-slate-400">Total Wealth</div>
                  <div className="text-2xl font-bold text-yellow-300">{formatMoney(character.wealth)}</div>
                </div>
                <div className="p-3 bg-slate-900/30 rounded">
                  <div className="text-xs text-slate-400">Income Rate</div>
                  <div className="text-xl font-bold text-emerald-300">{formatMoney(character.income_rate)}/10s</div>
                </div>
                <div className="p-3 bg-slate-900/30 rounded">
                  <div className="text-xs text-slate-400">Energy</div>
                  <div className="w-full h-2 bg-slate-700 rounded overflow-hidden mt-2">
                    <div className="h-full bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, ((character.energy ?? 100) / (character.max_energy ?? 100)) * 100))}%` }}></div>
                  </div>
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
              <div className="mb-3 p-2 bg-slate-900/30 rounded text-xs text-slate-300">
                <div className="font-semibold text-slate-200 mb-1">Your City Stats ({cityFocus}):</div>
                <div>Jobs: {cityStats[cityFocus]?.jobsCompleted || 0} | Earned: ₱{cityStats[cityFocus]?.moneyEarned || 0}</div>
              </div>
              <ol className="list-decimal list-inside text-sm space-y-2">
                {leaderboard.map((p, idx) => (
                  <li key={`leaderboard-${idx}-${p.user_id || p.name}`} className="flex items-center justify-between hover:bg-slate-900/20 px-2 py-1 rounded transition">
                    <span>{p.name}</span>
                    <span className="text-yellow-300 font-semibold">{formatMoney(p.wealth)}</span>
                  </li>
                ))}
              </ol>
            </div>

            {character && (
              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-bold mb-3">City Progress</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(cityStats).map(([city, stats]) => (
                    <div key={city} className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                      <span className="font-medium">{city}</span>
                      <span className="text-xs text-slate-400">Jobs: {stats.jobsCompleted} | ₱{stats.moneyEarned}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Game Phases / Achievements */}
            {character && (
              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-bold mb-3">Achievement Milestones</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2">Basic Achievements</div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>💼 Do a job</span>
                        <span className={`text-xs ${phases.didJob ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.didJob ? '✓' : '○'}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>🏠 Buy an asset</span>
                        <span className={`text-xs ${phases.boughtAsset ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.boughtAsset ? '✓' : '○'}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>🎁 Claim daily reward</span>
                        <span className={`text-xs ${phases.claimedDaily ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.claimedDaily ? '✓' : '○'}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>🌍 Visit all cities</span>
                        <span className="text-xs text-slate-400">{Object.keys(phases.visitedCities || {}).length}/5</span>
                      </li>
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>⚔️ Win a duel</span>
                        <span className={`text-xs ${phases.winDuel ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.winDuel ? '✓' : '○'}</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2">Progression Goals</div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>💰 Earn ₱500</span>
                        <span className={`text-xs ${phases.earnedWealth500 ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.earnedWealth500 ? '✓' : '○'}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>📈 Reach Level 5</span>
                        <span className={`text-xs ${phases.reachedLevel5 ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.reachedLevel5 ? '✓' : '○'}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>🏘️ Own multiple assets</span>
                        <span className={`text-xs ${phases.ownedMultipleAssets ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.ownedMultipleAssets ? '✓' : '○'}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>🔥 3-day daily streak</span>
                        <span className={`text-xs ${phases.completedDailyStreak3 ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.completedDailyStreak3 ? '✓' : '○'}</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2">Elite Achievements</div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>💎 Earn ₱5000</span>
                        <span className={`text-xs ${phases.earnedWealth5000 ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.earnedWealth5000 ? '✓' : '○'}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>⭐ Reach Level 10</span>
                        <span className={`text-xs ${phases.reachedLevel10 ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.reachedLevel10 ? '✓' : '○'}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>🎯 Win multiple duels</span>
                        <span className={`text-xs ${phases.wonMultipleDuels ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.wonMultipleDuels ? '✓' : '○'}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 bg-slate-900/20 rounded">
                        <span>💸 ₱100+ passive income/10s</span>
                        <span className={`text-xs ${phases.achievedPassiveIncome100 ? 'text-emerald-400' : 'text-slate-400'}`}>{phases.achievedPassiveIncome100 ? '✓' : '○'}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {character && <MatchHistory characterId={character.id} maxMatches={8} />}

            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-bold mb-2">Match Requests</h3>
              <div className="text-sm text-slate-300 space-y-2 mb-3">
                {matchRequests.length === 0 && <div className="text-slate-400">No incoming match requests.</div>}
                {matchRequests.map((r, idx) => (
                  <div key={r.user_id + '_' + idx} className="flex items-center justify-between bg-slate-900/20 p-2 rounded">
                    <div>
                      <div className="font-medium">{r.name || r.user_id}</div>
                      <div className="text-xs text-slate-400">Requested {new Date(r.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => acceptMatch(r)} className="px-2 py-1 bg-emerald-600 rounded text-white text-sm">Accept</button>
                      <button onClick={() => rejectMatch(r)} className="px-2 py-1 bg-red-600 rounded text-white text-sm">Reject</button>
                    </div>
                  </div>
                ))}
              </div>

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

            {duelSession && (
              <DuelMatch
                sessionId={duelSession.sessionId}
                player={character}
                opponent={duelSession.opponent}
                onEnd={endDuel}
                userId={userId}
                userEmail={userEmail}
              />
            )}

          </div>
        </div>
      </div>

      {/* Character Customizer Panel */}
      <CharacterCustomizer
        cosmetics={cosmetics}
        onUpdateCosmetics={handleUpdateCosmetics}
        isOpen={customizationOpen}
        onToggle={() => setCustomizationOpen(!customizationOpen)}
      />
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

function WorldMap({ onClickLocation, currentCity, cityStats }) {
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
      {cities.map(city => {
        const isCurrentCity = currentCity === city.name
        const stats = cityStats?.[city.name] || { jobsCompleted: 0, moneyEarned: 0 }
        return (
          <div
            key={city.id}
            className={`border rounded-lg p-4 flex flex-col justify-between transition-all cursor-pointer ${
              isCurrentCity
                ? 'bg-emerald-600/30 border-emerald-500 ring-2 ring-emerald-500'
                : 'bg-slate-900/20 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div>
              <div className="font-semibold text-slate-100">{city.name}</div>
              {isCurrentCity && <div className="text-xs text-emerald-300 mt-1 font-medium">Current Location</div>}
              <div className="text-xs text-slate-400 mt-1">Jobs: {stats.jobsCompleted} | Earned: ₱{stats.moneyEarned}</div>
            </div>
            <div className="mt-3 text-right">
              <button
                onClick={() => onClickLocation(city)}
                className={`px-3 py-2 rounded text-white font-medium transition-colors ${
                  isCurrentCity
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {isCurrentCity ? 'Current' : 'Visit'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

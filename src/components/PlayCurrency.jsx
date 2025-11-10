import React, { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { gameAPI } from '../lib/gameAPI'
import IsometricGameMap from './game/IsometricGameMap'
import Player3DView from './game/Player3DView'
import DuelMatch from './game/DuelMatch'
import MatchHistory from './game/MatchHistory'
import CharacterCustomizer from './game/CharacterCustomizer'
import PlayerTradingUI from './game/PlayerTradingUI'
import GuildManager from './game/GuildManager'
import MarketEconomyUI from './game/MarketEconomyUI'
import MatchSpectator from './game/MatchSpectator'
import PropertyManagementPanel from './game/PropertyManagementPanel'
import PropertyEmpireAchievements from './game/PropertyEmpireAchievements'
import Player3DModal from './game/Player3DModal'
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

// City-specific bonuses and specializations
const CITY_BONUSES = {
  Manila: {
    name: 'Manila',
    emoji: '🏙️',
    businessBonus: 0.15, // +15% to business/sales jobs
    incomeMultiplier: 1.1,
    specializedJobs: ['business', 'professional'],
    description: 'Business & Finance Hub'
  },
  Cebu: {
    name: 'Cebu',
    emoji: '🏖️',
    techBonus: 0.12, // +12% to tech jobs
    incomeMultiplier: 1.08,
    specializedJobs: ['tech', 'internet'],
    description: 'Tech & Digital Center'
  },
  Davao: {
    name: 'Davao',
    emoji: '🌾',
    farmingBonus: 0.18, // +18% to farming jobs (highest)
    incomeMultiplier: 1.12,
    specializedJobs: ['farming', 'agricultural'],
    description: 'Agricultural Stronghold'
  },
  Bacolod: {
    name: 'Bacolod',
    emoji: '🎭',
    serviceBonus: 0.14, // +14% to service jobs
    incomeMultiplier: 1.09,
    specializedJobs: ['service'],
    description: 'Service & Hospitality Hub'
  },
  Baguio: {
    name: 'Baguio',
    emoji: '❄️',
    manualBonus: 0.16, // +16% to manual labor
    incomeMultiplier: 1.11,
    specializedJobs: ['manual'],
    description: 'Labor & Construction Center'
  }
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
  const [jobModalOpen, setJobModalOpen] = useState(false)
  const [jobModalInfo, setJobModalInfo] = useState(null)
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
  const presenceTableChannelRef = useRef(null)
  const assetsChannelRef = useRef(null)
  const worldInstanceRef = useRef(null)
  const [mapSettings, setMapSettings] = useState({ avatarSpeed: 2, cameraSpeed: 1, zoomLevel: 1, sizeMultiplier: 10 })
  const [characterPosition, setCharacterPosition] = useState({ x: 0, y: 0, city: 'Manila' })
  const [matchRequests, setMatchRequests] = useState([])
  const [cityFocus, setCityFocus] = useState('Manila')
  const [cityStats, setCityStats] = useState({})
  const [cosmetics, setCosmetics] = useState(DEFAULT_COSMETICS)
  const [customizationOpen, setCustomizationOpen] = useState(false)
  const [initialAvatarPos, setInitialAvatarPos] = useState(null)
  const [mapViewMode, setMapViewMode] = useState('isometric') // 'isometric', 'grid'
  const [propertyPanelOpen, setPropertyPanelOpen] = useState(false)
  const [placingAsset, setPlacingAsset] = useState(null)
  const [remoteAssets, setRemoteAssets] = useState([])
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
    achievedPassiveIncome100: false,
    // Endgame phases
    earnedWealth50000: false,
    reachedLevel20: false,
    achievedPassiveIncome500: false,
    ownedAllPropertyTypes: false,
    completedDailyStreak30: false,
    wonTenDuels: false,
    prestigeOnce: false,
    prestigeLevel5: false,
    maxedAllStats: false,
    masterAllJobs: false
  })

  // Character stats specialization (upgrade with jobs)
  const [characterStats, setCharacterStats] = useState({
    strength: 0,      // Manual labor jobs
    intelligence: 0,  // Tech jobs
    charisma: 0,      // Service/sales jobs
    endurance: 0,     // Farm/labor jobs
    dexterity: 0,     // Precision jobs
    luck: 0           // General bonus
  })

  // Prestige system
  const [prestigeData, setPrestigeData] = useState({
    prestigeLevel: 0,
    totalPrestigeResets: 0,
    prestigeMultiplier: 1.0 // 1.0 + (0.1 * prestigeLevel)
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

        // Load remote assets and subscribe to changes (game_assets table)
        try {
          const { data: assets, error: assetsErr } = await supabase.from('game_assets').select('*')
          if (assetsErr) throw assetsErr
          if (mounted && assets) setRemoteAssets(assets)
        } catch (e) {
          console.warn('Could not load game_assets from supabase, falling back to localStorage', e)
          try {
            const raw = localStorage.getItem('pc_local_game_assets')
            const parsed = raw ? JSON.parse(raw) : []
            setRemoteAssets(parsed || [])
          } catch (le) { console.warn('Failed to load local assets', le) }
        }

        if (mounted && typeof supabase.channel === 'function') {
          try {
            const channel = supabase
              .channel('public:game_assets')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'game_assets' }, (payload) => {
                try {
                  // payload.eventType in v2, payload.new/payload.old
                  const ev = payload.eventType || payload.event
                  const rec = payload.new || payload.record || payload.new
                  if (!rec) return
                  setRemoteAssets((prev) => {
                    const copy = [...(prev || [])]
                    if (ev === 'INSERT' || ev === 'UPDATE') {
                      const idx = copy.findIndex(a => a.id === rec.id)
                      if (idx === -1) copy.push(rec)
                      else copy[idx] = rec
                    } else if (ev === 'DELETE') {
                      return copy.filter(a => a.id !== (payload.old?.id || payload.old?.id))
                    }
                    return copy
                  })
                } catch (e) { console.warn('asset channel handler failed', e) }
              })
              .subscribe()

            // store channel on assetsChannelRef to cleanup
            assetsChannelRef.current = channel
          } catch (e) {
            console.warn('Could not subscribe to game_assets channel', e)
          }
        }

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

  // Get income multiplier based on city specialization
  const getCityBonus = useCallback((job, cityName) => {
    const cityData = CITY_BONUSES[cityName]
    if (!cityData) return 0

    const jobName = job.name.toLowerCase()

    // Tech jobs: +12% in Cebu
    if (cityData.techBonus && ['programmer', 'developer', 'administrator', 'engineer', 'designer', 'analyst', 'machine learning', 'data scientist', 'devops'].some(t => jobName.includes(t))) {
      return cityData.techBonus
    }

    // Business/Sales jobs: +15% in Manila
    if (cityData.businessBonus && ['manager', 'sales', 'business', 'accountant', 'consultant', 'advisor', 'coordinator'].some(t => jobName.includes(t))) {
      return cityData.businessBonus
    }

    // Farming/Agriculture jobs: +18% in Davao
    if (cityData.farmingBonus && ['farmer', 'farm', 'planter', 'harvester', 'fisherman', 'livestock', 'poultry'].some(t => jobName.includes(t))) {
      return cityData.farmingBonus
    }

    // Service jobs: +14% in Bacolod
    if (cityData.serviceBonus && ['waiter', 'bartender', 'receptionist', 'stylist', 'therapist', 'driver', 'guide'].some(t => jobName.includes(t))) {
      return cityData.serviceBonus
    }

    // Manual labor jobs: +16% in Baguio
    if (cityData.manualBonus && ['carpenter', 'welder', 'plumber', 'electrician', 'mason', 'construction', 'laborer'].some(t => jobName.includes(t))) {
      return cityData.manualBonus
    }

    return 0
  }, [])

  // Get stat boosts based on job category
  const getStatBoostFromJob = useCallback((job) => {
    const boosts = {
      strength: 0,
      intelligence: 0,
      charisma: 0,
      endurance: 0,
      dexterity: 0,
      luck: 0
    }

    // Determine category by job name patterns
    const jobName = job.name.toLowerCase()

    if (['programmer', 'developer', 'administrator', 'engineer', 'analyst', 'designer', 'tester'].some(t => jobName.includes(t))) {
      boosts.intelligence += 2
      boosts.dexterity += 1
    } else if (['carpenter', 'welder', 'plumber', 'electrician', 'mason', 'construction'].some(t => jobName.includes(t))) {
      boosts.strength += 2
      boosts.endurance += 1
    } else if (['manager', 'coordinator', 'guide', 'stylist', 'bartender', 'waiter', 'receptionist'].some(t => jobName.includes(t))) {
      boosts.charisma += 2
      boosts.intelligence += 1
    } else if (['farmer', 'vendor', 'laborer', 'gardener', 'janitor', 'delivery'].some(t => jobName.includes(t))) {
      boosts.endurance += 2
      boosts.strength += 1
    } else if (['driver', 'designer', 'editor', 'marketer', 'content'].some(t => jobName.includes(t))) {
      boosts.dexterity += 2
      boosts.charisma += 1
    }

    // Small luck bonus for all jobs
    boosts.luck += 1

    return boosts
  }, [])

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
      if (updatedChar.wealth >= 50000 && !next.earnedWealth50000) next.earnedWealth50000 = true
      if (updatedChar.level >= 5 && !next.reachedLevel5) next.reachedLevel5 = true
      if (updatedChar.level >= 10 && !next.reachedLevel10) next.reachedLevel10 = true
      if (updatedChar.level >= 20 && !next.reachedLevel20) next.reachedLevel20 = true
      if ((updatedChar.properties || []).length >= 2 && !next.ownedMultipleAssets) next.ownedMultipleAssets = true
      if (updatedChar.income_rate >= 100 && !next.achievedPassiveIncome100) next.achievedPassiveIncome100 = true
      if (updatedChar.income_rate >= 500 && !next.achievedPassiveIncome500) next.achievedPassiveIncome500 = true
      if ((updatedChar.properties || []).length >= 3 && updatedChar.properties.some(p => p.id === 'sari-sari') && updatedChar.properties.some(p => p.id === 'food-cart') && updatedChar.properties.some(p => p.id === 'tricycle') && !next.ownedAllPropertyTypes) next.ownedAllPropertyTypes = true
      if (prestigeData.prestigeLevel >= 1 && !next.prestigeOnce) next.prestigeOnce = true
      if (prestigeData.prestigeLevel >= 5 && !next.prestigeLevel5) next.prestigeLevel5 = true
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
        home_city: char.home_city || null,
        // Persist in-memory character stats (strength/intelligence/etc) so UI and DB stay in sync
        stats: (typeof characterStats !== 'undefined') ? characterStats : null
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
        home_city: char.home_city || null,
        stats: (typeof characterStats !== 'undefined') ? characterStats : null
      }
      const { error: e } = await supabase.from('game_characters').upsert(payload, { onConflict: 'id' })
      if (e) throw e
      // update leaderboard table also
      await supabase.from('game_leaderboard').upsert({ user_id: userId, name: char.name, wealth: char.wealth }, { onConflict: 'user_id' }).catch(() => {})
    } catch (err) {
      console.warn('saveCharacterToDB failed', err)
      // If error mentions cosmetics (schema mismatch), retry without cosmetics
      const msg = (err && (err.message || err.error_description || err.details || '')).toString().toLowerCase()
      if (msg.includes('cosmetics') || msg.includes('column') || msg.includes('null value')) {
        try {
          const { error: e2 } = await supabase.from('game_characters').upsert({
            id: char.id,
            user_id: userId,
            name: char.name,
            wealth: char.wealth,
            income_rate: char.income_rate,
            xp: char.xp,
            level: char.level,
            properties: char.properties || [],
            last_daily: char.last_daily || null,
            current_location: char.current_location || null,
            home_city: char.home_city || null,
            stats: (typeof characterStats !== 'undefined') ? characterStats : null
          }, { onConflict: 'id' })
          if (!e2) {
            await supabase.from('game_leaderboard').upsert({ user_id: userId, name: char.name, wealth: char.wealth }, { onConflict: 'user_id' }).catch(() => {})
            return
          }
        } catch (e3) {
          console.warn('Retry upsert without cosmetics failed', e3)
        }
      }

      setError('Could not save character: ' + (err.message || String(err)))
    }
  }

  // Confirm a placement made on the map
  const confirmPlacement = async ({ x, y, gridX, gridY }) => {
    if (!placingAsset || !character) return
    // Ensure one building per square: check remoteAssets and character.properties
    const occupied = ((character.properties || [])
      .concat(remoteAssets || [])
      .some(p => Math.round((p.location_x || 0)) === Math.round(x) && Math.round((p.location_y || 0)) === Math.round(y)))
    if (occupied) {
      setError('Square already occupied')
      setPlacingAsset(null)
      return
    }

    // Call server-side RPC to atomically place asset and update character
    try {
      const rpcParams = {
        p_owner_id: userId || character.id || null,
        p_owner_character_id: character.id || null,
        p_name: placingAsset.name,
        p_property_type: placingAsset.type || 'business',
        p_price: placingAsset.price || 0,
        p_income: placingAsset.income || 0,
        p_grid_x: gridX || null,
        p_grid_y: gridY || null,
        p_location_x: Math.round(x || 0),
        p_location_y: Math.round(y || 0),
        p_metadata: {}
      }

      const { data, error: rpcErr } = await supabase.rpc('place_asset_atomic', rpcParams)
      if (rpcErr) throw rpcErr

      // Attempt to resolve returned asset and updated character from RPC
      let returnedAsset = null
      let returnedChar = null

      if (Array.isArray(data)) {
        // common case: RPC returns single object or array with asset
        if (data.length === 1) {
          const d = data[0]
          if (d && typeof d === 'object') {
            returnedAsset = d.asset || d.game_asset || d
            returnedChar = d.character || d.updated_character || null
          }
        } else {
          // pick first object that looks like an asset
          returnedAsset = data.find(i => i && i.owner_id) || data[0]
        }
      } else if (data && typeof data === 'object') {
        returnedAsset = data.asset || data.game_asset || data
        returnedChar = data.character || data.updated_character || null
      }

      // If RPC returned an updated character, use it
      if (returnedChar && returnedChar.id) {
        setCharacter(returnedChar)
      } else {
        // apply local update based on placingAsset if RPC didn't return character
        const updated = { ...character }
        updated.wealth = Number(updated.wealth || 0) - (placingAsset.price || 0)
        updated.income_rate = Number(updated.income_rate || 0) + Number(placingAsset.income || 0)
        const prop = {
          id: (returnedAsset && returnedAsset.id) ? returnedAsset.id : `${placingAsset.id}-${Date.now()}-${character.id || 'guest'}`,
          name: placingAsset.name,
          price: placingAsset.price,
          income: placingAsset.income,
          purchased_at: new Date().toISOString(),
          location_x: Math.round(x),
          location_y: Math.round(y),
          grid_x: gridX,
          grid_y: gridY,
          current_value: placingAsset.price,
          owner_id: character.id || 'guest',
          upgrade_level: 0,
          property_type: placingAsset.type || 'business'
        }
        updated.properties = (updated.properties || []).concat(prop)
        setCharacter(updated)
        persistCharacterPartial(updated)
        if (userId) saveCharacterToDB(updated)
      }

      // Add returned asset to remoteAssets if present
      if (returnedAsset) {
        setRemoteAssets(prev => {
          const copy = [...(prev || [])]
          const idx = copy.findIndex(a => a.id === returnedAsset.id)
          if (idx === -1) copy.push(returnedAsset)
          else copy[idx] = returnedAsset
          return copy
        })
      }

    } catch (e) {
      console.warn('place_asset_atomic RPC failed', e)
      setError('Could not place asset: ' + ((e && e.message) || String(e)))
    } finally {
      setPlacingAsset(null)
      await loadLeaderboard()
    }
  }

  useEffect(() => {
    return () => {
      // cleanup supabase channels if present
      try {
        if (presenceChannelRef.current && typeof supabase.removeChannel === 'function') {
          supabase.removeChannel(presenceChannelRef.current)
        } else if (presenceChannelRef.current && typeof presenceChannelRef.current.unsubscribe === 'function') {
          presenceChannelRef.current.unsubscribe()
        }
      } catch (e) {}
      try {
        if (assetsChannelRef.current && typeof supabase.removeChannel === 'function') {
          supabase.removeChannel(assetsChannelRef.current)
        } else if (assetsChannelRef.current && typeof assetsChannelRef.current.unsubscribe === 'function') {
          assetsChannelRef.current.unsubscribe()
        }
      } catch (e) {}
    }
  }, [])

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

    const duration = job.duration

    // If world instance available, trigger in-world job animation/progress
    const world = worldInstanceRef.current
    if (world && world.startPlayerJob) {
      try {
        world.startPlayerJob(character.id || character.user_id || 'guest', job.name, duration,
          (pct) => { // onProgress
            setWorkProgress(pct)
          },
          async () => { // onComplete
            try {
              // reward with skill scaling based on difficulty and character level
              setCharacter((c) => {
                if (!c) return c
                const charLevel = c.level || 1
                const difficultyMultiplier = 0.8 + (job.difficulty * 0.1) // Higher difficulty = higher base reward
                const levelMultiplier = 1 + (charLevel * 0.15) // Higher level = higher rewards (scales 15% per level)
                const cityBonus = getCityBonus(job, cityFocus) // City-specific bonuses (5-18%)
                const prestigeBonus = prestigeData.prestigeMultiplier || 1.0 // Prestige multiplier

                // Scale reward and XP based on character level, city bonus, and prestige
                const baseReward = job.reward * levelMultiplier * (1 + cityBonus) * prestigeBonus
                const scaledReward = Math.floor(baseReward)
                const scaledXP = Math.floor(job.xp * levelMultiplier * (1 + cityBonus * 0.5) * prestigeBonus)

                const updated = { ...c, wealth: Number(c.wealth || 0) + scaledReward, xp: Number(c.xp || 0) + scaledXP }

                // level up logic (every 100 xp = 1 level)
                const newLevel = Math.max(1, Math.floor((updated.xp || 0) / 100) + 1)
                if (newLevel !== updated.level) updated.level = newLevel

                // Apply stat boosts from job
                const statBoost = getStatBoostFromJob(job)

                // Compute new stats based on existing characterStats snapshot
                const newStats = {
                  strength: (characterStats?.strength || 0) + statBoost.strength,
                  intelligence: (characterStats?.intelligence || 0) + statBoost.intelligence,
                  charisma: (characterStats?.charisma || 0) + statBoost.charisma,
                  endurance: (characterStats?.endurance || 0) + statBoost.endurance,
                  dexterity: (characterStats?.dexterity || 0) + statBoost.dexterity,
                  luck: (characterStats?.luck || 0) + statBoost.luck
                }

                // Update UI state immediately
                setCharacterStats(() => newStats)

                // persist character and stats
                persistCharacterPartial(updated)
                // Save using the updated object (avoid stale closure)
                if (userId) {
                  saveCharacterToDB(updated).catch((e)=>{console.warn('saveCharacterToDB after job failed', e)})
                  // Persist stats JSON column explicitly
                  try { gameAPI.updateCharacterStats(updated.id, { stats: newStats }).catch(()=>{}) } catch(e) {}
                }

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
            } catch(e) {
              console.warn('Job completion handler failed', e)
              setIsWorking(false)
              setWorkingJobId(null)
              setWorkProgress(0)
            }
          }
        )
      } catch (e) {
        console.warn('Failed to start in-world job', e)
        setIsWorking(false)
        setWorkingJobId(null)
        setWorkProgress(0)
      }
    } else {
      // fallback to local modal-based job (if world not ready)
      const start = Date.now()
      const tick = setInterval(() => {
        const elapsed = Date.now() - start
        const pct = Math.min(100, Math.floor((elapsed / duration) * 100))
        setWorkProgress(pct)
        if (pct >= 100) {
          clearInterval(tick)
        }
      }, 100)

      setTimeout(async () => {
        // fallback reward handling (same as above)
        setCharacter((c) => {
          if (!c) return c
          const charLevel = c.level || 1
          const difficultyMultiplier = 0.8 + (job.difficulty * 0.1)
          const levelMultiplier = 1 + (charLevel * 0.15)
          const cityBonus = getCityBonus(job, cityFocus)
          const prestigeBonus = prestigeData.prestigeMultiplier || 1.0
          const baseReward = job.reward * levelMultiplier * (1 + cityBonus) * prestigeBonus
          const scaledReward = Math.floor(baseReward)
          const scaledXP = Math.floor(job.xp * levelMultiplier * (1 + cityBonus * 0.5) * prestigeBonus)
          const updated = { ...c, wealth: Number(c.wealth || 0) + scaledReward, xp: Number(c.xp || 0) + scaledXP }
          const newLevel = Math.max(1, Math.floor((updated.xp || 0) / 100) + 1)
          if (newLevel !== updated.level) updated.level = newLevel
          const statBoost = getStatBoostFromJob(job)
          const newStats = {
            strength: (characterStats?.strength || 0) + statBoost.strength,
            intelligence: (characterStats?.intelligence || 0) + statBoost.intelligence,
            charisma: (characterStats?.charisma || 0) + statBoost.charisma,
            endurance: (characterStats?.endurance || 0) + statBoost.endurance,
            dexterity: (characterStats?.dexterity || 0) + statBoost.dexterity,
            luck: (characterStats?.luck || 0) + statBoost.luck
          }
          setCharacterStats(() => newStats)
          persistCharacterPartial(updated)
          if (userId) {
            saveCharacterToDB(updated).catch((e)=>{console.warn('saveCharacterToDB after job failed', e)})
            try { gameAPI.updateCharacterStats(updated.id, { stats: newStats }).catch(()=>{}) } catch(e) {}
          }
          checkAndUpdatePhases(updated)
          return updated
        })
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
  }

  const buyProperty = async (asset) => {
    if (!character) return
    if ((character.wealth || 0) < asset.price) {
      setError('Not enough money')
      return
    }
    // Enter placement mode: keep asset reserved and let player pick a square on the map
    setPlacingAsset({ ...asset })
    setPropertyPanelOpen(false)
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

  const upgradeProperty = async (propertyId) => {
    if (!character) return
    const property = (character.properties || []).find(p => p.id === propertyId)
    if (!property) return

    // Upgrade cost: 25% of property base price per level
    const upgradeCost = Math.floor(property.price * (0.25 * (property.upgrade_level + 1)))
    if ((character.wealth || 0) < upgradeCost) {
      setError(`Need ₱${upgradeCost} to upgrade`)
      return
    }

    const updated = { ...character }
    updated.properties = updated.properties.map(p => {
      if (p.id === propertyId) {
        const newLevel = (p.upgrade_level || 0) + 1
        const incomeBoost = Math.floor(Number(p.income || 0) * (0.2 * newLevel))
        return {
          ...p,
          upgrade_level: newLevel,
          current_value: Number(p.current_value || 0) * 1.15,
          income: Number(p.income || 0) + incomeBoost
        }
      }
      return p
    })

    updated.wealth = Number(updated.wealth || 0) - upgradeCost
    updated.income_rate = updated.properties.reduce((sum, p) => sum + (Number(p.income || 0)), 0)

    setCharacter(updated)
    persistCharacterPartial(updated)
    if (userId) saveCharacterToDB(updated)
    setError('')
  }

  const prestigeReset = async () => {
    if (!character) return

    const currentWealth = character.wealth || 0
    const prestigeGain = Math.max(1, Math.floor(currentWealth / 10000))
    const newPrestigeLevel = (prestigeData.prestigeLevel || 0) + prestigeGain
    const newMultiplier = 1.0 + (newPrestigeLevel * 0.1)

    const resetCharacter = {
      ...character,
      wealth: Math.floor(500 * newMultiplier),
      xp: 0,
      level: 1,
      properties: [],
      income_rate: 0,
      energy: character.max_energy || 100,
      last_daily: null
    }

    setCharacter(resetCharacter)
    setCharacterStats({ strength: 0, intelligence: 0, charisma: 0, endurance: 0, dexterity: 0, luck: 0 })
    setPrestigeData({
      prestigeLevel: newPrestigeLevel,
      totalPrestigeResets: (prestigeData.totalPrestigeResets || 0) + 1,
      prestigeMultiplier: newMultiplier
    })

    setPhases(prev => ({
      ...prev,
      didJob: false,
      boughtAsset: false,
      claimedDaily: false
    }))

    persistCharacterPartial(resetCharacter)
    if (userId) saveCharacterToDB(resetCharacter)
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
      if (streak >= 30 && !next.completedDailyStreak30) {
        next.completedDailyStreak30 = true
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

      // also subscribe to presence table changes (postgres_changes) to reflect DB-driven presence updates
      try {
        const tableChannel = supabase
          .channel('public:game_presence_table')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'game_presence' }, (payload) => {
            try {
              const ev = payload.eventType || payload.event
              const rec = payload.new || payload.record || payload.new
              if (!rec) return
              setOnlinePlayers((prev) => {
                const idx = prev.findIndex(x => x.user_id === (rec.user_id || rec.id || rec.user_id))
                if (ev === 'INSERT' || ev === 'UPDATE') {
                  if (idx === -1) return prev.concat({ user_id: rec.user_id || rec.id, name: rec.name || rec.user_name || 'Player', status: rec.status || 'online' })
                  const copy = [...prev]
                  copy[idx] = { ...copy[idx], user_id: rec.user_id || rec.id, name: rec.name || rec.user_name || copy[idx].name, status: rec.status || copy[idx].status }
                  return copy
                } else if (ev === 'DELETE') {
                  return prev.filter(x => x.user_id !== (payload.old?.user_id || payload.old?.id))
                }
                return prev
              })
            } catch (e) { console.warn('presence table handler failed', e) }
          })
          .subscribe()
        presenceTableChannelRef.current = tableChannel
      } catch (e) {
        console.warn('Could not subscribe to presence table channel', e)
      }

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
    // award reward to winner locally
    try {
      if (winner && character && winner === character.name) {
        const updated = { ...character, wealth: Number(character.wealth || 0) + 100, xp: Number(character.xp || 0) + 20 }
        setCharacter(updated)
        persistCharacterPartial(updated)
        if (userId) saveCharacterToDB(updated)
        // Track duel win in phases
        setPhases(prev => {
          const next = { ...prev, winDuel: true, wonMultipleDuels: true }
          savePhases(next)
          return next
        })
        checkAndUpdatePhases(updated)
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
      <Player3DModal open={jobModalOpen} info={jobModalInfo} onClose={() => { setJobModalOpen(false); setJobModalInfo(null) }} />
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main world area */}
          <div className="lg:col-span-2">
            <div className="relative bg-slate-800/40 border border-slate-700 rounded-lg overflow-hidden">
              <header className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Game World</h2>
                  <p className="text-xs text-slate-400">Click a location to perform tasks and earn income.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-400">Players online: <span className="font-semibold text-emerald-400">{onlinePlayers.length}</span></div>
                  <button onClick={() => rotateJobs()} className="px-2 py-1 text-xs bg-violet-600 hover:bg-violet-700 rounded text-white font-medium">Refresh Jobs</button>
                  <select onChange={(e) => setMapViewMode(e.target.value)} value={mapViewMode} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-white">
                    <option value="isometric">Player View</option>
                    <option value="grid">City Grid</option>
                  </select>
                </div>
              </header>

              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-slate-300">Now in <span className="font-semibold text-emerald-400">{cityFocus}</span> • Interact with available jobs.</div>
                  <div className="text-xs text-slate-400">{CITY_BONUSES[cityFocus]?.emoji} {CITY_BONUSES[cityFocus]?.description}</div>
                </div>

                <div className="border border-slate-700 rounded overflow-hidden" style={{ height: 520 }}>
                  {mapViewMode === 'isometric' ? (
                    <Player3DView
                      properties={[...((character.properties || []).map(normalizeProperty)), ...((remoteAssets || []).map(normalizeProperty))].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i)}
                      character={character}
                      initialAvatarPos={initialAvatarPos}
                      onCharacterMove={(pos) => setCharacterPosition(pos)}
                      mapSettings={mapSettings}
                      placingProperty={placingAsset}
                      onConfirmPlace={(coords) => confirmPlacement(coords)}
                      onCancelPlace={() => setPlacingAsset(null)}
                      onPropertyClick={(prop) => { setPropertyPanelOpen(true) }}
                      onWorldReady={(w) => { worldInstanceRef.current = w }}
                    />
                  ) : (
                    <WorldMap
                      currentCity={cityFocus}
                      cityStats={cityStats}
                      onClickLocation={(loc) => {
                        handleCityClick(loc.name)
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
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {jobs.map((job, idx) => {
                    const cityBonus = getCityBonus(job, cityFocus)
                    const bonusPercent = Math.round(cityBonus * 100)
                    return (
                      <div key={`job-${idx}-${jobSeed}`} className={`p-3 border rounded-lg transition-all flex flex-col justify-between ${workingJobId === job.name ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800/60 border-slate-700'}`}>
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-slate-100">{job.name}</div>
                            {cityBonus > 0 && <span className="text-xs bg-emerald-600/40 text-emerald-300 px-2 py-0.5 rounded">+{bonusPercent}%</span>}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">Reward: {formatMoney(job.reward)} • XP: {job.xp}</div>
                          <div className="text-xs text-slate-500 mt-1">Difficulty: {'⭐'.repeat(job.difficulty)}</div>
                        </div>

                        <div className="mt-3">
                          <div className="mb-2 h-2 bg-slate-700 rounded overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${(workingJobId === job.name ? workProgress : 0)}%` }} />
                          </div>
                          <button
                            disabled={isWorking && workingJobId !== job.name}
                            onClick={() => performJob(job)}
                            className={`w-full px-3 py-2 rounded text-white font-medium transition-colors ${isWorking && workingJobId === job.name ? 'bg-blue-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {workingJobId === job.name ? 'Working...' : 'Work'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 flex gap-3">
                  <button onClick={() => setPropertyPanelOpen(true)} className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-lg text-white font-bold">🏢 Property Manager ({(character.properties || []).length})</button>
                  <button onClick={() => rotateJobs()} className="px-4 py-3 bg-slate-700 rounded text-white">Shuffle Jobs</button>
                </div>
              </div>
            </div>

            {propertyPanelOpen && (
              <div className="mt-4 fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="w-full max-w-2xl max-h-[90vh] rounded-lg overflow-hidden">
                  <PropertyManagementPanel
                    character={character}
                    properties={character.properties || []}
                    market={market}
                    wealth={character.wealth || 0}
                    onBuyProperty={buyProperty}
                    onUpgradeProperty={upgradeProperty}
                    onSellProperty={sellProperty}
                    onCollectIncome={(propId) => {
                      const prop = (character.properties || []).find(p => p.id === propId)
                      if (prop) {
                        const reward = Number(prop.income || 0) * 3.6
                        setCharacter((c) => {
                          const updated = { ...c, wealth: Number(c.wealth || 0) + reward }
                          persistCharacterPartial(updated)
                          if (userId) saveCharacterToDB(updated)
                          return updated
                        })
                      }
                    }}
                    onClose={() => setPropertyPanelOpen(false)}
                  />
                </div>
              </div>
            )}

          </div>

          {/* Right column: player panel */}
          <aside>
            <div className="sticky top-6 space-y-4">
              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold">{character.name}</h3>
                    <div className="text-xs text-slate-400">Level {character.level} • XP {character.xp} {prestigeData.prestigeLevel > 0 && `• Prestige ${prestigeData.prestigeLevel}`}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setCustomizationOpen(true)} className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded">Customize</button>
                    <button onClick={() => setCharacter(null)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded">My Account</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2 bg-slate-900/30 rounded text-center">
                    <div className="text-xs text-slate-400">Wealth</div>
                    <div className="text-lg font-bold text-yellow-300">{formatMoney(character.wealth)}</div>
                  </div>
                  <div className="p-2 bg-slate-900/30 rounded text-center">
                    <div className="text-xs text-slate-400">Income/10s</div>
                    <div className="text-lg font-bold text-emerald-300">{formatMoney(character.income_rate)}</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-xs text-slate-400">Energy</div>
                  <div className="w-full h-3 bg-slate-700 rounded overflow-hidden mt-2">
                    <div className="h-full bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, ((character.energy ?? 100) / (character.max_energy ?? 100)) * 100))}%` }}></div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={claimDaily} className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white">Claim Daily</button>
                  {!userId && <button onClick={() => onShowAuth && onShowAuth('login')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white">Login</button>}
                </div>

                <div className="mt-3">
                  <button onClick={() => requestMatch()} className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 rounded text-white">Find Match</button>
                </div>
              </div>

              {/* Stats */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                <h4 className="font-bold mb-2">Stats</h4>
                <div className="space-y-2 text-sm">
                  <StatRow label="💪 Strength" value={characterStats.strength} color="red" />
                  <StatRow label="🧠 Intelligence" value={characterStats.intelligence} color="blue" />
                  <StatRow label="😊 Charisma" value={characterStats.charisma} color="pink" />
                  <StatRow label="⚡ Endurance" value={characterStats.endurance} color="amber" />
                  <StatRow label="🎯 Dexterity" value={characterStats.dexterity} color="green" />
                  <StatRow label="🍀 Luck" value={characterStats.luck} color="yellow" />
                </div>
                <p className="text-xs text-slate-400 mt-3">Stats increase as you complete jobs. Each job type boosts different stats.</p>
              </div>

              {/* Leaderboard */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                <h4 className="font-bold mb-2">Leaderboard</h4>
                <ol className="list-decimal list-inside text-sm space-y-2">
                  {leaderboard.map((p, idx) => (
                    <li key={`lb-${idx}-${p.user_id || p.name}`} className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <span className="text-yellow-300 font-semibold">{formatMoney(p.wealth)}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                <h4 className="font-bold mb-2">Matches & Players</h4>
                <div className="text-sm mb-2">
                  {matchRequests.length === 0 ? <div className="text-slate-400">No incoming match requests.</div> : matchRequests.map((r, idx) => (
                    <div key={`mr-${idx}`} className="flex items-center justify-between p-2 bg-slate-900/20 rounded mb-2">
                      <div>
                        <div className="font-medium">{r.name || r.user_id}</div>
                        <div className="text-xs text-slate-400">{new Date(r.timestamp).toLocaleTimeString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => acceptMatch(r)} className="px-2 py-1 bg-emerald-600 rounded text-white text-sm">Accept</button>
                        <button onClick={() => rejectMatch(r)} className="px-2 py-1 bg-red-600 rounded text-white text-sm">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-sm space-y-1">
                  <div className="text-slate-400">Players online: {onlinePlayers.length}</div>
                  {onlinePlayers.map(p => (
                    <div key={`online-${p.user_id}`} className="flex items-center justify-between text-sm mt-1">
                      <div>{p.name || 'Anonymous'}</div>
                      <div className="text-xs text-slate-400">{p.status || 'online'}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </aside>
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

// Small presentational helper for stat rows
function StatRow({ label, value = 0, color = 'green' }) {
  const colors = {
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    pink: 'bg-pink-500',
    amber: 'bg-amber-400',
    green: 'bg-green-400',
    yellow: 'bg-yellow-300'
  }
  const pct = Math.max(0, Math.min(100, value * 8))
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm">{label}</div>
      <div className="flex-1 mx-3">
        <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
          <div className={`${colors[color] || 'bg-green-400'} h-full`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-sm font-semibold">{value}</div>
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

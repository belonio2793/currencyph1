import { getAIService, PromptBuilders } from './aiService'

// Time and Season Management
export class WorldTime {
  constructor() {
    this.currentDate = new Date()
    this.gameSpeed = 60 // 1 minute = 1 real second
    this.season = this.getSeason()
    this.startTime = Date.now()
  }

  update() {
    const elapsed = (Date.now() - this.startTime) / 1000
    const minutesPassed = elapsed / this.gameSpeed
    
    this.currentDate = new Date(this.startTime + minutesPassed * 60000)
    this.season = this.getSeason()
  }

  getSeason() {
    const month = this.currentDate.getMonth()
    if (month >= 5 && month <= 10) return 'dry' // June-Nov
    return 'wet' // Dec-May
  }

  getTimeOfDay() {
    const hour = this.currentDate.getHours()
    if (hour >= 5 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 17) return 'afternoon'
    if (hour >= 17 && hour < 21) return 'evening'
    return 'night'
  }

  formatTime() {
    return this.currentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  formatDate() {
    return this.currentDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }
}

// Weather System
export class WeatherSystem {
  constructor(city) {
    this.city = city
    this.temperature = 28 // Celsius (typical for Philippines)
    this.humidity = 75
    this.condition = 'clear'
    this.windSpeed = 5 // km/h
    this.lastUpdate = Date.now()
  }

  async update(worldTime) {
    const now = Date.now()
    if (now - this.lastUpdate < 300000) return // Update every 5 minutes game time

    try {
      const ai = getAIService()
      const { system, context } = PromptBuilders.weatherEvent(this.city.name)
      
      const weatherDescription = await ai.generateResponse(
        context,
        system,
        `Generate weather for ${worldTime.season} season, ${worldTime.getTimeOfDay()}.`
      )

      // Parse weather conditions from response
      if (weatherDescription.includes('rain')) {
        this.condition = 'rainy'
        this.humidity = 95
        this.temperature -= 2
      } else if (weatherDescription.includes('cloud')) {
        this.condition = 'cloudy'
        this.humidity = 70
      } else if (weatherDescription.includes('hot')) {
        this.condition = 'hot'
        this.temperature = 35
      } else {
        this.condition = 'clear'
        this.humidity = 60
      }

      this.lastUpdate = now
    } catch (error) {
      console.error('Weather update error:', error)
    }
  }

  getWeatherConditionLabel() {
    const labels = {
      'clear': 'Clear',
      'cloudy': 'Cloudy',
      'rainy': 'Rainy',
      'hot': 'Hot',
      'stormy': 'Stormy'
    }
    return labels[this.condition] || 'Clear'
  }
}

// Economy System
export class EconomySystem {
  constructor() {
    this.commodities = {
      'coconut': { basePrice: 50, supply: 100, demand: 80, trend: 'stable' },
      'rice': { basePrice: 30, supply: 150, demand: 200, trend: 'up' },
      'banana': { basePrice: 40, supply: 120, demand: 90, trend: 'down' },
      'fish': { basePrice: 120, supply: 80, demand: 100, trend: 'stable' },
      'mango': { basePrice: 60, supply: 60, demand: 120, trend: 'up' },
      'textiles': { basePrice: 200, supply: 40, demand: 50, trend: 'stable' }
    }
    this.lastUpdate = Date.now()
  }

  async update(worldTime) {
    const now = Date.now()
    if (now - this.lastUpdate < 600000) return // Update every 10 minutes

    // Simulate supply/demand changes
    Object.keys(this.commodities).forEach(item => {
      const commodity = this.commodities[item]
      
      // Random market fluctuations
      if (Math.random() > 0.6) {
        commodity.demand += Math.floor((Math.random() - 0.5) * 20)
        commodity.supply += Math.floor((Math.random() - 0.5) * 10)
      }

      // Calculate trend
      const demandRatio = commodity.demand / commodity.supply
      if (demandRatio > 1.5) commodity.trend = 'up'
      else if (demandRatio < 0.7) commodity.trend = 'down'
      else commodity.trend = 'stable'

      // Ensure non-negative values
      commodity.demand = Math.max(10, commodity.demand)
      commodity.supply = Math.max(10, commodity.supply)
    })

    this.lastUpdate = now
  }

  getPrice(item) {
    const commodity = this.commodities[item]
    if (!commodity) return 100

    const demandRatio = commodity.demand / commodity.supply
    const priceMultiplier = Math.min(2, Math.max(0.5, demandRatio))
    
    return Math.round(commodity.basePrice * priceMultiplier)
  }

  getTrend(item) {
    return this.commodities[item]?.trend || 'stable'
  }
}

// Job System
export class JobSystem {
  constructor() {
    this.jobs = [
      { id: 'fisherman', title: 'Fisherman', pay: 500, difficulty: 'easy', duration: '8h' },
      { id: 'farmer', title: 'Farm Worker', pay: 400, difficulty: 'easy', duration: '8h' },
      { id: 'trader', title: 'Market Trader', pay: 600, difficulty: 'medium', duration: '6h' },
      { id: 'courier', title: 'Courier', pay: 700, difficulty: 'medium', duration: '8h' },
      { id: 'security', title: 'Security Guard', pay: 800, difficulty: 'easy', duration: '12h' },
      { id: 'consultant', title: 'Business Consultant', pay: 1500, difficulty: 'hard', duration: '4h' },
      { id: 'guide', title: 'Tour Guide', pay: 900, difficulty: 'medium', duration: '6h' }
    ]
    this.activeJobs = new Map()
  }

  async generateJobsForCity(city, playerLevel) {
    // Generate 3-5 random jobs
    const jobCount = Math.floor(Math.random() * 3) + 3
    const selectedJobs = []

    for (let i = 0; i < jobCount; i++) {
      const job = this.jobs[Math.floor(Math.random() * this.jobs.length)]
      selectedJobs.push({
        ...job,
        city: city.name,
        id: `job_${city.name}_${Date.now()}_${i}`,
        salary: this.calculateSalary(job.pay, playerLevel)
      })
    }

    return selectedJobs
  }

  calculateSalary(basePayRate, playerLevel) {
    const bonusMultiplier = 1 + (playerLevel * 0.1)
    return Math.round(basePayRate * bonusMultiplier)
  }
}

// Event System
export class EventSystem {
  constructor() {
    this.activeEvents = []
    this.eventTemplates = [
      { type: 'festival', description: 'A local festival is happening', effect: 'market_boost' },
      { type: 'strike', description: 'Market workers are on strike', effect: 'price_spike' },
      { type: 'harvest', description: 'Harvest season begins', effect: 'supply_boost' },
      { type: 'disaster', description: 'Bad weather incoming', effect: 'trade_danger' },
      { type: 'visitor', description: 'Important visitor arrives', effect: 'business_boom' }
    ]
    this.lastEventTime = Date.now()
  }

  async generateRandomEvent(city, worldTime) {
    const now = Date.now()
    // Events roughly every 20 minutes
    if (now - this.lastEventTime < 1200000) return null

    const event = this.eventTemplates[Math.floor(Math.random() * this.eventTemplates.length)]
    
    this.activeEvents.push({
      ...event,
      city: city.name,
      startTime: now,
      duration: 3600000 + Math.random() * 3600000 // 1-2 hours
    })

    this.lastEventTime = now
    return event
  }

  getActiveEvents(city) {
    const now = Date.now()
    this.activeEvents = this.activeEvents.filter(event => 
      event.startTime + event.duration > now
    )
    return this.activeEvents.filter(event => event.city === city.name)
  }
}

// NPC Routine System
export class NPCRoutine {
  constructor(npcName, city) {
    this.npcName = npcName
    this.city = city
    this.routine = this.generateRoutine()
    this.currentActivity = null
  }

  generateRoutine() {
    return {
      '5:00-8:00': 'sleep',
      '8:00-12:00': 'work',
      '12:00-13:00': 'lunch',
      '13:00-17:00': 'work',
      '17:00-19:00': 'rest',
      '19:00-21:00': 'social',
      '21:00-5:00': 'sleep'
    }
  }

  getCurrentActivity(timeOfDay) {
    const hour = new Date().getHours()
    const time = `${hour}:00`
    
    for (const [timeRange, activity] of Object.entries(this.routine)) {
      const [start, end] = timeRange.split('-')
      const [startHour] = start.split(':')
      const [endHour] = end.split(':')
      
      if (hour >= parseInt(startHour) && hour < parseInt(endHour)) {
        return activity
      }
    }
    return 'idle'
  }

  getLocation(activity) {
    const locations = {
      'work': 'workplace',
      'lunch': 'restaurant',
      'social': 'plaza',
      'rest': 'home',
      'sleep': 'home',
      'idle': 'street'
    }
    return locations[activity] || 'street'
  }
}

// Complete World Simulator
export class WorldSimulator {
  constructor(city, playerData) {
    this.city = city
    this.playerData = playerData
    this.time = new WorldTime()
    this.weather = new WeatherSystem(city)
    this.economy = new EconomySystem()
    this.jobs = new JobSystem()
    this.events = new EventSystem()
    this.npcs = new Map()
    this.lastUpdate = Date.now()
  }

  async update() {
    const now = Date.now()
    if (now - this.lastUpdate < 1000) return // Update once per second max

    this.time.update()
    await this.weather.update(this.time)
    await this.economy.update(this.time)
    await this.events.generateRandomEvent(this.city, this.time)

    this.lastUpdate = now
  }

  getWorldState() {
    return {
      time: {
        formatted: this.time.formatTime(),
        date: this.time.formatDate(),
        timeOfDay: this.time.getTimeOfDay(),
        season: this.time.season
      },
      weather: {
        condition: this.weather.condition,
        conditionLabel: this.weather.getWeatherConditionLabel(),
        temperature: this.weather.temperature,
        humidity: this.weather.humidity
      },
      economy: {
        commodities: this.economy.commodities
      },
      events: this.events.getActiveEvents(this.city.name)
    }
  }
}

import { CitySimulation, saveCityToDatabase, loadCitiesForUser } from './citySimulation'

class CitySimulationTicker {
  constructor() {
    this.isRunning = false
    this.interval = null
    this.cities = new Map()
    this.userId = null
    this.tickInterval = 5000 // 5 seconds = 1 month in game time
    this.callbacks = new Set()
  }

  setUser(userId) {
    this.userId = userId
  }

  addCallback(callback) {
    this.callbacks.add(callback)
  }

  removeCallback(callback) {
    this.callbacks.delete(callback)
  }

  notifyCallbacks(cities) {
    this.callbacks.forEach(callback => {
      try {
        callback(cities)
      } catch (err) {
        console.error('Callback error in CitySimulationTicker:', err)
      }
    })
  }

  async loadCities() {
    if (!this.userId) return

    try {
      const userCities = await loadCitiesForUser(this.userId)
      this.cities.clear()
      userCities.forEach(city => {
        this.cities.set(city.city_id, new CitySimulation(city))
      })
      return Array.from(this.cities.values()).map(sim => sim.export())
    } catch (err) {
      console.error('Failed to load cities:', err)
      return []
    }
  }

  addCity(city) {
    const simulation = new CitySimulation(city)
    this.cities.set(city.id, simulation)
    return simulation.export()
  }

  removeCity(cityId) {
    this.cities.delete(cityId)
  }

  async start() {
    if (this.isRunning) return

    await this.loadCities()
    this.isRunning = true

    this.interval = setInterval(() => {
      this.tick()
    }, this.tickInterval)
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.isRunning = false
  }

  tick() {
    const updatedCities = []

    this.cities.forEach((simulation, cityId) => {
      try {
        const updatedCity = simulation.tick()
        updatedCities.push(updatedCity)

        this.saveCityAsync(updatedCity)
      } catch (err) {
        console.error(`Error ticking city ${cityId}:`, err)
      }
    })

    if (updatedCities.length > 0) {
      this.notifyCallbacks(updatedCities)
    }
  }

  saveCityAsync(city) {
    if (!this.userId) return

    saveCityToDatabase(this.userId, city).catch(err => {
      console.error('Failed to auto-save city:', err)
    })
  }

  getCity(cityId) {
    const simulation = this.cities.get(cityId)
    return simulation ? simulation.export() : null
  }

  getAllCities() {
    const cities = []
    this.cities.forEach(sim => {
      cities.push(sim.export())
    })
    return cities
  }

  setTickSpeed(multiplier) {
    const baseInterval = 5000
    this.tickInterval = Math.max(500, baseInterval / multiplier)

    if (this.isRunning) {
      this.stop()
      this.start()
    }
  }
}

export const citySimulationTicker = new CitySimulationTicker()

export default citySimulationTicker

import { supabase } from './supabaseClient'

export class CitySimulation {
  constructor(city) {
    this.city = { ...city }
    this.simulationTick = 0
  }

  static DEFAULT_CITY = {
    id: null,
    name: 'New City',
    x: 14.5994, // Manila default
    y: 120.9842,
    population: 50000,
    budget: 1000000,
    happiness: 75,
    pollution: 20,
    employment: 65,
    education: 60,
    health: 70,
    crime: 15,
    infrastructure: 50,
    residentialZones: 10,
    commercialZones: 5,
    industrialZones: 2,
    parks: 3,
    hospitals: 2,
    schools: 3,
    powerPlants: 1,
    roads: 150,
    electricity: 80,
    water: 75,
    sewage: 70,
    taxRate: 0.08,
    monthlyRevenue: 0,
    monthlyExpense: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  // Simulate one month of city life
  tick() {
    this.simulationTick++

    // Population growth based on happiness
    this.updatePopulation()
    // Budget and taxes
    this.updateBudget()
    // Happiness factors
    this.updateHappiness()
    // Infrastructure wear
    this.updateInfrastructure()
    // Pollution and environment
    this.updatePollution()
    // Crime rates
    this.updateCrime()
    // Service effectiveness
    this.updateServices()

    return this.city
  }

  updatePopulation() {
    const happinessFactor = (this.city.happiness - 50) / 100
    const growthRate = 0.02 + (happinessFactor * 0.03)
    
    const baseGrowth = Math.floor(this.city.population * growthRate)
    const employmentImpact = this.city.employment > 70 ? baseGrowth * 1.2 : baseGrowth * 0.8
    
    this.city.population = Math.floor(this.city.population + employmentImpact)
  }

  updateBudget() {
    const taxIncome = this.city.population * 100 * this.city.taxRate
    const maintenanceCost = (this.city.roads * 50) + (this.city.powerPlants * 10000) + (this.city.hospitals * 5000) + (this.city.schools * 3000)
    const pollutionCost = this.city.pollution * 1000
    
    this.city.monthlyRevenue = Math.floor(taxIncome)
    this.city.monthlyExpense = Math.floor(maintenanceCost + pollutionCost)
    
    this.city.budget += (this.city.monthlyRevenue - this.city.monthlyExpense)
  }

  updateHappiness() {
    let happinessAdjustment = 0

    // Services
    if (this.city.health > 70) happinessAdjustment += 2
    if (this.city.education > 70) happinessAdjustment += 2
    if (this.city.employment > 70) happinessAdjustment += 3
    if (this.city.electricity < 80) happinessAdjustment -= 5
    if (this.city.water < 70) happinessAdjustment -= 5

    // Negative factors
    if (this.city.pollution > 70) happinessAdjustment -= 5
    if (this.city.crime > 50) happinessAdjustment -= 3

    // Parks and recreation
    happinessAdjustment += this.city.parks * 0.5

    // Normalize
    this.city.happiness = Math.max(0, Math.min(100, this.city.happiness + happinessAdjustment))
  }

  updateInfrastructure() {
    const wearRate = 0.02 + (this.city.pollution / 500)
    
    if (this.city.infrastructure > 0) {
      this.city.infrastructure -= wearRate
    }

    if (this.city.budget > 50000 && this.city.infrastructure < 60) {
      this.city.infrastructure = Math.min(100, this.city.infrastructure + 1)
      this.city.budget -= 50000
    }
  }

  updatePollution() {
    let pollutionIncrease = this.city.industrialZones * 5 + this.city.commercialZones * 2
    let pollutionDecrease = this.city.parks * 10 + (this.city.infrastructure / 10)

    this.city.pollution = Math.max(0, Math.min(100, this.city.pollution + pollutionIncrease - pollutionDecrease))
  }

  updateCrime() {
    const policeInfluence = -this.city.infrastructure * 0.3
    const unemploymentInfluence = (100 - this.city.employment) * 0.2
    const povertyInfluence = (100 - this.city.happiness) * 0.1

    const crimeAdjustment = (policeInfluence + unemploymentInfluence + povertyInfluence) / 100

    this.city.crime = Math.max(0, Math.min(100, this.city.crime + crimeAdjustment))
  }

  updateServices() {
    // Education quality improves with schools
    this.city.education = Math.min(100, 20 + (this.city.schools * 8))

    // Health improves with hospitals
    this.city.health = Math.min(100, 25 + (this.city.hospitals * 10))

    // Employment based on commercial/industrial zones
    const jobCapacity = (this.city.commercialZones * 100) + (this.city.industrialZones * 150)
    const jobDemand = Math.max(this.city.population * 0.4, jobCapacity)
    this.city.employment = Math.min(100, Math.floor((jobCapacity / jobDemand) * 100))

    // Electricity
    if (this.city.powerPlants > 0) {
      this.city.electricity = Math.min(100, 60 + (this.city.powerPlants * 15))
    }

    // Water system
    this.city.water = Math.min(100, 40 + (this.city.residentialZones * 3))
  }

  addZone(type, count = 1) {
    const costs = {
      residential: 100000,
      commercial: 150000,
      industrial: 200000,
      park: 50000,
      hospital: 500000,
      school: 300000,
      powerplant: 1000000
    }

    const cost = (costs[type] || 0) * count
    if (this.city.budget < cost) return false

    this.city.budget -= cost

    switch(type) {
      case 'residential':
        this.city.residentialZones += count
        break
      case 'commercial':
        this.city.commercialZones += count
        break
      case 'industrial':
        this.city.industrialZones += count
        break
      case 'park':
        this.city.parks += count
        break
      case 'hospital':
        this.city.hospitals += count
        break
      case 'school':
        this.city.schools += count
        break
      case 'powerplant':
        this.city.powerPlants += count
        break
    }

    return true
  }

  buildRoads(count = 1) {
    const cost = 10000 * count
    if (this.city.budget < cost) return false

    this.city.budget -= cost
    this.city.roads += count
    return true
  }

  setTaxRate(rate) {
    this.city.taxRate = Math.max(0, Math.min(0.20, rate))
  }

  export() {
    return { ...this.city }
  }
}

export async function saveCityToDatabase(userId, city) {
  try {
    const { data, error } = await supabase
      .from('cities')
      .upsert({
        user_id: userId,
        city_id: city.id,
        name: city.name,
        x: city.x,
        y: city.y,
        population: city.population,
        budget: city.budget,
        happiness: city.happiness,
        pollution: city.pollution,
        employment: city.employment,
        education: city.education,
        health: city.health,
        crime: city.crime,
        infrastructure: city.infrastructure,
        residential_zones: city.residentialZones,
        commercial_zones: city.commercialZones,
        industrial_zones: city.industrialZones,
        parks: city.parks,
        hospitals: city.hospitals,
        schools: city.schools,
        power_plants: city.powerPlants,
        roads: city.roads,
        electricity: city.electricity,
        water: city.water,
        sewage: city.sewage,
        tax_rate: city.taxRate,
        monthly_revenue: city.monthlyRevenue,
        monthly_expense: city.monthlyExpense,
        updated_at: new Date()
      }, { onConflict: 'city_id' })

    if (error) throw error
    return data
  } catch (err) {
    console.error('Failed to save city:', err)
    throw err
  }
}

export async function loadCitiesForUser(userId) {
  try {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Failed to load cities:', err)
    return []
  }
}

export async function deleteCity(cityId) {
  try {
    const { error } = await supabase
      .from('cities')
      .delete()
      .eq('city_id', cityId)

    if (error) throw error
  } catch (err) {
    console.error('Failed to delete city:', err)
    throw err
  }
}

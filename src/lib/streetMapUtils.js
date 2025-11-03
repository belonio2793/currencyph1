const MANILA_STREETS = {
  'Ayala Avenue': { lat: 14.5599, lng: 120.9873, type: 'commercial', district: 'Makati' },
  'Paseo de Roxas': { lat: 14.5621, lng: 120.9820, type: 'commercial', district: 'Makati' },
  'Ortigas Avenue': { lat: 14.5803, lng: 121.0301, type: 'commercial', district: 'Quezon City' },
  'Edsa': { lat: 14.5802, lng: 121.0235, type: 'highway', district: 'Multiple' },
  'Taguig Fort Bonifacio': { lat: 14.5500, lng: 121.0370, type: 'commercial', district: 'Taguig' },
  'Cebu IT Park': { lat: 10.3167, lng: 123.8833, type: 'commercial', district: 'Cebu' },
  'Davao CBD': { lat: 7.0731, lng: 125.6143, type: 'commercial', district: 'Davao' },
  'Iloilo Business Park': { lat: 10.6891, lng: 122.5598, type: 'commercial', district: 'Iloilo' }
}

const CITY_ZONES = {
  'Manila': {
    center: { lat: 14.5995, lng: 120.9842 },
    bounds: { north: 14.7, south: 14.5, east: 121.1, west: 120.85 },
    districts: ['Makati', 'BGC', 'Pasig', 'Quezon City', 'Manila Proper']
  },
  'Cebu': {
    center: { lat: 10.3167, lng: 123.8833 },
    bounds: { north: 10.5, south: 10.1, east: 124.0, west: 123.7 },
    districts: ['Cebu City', 'Mactan']
  },
  'Davao': {
    center: { lat: 7.0731, lng: 125.6143 },
    bounds: { north: 7.3, south: 6.8, east: 125.8, west: 125.4 },
    districts: ['Davao City']
  }
}

const PROPERTY_ZONES = {
  residential: { priceMultiplier: 1.0, incomeMultiplier: 1.2 },
  commercial: { priceMultiplier: 1.5, incomeMultiplier: 2.0 },
  industrial: { priceMultiplier: 0.8, incomeMultiplier: 1.5 },
  mixed: { priceMultiplier: 1.2, incomeMultiplier: 1.6 }
}

export function getStreetProperties(city = 'Manila', street = null) {
  const streets = Object.entries(MANILA_STREETS)
    .filter(([name, data]) => !city || data.district.includes(city) || city === 'All')
    .map(([name, data]) => ({ name, ...data }))

  if (street) {
    return streets.filter(s => s.name.toLowerCase().includes(street.toLowerCase()))
  }
  return streets
}

export function getCityZone(city) {
  return CITY_ZONES[city] || null
}

export function generatePropertyOnStreet(streetName, propertyType = 'residential') {
  const streets = Object.entries(MANILA_STREETS)
  const [name, streetData] = streets.find(([n]) => n.toLowerCase() === streetName.toLowerCase()) || []

  if (!streetData) return null

  const zoneMultiplier = PROPERTY_ZONES[propertyType] || PROPERTY_ZONES.residential

  const basePrice = {
    residential: 500000,
    commercial: 2000000,
    industrial: 1200000,
    mixed: 1500000
  }

  const baseRevenue = {
    residential: 100,
    commercial: 500,
    industrial: 300,
    mixed: 400
  }

  return {
    name: `${propertyType.charAt(0).toUpperCase() + propertyType.slice(1)} on ${name}`,
    type: propertyType,
    location: {
      street: name,
      lat: streetData.lat + (Math.random() - 0.5) * 0.01,
      lng: streetData.lng + (Math.random() - 0.5) * 0.01,
      district: streetData.district
    },
    purchase_price: Math.floor((basePrice[propertyType] || basePrice.residential) * zoneMultiplier.priceMultiplier),
    revenue_per_day: Math.floor((baseRevenue[propertyType] || baseRevenue.residential) * zoneMultiplier.incomeMultiplier),
    demand_level: Math.random() > 0.5 ? 'high' : 'normal',
    neighborhood_quality: Math.floor(Math.random() * 100) + 50
  }
}

export function getLocationName(lat, lng, city = 'Manila') {
  const streets = getStreetProperties(city)

  let closest = null
  let minDistance = Infinity

  streets.forEach(street => {
    const dist = Math.hypot(street.lat - lat, street.lng - lng)
    if (dist < minDistance) {
      minDistance = dist
      closest = street
    }
  })

  return closest ? closest.name : `Near ${city} (${lat.toFixed(4)}, ${lng.toFixed(4)})`
}

export function getPropertySuggestions(city = 'Manila', budget = 1000000) {
  const streets = getStreetProperties(city)
  const types = Object.keys(PROPERTY_ZONES)

  const suggestions = []

  for (let i = 0; i < 5; i++) {
    const street = streets[Math.floor(Math.random() * streets.length)]
    const type = types[Math.floor(Math.random() * types.length)]

    const property = generatePropertyOnStreet(street.name, type)
    if (property && property.purchase_price <= budget) {
      suggestions.push(property)
    }
  }

  return suggestions.sort((a, b) => b.revenue_per_day - a.revenue_per_day)
}

export function calculateDistrictMultiplier(district) {
  const multipliers = {
    'Makati': 1.4,
    'BGC': 1.3,
    'Pasig': 1.2,
    'Quezon City': 1.1,
    'Manila Proper': 0.9,
    'Mactan': 1.2,
    'Davao City': 1.0,
    'Cebu City': 1.15
  }
  return multipliers[district] || 1.0
}

export function getMarketTrends(city = 'Manila') {
  const zone = getCityZone(city)
  if (!zone) return null

  return {
    city,
    averagePrice: Math.random() * 2000000 + 500000,
    priceChange: (Math.random() - 0.5) * 10,
    demandLevel: ['low', 'normal', 'high'][Math.floor(Math.random() * 3)],
    hotSpots: zone.districts.slice(0, 3),
    forecastedGrowth: (Math.random() * 20 - 5).toFixed(1) + '%'
  }
}

export function searchPropertiesByZone(city, zoneType, priceRange = { min: 0, max: Infinity }) {
  const streets = getStreetProperties(city)
  const matchingStreets = streets.filter(s => s.type === zoneType)

  return matchingStreets.map(street => {
    const property = generatePropertyOnStreet(street.name, 'commercial')
    return {
      ...property,
      location: { ...property.location, street: street.name }
    }
  }).filter(p => p.purchase_price >= priceRange.min && p.purchase_price <= priceRange.max)
}

export default {
  getStreetProperties,
  getCityZone,
  generatePropertyOnStreet,
  getLocationName,
  getPropertySuggestions,
  calculateDistrictMultiplier,
  getMarketTrends,
  searchPropertiesByZone
}

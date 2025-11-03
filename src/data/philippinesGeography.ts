export interface Street {
  id: string
  name: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  neighborhood: string
}

export interface Neighborhood {
  id: string
  name: string
  centerLat: number
  centerLng: number
  bounds: {
    northLat: number
    southLat: number
    westLng: number
    eastLng: number
  }
}

export interface City {
  id: string
  name: string
  region: string
  centerLat: number
  centerLng: number
  population: number
  neighborhoods: Neighborhood[]
  streets: Street[]
}

const MANILA_NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 'intramuros',
    name: 'Intramuros',
    centerLat: 14.5956,
    centerLng: 120.9799,
    bounds: { northLat: 14.6020, southLat: 14.5890, westLng: 120.9740, eastLng: 120.9858 }
  },
  {
    id: 'ermita',
    name: 'Ermita',
    centerLat: 14.5820,
    centerLng: 120.9860,
    bounds: { northLat: 14.5900, southLat: 14.5740, westLng: 120.9780, eastLng: 120.9950 }
  },
  {
    id: 'malate',
    name: 'Malate',
    centerLat: 14.5680,
    centerLng: 120.9800,
    bounds: { northLat: 14.5780, southLat: 14.5580, westLng: 120.9700, eastLng: 120.9900 }
  },
  {
    id: 'binondo',
    name: 'Binondo',
    centerLat: 14.5980,
    centerLng: 120.9680,
    bounds: { northLat: 14.6060, southLat: 14.5900, westLng: 120.9570, eastLng: 120.9790 }
  },
  {
    id: 'santa-cruz',
    name: 'Santa Cruz',
    centerLat: 14.6100,
    centerLng: 120.9750,
    bounds: { northLat: 14.6200, southLat: 14.6000, westLng: 120.9640, eastLng: 120.9860 }
  },
  {
    id: 'quiapo',
    name: 'Quiapo',
    centerLat: 14.6050,
    centerLng: 120.9870,
    bounds: { northLat: 14.6150, southLat: 14.5950, westLng: 120.9760, eastLng: 120.9980 }
  },
  {
    id: 'sampaloc',
    name: 'Sampaloc',
    centerLat: 14.6250,
    centerLng: 120.9950,
    bounds: { northLat: 14.6400, southLat: 14.6100, westLng: 120.9830, eastLng: 121.0070 }
  },
  {
    id: 'san-nicolas',
    name: 'San Nicolas',
    centerLat: 14.6150,
    centerLng: 120.9580,
    bounds: { northLat: 14.6250, southLat: 14.6050, westLng: 120.9470, eastLng: 120.9690 }
  },
  {
    id: 'tondo',
    name: 'Tondo',
    centerLat: 14.6350,
    centerLng: 120.9700,
    bounds: { northLat: 14.6550, southLat: 14.6150, westLng: 120.9500, eastLng: 120.9900 }
  },
  {
    id: 'paco',
    name: 'Paco',
    centerLat: 14.5650,
    centerLng: 120.9650,
    bounds: { northLat: 14.5750, southLat: 14.5550, westLng: 120.9550, eastLng: 120.9750 }
  }
]

const MANILA_STREETS: Street[] = [
  {
    id: 'ayala-ave',
    name: 'Ayala Avenue',
    startLat: 14.5650,
    startLng: 120.9800,
    endLat: 14.5950,
    endLng: 120.9800,
    neighborhood: 'makati'
  },
  {
    id: 'paseo-de-roxas',
    name: 'Paseo de Roxas',
    startLat: 14.5650,
    startLng: 120.9750,
    endLat: 14.5950,
    endLng: 120.9750,
    neighborhood: 'makati'
  },
  {
    id: 'j-vargas-st',
    name: 'J.P. Vargas Street',
    startLat: 14.5700,
    startLng: 120.9600,
    endLat: 14.5700,
    endLng: 120.9900,
    neighborhood: 'makati'
  },
  {
    id: 'makati-ave',
    name: 'Makati Avenue',
    startLat: 14.5550,
    startLng: 120.9700,
    endLat: 14.6000,
    endLng: 120.9700,
    neighborhood: 'makati'
  },
  {
    id: 'quirino-ave',
    name: 'Quirino Avenue',
    startLat: 14.6050,
    startLng: 120.9650,
    endLat: 14.6050,
    endLng: 120.9950,
    neighborhood: 'manila'
  },
  {
    id: 'roxas-blvd',
    name: 'Roxas Boulevard',
    startLat: 14.5600,
    startLng: 120.9650,
    endLat: 14.6200,
    endLng: 120.9650,
    neighborhood: 'manila'
  },
  {
    id: 'escolta',
    name: 'Escolta',
    startLat: 14.5980,
    startLng: 120.9600,
    endLat: 14.5980,
    endLng: 120.9800,
    neighborhood: 'binondo'
  },
  {
    id: 'jones-bridge',
    name: 'Jones Bridge Road',
    startLat: 14.6100,
    startLng: 120.9650,
    endLat: 14.6100,
    endLng: 120.9750,
    neighborhood: 'santa-cruz'
  },
  {
    id: 'plaza-miranda',
    name: 'Plaza Miranda',
    startLat: 14.6020,
    startLng: 120.9870,
    endLat: 14.6040,
    endLng: 120.9890,
    neighborhood: 'quiapo'
  },
  {
    id: 'espana-blvd',
    name: 'España Boulevard',
    startLat: 14.6200,
    startLng: 120.9950,
    endLat: 14.6200,
    endLng: 121.0050,
    neighborhood: 'sampaloc'
  },
  {
    id: 'recto-ave',
    name: 'Recto Avenue',
    startLat: 14.6150,
    startLng: 120.9800,
    endLat: 14.6150,
    endLng: 121.0050,
    neighborhood: 'sampaloc'
  },
  {
    id: 'taft-ave',
    name: 'Taft Avenue',
    startLat: 14.5650,
    startLng: 120.9900,
    endLat: 14.6400,
    endLng: 120.9900,
    neighborhood: 'manila'
  }
]

const CEBU_NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 'downtown-cebu',
    name: 'Downtown Cebu',
    centerLat: 10.3157,
    centerLng: 123.8854,
    bounds: { northLat: 10.3250, southLat: 10.3060, westLng: 123.8750, eastLng: 123.8960 }
  },
  {
    id: 'fuente-osmeña',
    name: 'Fuente Osmeña',
    centerLat: 10.3180,
    centerLng: 123.8790,
    bounds: { northLat: 10.3280, southLat: 10.3080, westLng: 123.8680, eastLng: 123.8900 }
  },
  {
    id: 'lahug',
    name: 'Lahug',
    centerLat: 10.3350,
    centerLng: 123.8950,
    bounds: { northLat: 10.3450, southLat: 10.3250, westLng: 123.8840, eastLng: 123.9060 }
  },
  {
    id: 'mandaue',
    name: 'Mandaue',
    centerLat: 10.3450,
    centerLng: 123.9050,
    bounds: { northLat: 10.3550, southLat: 10.3350, westLng: 123.8950, eastLng: 123.9150 }
  }
]

const CEBU_STREETS: Street[] = [
  {
    id: 'osmena-blvd-cebu',
    name: 'Osmeña Boulevard',
    startLat: 10.3150,
    startLng: 123.8750,
    endLat: 10.3150,
    endLng: 123.8950,
    neighborhood: 'downtown-cebu'
  },
  {
    id: 'colon-st-cebu',
    name: 'Colon Street',
    startLat: 10.3100,
    startLng: 123.8800,
    endLat: 10.3250,
    endLng: 123.8800,
    neighborhood: 'downtown-cebu'
  }
]

const DAVAO_NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 'downtown-davao',
    name: 'Downtown Davao',
    centerLat: 7.0731,
    centerLng: 125.6121,
    bounds: { northLat: 7.0850, southLat: 7.0610, westLng: 125.6000, eastLng: 125.6240 }
  },
  {
    id: 'banaybanay',
    name: 'Banaybanay',
    centerLat: 7.0900,
    centerLng: 125.6200,
    bounds: { northLat: 7.1000, southLat: 7.0800, westLng: 125.6100, eastLng: 125.6300 }
  }
]

const DAVAO_STREETS: Street[] = [
  {
    id: 'san-pedro-st-davao',
    name: 'San Pedro Street',
    startLat: 7.0700,
    startLng: 125.6100,
    endLat: 7.0800,
    endLng: 125.6100,
    neighborhood: 'downtown-davao'
  }
]

export const PHILIPPINES_CITIES: City[] = [
  {
    id: 'manila',
    name: 'Manila',
    region: 'NCR',
    centerLat: 14.5995,
    centerLng: 120.9842,
    population: 1846513,
    neighborhoods: MANILA_NEIGHBORHOODS,
    streets: MANILA_STREETS
  },
  {
    id: 'cebu',
    name: 'Cebu City',
    region: 'Visayas',
    centerLat: 10.3157,
    centerLng: 123.8854,
    population: 922611,
    neighborhoods: CEBU_NEIGHBORHOODS,
    streets: CEBU_STREETS
  },
  {
    id: 'davao',
    name: 'Davao City',
    region: 'Mindanao',
    centerLat: 7.0731,
    centerLng: 125.6121,
    population: 1632991,
    neighborhoods: DAVAO_NEIGHBORHOODS,
    streets: DAVAO_STREETS
  },
  {
    id: 'quezon-city',
    name: 'Quezon City',
    region: 'NCR',
    centerLat: 14.6349,
    centerLng: 121.0388,
    population: 2960048,
    neighborhoods: [],
    streets: []
  },
  {
    id: 'makati',
    name: 'Makati',
    region: 'NCR',
    centerLat: 14.5550,
    centerLng: 120.9700,
    population: 510383,
    neighborhoods: [],
    streets: []
  },
  {
    id: 'caloocan',
    name: 'Caloocan',
    region: 'NCR',
    centerLat: 14.6431,
    centerLng: 120.9669,
    population: 1523058,
    neighborhoods: [],
    streets: []
  },
  {
    id: 'iloilo',
    name: 'Iloilo City',
    region: 'Visayas',
    centerLat: 10.7202,
    centerLng: 122.5621,
    population: 447945,
    neighborhoods: [],
    streets: []
  },
  {
    id: 'cdo',
    name: 'Cagayan de Oro',
    region: 'Mindanao',
    centerLat: 8.4865,
    centerLng: 124.6467,
    population: 675817,
    neighborhoods: [],
    streets: []
  }
]

export function getCityById(cityId: string): City | undefined {
  return PHILIPPINES_CITIES.find(city => city.id === cityId)
}

export function getNeighborhoodById(cityId: string, neighborhoodId: string): Neighborhood | undefined {
  const city = getCityById(cityId)
  if (!city) return undefined
  return city.neighborhoods.find(n => n.id === neighborhoodId)
}

export function convertLatLngToGameCoords(
  lat: number,
  lng: number,
  city: City,
  mapWidth: number = 300,
  mapHeight: number = 350
): { x: number; y: number } {
  const bounds = {
    northLat: city.centerLat + 0.05,
    southLat: city.centerLat - 0.05,
    westLng: city.centerLng - 0.05,
    eastLng: city.centerLng + 0.05
  }

  const x = ((lng - bounds.westLng) / (bounds.eastLng - bounds.westLng)) * mapWidth
  const y = ((bounds.northLat - lat) / (bounds.northLat - bounds.southLat)) * mapHeight

  return {
    x: Math.max(0, Math.min(mapWidth, x)),
    y: Math.max(0, Math.min(mapHeight, y))
  }
}

export function convertGameCoordsToLatLng(
  x: number,
  y: number,
  city: City,
  mapWidth: number = 300,
  mapHeight: number = 350
): { lat: number; lng: number } {
  const bounds = {
    northLat: city.centerLat + 0.05,
    southLat: city.centerLat - 0.05,
    westLng: city.centerLng - 0.05,
    eastLng: city.centerLng + 0.05
  }

  const lng = bounds.westLng + (x / mapWidth) * (bounds.eastLng - bounds.westLng)
  const lat = bounds.northLat - (y / mapHeight) * (bounds.northLat - bounds.southLat)

  return { lat, lng }
}

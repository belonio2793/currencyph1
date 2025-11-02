// Comprehensive Philippines cities data with real coordinates
export const PHILIPPINES_CITIES = [
  // NCR (Metro Manila)
  { name: 'Manila', lat: 14.5994, lng: 120.9842, region: 'NCR', population: 1780148, type: 'metropolis' },
  { name: 'Quezon City', lat: 14.6349, lng: 121.0388, region: 'NCR', population: 2932771, type: 'metropolis' },
  { name: 'Caloocan', lat: 14.6505, lng: 120.9618, region: 'NCR', population: 1661584, type: 'city' },
  { name: 'Makati', lat: 14.5547, lng: 121.0244, region: 'NCR', population: 592846, type: 'city' },
  { name: 'Las Piñas', lat: 14.3570, lng: 120.9270, region: 'NCR', population: 614241, type: 'city' },
  { name: 'Pasay', lat: 14.5553, lng: 120.9939, region: 'NCR', population: 416543, type: 'city' },
  { name: 'Parañaque', lat: 14.3540, lng: 121.0019, region: 'NCR', population: 681891, type: 'city' },
  { name: 'Pasig', lat: 14.5769, lng: 121.0884, region: 'NCR', population: 667752, type: 'city' },
  { name: 'San Juan', lat: 14.5869, lng: 121.0286, region: 'NCR', population: 127537, type: 'city' },
  { name: 'Taguig', lat: 14.5215, lng: 121.0565, region: 'NCR', population: 843065, type: 'city' },
  { name: 'Valenzuela', lat: 14.7033, lng: 120.9819, region: 'NCR', population: 716311, type: 'city' },
  { name: 'Malabon', lat: 14.7288, lng: 120.9633, region: 'NCR', population: 376110, type: 'city' },
  { name: 'Navotas', lat: 14.6760, lng: 120.9433, region: 'NCR', population: 257608, type: 'city' },
  
  // Calabarzon
  { name: 'Antipolo', lat: 14.5894, lng: 121.1789, region: 'Calabarzon', population: 776688, type: 'city' },
  { name: 'Cavite City', lat: 14.4633, lng: 120.8876, region: 'Calabarzon', population: 107818, type: 'city' },
  { name: 'Trece Martires', lat: 14.3145, lng: 120.8814, region: 'Calabarzon', population: 109859, type: 'city' },
  { name: 'Kawit', lat: 14.3845, lng: 120.8745, region: 'Calabarzon', population: 96542, type: 'town' },
  { name: 'Rosario', lat: 14.4125, lng: 120.8956, region: 'Calabarzon', population: 62341, type: 'town' },
  { name: 'Tagaytay', lat: 14.0504, lng: 121.2120, region: 'Calabarzon', population: 273959, type: 'city' },
  { name: 'Silang', lat: 14.1855, lng: 121.0176, region: 'Calabarzon', population: 277452, type: 'city' },
  { name: 'Imus', lat: 14.3010, lng: 120.9233, region: 'Calabarzon', population: 462571, type: 'city' },
  { name: 'Bacoor', lat: 14.4018, lng: 120.9502, region: 'Calabarzon', population: 625639, type: 'city' },
  { name: 'Dasmariñas', lat: 14.2897, lng: 121.0388, region: 'Calabarzon', population: 540915, type: 'city' },
  { name: 'Lucena', lat: 14.0016, lng: 121.5747, region: 'Calabarzon', population: 281673, type: 'city' },
  { name: 'Candelaria', lat: 13.9754, lng: 121.4558, region: 'Calabarzon', population: 97432, type: 'town' },
  
  // Bicol
  { name: 'Naga City', lat: 13.6208, lng: 123.1849, region: 'Bicol', population: 205686, type: 'city' },
  { name: 'Legazpi', lat: 13.1521, lng: 123.7364, region: 'Bicol', population: 210547, type: 'city' },
  { name: 'Tabaco', lat: 13.4278, lng: 123.7268, region: 'Bicol', population: 90876, type: 'city' },
  { name: 'Camarines Sur', lat: 13.8844, lng: 123.3001, region: 'Bicol', population: 94321, type: 'town' },
  { name: 'Virac', lat: 13.5894, lng: 124.2142, region: 'Bicol', population: 89543, type: 'town' },
  
  // Visayas
  { name: 'Cebu City', lat: 10.3157, lng: 123.8854, region: 'Visayas', population: 866171, type: 'metropolis' },
  { name: 'Lapu-Lapu', lat: 10.3181, lng: 123.9725, region: 'Visayas', population: 410215, type: 'city' },
  { name: 'Mandaue City', lat: 10.4008, lng: 123.9738, region: 'Visayas', population: 481882, type: 'city' },
  { name: 'Danao', lat: 10.1964, lng: 124.0456, region: 'Visayas', population: 130566, type: 'city' },
  { name: 'Talisay', lat: 10.2776, lng: 123.9294, region: 'Visayas', population: 356260, type: 'city' },
  { name: 'Bacolod', lat: 10.3906, lng: 122.9806, region: 'Visayas', population: 451822, type: 'city' },
  { name: 'Iloilo City', lat: 10.6918, lng: 122.5637, region: 'Visayas', population: 446413, type: 'city' },
  { name: 'Dumaguete', lat: 9.3064, lng: 123.3149, region: 'Visayas', population: 131377, type: 'city' },
  { name: 'Tagbilaran', lat: 9.6413, lng: 123.8561, region: 'Visayas', population: 89455, type: 'city' },
  { name: 'Roxas', lat: 11.5883, lng: 122.7559, region: 'Visayas', population: 42147, type: 'city' },
  { name: 'Kalibo', lat: 11.6011, lng: 122.7207, region: 'Visayas', population: 43598, type: 'town' },
  { name: 'Boracay', lat: 11.9676, lng: 121.9278, region: 'Visayas', population: 12694, type: 'town' },
  { name: 'Ormoc', lat: 11.0050, lng: 124.6058, region: 'Visayas', population: 196040, type: 'city' },
  { name: 'Tacloban', lat: 11.2851, lng: 124.9939, region: 'Visayas', population: 242089, type: 'city' },
  { name: 'Calbayog', lat: 12.0743, lng: 124.5915, region: 'Visayas', population: 113410, type: 'city' },
  
  // Mindanao
  { name: 'Davao City', lat: 7.1315, lng: 125.6521, region: 'Mindanao', population: 1632991, type: 'metropolis' },
  { name: 'Zamboanga City', lat: 6.9271, lng: 122.0724, region: 'Mindanao', population: 975126, type: 'metropolis' },
  { name: 'Cagayan de Oro', lat: 8.4865, lng: 124.6467, region: 'Mindanao', population: 675817, type: 'city' },
  { name: 'Iligan', lat: 8.2317, lng: 124.2170, region: 'Mindanao', population: 342618, type: 'city' },
  { name: 'Butuan', lat: 8.9676, lng: 125.5261, region: 'Mindanao', population: 314505, type: 'city' },
  { name: 'Surigao', lat: 9.7899, lng: 125.5023, region: 'Mindanao', population: 132046, type: 'city' },
  { name: 'Tandag', lat: 9.3821, lng: 126.0359, region: 'Mindanao', population: 82541, type: 'town' },
  { name: 'General Santos', lat: 6.1186, lng: 125.1925, region: 'Mindanao', population: 594446, type: 'city' },
  { name: 'Koronadal', lat: 6.5131, lng: 124.8128, region: 'Mindanao', population: 165024, type: 'city' },
  { name: 'Cotabato City', lat: 7.2156, lng: 124.2545, region: 'Mindanao', population: 304543, type: 'city' },
  { name: 'Marawi', lat: 7.6126, lng: 124.2919, region: 'Mindanao', population: 201034, type: 'city' },
  { name: 'Ozamis', lat: 8.1436, lng: 123.8509, region: 'Mindanao', population: 77432, type: 'city' },
  
  // Luzon
  { name: 'Baguio', lat: 16.4023, lng: 120.5960, region: 'Cordillera', population: 345366, type: 'city' },
  { name: 'Cabanatuan', lat: 15.4909, lng: 121.0211, region: 'Nueva Ecija', population: 379032, type: 'city' },
  { name: 'San Fernando', lat: 15.0336, lng: 120.6854, region: 'Pampanga', population: 356589, type: 'city' },
  { name: 'Angeles', lat: 15.1343, lng: 120.5880, region: 'Pampanga', population: 503949, type: 'city' },
  { name: 'Urdaneta', lat: 15.9731, lng: 120.5769, region: 'Pangasinan', population: 99320, type: 'city' },
  { name: 'Dagupan', lat: 16.0404, lng: 120.3289, region: 'Pangasinan', population: 163471, type: 'city' },
  { name: 'Laoag', lat: 17.2060, lng: 120.5907, region: 'Ilocos Norte', population: 136043, type: 'city' },
  { name: 'Batangas', lat: 13.7568, lng: 121.1858, region: 'Calabarzon', population: 305380, type: 'city' },
  { name: 'Lipa', lat: 13.7399, lng: 121.1829, region: 'Calabarzon', population: 317696, type: 'city' },
  { name: 'Calapan', lat: 13.2106, lng: 121.1858, region: 'Mimaropa', population: 105638, type: 'city' },
  { name: 'Puerto Princesa', lat: 10.1932, lng: 120.7694, region: 'Mimaropa', population: 188906, type: 'city' },
  { name: 'San Pablo', lat: 14.0585, lng: 121.3089, region: 'Calabarzon', population: 282545, type: 'city' },
  { name: 'Laguna de Bay', lat: 14.3165, lng: 121.2768, region: 'Calabarzon', population: 155934, type: 'city' },
  { name: 'Vigan', lat: 16.6207, lng: 120.3852, region: 'Ilocos Sur', population: 72299, type: 'city' },
]

// More detailed city data with zones
export const CITY_DETAILS = {
  'Manila': {
    description: 'Capital of the Philippines. Financial and cultural center.',
    zones: ['Intramuros', 'Downtown Manila', 'Binondo', 'Ermita', 'Malate', 'Quiapo'],
    populationDensity: 'very_high',
    economy: 'commerce',
    businesses: ['Bank', 'Trading Company', 'Market', 'Government Office']
  },
  'Cebu City': {
    description: 'Queen City of the South. Major business hub.',
    zones: ['Cebu Business Park', 'Carbon Market', 'South Road Properties'],
    populationDensity: 'high',
    economy: 'commerce',
    businesses: ['Port', 'Trading Center', 'Market', 'Shopping Mall']
  },
  'Davao City': {
    description: 'Mindanao metropolis. Agricultural and manufacturing center.',
    zones: ['Downtown Davao', 'Ecozone', 'Bankerohan Market'],
    populationDensity: 'high',
    economy: 'agriculture',
    businesses: ['Fruit Processing', 'Banana Exporter', 'Market', 'Government Center']
  }
}

export function getCityByName(name) {
  return PHILIPPINES_CITIES.find(city => city.name === name)
}

export function getCitiesByRegion(region) {
  return PHILIPPINES_CITIES.filter(city => city.region === region)
}

export function getRandomCity() {
  return PHILIPPINES_CITIES[Math.floor(Math.random() * PHILIPPINES_CITIES.length)]
}

export function getNearestCities(lat, lng, count = 5) {
  return PHILIPPINES_CITIES
    .map(city => ({
      ...city,
      distance: Math.hypot(city.lat - lat, city.lng - lng)
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
}

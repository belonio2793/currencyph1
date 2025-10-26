import { supabase } from './supabaseClient'

const PHILIPPINES_CITIES = [
  'Manila', 'Cebu', 'Davao', 'Baguio', 'Iloilo', 'Bacolod', 'Cagayan de Oro',
  'Zamboanga', 'Boracay', 'Puerto Princesa', 'El Nido', 'Tagbilaran',
  'General Luna', 'Olongapo', 'San Juan', 'Vigan', 'Legazpi', 'Tagaytay',
  'Bohol', 'Coron', 'Palawan', 'Quezon City', 'Makati', 'Pasig', 'Taguig',
  'Caloocan', 'Las Piñas', 'Parañaque', 'Marikina', 'Mandaluyong', 'San Juan',
  'Malabon', 'Navotas', 'Valenzuela', 'Maynila', 'Antipolo', 'Cainta', 'Tanay',
  'Paete', 'Angono', 'Montalban', 'Norzagaray', 'Novaliches', 'Bulakan',
  'Malolos', 'San Fernando', 'Plaridel', 'Meycauayan', 'Obando', 'Hagonoy',
  'Calumpit', 'Apalit', 'San Luis', 'Guagua', 'Porac', 'Floridablanca',
  'Dinalupihan', 'Masinloc', 'Palauig', 'Iba', 'Subic', 'Olongapo',
  'Limay', 'Hermosa', 'Abucay', 'Samal', 'Orion', 'Balanga', 'Orani',
  'Pilar', 'Nataasan', 'Cabanatuan', 'Science City', 'Muñoz', 'Gapan',
  'Talugtug', 'Pantabangan', 'Santo Domingo'
]

// Mock TripAdvisor attraction data for testing/development
const MOCK_ATTRACTIONS_BY_CITY = {
  Manila: [
    { name: 'Intramuros', rating: 4.1, category: 'Historical Site', reviewCount: 3645 },
    { name: 'Rizal Park', rating: 4.5, category: 'Park', reviewCount: 29795 },
    { name: 'Manila Cathedral', rating: 4.2, category: 'Religious Site', reviewCount: 1176 },
    { name: 'National Museum of Fine Arts', rating: 4.7, category: 'Museum', reviewCount: 8865 },
    { name: 'Fort Santiago', rating: 4.5, category: 'Historical Site', reviewCount: 11922 }
  ],
  Cebu: [
    { name: 'Magellan\'s Cross', rating: 4.3, category: 'Historical Site', reviewCount: 4200 },
    { name: 'Cebu Cathedral', rating: 4.4, category: 'Religious Site', reviewCount: 2100 },
    { name: 'Tops Lookout', rating: 4.5, category: 'Viewpoint', reviewCount: 5300 }
  ],
  Davao: [
    { name: 'People\'s Park', rating: 4.2, category: 'Park', reviewCount: 2800 },
    { name: 'Samal Island', rating: 4.6, category: 'Island', reviewCount: 8900 },
    { name: 'Crocodile Park', rating: 4.1, category: 'Zoo', reviewCount: 3200 }
  ]
}

export async function populateTripadvisorListings() {
  try {
    const allListings = []
    const totalCities = PHILIPPINES_CITIES.length

    for (let i = 0; i < totalCities; i++) {
      const city = PHILIPPINES_CITIES[i]
      
      // Get mock attractions for this city (or empty array if not in mock data)
      const attractions = MOCK_ATTRACTIONS_BY_CITY[city] || generateMockAttractionsForCity(city)
      
      // Convert attractions to listings format
      const cityListings = attractions.map((attr, idx) => ({
        tripadvisor_id: `${city.toLowerCase().replace(/\s+/g, '-')}-${idx}-${Date.now()}`,
        name: attr.name,
        address: `${attr.name}, ${city}, Philippines`,
        latitude: generateRandomLatitude(),
        longitude: generateRandomLongitude(),
        rating: attr.rating,
        category: attr.category,
        raw: {
          city: city,
          description: `${attr.name} is a popular attraction in ${city}, Philippines. ${attr.category} with a rating of ${attr.rating}/5 based on ${attr.reviewCount} reviews.`,
          reviews: [],
          highlights: ['Popular attraction', 'Highly rated', 'Worth visiting'],
          bestFor: ['Tourism', 'Photography', 'Learning'],
          hours: '9:00 AM - 6:00 PM',
          admission: 'Variable',
          image: `https://via.placeholder.com/600x400?text=${encodeURIComponent(attr.name)}`,
          images: [],
          phone: null,
          website: null,
          reviewCount: attr.reviewCount
        },
        updated_at: new Date().toISOString()
      }))

      allListings.push(...cityListings)
    }

    // Insert in batches to avoid overwhelming the database
    const batchSize = 100
    let totalInserted = 0

    for (let i = 0; i < allListings.length; i += batchSize) {
      const batch = allListings.slice(i, i + batchSize)
      
      const { data, error } = await supabase
        .from('nearby_listings')
        .upsert(batch, { onConflict: 'tripadvisor_id' })
        .select('id')

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error)
        return {
          success: false,
          message: `Error at batch ${i / batchSize + 1}: ${error.message}`,
          totalFetched: allListings.length,
          inserted: totalInserted
        }
      }

      totalInserted += data?.length || 0
    }

    return {
      success: true,
      message: `Successfully populated ${totalInserted} listings from ${totalCities} Philippine cities`,
      totalFetched: allListings.length,
      uniqueSaved: totalInserted,
      inserted: totalInserted
    }
  } catch (err) {
    console.error('Failed to populate TripAdvisor listings:', err)
    return {
      success: false,
      message: err.message,
      totalFetched: 0,
      inserted: 0
    }
  }
}

function generateMockAttractionsForCity(city) {
  // Generate 2-4 mock attractions for cities not in our predefined list
  const count = Math.floor(Math.random() * 3) + 2
  const categories = ['Park', 'Museum', 'Religious Site', 'Historical Site', 'Beach', 'Market']
  const attractions = []

  for (let i = 0; i < count; i++) {
    attractions.push({
      name: `${city} Attraction ${i + 1}`,
      rating: (Math.random() * 2 + 3).toFixed(1),
      category: categories[Math.floor(Math.random() * categories.length)],
      reviewCount: Math.floor(Math.random() * 5000) + 500
    })
  }

  return attractions
}

function generateRandomLatitude() {
  // Philippines latitude range: approximately 5°N to 19°N
  return (Math.random() * 14 + 5).toFixed(4)
}

function generateRandomLongitude() {
  // Philippines longitude range: approximately 120°E to 127°E
  return (Math.random() * 7 + 120).toFixed(4)
}

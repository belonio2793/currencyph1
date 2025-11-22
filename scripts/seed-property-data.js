import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

// Sample property data for major Philippine cities
const sampleProperties = [
  {
    addresses_address: '123 Makati Ave, Makati City',
    addresses_street_number: '123',
    addresses_street_name: 'Makati Ave',
    addresses_city: 'Makati',
    addresses_province: 'Metro Manila',
    addresses_region: 'National Capital Region',
    addresses_postal_code: '1200',
    addresses_latitude: 14.5549,
    addresses_longitude: 121.0175,
    barangay: 'Bel-Air',
    lot_number: 'LOT-001-MM-2024',
    lot_area: 1500,
    lot_area_unit: 'sqm',
    property_type: 'Commercial',
    zoning_classification: 'commercial',
    land_use: 'Office Space',
    owner_name: 'Sample Owner 1',
    land_title_number: 'TCT-123456',
    elevation: 45.5,
    property_status: 'active',
    notes: 'Prime commercial property in Makati CBD'
  },
  {
    addresses_address: '456 Roxas Blvd, Manila',
    addresses_street_number: '456',
    addresses_street_name: 'Roxas Blvd',
    addresses_city: 'Manila',
    addresses_province: 'Metro Manila',
    addresses_region: 'National Capital Region',
    addresses_postal_code: '1000',
    addresses_latitude: 14.5951,
    addresses_longitude: 120.9680,
    barangay: 'Ermita',
    lot_number: 'LOT-002-MM-2024',
    lot_area: 2000,
    lot_area_unit: 'sqm',
    property_type: 'Residential',
    zoning_classification: 'residential',
    land_use: 'Condominium',
    owner_name: 'Sample Owner 2',
    land_title_number: 'TCT-654321',
    elevation: 25.0,
    property_status: 'active',
    notes: 'Waterfront residential property'
  },
  {
    addresses_address: '789 P. Burgos St, Cebu City',
    addresses_street_number: '789',
    addresses_street_name: 'P. Burgos St',
    addresses_city: 'Cebu City',
    addresses_province: 'Cebu',
    addresses_region: 'Central Visayas',
    addresses_postal_code: '6000',
    addresses_latitude: 10.3157,
    addresses_longitude: 123.8854,
    barangay: 'Mabolo',
    lot_number: 'LOT-003-CB-2024',
    lot_area: 3000,
    lot_area_unit: 'sqm',
    property_type: 'Mixed-Use',
    zoning_classification: 'mixed-use',
    land_use: 'Commercial & Residential',
    owner_name: 'Sample Owner 3',
    land_title_number: 'TCT-789012',
    elevation: 15.0,
    property_status: 'active',
    notes: 'Mixed-use development opportunity'
  },
  {
    addresses_address: '101 J.P. Laurel Ave, Davao City',
    addresses_street_number: '101',
    addresses_street_name: 'J.P. Laurel Ave',
    addresses_city: 'Davao City',
    addresses_province: 'Davao del Sur',
    addresses_region: 'Davao Region',
    addresses_postal_code: '8000',
    addresses_latitude: 7.0730,
    addresses_longitude: 125.6137,
    barangay: 'Poblacion',
    lot_number: 'LOT-004-DV-2024',
    lot_area: 2500,
    lot_area_unit: 'sqm',
    property_type: 'Residential',
    zoning_classification: 'residential',
    land_use: 'Subdivision Lot',
    owner_name: 'Sample Owner 4',
    land_title_number: 'TCT-345678',
    elevation: 85.5,
    property_status: 'active',
    notes: 'Residential lot in growing subdivision'
  },
  {
    addresses_address: '234 Session Rd, Baguio City',
    addresses_street_number: '234',
    addresses_street_name: 'Session Rd',
    addresses_city: 'Baguio City',
    addresses_province: 'Benguet',
    addresses_region: 'Cordillera Administrative Region',
    addresses_postal_code: '2600',
    addresses_latitude: 16.4087,
    addresses_longitude: 120.5954,
    barangay: 'Lualhati',
    lot_number: 'LOT-005-BG-2024',
    lot_area: 5000,
    lot_area_unit: 'sqm',
    property_type: 'Agricultural',
    zoning_classification: 'agricultural',
    land_use: 'Farm/Resort',
    owner_name: 'Sample Owner 5',
    land_title_number: 'TCT-901234',
    elevation: 1450.0,
    property_status: 'active',
    notes: 'Highland agricultural property'
  },
  {
    addresses_address: '567 Rizal St, Iloilo City',
    addresses_street_number: '567',
    addresses_street_name: 'Rizal St',
    addresses_city: 'Iloilo City',
    addresses_province: 'Iloilo',
    addresses_region: 'Western Visayas',
    addresses_postal_code: '5000',
    addresses_latitude: 10.6917,
    addresses_longitude: 122.5597,
    barangay: 'Molo',
    lot_number: 'LOT-006-IL-2024',
    lot_area: 1800,
    lot_area_unit: 'sqm',
    property_type: 'Commercial',
    zoning_classification: 'commercial',
    land_use: 'Retail & Dining',
    owner_name: 'Sample Owner 6',
    land_title_number: 'TCT-567890',
    elevation: 15.0,
    property_status: 'active',
    notes: 'Prime commercial area in Iloilo'
  },
  {
    addresses_address: '890 Quezon Ave, Quezon City',
    addresses_street_number: '890',
    addresses_street_name: 'Quezon Ave',
    addresses_city: 'Quezon City',
    addresses_province: 'Metro Manila',
    addresses_region: 'National Capital Region',
    addresses_postal_code: '1100',
    addresses_latitude: 14.6349,
    addresses_longitude: 121.0388,
    barangay: 'Kamuning',
    lot_number: 'LOT-007-QC-2024',
    lot_area: 2200,
    lot_area_unit: 'sqm',
    property_type: 'Residential',
    zoning_classification: 'residential',
    land_use: 'Apartment Complex',
    owner_name: 'Sample Owner 7',
    land_title_number: 'TCT-234567',
    elevation: 55.0,
    property_status: 'active',
    notes: 'Residential property in Kamuning'
  },
  {
    addresses_address: '345 Aguirre Ave, Lahug, Cebu',
    addresses_street_number: '345',
    addresses_street_name: 'Aguirre Ave',
    addresses_city: 'Cebu City',
    addresses_province: 'Cebu',
    addresses_region: 'Central Visayas',
    addresses_postal_code: '6000',
    addresses_latitude: 10.3271,
    addresses_longitude: 123.8832,
    barangay: 'Lahug',
    lot_number: 'LOT-008-CB-2024',
    lot_area: 4500,
    lot_area_unit: 'sqm',
    property_type: 'Commercial',
    zoning_classification: 'commercial',
    land_use: 'Shopping Center',
    owner_name: 'Sample Owner 8',
    land_title_number: 'TCT-890123',
    elevation: 20.0,
    property_status: 'active',
    notes: 'Large commercial development site'
  },
  {
    addresses_address: '678 A. Soriano Ave, Intramuros',
    addresses_street_number: '678',
    addresses_street_name: 'A. Soriano Ave',
    addresses_city: 'Manila',
    addresses_province: 'Metro Manila',
    addresses_region: 'National Capital Region',
    addresses_postal_code: '1002',
    addresses_latitude: 14.5850,
    addresses_longitude: 120.9750,
    barangay: 'Intramuros',
    lot_number: 'LOT-009-MM-2024',
    lot_area: 3500,
    lot_area_unit: 'sqm',
    property_type: 'Industrial',
    zoning_classification: 'industrial',
    land_use: 'Manufacturing',
    owner_name: 'Sample Owner 9',
    land_title_number: 'TCT-012345',
    elevation: 10.0,
    property_status: 'active',
    notes: 'Industrial property in Intramuros'
  },
  {
    addresses_address: '912 Legarda Rd, Ermita, Manila',
    addresses_street_number: '912',
    addresses_street_name: 'Legarda Rd',
    addresses_city: 'Manila',
    addresses_province: 'Metro Manila',
    addresses_region: 'National Capital Region',
    addresses_postal_code: '1000',
    addresses_latitude: 14.6000,
    addresses_longitude: 120.9700,
    barangay: 'Ermita',
    lot_number: 'LOT-010-MM-2024',
    lot_area: 2000,
    lot_area_unit: 'sqm',
    property_type: 'Residential',
    zoning_classification: 'residential',
    land_use: 'Townhouse Development',
    owner_name: 'Sample Owner 10',
    land_title_number: 'TCT-456789',
    elevation: 20.0,
    property_status: 'active',
    notes: 'Residential development in Ermita'
  }
]

async function seedPropertyData() {
  try {
    console.log('Starting property data seeding...')

    // Get a sample user ID (using first active user or create a test entry without user_id)
    const { data: userData } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1)

    const userId = userData && userData.length > 0 ? userData[0].id : null

    if (!userId) {
      console.log('No user found. Creating properties without user assignment.')
    }

    // Insert property data
    for (const property of sampleProperties) {
      const propertyData = {
        ...property,
        user_id: userId || null
      }

      const { data, error } = await supabase
        .from('addresses')
        .insert([propertyData])
        .select()

      if (error) {
        console.error(`Error inserting property: ${property.addresses_address}`, error)
      } else {
        console.log(`✓ Added property: ${property.addresses_address}`)
      }
    }

    console.log('✓ Property data seeding completed!')

  } catch (error) {
    console.error('Error seeding property data:', error)
    process.exit(1)
  }
}

seedPropertyData()

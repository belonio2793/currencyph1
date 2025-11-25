import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_PROJECT_URL || 'https://corcofbmafdxehvlbesx.supabase.co',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

const newPorts = [
  {
    name: 'Port of Manila (South Harbor)',
    description: 'The largest and busiest port in the Philippines, serving as the main international gateway for Metro Manila. Handles containerized cargo, breakbulk, and general cargo. Over 4.5 million TEUs annually.',
    status: 'active',
    latitude: 14.5879,
    longitude: 120.8578,
    city: 'Manila',
    province: 'Metro Manila',
    region: 'NCR',
    address: 'South Harbor, Port Area, Manila 1000',
    port_code: 'MNL',
    port_type: 'international',
    berth_count: 15,
    max_depth_meters: 14.0,
    max_vessel_length_meters: 300.0,
    annual_capacity_teu: 2000000,
    container_terminal: true,
    ro_ro_services: true,
    breakbulk_services: true,
    bulk_cargo: false,
    refrigerated_containers: false,
    dangerous_cargo: true,
    contact_phone: '+63 2 5279-5555',
    contact_email: 'info@portofmanila.ph',
    website: 'https://www.ppa.com.ph',
    is_public: true,
    metadata: { operator: 'Philippine Ports Authority', facilities: 'Container Terminal, RoRo Terminal, Breakbulk Berths', annual_volume_tons: 75000000 }
  },
  {
    name: 'Port of Manila (North Harbor)',
    description: 'Secondary harbor of Port Manila serving general cargo, breakbulk, and passenger operations. Important alternative container gateway with extensive cargo handling capabilities.',
    status: 'active',
    latitude: 14.6158,
    longitude: 120.8608,
    city: 'Manila',
    province: 'Metro Manila',
    region: 'NCR',
    address: 'North Harbor, Port Area, Manila 1000',
    port_code: 'MNL-NH',
    port_type: 'international',
    berth_count: 18,
    max_depth_meters: 13.0,
    max_vessel_length_meters: 280.0,
    annual_capacity_teu: 1500000,
    container_terminal: true,
    ro_ro_services: true,
    breakbulk_services: true,
    bulk_cargo: true,
    refrigerated_containers: true,
    dangerous_cargo: true,
    contact_phone: '+63 2 5279-5555',
    contact_email: 'info@portofmanila.ph',
    website: 'https://www.ppa.com.ph',
    is_public: true,
    metadata: { operator: 'Philippine Ports Authority', facilities: 'General Cargo Berths, RoRo Terminal, Break-in-Bulk', annual_volume_tons: 65000000 }
  },
  {
    name: 'Port of Iloilo',
    description: 'Safe natural harbor serving the Visayas region. Gateway for the Central Visayas and the entire Panay Island. Equipped with modern container and general cargo terminals with significant ferry operations.',
    status: 'active',
    latitude: 10.6899,
    longitude: 122.5659,
    city: 'Iloilo City',
    province: 'Iloilo',
    region: 'Region VI',
    address: 'National Highway, Iloilo City',
    port_code: 'ILO',
    port_type: 'international',
    berth_count: 12,
    max_depth_meters: 12.0,
    max_vessel_length_meters: 250.0,
    annual_capacity_teu: 350000,
    container_terminal: true,
    ro_ro_services: true,
    breakbulk_services: true,
    bulk_cargo: true,
    refrigerated_containers: false,
    dangerous_cargo: false,
    contact_phone: '+63 33 335-8000',
    contact_email: 'inquiries@iloiloport.ph',
    website: 'https://www.ppa.com.ph',
    is_public: true,
    metadata: { operator: 'Philippine Ports Authority', facilities: 'Container Terminal, General Cargo Terminal, Ferry Terminal', annual_volume_tons: 5000000 }
  },
  {
    name: 'Port of Zamboanga',
    description: 'Major port serving Southern Philippines and Mindanao. Center for sardine exports and general cargo operations. Strategic hub for trade with 19 functional docks supporting various cargo types.',
    status: 'active',
    latitude: 6.8988,
    longitude: 122.0724,
    city: 'Zamboanga City',
    province: 'Zamboanga del Sur',
    region: 'Region IX',
    address: 'Port Road, Zamboanga City',
    port_code: 'ZAM',
    port_type: 'international',
    berth_count: 12,
    max_depth_meters: 11.0,
    max_vessel_length_meters: 240.0,
    annual_capacity_teu: 280000,
    container_terminal: true,
    ro_ro_services: true,
    breakbulk_services: true,
    bulk_cargo: true,
    refrigerated_containers: false,
    dangerous_cargo: true,
    contact_phone: '+63 62 991-3261',
    contact_email: 'info@zamboangaport.ph',
    website: 'https://www.ppa.com.ph',
    is_public: true,
    metadata: { operator: 'Philippine Ports Authority', facilities: 'General Cargo Terminal, Ro-Ro Services, Cold Storage', annual_volume_tons: 3500000 }
  },
  {
    name: 'Port of Batangas',
    description: 'Strategic international gateway south of Manila serving domestic and international trade. Modern facilities for container, breakbulk, and project cargo handling with dedicated liquid bulk terminal.',
    status: 'active',
    latitude: 13.7584,
    longitude: 121.1841,
    city: 'Batangas City',
    province: 'Batangas',
    region: 'CALABARZON',
    address: 'Port Area, Batangas City',
    port_code: 'BAN',
    port_type: 'international',
    berth_count: 14,
    max_depth_meters: 12.0,
    max_vessel_length_meters: 260.0,
    annual_capacity_teu: 450000,
    container_terminal: true,
    ro_ro_services: true,
    breakbulk_services: true,
    bulk_cargo: true,
    refrigerated_containers: true,
    dangerous_cargo: false,
    contact_phone: '+63 43 740-0251',
    contact_email: 'portadmin@batangasport.ph',
    website: 'https://www.ppa.com.ph',
    is_public: true,
    metadata: { operator: 'Philippine Ports Authority', facilities: 'Container Terminal, Breakbulk Terminal, Liquid Bulk Terminal', annual_volume_tons: 8000000 }
  },
  {
    name: 'Port of Cagayan de Oro',
    description: 'Strategic gateway for Northern Mindanao and major commercial hub. Home to the Mindanao International Container Port with state-of-the-art facilities for containerized cargo and general cargo operations.',
    status: 'active',
    latitude: 8.4866,
    longitude: 124.6348,
    city: 'Cagayan de Oro City',
    province: 'Misamis Oriental',
    region: 'Region X',
    address: 'Port Road, Cagayan de Oro City',
    port_code: 'CDO',
    port_type: 'international',
    berth_count: 10,
    max_depth_meters: 11.5,
    max_vessel_length_meters: 230.0,
    annual_capacity_teu: 320000,
    container_terminal: true,
    ro_ro_services: true,
    breakbulk_services: true,
    bulk_cargo: true,
    refrigerated_containers: false,
    dangerous_cargo: false,
    contact_phone: '+63 88 857-0266',
    contact_email: 'info@cdoport.ph',
    website: 'https://www.ppa.com.ph',
    is_public: true,
    metadata: { operator: 'Philippine Ports Authority', facilities: 'Container Terminal, General Cargo, Ferry Terminal', annual_volume_tons: 4500000 }
  },
  {
    name: 'Port of Puerto Princesa',
    description: 'Major port of entry for the island-province of Palawan. Hub for regional transport and trade serving the island\'s vast tourism and agricultural industries with container and general cargo facilities.',
    status: 'active',
    latitude: 9.7424,
    longitude: 118.7292,
    city: 'Puerto Princesa City',
    province: 'Palawan',
    region: 'MIMAROPA',
    address: 'Rizal Avenue, Puerto Princesa City',
    port_code: 'PPS',
    port_type: 'international',
    berth_count: 8,
    max_depth_meters: 10.0,
    max_vessel_length_meters: 220.0,
    annual_capacity_teu: 180000,
    container_terminal: true,
    ro_ro_services: true,
    breakbulk_services: true,
    bulk_cargo: false,
    refrigerated_containers: false,
    dangerous_cargo: false,
    contact_phone: '+63 48 434-3140',
    contact_email: 'info@ppport.ph',
    website: 'https://www.ppa.com.ph',
    is_public: true,
    metadata: { operator: 'Philippine Ports Authority', facilities: 'General Cargo Terminal, Container Berth, Ferry Terminal', annual_volume_tons: 2500000 }
  }
]

async function addPorts() {
  try {
    console.log('Starting to add 6 additional shipping ports...')
    console.log(`Adding ${newPorts.length} ports to the database...`)

    const { data, error } = await supabase
      .from('shipping_ports')
      .insert(newPorts)
      .select()

    if (error) {
      console.error('Error inserting ports:', error)
      process.exit(1)
    }

    console.log(`✅ Successfully added ${data.length} ports!`)
    console.log('\nAdded ports:')
    data.forEach(port => {
      console.log(`  • ${port.name} (${port.city})`)
    })

    // Verify total count
    const { data: allPorts, error: countError } = await supabase
      .from('shipping_ports')
      .select('id', { count: 'exact' })
      .eq('is_public', true)

    if (!countError) {
      console.log(`\n📊 Total public shipping ports: ${allPorts.length}`)
    }

    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

addPorts()

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

async function createDemoShipment() {
  try {
    console.log('🚀 Creating demo shipment...\n')

    const userId = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

    const shipmentData = {
      user_id: userId,
      serial_id: 'DEMO-2024-001',
      package_name: 'Electronics Bundle',
      package_description: 'Mixed electronics including laptop accessories, phone charger, and USB cables',
      package_weight: 2.5,
      package_dimensions: '30x25x15 cm',
      origin_address_id: null,
      destination_address_id: null,
      status: 'in-transit',
      notes: 'Demo shipment for testing the tracking system',
      batch_id: null,
      batch_size: null,
      generated_count: null,
      pdf_url: null,
      export_format: 'pdf'
    }

    const { data: shipment, error: shipmentError } = await supabase
      .from('addresses_shipment_labels')
      .insert([shipmentData])
      .select()

    if (shipmentError) throw shipmentError

    const shipmentId = shipment[0].id
    console.log('✅ Shipment created:', shipmentId)
    console.log('   Serial ID:', shipment[0].serial_id)
    console.log('   Package:', shipment[0].package_name)
    console.log('   Status:', shipment[0].status)

    const checkpoints = [
      {
        shipment_id: shipmentId,
        checkpoint_name: 'Origin - Manila Hub',
        checkpoint_type: 'origin',
        status: 'scanned',
        latitude: 14.5994,
        longitude: 120.9842,
        location_address: 'Manila Distribution Center, Quezon City, Philippines',
        scanned_by_user_id: userId,
        notes: 'Package received and sorted',
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      },
      {
        shipment_id: shipmentId,
        checkpoint_name: 'In Transit - Batangas Port',
        checkpoint_type: 'waypoint',
        status: 'in-transit',
        latitude: 13.7631,
        longitude: 120.9427,
        location_address: 'Batangas Port Terminal, Batangas City, Philippines',
        scanned_by_user_id: userId,
        notes: 'Package loaded onto ferry',
        created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
      },
      {
        shipment_id: shipmentId,
        checkpoint_name: 'In Transit - Cebu Port',
        checkpoint_type: 'waypoint',
        status: 'in-transit',
        latitude: 10.3157,
        longitude: 123.8854,
        location_address: 'Cebu Port Authority, Cebu City, Philippines',
        scanned_by_user_id: userId,
        notes: 'Package arrived at destination port',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        shipment_id: shipmentId,
        checkpoint_name: 'Local Delivery - Cebu Distribution Hub',
        checkpoint_type: 'waypoint',
        status: 'in-transit',
        latitude: 10.3226,
        longitude: 123.9008,
        location_address: 'Cebu Regional Distribution Center, Cebu City, Philippines',
        scanned_by_user_id: userId,
        notes: 'Package in local delivery queue',
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      },
      {
        shipment_id: shipmentId,
        checkpoint_name: 'Out for Delivery',
        checkpoint_type: 'waypoint',
        status: 'in-transit',
        latitude: 10.3356,
        longitude: 123.9119,
        location_address: 'Banilad, Cebu City, Philippines',
        scanned_by_user_id: userId,
        notes: 'Package out for delivery with driver',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }
    ]

    const { data: insertedCheckpoints, error: checkpointError } = await supabase
      .from('addresses_shipment_tracking')
      .insert(checkpoints)
      .select()

    if (checkpointError) throw checkpointError

    console.log('\n✅ Tracking checkpoints created:')
    insertedCheckpoints.forEach((checkpoint, index) => {
      console.log(`\n   Checkpoint ${index + 1}: ${checkpoint.checkpoint_name}`)
      console.log(`   Status: ${checkpoint.status}`)
      console.log(`   Location: ${checkpoint.location_address}`)
      console.log(`   Coordinates: ${checkpoint.latitude.toFixed(4)}, ${checkpoint.longitude.toFixed(4)}`)
      console.log(`   Time: ${new Date(checkpoint.created_at).toLocaleString()}`)
      console.log(`   Notes: ${checkpoint.notes}`)
    })

    console.log('\n\n✨ Demo shipment setup complete!')
    console.log('\n📍 Route Summary:')
    console.log('   Start: Manila (14.5994°N, 120.9842°E)')
    console.log('   End: Cebu (10.3356°N, 123.9119°E)')
    console.log('   Distance: ~580 km (approx)')
    console.log('   Checkpoints: 5 tracking points')
    console.log('   Package Weight: 2.5 kg')
    console.log('\n🎯 You can now see this shipment in:')
    console.log('   - Shipping > Shipping tab (shipments list)')
    console.log('   - Shipping > Track Package tab (interactive map + tracking timeline)')
    console.log('   - Network Orders tab (if you create network orders)')

  } catch (error) {
    console.error('❌ Error creating demo shipment:', error.message)
    process.exit(1)
  }
}

createDemoShipment()

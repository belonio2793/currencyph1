import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addAllCoconutEquipment() {
  try {
    // Find the coconut project
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .ilike('name', '%coconut%')
      .single()

    if (projErr && projErr.code !== 'PGRST116') {
      console.error('Error fetching project:', projErr)
      return
    }

    let projectId = projects?.id
    if (!projectId) {
      console.log('No coconut project found. Creating one...')
      const { data: newProj, error: createErr } = await supabase
        .from('projects')
        .insert([{
          name: 'Coconut Oil & Water Processing Plant',
          description: 'Sustainable facility for coconut oil & bottled coconut water',
          project_type: 'agriculture',
          total_cost: 500000,
          currency_code: 'PHP',
          status: 'funding',
          min_investment: 1000
        }])
        .select()
        .single()

      if (createErr) {
        console.error('Error creating project:', createErr)
        return
      }

      projectId = newProj.id
      console.log('✓ Created project:', projectId)
    } else {
      console.log('✓ Found existing project:', projectId)
    }

    // Get or create supplier
    const { data: suppliers } = await supabase
      .from('project_suppliers')
      .select('id')
      .eq('project_id', projectId)
      .single()

    let supplierId = suppliers?.id
    if (!supplierId) {
      const { data: newSupp } = await supabase
        .from('project_suppliers')
        .insert([{
          project_id: projectId,
          supplier_name: 'Equipment Suppliers',
          supplier_type: 'equipment',
          contact_person: 'Sales Department',
          email: 'info@suppliers.com',
          phone: '+63 2 1234 5678',
          city: 'Metro Manila',
          country: 'Philippines',
          delivery_timeline_days: 30,
          is_primary: true
        }])
        .select()
        .single()

      supplierId = newSupp?.id
      console.log('✓ Created supplier:', supplierId)
    }

    // Define all equipment from the user's list
    const equipment = [
      {
        equipment_name: 'Dehusking Machine',
        equipment_type: 'processing',
        quantity: 1,
        unit_cost_usd: 6000,
        capacity_value: 100,
        capacity_unit: 'pcs/hour',
        material_of_construction: 'Metal',
        notes: 'Capacity 100pcs per hour'
      },
      {
        equipment_name: 'Deshelling Machine',
        equipment_type: 'processing',
        quantity: 1,
        unit_cost_usd: 7000,
        material_of_construction: 'Metal',
        notes: 'For coconut processing'
      },
      {
        equipment_name: 'Peeling Machine',
        equipment_type: 'processing',
        quantity: 1,
        unit_cost_usd: 0,
        material_of_construction: 'Metal',
        notes: 'Unit cost to be confirmed'
      },
      {
        equipment_name: 'Washing Machine',
        equipment_type: 'processing',
        quantity: 1,
        unit_cost_usd: 8000,
        capacity_value: 1,
        capacity_unit: 'T/h',
        material_of_construction: 'SUS 304',
        length_mm: 600,
        height_mm: 1800,
        power_consumption_kw: 1.5,
        notes: 'Size F600*1800mm'
      },
      {
        equipment_name: 'Grinding Machine',
        equipment_type: 'processing',
        quantity: 1,
        unit_cost_usd: 8000,
        capacity_value: 1000,
        capacity_unit: 'kg/h',
        material_of_construction: 'SUS 304',
        length_mm: 1240,
        width_mm: 930,
        height_mm: 1800,
        power_consumption_kw: 5.5,
        notes: 'Size 1240*930*1800mm'
      },
      {
        equipment_name: 'Squeezing Machine',
        equipment_type: 'processing',
        quantity: 1,
        unit_cost_usd: 6000,
        capacity_value: 500,
        capacity_unit: 'kg/h',
        notes: 'Capacity 500kg/h'
      },
      {
        equipment_name: 'Dual Tank Filters',
        equipment_type: 'filtration',
        quantity: 1,
        unit_cost_usd: 800,
        capacity_value: 1,
        capacity_unit: 't/h',
        notes: 'Dual tank system, capacity 1t/h'
      },
      {
        equipment_name: 'Screw Pump',
        equipment_type: 'pumping',
        quantity: 1,
        unit_cost_usd: 3800,
        material_of_construction: 'Metal',
        notes: 'High capacity pump'
      },
      {
        equipment_name: 'Refrigeration Type Milk Storage Tank',
        equipment_type: 'storage',
        quantity: 1,
        unit_cost_usd: 5000,
        capacity_value: 1000,
        capacity_unit: 'L',
        material_of_construction: 'SUS304',
        length_mm: 800,
        height_mm: 1300,
        power_consumption_kw: 1.1,
        notes: 'Size 800X1300MM, with refrigeration'
      },
      {
        equipment_name: 'Sugar Dissolving Tank',
        equipment_type: 'storage',
        quantity: 1,
        unit_cost_usd: 1680,
        capacity_value: 200,
        capacity_unit: 'L',
        material_of_construction: 'SUS304',
        notes: 'Volume 300L'
      },
      {
        equipment_name: 'Mixing Tank',
        equipment_type: 'storage',
        quantity: 1,
        unit_cost_usd: 2600,
        capacity_value: 300,
        capacity_unit: 'L',
        material_of_construction: 'SUS304',
        length_mm: 700,
        height_mm: 1300,
        power_consumption_kw: 0.55,
        notes: 'Size 700X1300MM'
      },
      {
        equipment_name: 'Milk Pump',
        equipment_type: 'pumping',
        quantity: 4,
        unit_cost_usd: 300,
        capacity_value: 1,
        capacity_unit: 'T/H',
        material_of_construction: 'SUS304',
        notes: 'Flow 1TPH, quantity 4'
      },
      {
        equipment_name: 'Filter',
        equipment_type: 'filtration',
        quantity: 1,
        unit_cost_usd: 300,
        capacity_value: 1,
        capacity_unit: 'T/H',
        material_of_construction: 'SUS304',
        notes: 'Flow 1TPH'
      },
      {
        equipment_name: 'Holding Storage Tank',
        equipment_type: 'storage',
        quantity: 1,
        unit_cost_usd: 1050,
        capacity_value: 200,
        capacity_unit: 'L',
        material_of_construction: 'SUS304',
        notes: 'Capacity 200L'
      },
      {
        equipment_name: 'Homogenizer',
        equipment_type: 'processing',
        quantity: 1,
        unit_cost_usd: 3150,
        capacity_value: 0.2,
        capacity_unit: 'T/h',
        power_consumption_kw: 5.5,
        material_of_construction: 'SUS304',
        length_mm: 900,
        width_mm: 550,
        height_mm: 1000,
        notes: 'Working pressure 25Mpa, Size 900X550X1000MM'
      },
      {
        equipment_name: 'UHT Concentrator',
        equipment_type: 'processing',
        quantity: 1,
        unit_cost_usd: 25800,
        capacity_value: 500,
        capacity_unit: 'L/hour',
        material_of_construction: 'SUS 304',
        notes: 'Sterilization temperature 105-143 degrees, Holding time 4-15 seconds'
      },
      {
        equipment_name: 'Coconut Milk Filling Machine',
        equipment_type: 'packaging',
        quantity: 1,
        unit_cost_usd: 0,
        notes: 'Status: To be confirmed'
      },
      {
        equipment_name: 'Pipes, Valves, and Accessories',
        equipment_type: 'accessories',
        quantity: 1,
        unit_cost_usd: 6000,
        material_of_construction: 'DN25',
        notes: 'Complete piping system with fittings'
      }
    ]

    console.log(`\n⚙️  Adding ${equipment.length} equipment items...`)

    // First, delete existing equipment to avoid duplicates
    const { data: existingEq } = await supabase
      .from('project_equipment')
      .select('id')
      .eq('project_id', projectId)

    if (existingEq && existingEq.length > 0) {
      console.log(`Found ${existingEq.length} existing equipment items, replacing...`)
      for (const eq of existingEq) {
        await supabase.from('project_equipment').delete().eq('id', eq.id)
      }
    }

    // Insert all equipment
    const equipmentWithProject = equipment.map(eq => ({
      ...eq,
      project_id: projectId,
      supplier_id: supplierId
    }))

    const { data: insertedEquipment, error: insertErr } = await supabase
      .from('project_equipment')
      .insert(equipmentWithProject)
      .select()

    if (insertErr) {
      console.error('Error inserting equipment:', insertErr)
      return
    }

    console.log(`✓ Successfully added ${insertedEquipment.length} equipment items`)

    // Calculate total equipment cost
    const totalCost = equipment.reduce((sum, eq) => sum + (eq.unit_cost_usd * eq.quantity), 0)
    console.log(`\n💰 Total Equipment Cost: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)

    // Display summary
    console.log('\n📊 Equipment Summary:')
    equipment.forEach((eq, idx) => {
      const totalForItem = (eq.unit_cost_usd * eq.quantity).toFixed(2)
      console.log(`  ${idx + 1}. ${eq.equipment_name} - Qty: ${eq.quantity}, Cost: $${totalForItem}`)
    })

    console.log('\n✅ All equipment has been successfully added to the project!')
  } catch (error) {
    console.error('Error:', error)
  }
}

addAllCoconutEquipment()

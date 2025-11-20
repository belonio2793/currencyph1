import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function seedHydrogenWaterProject() {
  try {
    // First, check if a hydrogen water project exists
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .ilike('name', '%hydrogen%water%')
      .single()

    if (projErr && projErr.code !== 'PGRST116') {
      console.error('Error fetching project:', projErr)
      return
    }

    const projectId = projects?.id
    if (!projectId) {
      console.log('No hydrogen water project found. Creating one...')
      const projectData = {
        name: 'Hydrogen-Infused Mineral Water Processing Facility',
        description: 'Ultra-Pure, Carbon-Filtered, Hydrogen-Infused Deep Well Water - A Zero-Plastic, Next-Generation Beverage & Household Water Solution'
      }

      // Try inserting with extended fields first
      let { data: newProj, error: createErr } = await supabase
        .from('projects')
        .insert([{
          ...projectData,
          long_description: `HYDROGEN-INFUSED MINERAL WATER FACILITY
Ultra-Pure, Carbon-Filtered, Hydrogen-Infused Deep Well Water
A Zero-Plastic, Next-Generation Beverage & Household Water Solution

This is not a traditional water plant. This is a next-generation, high-margin water production ecosystem powered by deep-well extraction, advanced mineral enhancement, carbon filtration, and therapeutic hydrogen infusion.

The result: The cleanest, healthiest, highest-value water product in the Philippines.

Safe for drinking, cooking, shower systems, sinks, toilets, entire households, and high-end commercial clients.

TECHNOLOGY FEATURES:
✔ Zero-plastic
✔ Zero-waste
✔ No RO rejection water
✔ Long-term sustainable
✔ Higher-margin than bottled water
✔ Healthier than any competing product

OPERATIONAL CAPACITY:
Daily Processing: 70,000–100,000 liters/day (expandable to 150,000 L/day)
Facility Size: 150–250 sqm
System Configuration: Closed-loop stainless steel (SUS 304/SUS 316)`,
          project_type: 'water_processing',
          total_cost: 180000,
          currency_code: 'USD',
          status: 'funding',
          min_investment: 1000
        }])
        .select()
        .single()

      // If extended fields don't exist, try basic fields
      if (createErr && createErr.message.includes('column')) {
        console.log('Extended fields not available, using basic fields...')
        const { data: basicProj, error: basicErr } = await supabase
          .from('projects')
          .insert([projectData])
          .select()
          .single()

        if (basicErr) {
          console.error('Error creating project:', basicErr)
          return
        }
        newProj = basicProj
      } else if (createErr) {
        console.error('Error creating project:', createErr)
        return
      }

      console.log('Created project:', newProj.id)
      await seedDetails(newProj.id)
    } else {
      console.log('Using existing project:', projectId)
      await seedDetails(projectId)
    }

  } catch (error) {
    console.error('Seed error:', error)
  }
}

async function seedDetails(projectId) {
  console.log('\n📦 Seeding project suppliers...')
  const suppliers = [
    {
      project_id: projectId,
      supplier_name: 'Premium Water Technologies Inc.',
      supplier_type: 'equipment',
      contact_person: 'Sales Department',
      email: 'sales@premiumwater.com',
      phone: '+63 2 8123 4567',
      address: 'Innovation Park, Metro Manila',
      city: 'Manila',
      country: 'Philippines',
      payment_terms: '30% down payment, 70% upon completion',
      delivery_timeline_days: 45,
      warranty_months: 24,
      is_primary: true
    }
  ]

  const { data: suppData } = await supabase.from('project_suppliers').insert(suppliers).select()
  const supplierId = suppData?.[0]?.id
  console.log(`✓ Added ${suppliers.length} supplier(s)`)

  console.log('\n⚙️ Seeding equipment...')
  const equipment = [
    { name: 'Deep Well Pump & Submersible System', type: 'pumping', qty: 1, capacity: 100, unit: 'L/h', power: 7.5, cost: 15000, specs: 'SUS 304 submersible pump' },
    { name: 'Carbon Block Filtration System', type: 'processing', qty: 1, capacity: 5, unit: 'T/h', power: 2.2, cost: 18000, specs: 'Multi-stage carbon block, SUS 304' },
    { name: 'Sediment & Membrane Filtration', type: 'processing', qty: 1, capacity: 5, unit: 'T/h', power: 1.5, cost: 16000, specs: 'High-precision 0.2μ membranes' },
    { name: 'Mineral Enhancement Media Tank', type: 'storage', qty: 1, capacity: 500, unit: 'L', power: 0.75, cost: 8000, specs: 'SUS 304, mineral media reactor' },
    { name: 'UV-C Sterilization System', type: 'processing', qty: 1, capacity: 100, unit: 'L/h', power: 2, cost: 12000, specs: 'UV-C chamber, SUS 304' },
    { name: 'Hydrogen Infusion Generator (Electrolysis)', type: 'processing', qty: 1, capacity: 50, unit: 'L/h', power: 5, cost: 25000, specs: 'Electrolysis-based, includes control system' },
    { name: 'Stainless Steel Storage Tank 1000L', type: 'storage', qty: 2, capacity: 1000, unit: 'L', power: 1.1, cost: 8000, specs: 'SUS 304, 1200×1500mm, closed-loop' },
    { name: 'Stainless Steel Storage Tank 500L', type: 'storage', qty: 2, capacity: 500, unit: 'L', power: 0.75, cost: 5000, specs: 'SUS 304, premium insulation' },
    { name: 'High-Precision Water Quality Monitor', type: 'processing', qty: 2, capacity: null, unit: null, power: 0.5, cost: 4000, specs: 'Real-time TDS, pH, ORP monitoring' },
    { name: 'Stainless Steel Bottling/Refill System', type: 'filling', qty: 1, capacity: 300, unit: 'L/h', power: 3, cost: 22000, specs: 'Semi-automatic, SUS 304, variable capacity' },
    { name: 'Water Delivery Tanker System', type: 'accessories', qty: 1, capacity: 5000, unit: 'L', power: null, cost: 10000, specs: 'Stainless steel tank, food-grade' },
    { name: 'Control & Automation System', type: 'accessories', qty: 1, capacity: null, unit: null, power: 2, cost: 9000, specs: 'PLC-based system with remote monitoring' }
  ]

  const equipmentInserts = equipment.map(eq => ({
    project_id: projectId,
    supplier_id: supplierId,
    equipment_name: eq.name,
    equipment_type: eq.type,
    quantity: eq.qty,
    unit_cost_usd: eq.cost,
    capacity_value: eq.capacity,
    capacity_unit: eq.unit,
    power_consumption_kw: eq.power,
    material_of_construction: eq.specs.includes('SUS') ? 'SUS 304' : eq.specs,
    installation_days: 21,
    installation_cost_usd: eq.cost * 0.12,
    lead_time_days: 45
  }))

  const { data: eqpData } = await supabase.from('project_equipment').insert(equipmentInserts).select()
  console.log(`✓ Added ${equipmentInserts.length} equipment items`)

  console.log('\n💰 Seeding project costs...')
  const costs = [
    { category: 'equipment', budgeted: 80000, percent: 44.4 },
    { category: 'hydrogen_infusion_systems', budgeted: 25000, percent: 13.9 },
    { category: 'stainless_steel_tanks', budgeted: 20000, percent: 11.1 },
    { category: 'deep_well_piping', budgeted: 10000, percent: 5.6 },
    { category: 'construction_facility', budgeted: 30000, percent: 16.7 },
    { category: 'delivery_vehicle', budgeted: 10000, percent: 5.6 },
    { category: 'working_capital', budgeted: 5000, percent: 2.8 }
  ]

  const costInserts = costs.map(c => ({
    project_id: projectId,
    cost_category: c.category,
    budgeted_amount_usd: c.budgeted,
    percentage_of_total: c.percent
  }))

  await supabase.from('project_costs').insert(costInserts).select()
  console.log(`✓ Added ${costInserts.length} cost categories`)

  console.log('\n📈 Seeding production capacity...')
  const capacities = [
    {
      project_id: projectId,
      phase_name: 'Phase 1 - Commissioning',
      product_type: 'hydrogen_water',
      capacity_per_hour: 3000,
      capacity_per_day: 72000,
      capacity_per_month: 2160000,
      capacity_per_year: 25920000,
      capacity_unit: 'L',
      utilization_percentage: 60,
      phase_start_date: new Date(new Date().getFullYear(), new Date().getMonth() + 4, 1).toISOString().split('T')[0]
    },
    {
      project_id: projectId,
      phase_name: 'Phase 2 - Full Production',
      product_type: 'hydrogen_water',
      capacity_per_hour: 4000,
      capacity_per_day: 96000,
      capacity_per_month: 2880000,
      capacity_per_year: 34560000,
      capacity_unit: 'L',
      utilization_percentage: 85,
      phase_start_date: new Date(new Date().getFullYear() + 1, new Date().getMonth() + 2, 1).toISOString().split('T')[0]
    }
  ]

  await supabase.from('production_capacity').insert(capacities).select()
  console.log(`✓ Added ${capacities.length} production phases`)

  console.log('\n💵 Seeding revenue projections...')
  const revenues = [
    { year: 1, product: 'hydrogen_drinking_water', volume: 360000, unit: 'L', price: 0.7 },
    { year: 1, product: 'mineral_water', volume: 450000, unit: 'L', price: 0.4 },
    { year: 1, product: 'home_systems', volume: 120, unit: 'units', price: 1250 },
    { year: 1, product: 'commercial_systems', volume: 30, unit: 'units', price: 5000 },
    { year: 1, product: 'shower_units', volume: 300, unit: 'units', price: 115 },
    { year: 1, product: 'bulk_delivery', volume: 200000, unit: 'L', price: 0.3 },
    { year: 2, product: 'hydrogen_drinking_water', volume: 480000, unit: 'L', price: 0.75 },
    { year: 2, product: 'mineral_water', volume: 600000, unit: 'L', price: 0.42 },
    { year: 2, product: 'home_systems', volume: 180, unit: 'units', price: 1250 },
    { year: 3, product: 'hydrogen_drinking_water', volume: 540000, unit: 'L', price: 0.8 },
    { year: 3, product: 'mineral_water', volume: 700000, unit: 'L', price: 0.45 },
    { year: 4, product: 'hydrogen_drinking_water', volume: 600000, unit: 'L', price: 0.85 },
    { year: 5, product: 'hydrogen_drinking_water', volume: 650000, unit: 'L', price: 0.9 }
  ]

  const revInserts = revenues.map(r => ({
    project_id: projectId,
    product_type: r.product,
    projected_annual_volume: r.volume,
    volume_unit: r.unit,
    unit_price_usd: r.price,
    year_number: r.year,
    scenario: 'moderate'
  }))

  await supabase.from('revenue_projections').insert(revInserts).select()
  console.log(`✓ Added ${revInserts.length} revenue projections`)

  console.log('\n🎯 Seeding project milestones...')
  const milestones = [
    { name: 'Secure Funding', type: 'funding', planned: new Date().toISOString().split('T')[0], status: 'in_progress', progress: 20 },
    { name: 'Deep Well Drilling & Testing', type: 'construction', planned: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0], status: 'planned', progress: 0 },
    { name: 'Equipment Procurement', type: 'procurement', planned: new Date(new Date().setDate(new Date().getDate() + 60)).toISOString().split('T')[0], status: 'planned', progress: 0 },
    { name: 'Facility Construction', type: 'construction', planned: new Date(new Date().setDate(new Date().getDate() + 90)).toISOString().split('T')[0], status: 'planned', progress: 0 },
    { name: 'Equipment Installation & Integration', type: 'installation', planned: new Date(new Date().setDate(new Date().getDate() + 150)).toISOString().split('T')[0], status: 'planned', progress: 0 },
    { name: 'Hydrogen System Calibration', type: 'testing', planned: new Date(new Date().setDate(new Date().getDate() + 180)).toISOString().split('T')[0], status: 'planned', progress: 0 },
    { name: 'Quality Testing & Certification', type: 'quality', planned: new Date(new Date().setDate(new Date().getDate() + 210)).toISOString().split('T')[0], status: 'planned', progress: 0 },
    { name: 'Commercial Production Launch', type: 'production', planned: new Date(new Date().setDate(new Date().getDate() + 240)).toISOString().split('T')[0], status: 'planned', progress: 0 }
  ]

  const mileInserts = milestones.map((m, i) => ({
    project_id: projectId,
    milestone_name: m.name,
    milestone_type: m.type,
    planned_date: m.planned,
    status: m.status,
    progress_percentage: m.progress,
    description: `${m.name} - Phase of the hydrogen-infused mineral water facility establishment`,
    deliverables: m.type === 'funding' ? 'Secure $180,000 in total project funding' : `Complete ${m.name.toLowerCase()}`
  }))

  await supabase.from('project_milestones').insert(mileInserts).select()
  console.log(`✓ Added ${mileInserts.length} milestones`)

  console.log('\n⚠️ Seeding risk assessment...')
  const risks = [
    { category: 'supply', desc: 'Deep water table sustainability and water quality consistency', prob: 30, severity: 'high', mitigation: 'Comprehensive water testing; redundant well system; water storage capacity' },
    { category: 'market', desc: 'Market education needed for hydrogen water benefits', prob: 40, severity: 'medium', mitigation: 'Strategic marketing; partnerships with health clinics and fitness centers; demo programs' },
    { category: 'regulatory', desc: 'Changing water quality standards and certifications', prob: 35, severity: 'high', mitigation: 'Regular compliance audits; certifications from DOH and DENR; in-house lab testing' },
    { category: 'operational', desc: 'Equipment downtime or hydrogen system maintenance', prob: 25, severity: 'medium', mitigation: 'Preventive maintenance program; backup hydrogen generator; spare parts inventory' },
    { category: 'financial', desc: 'Cost overruns in construction or equipment installation', prob: 35, severity: 'medium', mitigation: 'Fixed-price contracts with suppliers; contingency reserve (5.6% of budget); milestone-based payments' },
    { category: 'competition', desc: 'Competition from bottled water and RO system providers', prob: 50, severity: 'medium', mitigation: 'Premium product positioning; zero-waste marketing; subscription models for systems' }
  ]

  const riskInserts = risks.map(r => ({
    project_id: projectId,
    risk_category: r.category,
    risk_description: r.desc,
    probability_percentage: r.prob,
    impact_severity: r.severity,
    mitigation_strategy: r.mitigation
  }))

  await supabase.from('risk_assessment').insert(riskInserts).select()
  console.log(`✓ Added ${riskInserts.length} risks`)

  console.log('\n📊 Seeding financial metrics...')
  const metrics = [
    { name: 'breakeven_analysis', type: 'timeline', base: 25, conservative: 32, optimistic: 18, unit: 'months' },
    { name: 'roi_5_year', type: 'return', base: 177, conservative: 145, optimistic: 210, unit: '%' },
    { name: 'payback_period', type: 'timeline', base: 2.4, conservative: 2.7, optimistic: 2.1, unit: 'years' },
    { name: 'capex_total', type: 'cost', base: 180000, conservative: 200000, optimistic: 165000, unit: 'USD' },
    { name: 'annual_opex_yr1', type: 'cost', base: 120000, conservative: 130000, optimistic: 110000, unit: 'USD' },
    { name: 'daily_profit_yr1', type: 'revenue', base: 450, conservative: 350, optimistic: 550, unit: 'USD' },
    { name: 'year1_revenue', type: 'revenue', base: 420000, conservative: 380000, optimistic: 480000, unit: 'USD' }
  ]

  const metricInserts = metrics.map(m => ({
    project_id: projectId,
    metric_name: m.name,
    metric_type: m.type,
    base_case_value: m.base,
    conservative_case_value: m.conservative,
    optimistic_case_value: m.optimistic,
    unit_of_measure: m.unit,
    assumptions: 'Based on hydrogen water market projections (10%+ annual growth through 2030), Philippines water infrastructure demand, and stainless steel equipment specifications'
  }))

  await supabase.from('financial_metrics').insert(metricInserts).select()
  console.log(`✓ Added ${metricInserts.length} financial metrics`)

  console.log('\n✅ All data seeded successfully!')
}

seedHydrogenWaterProject().catch(console.error)

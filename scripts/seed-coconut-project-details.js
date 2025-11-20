import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function seedCoconutProjectDetails() {
  try {
    // First, check if a coconut project exists
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .ilike('name', '%coconut%')
      .single()

    if (projErr && projErr.code !== 'PGRST116') {
      console.error('Error fetching project:', projErr)
      return
    }

    const projectId = projects?.id
    if (!projectId) {
      console.log('No coconut project found. Creating one...')
      const { data: newProj, error: createErr } = await supabase
        .from('projects')
        .insert([{
          name: 'Coconut Oil & Water Processing Plant',
          description: 'State-of-the-art 500L/hour coconut milk processing facility with equipment from GENYOND Machinery Industrial Group',
          project_type: 'agriculture',
          total_cost: 120000,
          currency_code: 'USD',
          status: 'funding',
          min_investment: 1000
        }])
        .select()
        .single()

      if (createErr) {
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
      supplier_name: 'GENYOND MACHINERY INDUSTRIAL GROUP LIMITED',
      supplier_type: 'equipment',
      contact_person: 'Sales Department',
      email: 'info@genyond.com',
      phone: '+86 21 51602610',
      address: 'No.1328, Hengnan Road, Shanghai, China',
      city: 'Shanghai',
      country: 'China',
      payment_terms: '30% down payment, 70% before shipment',
      delivery_timeline_days: 55,
      warranty_months: 12,
      is_primary: true
    }
  ]

  const { data: suppData } = await supabase.from('project_suppliers').insert(suppliers).select()
  const supplierId = suppData?.[0]?.id
  console.log(`✓ Added ${suppliers.length} supplier(s)`)

  console.log('\n⚙️ Seeding equipment...')
  const equipment = [
    { name: 'Dehusking Machine', type: 'processing', qty: 1, capacity: 100, unit: 'pcs/hour', power: 1.5, cost: 6000, specs: 'SUS 304' },
    { name: 'Deshelling Machine', type: 'processing', qty: 1, capacity: null, unit: null, power: null, cost: 7000, specs: 'SUS 304' },
    { name: 'Washing Machine', type: 'processing', qty: 1, capacity: 1, unit: 'T/h', power: null, cost: 8000, specs: 'SUS 304' },
    { name: 'Grinding Machine', type: 'processing', qty: 1, capacity: 1000, unit: 'kg/h', power: 5.5, cost: 8000, specs: 'SUS 304, 1240×930×1800mm' },
    { name: 'Squeezing Machine', type: 'processing', qty: 1, capacity: 500, unit: 'kg/h', power: 30, cost: 6000, specs: 'SUS 304, 3000×880×2000mm' },
    { name: 'Dual Tank Filters', type: 'processing', qty: 1, capacity: 1, unit: 'T/h', power: 5.5, cost: 800, specs: 'SUS 304, 1800×800×1500mm' },
    { name: 'Screw Pump', type: 'pumping', qty: 1, capacity: null, unit: null, power: null, cost: 3800, specs: 'SUS 304' },
    { name: 'Refrigeration Storage Tank', type: 'storage', qty: 1, capacity: 1000, unit: 'L', power: 1.1, cost: 5000, specs: 'SUS304, 800×1300mm, heat preservation' },
    { name: 'Sugar Dissolving Tank', type: 'storage', qty: 1, capacity: 200, unit: 'L', power: null, cost: 1680, specs: 'SUS304' },
    { name: 'Mixing Tank', type: 'storage', qty: 1, capacity: 300, unit: 'L', power: 0.55, cost: 2600, specs: 'SUS304, 700×1300mm, heating 18kw' },
    { name: 'Milk Pump', type: 'pumping', qty: 4, capacity: 1, unit: 'T/H', power: null, cost: 300, specs: 'SUS 304, φ25' },
    { name: 'Filter', type: 'processing', qty: 1, capacity: 1, unit: 'T/H', power: null, cost: 300, specs: 'SUS 304, φ25' },
    { name: 'Holding Storage Tank', type: 'storage', qty: 1, capacity: 200, unit: 'L', power: null, cost: 1050, specs: 'SUS304' },
    { name: 'Homogenizer', type: 'processing', qty: 1, capacity: 0.2, unit: 'T/h', power: 5.5, cost: 3150, specs: 'SUS 304, 25Mpa, 900×550��1000mm' },
    { name: 'UHT (Sterilizer)', type: 'processing', qty: 1, capacity: 500, unit: 'L/hour', power: null, cost: 25800, specs: 'SUS 304, 105-143°C' },
    { name: 'Pipes, Valves & Accessories', type: 'accessories', qty: 1, capacity: null, unit: null, power: null, cost: 6000, specs: 'DN25' }
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
    installation_days: 28,
    installation_cost_usd: eq.cost * 0.15,
    lead_time_days: 55
  }))

  const { data: eqpData } = await supabase.from('project_equipment').insert(equipmentInserts).select()
  console.log(`✓ Added ${equipmentInserts.length} equipment items`)

  console.log('\n💰 Seeding project costs...')
  const costs = [
    { category: 'equipment', budgeted: 94130, percent: 78.4 },
    { category: 'installation', budgeted: 14120, percent: 11.8 },
    { category: 'permits_licenses', budgeted: 3000, percent: 2.5 },
    { category: 'working_capital', budgeted: 5000, percent: 4.2 },
    { category: 'contingency', budgeted: 3750, percent: 3.1 }
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
      phase_name: 'Phase 1 - Operational',
      product_type: 'coconut_milk',
      capacity_per_hour: 500,
      capacity_per_day: 4000,
      capacity_per_month: 88000,
      capacity_per_year: 1056000,
      capacity_unit: 'L',
      utilization_percentage: 70,
      phase_start_date: new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1).toISOString().split('T')[0]
    },
    {
      project_id: projectId,
      phase_name: 'Phase 2 - Full Scale',
      product_type: 'coconut_milk',
      capacity_per_hour: 500,
      capacity_per_day: 4000,
      capacity_per_month: 88000,
      capacity_per_year: 1056000,
      capacity_unit: 'L',
      utilization_percentage: 90,
      phase_start_date: new Date(new Date().getFullYear() + 1, new Date().getMonth(), 1).toISOString().split('T')[0]
    }
  ]

  await supabase.from('production_capacity').insert(capacities).select()
  console.log(`✓ Added ${capacities.length} production phases`)

  console.log('\n💵 Seeding revenue projections...')
  const revenues = [
    { year: 1, product: 'coconut_milk', volume: 740000, unit: 'L', price: 2.5 },
    { year: 2, product: 'coconut_milk', volume: 950000, unit: 'L', price: 2.5 },
    { year: 3, product: 'coconut_milk', volume: 1056000, unit: 'L', price: 2.6 },
    { year: 4, product: 'coconut_water', volume: 150000, unit: 'L', price: 1.8 },
    { year: 5, product: 'coir_fiber', volume: 80000, unit: 'kg', price: 0.35 }
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
    { name: 'Secure Funding', type: 'funding', planned: new Date().toISOString().split('T')[0], status: 'in_progress', progress: 25 },
    { name: 'Equipment Procurement', type: 'procurement', planned: new Date(new Date().setDate(new Date().getDate() + 60)).toISOString().split('T')[0], status: 'planned', progress: 0 },
    { name: 'Site Preparation', type: 'installation', planned: new Date(new Date().setDate(new Date().getDate() + 120)).toISOString().split('T')[0], status: 'planned', progress: 0 },
    { name: 'Equipment Installation', type: 'installation', planned: new Date(new Date().setDate(new Date().getDate() + 180)).toISOString().split('T')[0], status: 'planned', progress: 0 },
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
    description: `${m.name} - Phase of the coconut processing plant establishment`,
    deliverables: m.type === 'funding' ? 'Secure $120,000 in total project funding' : `Complete ${m.name.toLowerCase()}`
  }))

  await supabase.from('project_milestones').insert(mileInserts).select()
  console.log(`✓ Added ${mileInserts.length} milestones`)

  console.log('\n⚠️ Seeding risk assessment...')
  const risks = [
    { category: 'supply', desc: 'Coconut supply volatility due to weather conditions', prob: 60, severity: 'high', mitigation: 'Secure long-term contracts with farmer cooperatives; build buffer inventory' },
    { category: 'price', desc: 'Fluctuating coconut oil prices in global market', prob: 75, severity: 'high', mitigation: 'Price hedging strategy; diversify product portfolio' },
    { category: 'market', desc: 'Export market competition and certification requirements', prob: 40, severity: 'medium', mitigation: 'Invest in quality assurance; obtain organic/export certifications' },
    { category: 'operational', desc: 'Equipment downtime or performance issues', prob: 30, severity: 'medium', mitigation: 'Preventive maintenance program; spare parts inventory' },
    { category: 'financial', desc: 'Delayed funding or cost overruns', prob: 45, severity: 'medium', mitigation: 'Strict project cost controls; contingency reserve (3.1% of budget)' }
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
    { name: 'breakeven_analysis', type: 'timeline', base: 18, conservative: 24, optimistic: 12, unit: 'months' },
    { name: 'roi_5_year', type: 'return', base: 185, conservative: 120, optimistic: 250, unit: '%' },
    { name: 'capex_total', type: 'cost', base: 120000, conservative: 140000, optimistic: 110000, unit: 'USD' },
    { name: 'annual_opex_yr1', type: 'cost', base: 45000, conservative: 55000, optimistic: 40000, unit: 'USD' }
  ]

  const metricInserts = metrics.map(m => ({
    project_id: projectId,
    metric_name: m.name,
    metric_type: m.type,
    base_case_value: m.base,
    conservative_case_value: m.conservative,
    optimistic_case_value: m.optimistic,
    unit_of_measure: m.unit,
    assumptions: 'Based on Philippine Coconut Industry Roadmap 2021-2040 and GENYOND equipment specifications'
  }))

  await supabase.from('financial_metrics').insert(metricInserts).select()
  console.log(`✓ Added ${metricInserts.length} financial metrics`)

  console.log('\n✅ All data seeded successfully!')
}

seedCoconutProjectDetails().catch(console.error)

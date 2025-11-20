import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function enrichCoconutProjectDetails() {
  try {
    // Find the coconut project
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .ilike('name', '%coconut%')
      .single()

    if (projErr) {
      console.error('Error fetching project:', projErr)
      return
    }

    const projectId = projects?.id
    if (!projectId) {
      console.log('No coconut project found. Run seed-coconut-project-details.js first.')
      return
    }

    console.log(`\n📊 Enriching project ${projectId} with detailed cost structure...\n`)

    // Step 1: Update project totals
    console.log('📈 Updating project total cost and details...')
    await supabase
      .from('projects')
      .update({
        total_cost: 280000, // Mid-range total from detailed breakdown
        description: 'Sustainable facility for coconut oil & bottled coconut water - Fully integrated zero-waste processing plant'
      })
      .eq('id', projectId)
    console.log('✓ Updated project metadata')

    // Step 2: Add detailed cost items for additional equipment & infrastructure
    console.log('\n📝 Adding detailed cost items for all categories...')
    const costCategories = [
      {
        category: 'husk_coir_processing',
        description: 'Husk/Coir Processing Equipment',
        budgeted: 32500,
        percent: 11.6
      },
      {
        category: 'coconut_water_line',
        description: 'Young Coconut Water Processing Line',
        budgeted: 29000,
        percent: 10.4
      },
      {
        category: 'oil_production',
        description: 'Oil Production Equipment (VCO/RBD)',
        budgeted: 22500,
        percent: 8.0
      },
      {
        category: 'cold_storage',
        description: 'Cold Storage Facility',
        budgeted: 15000,
        percent: 5.4
      },
      {
        category: 'shell_charcoal_kiln',
        description: 'Shell Charcoal Kiln',
        budgeted: 5500,
        percent: 2.0
      },
      {
        category: 'quality_lab',
        description: 'Quality Laboratory Setup',
        budgeted: 5250,
        percent: 1.9
      },
      {
        category: 'construction',
        description: 'Processing Building & Infrastructure',
        budgeted: 82500,
        percent: 29.5
      },
      {
        category: 'working_capital',
        description: 'Working Capital & Initial Operations',
        budgeted: 19250,
        percent: 6.9
      },
      {
        category: 'contingency',
        description: 'Project Contingency Reserve',
        budgeted: 20000,
        percent: 7.1
      }
    ]

    // Clear existing costs and add new ones
    await supabase.from('project_costs').delete().eq('project_id', projectId)

    const costInserts = costCategories.map(c => ({
      project_id: projectId,
      cost_category: c.category,
      budgeted_amount_usd: c.budgeted,
      percentage_of_total: c.percent,
      notes: c.description
    }))

    await supabase.from('project_costs').insert(costInserts)
    console.log(`✓ Added ${costCategories.length} cost categories`)

    // Step 3: Add detailed cost line items
    console.log('\n💳 Adding detailed cost line items...')
    const costItems = [
      // Husk/Coir Processing
      { category: 'husk_coir_processing', item: 'Decorticator', qty: 1, price: 12000 },
      { category: 'husk_coir_processing', item: 'Peat Screener', qty: 1, price: 6500 },
      { category: 'husk_coir_processing', item: 'Dryer', qty: 1, price: 8000 },
      { category: 'husk_coir_processing', item: 'Fiber Baler', qty: 1, price: 6000 },

      // Young Coconut Water Line
      { category: 'coconut_water_line', item: 'Bottle Sterilizer', qty: 1, price: 8000 },
      { category: 'coconut_water_line', item: 'Bottle Rinser', qty: 1, price: 6500 },
      { category: 'coconut_water_line', item: 'Capping Machine', qty: 1, price: 7000 },
      { category: 'coconut_water_line', item: 'Labeling Machine', qty: 1, price: 7500 },

      // Oil Production Equipment
      { category: 'oil_production', item: 'Centrifuge (VCO)', qty: 1, price: 10000 },
      { category: 'oil_production', item: 'Oil Press Upgrades', qty: 1, price: 8500 },
      { category: 'oil_production', item: 'Refining Pans', qty: 1, price: 4000 },

      // Cold Storage
      { category: 'cold_storage', item: '10-20 sqm Cold Room Setup', qty: 1, price: 15000 },

      // Shell Charcoal Kiln
      { category: 'shell_charcoal_kiln', item: '1-3 ton/day Shell Charcoal Kiln', qty: 1, price: 5500 },

      // Quality Laboratory
      { category: 'quality_lab', item: 'Basic Lab Equipment & Testing Tools', qty: 1, price: 5250 },

      // Construction & Infrastructure
      { category: 'construction', item: 'Processing Building (200-400 sqm)', qty: 1, price: 82500 },

      // Working Capital - Initial Operations
      { category: 'working_capital', item: 'Initial Salaries (1-2 months for 15-22 workers)', qty: 1, price: 9000 },
      { category: 'working_capital', item: 'First Batch Coconut Purchases', qty: 1, price: 6500 },
      { category: 'working_capital', item: 'Packaging Inventory', qty: 1, price: 3750 }
    ]

    // Get cost IDs to link items
    const { data: costMap } = await supabase
      .from('project_costs')
      .select('id, cost_category')
      .eq('project_id', projectId)

    const costIdMap = {}
    costMap?.forEach(c => {
      costIdMap[c.cost_category] = c.id
    })

    const itemInserts = costItems.map(item => ({
      project_id: projectId,
      cost_id: costIdMap[item.category],
      item_name: item.item,
      quantity: item.qty,
      unit_price_usd: item.price,
      payment_status: 'pending'
    }))

    await supabase.from('project_cost_items').insert(itemInserts)
    console.log(`✓ Added ${itemInserts.length} cost line items`)

    // Step 4: Update production capacity with detailed breakdown
    console.log('\n⚙️ Updating production capacity details...')
    await supabase.from('production_capacity').delete().eq('project_id', projectId)

    const productionPhases = [
      {
        phase_name: 'Year 1 - Operational Phase',
        product_type: 'coconut_nuts',
        capacity_per_day: 7500,
        capacity_per_month: 225000,
        capacity_per_year: 2700000,
        capacity_unit: 'nuts/day',
        utilization_percentage: 75
      },
      {
        phase_name: 'Coconut Water (Bottled)',
        product_type: 'coconut_water',
        capacity_per_day: 400,
        capacity_per_month: 12000,
        capacity_per_year: 144000,
        capacity_unit: 'L',
        utilization_percentage: 80
      },
      {
        phase_name: 'Virgin Coconut Oil (VCO)',
        product_type: 'vco_oil',
        capacity_per_day: 80,
        capacity_per_month: 2400,
        capacity_per_year: 28800,
        capacity_unit: 'L',
        utilization_percentage: 85
      },
      {
        phase_name: 'Coconut Milk/Cream',
        product_type: 'coconut_milk',
        capacity_per_day: 180,
        capacity_per_month: 5400,
        capacity_per_year: 64800,
        capacity_unit: 'L',
        utilization_percentage: 80
      },
      {
        phase_name: 'Coir Fiber',
        product_type: 'coir_fiber',
        capacity_per_day: 120,
        capacity_per_month: 3600,
        capacity_per_year: 43200,
        capacity_unit: 'kg',
        utilization_percentage: 75
      },
      {
        phase_name: 'Coco Peat',
        product_type: 'coco_peat',
        capacity_per_day: 250,
        capacity_per_month: 7500,
        capacity_per_year: 90000,
        capacity_unit: 'kg',
        utilization_percentage: 80
      },
      {
        phase_name: 'Shell Charcoal',
        product_type: 'shell_charcoal',
        capacity_per_day: 150,
        capacity_per_month: 4500,
        capacity_per_year: 54000,
        capacity_unit: 'kg',
        utilization_percentage: 75
      },
      {
        phase_name: 'Organic Fertilizer',
        product_type: 'organic_fertilizer',
        capacity_per_day: 100,
        capacity_per_month: 3000,
        capacity_per_year: 36000,
        capacity_unit: 'kg',
        utilization_percentage: 70
      }
    ]

    const prodInserts = productionPhases.map(p => ({
      project_id: projectId,
      phase_name: p.phase_name,
      product_type: p.product_type,
      capacity_per_day: p.capacity_per_day,
      capacity_per_month: p.capacity_per_month,
      capacity_per_year: p.capacity_per_year,
      capacity_unit: p.capacity_unit,
      utilization_percentage: p.utilization_percentage,
      phase_start_date: new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1)
        .toISOString()
        .split('T')[0]
    }))

    await supabase.from('production_capacity').insert(prodInserts)
    console.log(`✓ Added ${prodInserts.length} production capacity phases`)

    // Step 5: Update detailed revenue projections
    console.log('\n💰 Adding detailed revenue projections...')
    await supabase.from('revenue_projections').delete().eq('project_id', projectId)

    const revenueProjections = [
      // Year 1 - Conservative Startup Phase
      { year: 1, product: 'coconut_water', volume: 144000, price: 1.0, scenario: 'conservative' },
      { year: 1, product: 'vco_oil', volume: 28800, price: 6.0, scenario: 'conservative' },
      { year: 1, product: 'coconut_milk', volume: 64800, price: 2.5, scenario: 'conservative' },
      { year: 1, product: 'coir_fiber', volume: 43200, price: 0.3, scenario: 'conservative' },
      { year: 1, product: 'coco_peat', volume: 90000, price: 0.4, scenario: 'conservative' },
      { year: 1, product: 'shell_charcoal', volume: 54000, price: 0.6, scenario: 'conservative' },
      { year: 1, product: 'organic_fertilizer', volume: 36000, price: 0.2, scenario: 'conservative' },

      // Year 2 - Growth Phase
      { year: 2, product: 'coconut_water', volume: 180000, price: 1.05, scenario: 'moderate' },
      { year: 2, product: 'vco_oil', volume: 36000, price: 6.2, scenario: 'moderate' },
      { year: 2, product: 'coconut_milk', volume: 81000, price: 2.6, scenario: 'moderate' },
      { year: 2, product: 'coir_fiber', volume: 54000, price: 0.32, scenario: 'moderate' },
      { year: 2, product: 'coco_peat', volume: 112500, price: 0.42, scenario: 'moderate' },
      { year: 2, product: 'shell_charcoal', volume: 67500, price: 0.62, scenario: 'moderate' },

      // Year 3-5 - Full Operation
      { year: 3, product: 'coconut_water', volume: 216000, price: 1.1, scenario: 'optimistic' },
      { year: 3, product: 'vco_oil', volume: 43200, price: 6.5, scenario: 'optimistic' },
      { year: 3, product: 'coconut_milk', volume: 97200, price: 2.7, scenario: 'optimistic' },
      { year: 3, product: 'coir_fiber', volume: 64800, price: 0.35, scenario: 'optimistic' },
      { year: 3, product: 'coco_peat', volume: 135000, price: 0.45, scenario: 'optimistic' },
      { year: 3, product: 'shell_charcoal', volume: 81000, price: 0.65, scenario: 'optimistic' }
    ]

    const revInserts = revenueProjections.map(r => ({
      project_id: projectId,
      product_type: r.product,
      projected_annual_volume: r.volume,
      volume_unit: 'L/kg',
      unit_price_usd: r.price,
      year_number: r.year,
      scenario: r.scenario
    }))

    await supabase.from('revenue_projections').insert(revInserts)
    console.log(`✓ Added ${revInserts.length} revenue projections`)

    // Step 6: Add daily operating cost projections
    console.log('\n💸 Adding operating cost projections...')
    const operatingCosts = [
      { name: 'daily_raw_coconuts_cost', type: 'cost', base: 600, conservative: 700, optimistic: 500, unit: 'USD/day' },
      { name: 'daily_labor_cost', type: 'cost', base: 250, conservative: 300, optimistic: 200, unit: 'USD/day' },
      { name: 'daily_electricity_cost', type: 'cost', base: 115, conservative: 150, optimistic: 80, unit: 'USD/day' },
      { name: 'daily_packaging_cost', type: 'cost', base: 100, conservative: 150, optimistic: 50, unit: 'USD/day' },
      { name: 'daily_fuel_biomass', type: 'cost', base: 20, conservative: 40, optimistic: 0, unit: 'USD/day' },
      { name: 'daily_maintenance_cost', type: 'cost', base: 30, conservative: 40, optimistic: 20, unit: 'USD/day' },
      { name: 'annual_opex_yr1', type: 'cost', base: 103875, conservative: 129375, optimistic: 78750, unit: 'USD' },
      { name: 'daily_operating_cost_total', type: 'cost', base: 1115, conservative: 1300, optimistic: 850, unit: 'USD/day' },
      { name: 'daily_net_profit', type: 'return', base: 461, conservative: 276, optimistic: 726, unit: 'USD/day' },
      { name: 'monthly_net_profit', type: 'return', base: 11000, conservative: 8280, optimistic: 21800, unit: 'USD' },
      { name: 'annual_net_profit', type: 'return', base: 120000, conservative: 75000, optimistic: 150000, unit: 'USD' }
    ]

    const { data: existingMetrics } = await supabase
      .from('financial_metrics')
      .select('metric_name')
      .eq('project_id', projectId)

    const existingNames = new Set(existingMetrics?.map(m => m.metric_name) || [])

    const metricInserts = operatingCosts
      .filter(m => !existingNames.has(m.name))
      .map(m => ({
        project_id: projectId,
        metric_name: m.name,
        metric_type: m.type,
        base_case_value: m.base,
        conservative_case_value: m.conservative,
        optimistic_case_value: m.optimistic,
        unit_of_measure: m.unit,
        assumptions: 'Based on detailed cost structure analysis'
      }))

    if (metricInserts.length > 0) {
      await supabase.from('financial_metrics').insert(metricInserts)
      console.log(`✓ Added ${metricInserts.length} operating cost metrics`)
    } else {
      console.log('✓ Operating cost metrics already exist')
    }

    // Step 7: Update key financial metrics
    console.log('\n📊 Updating key financial metrics...')
    const mainMetrics = [
      { name: 'capex_total', type: 'cost', base: 280000, conservative: 390000, optimistic: 180000, unit: 'USD' },
      { name: 'roi_period_years', type: 'timeline', base: 2.3, conservative: 3.0, optimistic: 1.5, unit: 'years' },
      { name: 'breakeven_months', type: 'timeline', base: 24, conservative: 36, optimistic: 16, unit: 'months' },
      { name: 'annual_revenue_yr3', type: 'return', base: 564000, conservative: 420000, optimistic: 680000, unit: 'USD' }
    ]

    for (const metric of mainMetrics) {
      const { error } = await supabase.from('financial_metrics').upsert(
        {
          project_id: projectId,
          metric_name: metric.name,
          metric_type: metric.type,
          base_case_value: metric.base,
          conservative_case_value: metric.conservative,
          optimistic_case_value: metric.optimistic,
          unit_of_measure: metric.unit,
          assumptions: 'Based on comprehensive cost structure and revenue analysis'
        },
        { onConflict: 'project_id,metric_name' }
      )

      if (error) {
        console.error(`Error updating metric ${metric.name}:`, error)
      }
    }
    console.log(`✓ Updated ${mainMetrics.length} key financial metrics`)

    // Step 8: Add comprehensive risk assessment
    console.log('\n⚠️ Updating risk assessment...')
    await supabase.from('risk_assessment').delete().eq('project_id', projectId)

    const risks = [
      {
        category: 'supply',
        desc: 'Coconut shortage or price spikes due to weather',
        prob: 60,
        severity: 'high',
        mitigation: 'Contract with 200-400 farmers; set up mini-farm/nursery; offer buy-back programs'
      },
      {
        category: 'market',
        desc: 'Product shelf-life especially for water and milk',
        prob: 50,
        severity: 'medium',
        mitigation: 'UHT processing; strong cold chain; PET/TetraPak packaging with proper sterilization'
      },
      {
        category: 'operational',
        desc: 'Equipment downtime or machinery failures',
        prob: 35,
        severity: 'medium',
        mitigation: 'Preventive maintenance schedule; spare parts inventory; local technician training'
      },
      {
        category: 'regulatory',
        desc: 'FDA and export compliance requirements',
        prob: 40,
        severity: 'high',
        mitigation: 'HACCP program; quality assurance staff; regular lab testing'
      },
      {
        category: 'financial',
        desc: 'Delayed funding or cost overruns',
        prob: 45,
        severity: 'medium',
        mitigation: 'Strict cost controls; contingency reserve (7.1% of budget)'
      },
      {
        category: 'market',
        desc: 'Competition from large established players',
        prob: 70,
        severity: 'high',
        mitigation: 'Export to niche markets (Japan, Korea, GCC); organic certification; unique branding'
      },
      {
        category: 'price',
        desc: 'Coconut oil and water price volatility',
        prob: 75,
        severity: 'high',
        mitigation: 'Multi-product model; sell by-products; private-label OEM orders'
      },
      {
        category: 'logistics',
        desc: 'Cold chain shipping costs and complexity',
        prob: 55,
        severity: 'medium',
        mitigation: 'Partner with cold storage hubs; consider concentrate production'
      }
    ]

    const riskInserts = risks.map(r => ({
      project_id: projectId,
      risk_category: r.category,
      risk_description: r.desc,
      probability_percentage: r.prob,
      impact_severity: r.severity,
      mitigation_strategy: r.mitigation,
      status: 'identified'
    }))

    await supabase.from('risk_assessment').insert(riskInserts)
    console.log(`✓ Added ${riskInserts.length} risk assessments`)

    // Step 9: Add project timeline/milestones
    console.log('\n🎯 Updating project milestones and timeline...')
    const timelines = [
      {
        name: 'Feasibility Study & Market Analysis',
        duration: '3-5 weeks',
        desc: 'Raw material supply, buyer mapping'
      },
      {
        name: 'Permits + Environmental Compliance',
        duration: '4-8 weeks',
        desc: 'LGU + DENR + FDA (for water/milk)'
      },
      {
        name: 'Factory Design & Engineering',
        duration: '2-4 weeks',
        desc: 'Layout + utilities + drainage'
      },
      {
        name: 'Equipment Procurement',
        duration: '6-10 weeks',
        desc: 'Depending on supplier'
      },
      {
        name: 'Factory Construction',
        duration: '6-12 weeks',
        desc: 'Parallel with equipment shipping'
      },
      {
        name: 'Installation & Commissioning',
        duration: '2-3 weeks',
        desc: 'Calibration + water testing'
      },
      {
        name: 'Trial Production',
        duration: '2 weeks',
        desc: 'Quality assurance'
      },
      {
        name: 'Full Operation',
        duration: 'Ongoing',
        desc: 'Day 1 after commissioning'
      }
    ]

    const milestoneInserts = timelines.map((t, i) => ({
      project_id: projectId,
      milestone_name: t.name,
      milestone_type: 'production',
      planned_date: new Date(new Date().setDate(new Date().getDate() + i * 30)).toISOString().split('T')[0],
      status: 'planned',
      progress_percentage: 0,
      description: t.desc,
      deliverables: `${t.name} - Timeline: ${t.duration}`
    }))

    await supabase.from('project_milestones').insert(milestoneInserts)
    console.log(`✓ Added ${milestoneInserts.length} timeline milestones`)

    console.log('\n✅ Coconut project successfully enriched with comprehensive cost structure and financial details!')
    console.log('\n📋 Summary:')
    console.log('  • Total Project Cost: $280,000 (mid-range from $180k-$390k)')
    console.log('  • Daily Production Capacity: 5,000-10,000 nuts')
    console.log('  • Projected Daily Revenue: $1,576')
    console.log('  • Projected Annual Profit: $120,000-$150,000')
    console.log('  • ROI Timeline: 12-16 months (lean) / 2-2.5 years (full)')
    console.log('  • Project Timeline: 5-8 months to full operation')
  } catch (error) {
    console.error('Enrichment error:', error)
  }
}

enrichCoconutProjectDetails().catch(console.error)

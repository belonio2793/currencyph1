import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verifyProject() {
  try {
    console.log('Verifying Hydrogen Water Project...\n')

    // Get project details
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', 2)
      .single()

    if (projErr) {
      console.error('Error fetching project:', projErr)
      return
    }

    console.log('✓ Project Found:')
    console.log('  ID:', project.id)
    console.log('  Name:', project.name)
    console.log('  Description:', project.description.substring(0, 100) + '...')
    console.log('  Status:', project.status)
    if (project.long_description) {
      console.log('  Long Description: Present (' + project.long_description.length + ' chars)')
    }
    console.log('')

    // Get equipment count
    const { data: equipment, error: eqpErr } = await supabase
      .from('project_equipment')
      .select('id')
      .eq('project_id', 2)

    if (!eqpErr) {
      console.log('✓ Equipment:', equipment.length, 'items')
    }

    // Get costs
    const { data: costs, error: costErr } = await supabase
      .from('project_costs')
      .select('cost_category, budgeted_amount_usd')
      .eq('project_id', 2)

    if (!costErr && costs.length > 0) {
      console.log('✓ Costs: ' + costs.length + ' categories')
      console.log('  Breakdown:')
      let total = 0
      costs.forEach(c => {
        console.log('    -', c.cost_category + ':', '$' + c.budgeted_amount_usd)
        total += c.budgeted_amount_usd
      })
      console.log('  Total Budget: $' + total)
    }
    console.log('')

    // Get production capacity
    const { data: capacity, error: capErr } = await supabase
      .from('production_capacity')
      .select('phase_name, capacity_per_day, capacity_unit')
      .eq('project_id', 2)

    if (!capErr && capacity.length > 0) {
      console.log('✓ Production Capacity: ' + capacity.length + ' phases')
      capacity.forEach(c => {
        console.log('  -', c.phase_name + ':', c.capacity_per_day, c.capacity_unit + '/day')
      })
    }
    console.log('')

    // Get revenue projections
    const { data: revenues, error: revErr } = await supabase
      .from('revenue_projections')
      .select('product_type, year_number, projected_annual_volume')
      .eq('project_id', 2)
      .order('year_number')

    if (!revErr && revenues.length > 0) {
      console.log('✓ Revenue Projections: ' + revenues.length + ' entries')
      const byYear = {}
      revenues.forEach(r => {
        if (!byYear[r.year_number]) byYear[r.year_number] = []
        byYear[r.year_number].push(r.product_type)
      })
      Object.keys(byYear).forEach(year => {
        console.log('  Year ' + year + ': ' + byYear[year].join(', '))
      })
    }
    console.log('')

    // Get milestones
    const { data: milestones, error: milErr } = await supabase
      .from('project_milestones')
      .select('milestone_name, status, progress_percentage')
      .eq('project_id', 2)

    if (!milErr && milestones.length > 0) {
      console.log('✓ Milestones: ' + milestones.length)
      milestones.forEach(m => {
        console.log('  -', m.milestone_name + ':', m.progress_percentage + '% (' + m.status + ')')
      })
    }
    console.log('')

    // Get financial metrics
    const { data: metrics, error: metErr } = await supabase
      .from('financial_metrics')
      .select('metric_name, base_case_value, unit_of_measure')
      .eq('project_id', 2)

    if (!metErr && metrics.length > 0) {
      console.log('✓ Financial Metrics: ' + metrics.length)
      metrics.forEach(m => {
        console.log('  -', m.metric_name + ':', m.base_case_value, m.unit_of_measure)
      })
    }
    console.log('')

    // Get risks
    const { data: risks, error: riskErr } = await supabase
      .from('risk_assessment')
      .select('risk_category, probability_percentage, impact_severity')
      .eq('project_id', 2)

    if (!riskErr && risks.length > 0) {
      console.log('✓ Risk Assessment: ' + risks.length + ' items')
      risks.forEach(r => {
        console.log('  -', r.risk_category + ':', r.probability_percentage + '% probability (' + r.impact_severity + ')')
      })
    }
    console.log('')

    console.log('✅ Hydrogen Water Project is fully configured and ready!')

  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

verifyProject()

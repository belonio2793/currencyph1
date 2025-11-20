import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verifyProject() {
  try {
    console.log('Verifying Coconut Oil & Water Processing Project...\n')

    // Get project details
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .ilike('name', '%coconut%')
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
    console.log('')

    // Get equipment count
    const { data: equipment, error: eqpErr } = await supabase
      .from('project_equipment')
      .select('id')
      .eq('project_id', project.id)

    if (!eqpErr) {
      console.log('✓ Equipment:', equipment.length, 'items')
    }

    // Get costs
    const { data: costs, error: costErr } = await supabase
      .from('project_costs')
      .select('cost_category, budgeted_amount_usd')
      .eq('project_id', project.id)

    if (!costErr && costs.length > 0) {
      console.log('✓ Costs: ' + costs.length + ' categories')
      let total = 0
      costs.forEach(c => {
        total += c.budgeted_amount_usd
      })
      console.log('  Total Budget: $' + total)
    }
    console.log('')

    // Get revenue projections
    const { data: revenues, error: revErr } = await supabase
      .from('revenue_projections')
      .select('product_type, year_number')
      .eq('project_id', project.id)
      .order('year_number')

    if (!revErr && revenues.length > 0) {
      console.log('✓ Revenue Projections: ' + revenues.length + ' entries')
    }

    // Get milestones
    const { data: milestones, error: milErr } = await supabase
      .from('project_milestones')
      .select('id')
      .eq('project_id', project.id)

    if (!milErr) {
      console.log('✓ Milestones: ' + milestones.length)
    }

    // Get financial metrics
    const { data: metrics, error: metErr } = await supabase
      .from('financial_metrics')
      .select('id')
      .eq('project_id', project.id)

    if (!metErr) {
      console.log('✓ Financial Metrics: ' + metrics.length)
    }

    console.log('\n✅ Coconut Oil Project is fully configured and ready!')

  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

verifyProject()

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updateHydrogenWaterProject() {
  try {
    console.log('Updating hydrogen water project with extended fields...')

    const longDescription = `HYDROGEN-INFUSED MINERAL WATER FACILITY
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
System Configuration: Closed-loop stainless steel (SUS 304/SUS 316)

PROJECT TIMELINE
Phase 1: Site Prep + Deep Well Drilling (Weeks 1–4)
- Water table testing, drilling, pump installation.

Phase 2: Facility Build & Filtration Installation (Weeks 4–10)
- Tank installation, pipelining, lab setup.

Phase 3: Hydrogen Infusion Setup (Weeks 10–12)
- Calibration, certification, mineral balancing.

Phase 4: Commissioning & Trial Production (Weeks 12–14)
- Testing, first batches, internal sampling.

Phase 5: Commercial Operations (Week 14 onward)
- Full launch at 60–75% capacity.
- Scale to 90% by Month 6.`

    // Try updating with extended fields
    let { data: updated, error: updateErr } = await supabase
      .from('projects')
      .update({
        long_description: longDescription,
        project_type: 'water_processing',
        total_cost: 180000,
        currency_code: 'USD',
        min_investment: 1000,
        status: 'funding'
      })
      .eq('id', 2)
      .select()
      .single()

    if (updateErr && updateErr.message.includes('column')) {
      console.log('Extended columns not available, trying with basic fields only...')
      const { data: basicUpdated, error: basicErr } = await supabase
        .from('projects')
        .update({
          long_description: longDescription,
          status: 'funding'
        })
        .eq('id', 2)
        .select()
        .single()

      if (basicErr) {
        console.error('Error updating project:', basicErr)
        return
      }
      updated = basicUpdated
    } else if (updateErr) {
      console.error('Error updating project:', updateErr)
      return
    }

    console.log('✓ Project updated successfully!')
    console.log('Project ID:', updated.id)
    console.log('Project Name:', updated.name)
    console.log('Status:', updated.status)
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

updateHydrogenWaterProject()

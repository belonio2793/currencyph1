// Seed game property types and a sample property using Supabase client
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase env vars missing')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function seed() {
  try {
    const types = [
      { type: 'house', label: 'House', base_cost: 100 },
      { type: 'shop', label: 'Shop', base_cost: 250 },
      { type: 'factory', label: 'Factory', base_cost: 1000 }
    ]
    for (const t of types) {
      const { error } = await supabase.from('property_types').upsert([t])
      if (error) console.warn('upsert property_type failed', error)
    }

    // insert a sample property at origin owned by null (public)
    const { error: pErr } = await supabase.from('game_properties').insert([{ type: 'house', level: 0, x: 0, z: 0, placed: true }])
    if (pErr) console.warn('insert sample property failed', pErr)

    console.log('Seed completed')
  } catch (err) {
    console.error('Seed failed', err)
  }
}

seed()

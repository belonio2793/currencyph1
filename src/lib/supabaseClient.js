import { createClient } from '@supabase/supabase-js'

// Helper to read env both in browser (import.meta.env) and Node (process.env)
const getEnv = (name) => {
  try {
    // import.meta is available in Vite/browser builds
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) return import.meta.env[name]
  } catch (e) {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name]
  } catch (e) {
    // ignore
  }
  return undefined
}

const SUPABASE_URL = getEnv('VITE_PROJECT_URL') || getEnv('PROJECT_URL') || getEnv('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || ''

let supabase

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
} else {
  console.warn('Supabase not fully configured. SUPABASE_URL or SUPABASE_ANON_KEY is missing. Some features will be disabled.')
  const missingError = (method) => () => { throw new Error(`Supabase not configured. Called ${method} but SUPABASE_URL or SUPABASE_ANON_KEY is missing.`) }
  supabase = {
    from: () => ({ select: missingError('from().select'), insert: missingError('from().insert'), update: missingError('from().update'), upsert: missingError('from().upsert'), eq: missingError('from().eq'), order: missingError('from().order') }),
    auth: {
      signInWithPassword: missingError('auth.signInWithPassword'),
      signUp: missingError('auth.signUp'),
      getUser: async () => ({ data: { user: null }, error: null })
    },
    channel: (name) => ({
      // allow .on(...).subscribe() chaining
      on: () => ({ subscribe: missingError('channel().on().subscribe') }),
      // allow subscribe() directly
      subscribe: missingError('channel().subscribe')
    }),
    removeChannel: (c) => { /* noop when supabase not configured */ },
    rpc: missingError('rpc')
  }
}

export { supabase }

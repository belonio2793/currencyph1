import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixTestUser() {
  try {
    console.log('🔍 Looking for test user: guest@currency.ph')

    // Find user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()
    if (userError) {
      console.error('Failed to list users:', userError)
      return
    }

    const testUser = users.users.find(u => u.email === 'guest@currency.ph')
    if (!testUser) {
      console.error('❌ Test user guest@currency.ph not found')
      return
    }

    const userId = testUser.id
    console.log(`✅ Found user: ${userId}`)

    // 1. Check if onboarding state exists
    console.log('\n📋 Checking onboarding state...')
    const { data: onboardingState, error: stateError } = await supabase
      .from('user_onboarding_state')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (stateError && stateError.code === 'PGRST116') {
      console.log('⚠️  Onboarding state missing, creating...')
      const { error: insertError } = await supabase
        .from('user_onboarding_state')
        .insert({
          user_id: userId,
          email_verified: true,
          profile_complete: false,
          address_added: false,
          preferred_currency_set: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('❌ Failed to create onboarding state:', insertError)
      } else {
        console.log('✅ Onboarding state created')
      }
    } else if (onboardingState) {
      console.log('✅ Onboarding state exists')
    }

    // 2. Check if profile exists
    console.log('\n👤 Checking profile...')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (profileError && profileError.code === 'PGRST116') {
      console.log('⚠️  Profile missing, creating...')
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          full_name: 'Test User',
          email: 'guest@currency.ph',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('❌ Failed to create profile:', insertError)
      } else {
        console.log('✅ Profile created')
      }
    } else if (profile) {
      console.log('✅ Profile exists:', profile.full_name)
    }

    // 3. Check businesses
    console.log('\n🏢 Checking businesses...')
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', userId)

    if (businessError) {
      console.error('❌ Failed to load businesses:', businessError)
    } else {
      console.log(`✅ Found ${businesses.length} business(es)`)
      businesses.forEach((b, idx) => {
        console.log(`   ${idx + 1}. ${b.business_name} (${b.status})`)
      })
    }

    // 4. Check preferences
    console.log('\n⚙️  Checking user preferences...')
    const { data: prefs, error: prefError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (prefError && prefError.code === 'PGRST116') {
      console.log('⚠️  Preferences missing, creating...')
      const { error: insertError } = await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          preferred_currency: 'PHP',
          theme: 'light',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('❌ Failed to create preferences:', insertError)
      } else {
        console.log('✅ Preferences created')
      }
    } else if (prefs) {
      console.log('✅ Preferences exist, currency:', prefs.preferred_currency)
    }

    console.log('\n✅ Test user fixed and ready to use!')
  } catch (err) {
    console.error('Error:', err.message)
  }
}

fixTestUser()

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { identifier, password } = await req.json()

    // Validate inputs
    if (!identifier || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: identifier and password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client for searching users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Create anon client for sign-in
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || ''
    )

    // Search for user by any metadata field using the find_user_by_identifier function
    const { data: userMatch, error: searchError } = await supabaseAdmin
      .rpc('find_user_by_identifier', { identifier_input: identifier })

    if (searchError) {
      console.error('Error searching for user:', searchError)
      return new Response(
        JSON.stringify({ error: 'Failed to search for user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userMatch || userMatch.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User not found. Please check your identifier and try again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const user = userMatch[0]
    if (!user.email) {
      return new Response(
        JSON.stringify({ error: 'User found but email not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Attempt to sign in with the user's email and provided password
    const { data: sessionData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: user.email,
      password: password
    })

    if (signInError) {
      console.error('Sign-in error:', signInError.message)
      return new Response(
        JSON.stringify({ error: 'Invalid password. Please try again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!sessionData.session) {
      return new Response(
        JSON.stringify({ error: 'Sign-in succeeded but no session returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return complete session data
    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_in: sessionData.session.expires_in,
          expires_at: sessionData.session.expires_at,
          token_type: sessionData.session.token_type,
          user: {
            id: sessionData.user.id,
            email: sessionData.user.email,
            user_metadata: sessionData.user.user_metadata
          }
        },
        user: {
          id: user.user_id,
          email: user.email,
          full_name: user.full_name,
          username: user.username,
          nickname: user.nickname,
          phone_number: user.phone_number
        },
        message: 'Authentication successful'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Flexible auth function error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

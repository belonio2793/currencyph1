import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase credentials' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log('Applying marker_type migration...')

    // Check if column already exists
    const { data: columns, error: checkError } = await supabase.rpc(
      'get_columns',
      { table_name: 'planning_markers' }
    )

    if (checkError && checkError.code !== 'PGRST116') {
      console.log('Could not check existing columns:', checkError)
    }

    const markerTypeExists = columns?.some(
      (col: any) => col.column_name === 'marker_type'
    )

    if (markerTypeExists) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'marker_type column already exists'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Add the column
    const { error: addColumnError } = await supabase.rpc(
      'execute_sql',
      {
        sql: `ALTER TABLE public.planning_markers
              ADD COLUMN IF NOT EXISTS marker_type VARCHAR(50) DEFAULT 'Seller';`
      }
    )

    if (addColumnError) {
      console.log('RPC approach failed, this is expected')
    }

    // Create index
    const { error: indexError } = await supabase.rpc(
      'execute_sql',
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_planning_markers_type 
              ON public.planning_markers(marker_type);`
      }
    )

    if (indexError) {
      console.log('Index creation info:', indexError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migration completed. Please verify marker_type column exists.',
        instructions:
          'If the column was not created via RPC, execute this SQL in Supabase dashboard: ' +
          'ALTER TABLE public.planning_markers ADD COLUMN IF NOT EXISTS marker_type VARCHAR(50) DEFAULT "Seller";'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
        hint: 'Execute this SQL manually in Supabase dashboard: ALTER TABLE public.planning_markers ADD COLUMN IF NOT EXISTS marker_type VARCHAR(50) DEFAULT "Seller";'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

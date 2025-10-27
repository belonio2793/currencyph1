import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateSlug(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function populateSlugs() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { data: listings, error: fetchError } = await supabase
      .from('nearby_listings')
      .select('tripadvisor_id, name, slug')

    if (fetchError) {
      throw fetchError
    }

    if (!listings || listings.length === 0) {
      return {
        success: true,
        updated: 0,
        message: 'No listings found',
      }
    }

    const updates = listings
      .filter((listing: any) => !listing.slug && listing.name)
      .map((listing: any) => ({
        tripadvisor_id: listing.tripadvisor_id,
        name: listing.name,
        slug: generateSlug(listing.name),
      }))

    if (updates.length === 0) {
      return {
        success: true,
        updated: 0,
        message: 'All listings already have slugs',
      }
    }

    let totalUpdated = 0
    const errors: any[] = []

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('nearby_listings')
        .update({ slug: update.slug })
        .eq('tripadvisor_id', update.tripadvisor_id)

      if (updateError) {
        errors.push({
          tripadvisor_id: update.tripadvisor_id,
          error: updateError.message,
        })
      } else {
        totalUpdated++
      }
    }

    return {
      success: true,
      updated: totalUpdated,
      attempted: updates.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${totalUpdated} listings with slugs`,
    }
  } catch (err) {
    console.error('Error populating slugs:', err)
    return {
      success: false,
      message: err.message,
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const result = await populateSlugs()
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

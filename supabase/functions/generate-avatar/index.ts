import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const SUPABASE_URL = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('X_API_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in function env')
}

const supabase = createClient(SUPABASE_URL || '', SERVICE_ROLE_KEY || '');

async function callOpenAIImage(prompt: string) {
  // Use OpenAI Images API (gpt-image-1)
  const url = 'https://api.openai.com/v1/images/generations'
  const body = {
    prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json'
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error: ${res.status} ${text}`)
  }

  const data = await res.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('No image returned')
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return bytes
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

    const body = await req.json().catch(() => null)
    if (!body || !body.appearance) return new Response(JSON.stringify({ error: 'Missing appearance' }), { status: 400 })

    const { appearance, userId } = body

    // Use custom prompt if provided, otherwise build from appearance
    const prompt = body.prompt && typeof body.prompt === 'string' && body.prompt.trim().length > 0
      ? body.prompt.trim()
      : `A photorealistic full-body portrait of a ${appearance.gender} character, front-facing, neutral pose. Skin tone: ${appearance.skin_tone}. Height: ${appearance.height} cm. Build: ${appearance.build}. Hair style: ${appearance.hair_style}. Hair color: ${appearance.hair_color}. Clothing: simple neutral outfit. High-resolution, studio lighting, realistic skin texture, natural hair, professional photograph.`

    // Generate image
    const imageBytes = await callOpenAIImage(prompt)

    // Ensure 'avatars' bucket exists (service role)
    try {
      await supabase.storage.createBucket('avatars', { public: true })
    } catch (e) {
      // ignore if already exists
    }

    // Create path and upload to storage bucket 'avatars'
    const fileName = `avatar-${userId || 'guest'}-${Date.now()}.png`
    const path = `avatars/${fileName}`

    const { data, error } = await supabase.storage.from('avatars').upload(path, imageBytes, {
      contentType: 'image/png',
      upsert: true
    })

    if (error) {
      console.error('Storage upload error', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    const { publicUrl } = supabase.storage.from('avatars').getPublicUrl(path)

    return new Response(JSON.stringify({ url: publicUrl }), { status: 200 })
  } catch (err) {
    console.error('generate-avatar error', err)
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 })
  }
})

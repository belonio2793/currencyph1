export async function generatePhotorealAvatar(appearance, userId) {
  const PROJECT_URL = import.meta.env.VITE_PROJECT_URL || import.meta.env.VITE_SUPABASE_URL || ''
  const SERVICE_ROLE = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
  if (!PROJECT_URL) throw new Error('Missing PROJECT_URL env')
  const endpoint = `${PROJECT_URL.replace(/\/+$/,'')}/functions/v1/generate-avatar`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Supabase functions require an API key header; pass service role (admin) key from VITE env
      'apikey': SERVICE_ROLE
    },
    body: JSON.stringify({ appearance, userId })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error('Avatar generation failed: ' + text)
  }

  const data = await res.json()
  return data.url
}

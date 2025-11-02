/* CommonJS runner for migration script */
const fetch = require('node-fetch')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const SUPABASE_URL = process.env.PROJECT_URL || process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

async function ensureBucket(bucket) {
  try {
    const { data } = await supabase.storage.listBuckets()
    const exists = (data || []).find(b => b.name === bucket)
    if (!exists) {
      console.log('Creating bucket', bucket)
      const { error } = await supabase.storage.createBucket(bucket, { public: true })
      if (error) throw error
    }
  } catch (e) {
    console.error('Bucket check/create failed', e.message)
    throw e
  }
}

async function downloadToBuffer(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to download image: ' + res.status)
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (e) {
    console.warn('Download failed for', url, e.message)
    return null
  }
}

async function run() {
  const bucket = 'avatars'
  await ensureBucket(bucket)

  console.log('Fetching characters')
  const { data: chars, error } = await supabase.from('game_characters').select('*')
  if (error) throw error

  for (const c of chars) {
    const appearance = c.appearance || {}
    const rpmMeta = appearance.rpm_meta || (appearance.rpm && appearance.rpm.meta) || null
    const modelUrl = appearance.rpm_model_url || (appearance.rpm && appearance.rpm.model_url) || (rpmMeta && (rpmMeta.url || rpmMeta.avatarUrl)) || null
    const imageUrl = (rpmMeta && (rpmMeta.imageUrl || rpmMeta.thumbnail || rpmMeta.avatarUrl)) || null

    const newAppearance = { ...(appearance || {}) }
    newAppearance.rpm = {
      model_url: modelUrl || null,
      thumbnail: (appearance.rpm && appearance.rpm.thumbnail) || null,
      meta: rpmMeta || null
    }

    // extract some common fields
    newAppearance.hair_color = newAppearance.hair_color || (rpmMeta && (rpmMeta.hairColor || rpmMeta.hair_color)) || null
    newAppearance.skin_color = newAppearance.skin_color || (rpmMeta && (rpmMeta.skinColor || rpmMeta.skin_color)) || null
    newAppearance.height = newAppearance.height || appearance.height || 175
    newAppearance.build = newAppearance.build || appearance.build || 'average'

    // upload thumbnail if available and not already set
    if (imageUrl && !newAppearance.rpm.thumbnail) {
      try {
        const buf = await downloadToBuffer(imageUrl)
        if (buf) {
          const ext = 'png'
          const path = `${c.user_id || 'unknown'}/${c.id}-${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, { contentType: 'image/png' })
          if (upErr) {
            console.warn('Upload failed for', c.id, upErr.message)
          } else {
            const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path)
            newAppearance.rpm.thumbnail = publicData.publicUrl
            console.log('Uploaded thumbnail for', c.id)
          }
        }
      } catch (e) { console.warn('thumb handling failed', e.message) }
    }

    // write back
    try {
      const { error: upErr } = await supabase.from('game_characters').update({ appearance: newAppearance, updated_at: new Date() }).eq('id', c.id)
      if (upErr) {
        console.warn('Failed to update', c.id, upErr.message)
      } else {
        console.log('Updated appearance for', c.id)
      }
    } catch (e) {
      console.warn('Update exception for', c.id, e.message)
    }
  }

  console.log('Done')
}

run().catch(e => { console.error(e); process.exit(1) })

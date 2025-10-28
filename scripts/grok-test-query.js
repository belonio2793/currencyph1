import fetch from 'node-fetch'

const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY
const GROK_API_URL = process.env.GROK_API_URL || 'https://api.grok.ai/v1/search'

if (!X_API_KEY) {
  console.error('Missing X_API_KEY in env')
  process.exit(1)
}

const argv = process.argv.slice(2)
const query = argv.join(' ') || 'Aristocrat Manila TripAdvisor'

async function grokFindImages(query) {
  const prompt = `Find the TripAdvisor listing page for the query: "${query}" on tripadvisor.com.ph and return up to 5 direct high-resolution image URLs from the listing gallery. Respond with any text or JSON that includes the direct image links.`
  try {
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${X_API_KEY}` },
      body: JSON.stringify({ query: prompt })
    })
    console.log('Grok status', res.status)
    const text = await res.text()
    console.log('Grok raw response (first 2000 chars):\n', text.slice(0,2000))
    const m = text.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/gi) || []
    console.log('Extracted image URLs:', m.slice(0,5))
  } catch (err) {
    console.error('Grok request error:', err && err.message ? err.message : err)
  }
}

grokFindImages(query).then(() => process.exit(0))

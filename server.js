import express from 'express'
import fetch from 'node-fetch'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()
const PORT = process.env.API_PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Initialize Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// DIDIT environment variables
const DIDIT_API_KEY = process.env.DIDIT_API_KEY || process.env.VITE_DIDIT_API_KEY
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID || process.env.VITE_DIDIT_WORKFLOW_ID
const DIDIT_APP_ID = process.env.DIDIT_APP_ID || process.env.VITE_DIDIT_APP_ID

/**
 * POST /api/didit/create-session
 * Create a new DIDIT verification session
 */
app.post('/api/didit/create-session', async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    if (!DIDIT_API_KEY || !DIDIT_WORKFLOW_ID) {
      return res.status(500).json({
        error: 'Missing DIDIT configuration',
        missing: [
          !DIDIT_API_KEY && 'DIDIT_API_KEY',
          !DIDIT_WORKFLOW_ID && 'DIDIT_WORKFLOW_ID',
        ].filter(Boolean),
      })
    }

    // Call DIDIT API
    const diditBody = { workflow_id: DIDIT_WORKFLOW_ID }
    if (DIDIT_APP_ID) {
      diditBody.app_id = DIDIT_APP_ID
    }

    const diditResponse = await fetch('https://verification.didit.me/v2/session/', {
      method: 'POST',
      headers: {
        'x-api-key': DIDIT_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(diditBody),
    })

    if (!diditResponse.ok) {
      const errorText = await diditResponse.text()
      console.error('DIDIT API error:', diditResponse.status, errorText)
      return res.status(diditResponse.status).json({
        error: `DIDIT API returned ${diditResponse.status}`,
        details: errorText.slice(0, 500),
      })
    }

    const sessionData = await diditResponse.json()
    const { session_id, url: sessionUrl } = sessionData

    if (!session_id || !sessionUrl) {
      return res.status(500).json({
        error: 'Invalid DIDIT response: missing session_id or url',
      })
    }

    // Store in Supabase
    try {
      const { data, error } = await supabase
        .from('user_verifications')
        .upsert(
          {
            user_id: userId,
            id_type: 'national_id',  // Placeholder - will be updated from DIDIT webhook with actual document type
            id_number: session_id,   // Placeholder - will be updated from DIDIT webhook with actual ID number
            didit_workflow_id: DIDIT_WORKFLOW_ID,
            didit_session_id: session_id,
            didit_session_url: sessionUrl,
            status: 'pending',
            verification_method: 'didit',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single()

      if (error) {
        console.error('Database error:', error)
        // Still return session even if DB fails
        return res.json({
          success: true,
          sessionUrl,
          sessionId: session_id,
          data: null,
          warning: 'Session created but database storage failed',
        })
      }

      return res.json({
        success: true,
        sessionUrl,
        sessionId: session_id,
        data,
      })
    } catch (dbErr) {
      console.error('Database error:', dbErr)
      return res.json({
        success: true,
        sessionUrl,
        sessionId: session_id,
        data: null,
        warning: 'Session created but database storage failed',
      })
    }
  } catch (error) {
    console.error('Error creating DIDIT session:', error)
    res.status(500).json({
      error: 'Failed to create verification session',
      details: error.message,
    })
  }
})

/**
 * GET /api/didit/session-status/:sessionId
 * Check DIDIT session status
 */
app.get('/api/didit/session-status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' })
    }

    if (!DIDIT_API_KEY) {
      return res.status(500).json({ error: 'DIDIT_API_KEY not configured' })
    }

    const response = await fetch(
      `https://verification.didit.me/v2/session/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': DIDIT_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({
        error: `DIDIT API error: ${response.status}`,
        details: errorText.slice(0, 500),
      })
    }

    const data = await response.json()
    return res.json(data)
  } catch (error) {
    console.error('Error checking session status:', error)
    res.status(500).json({
      error: 'Failed to check session status',
      details: error.message,
    })
  }
})

/**
 * POST /api/didit/register-external
 * Register an external DIDIT session
 */
app.post('/api/didit/register-external', async (req, res) => {
  try {
    const { userId, sessionUrl } = req.body

    if (!userId || !sessionUrl) {
      return res.status(400).json({
        error: 'userId and sessionUrl are required',
      })
    }

    // Extract session ID from URL
    const sessionIdMatch = sessionUrl.match(/session\/([A-Za-z0-9_-]+)/i)
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : null

    const { data, error } = await supabase
      .from('user_verifications')
      .upsert(
        {
          user_id: userId,
          didit_session_id: sessionId,
          didit_session_url: sessionUrl,
          status: 'pending',
          verification_method: 'didit',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) {
      return res.status(500).json({
        error: 'Failed to register external session',
        details: error.message,
      })
    }

    return res.json({ success: true, data })
  } catch (error) {
    console.error('Error registering external session:', error)
    res.status(500).json({
      error: 'Failed to register external session',
      details: error.message,
    })
  }
})

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
  console.log(`DIDIT API Key configured: ${DIDIT_API_KEY ? 'yes' : 'no'}`)
  console.log(`DIDIT Workflow ID configured: ${DIDIT_WORKFLOW_ID ? 'yes' : 'no'}`)
  console.log(`Supabase URL configured: ${SUPABASE_URL ? 'yes' : 'no'}`)
})

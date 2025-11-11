import { supabase } from './supabaseClient'
import { encryptString, generateSymmetricKey, exportKeyToBase64 } from './crypto'

const DIDIT_API_KEY = import.meta.env.VITE_DIDIT_API_KEY
const DIDIT_APP_ID = import.meta.env.VITE_DIDIT_APP_ID
const DIDIT_API_BASE = 'https://api.didit.me/api/v1'

// Store encryption key in localStorage for consistent encryption/decryption
const ENCRYPTION_KEY_NAME = 'didit_encryption_key'

async function getOrCreateEncryptionKey() {
  const stored = localStorage.getItem(ENCRYPTION_KEY_NAME)
  
  if (stored) {
    // Import the stored key
    const binary = Uint8Array.from(atob(stored), c => c.charCodeAt(0))
    return await window.crypto.subtle.importKey(
      'raw',
      binary,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
  }
  
  // Generate new key and store it
  const key = await generateSymmetricKey()
  const exported = await exportKeyToBase64(key)
  localStorage.setItem(ENCRYPTION_KEY_NAME, exported)
  return key
}

async function encryptSensitiveData(data) {
  try {
    const key = await getOrCreateEncryptionKey()
    const encrypted = await encryptString(key, JSON.stringify(data))
    return encrypted
  } catch (error) {
    console.warn('Encryption failed, storing unencrypted:', error)
    return null
  }
}

export const diditService = {
  async submitVerification(userId, idType, idNumber, idImageUrl) {
    try {
      if (!DIDIT_API_KEY || !DIDIT_APP_ID) {
        throw new Error('DIDIT API credentials not configured')
      }

      // Call DIDIT API to submit ID for verification
      const diditResponse = await fetch(`${DIDIT_API_BASE}/verification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIDIT_API_KEY}`,
          'Content-Type': 'application/json',
          'X-App-Id': DIDIT_APP_ID
        },
        body: JSON.stringify({
          id_type: idType,
          id_number: idNumber,
          id_image_url: idImageUrl || null
        })
      })

      if (!diditResponse.ok) {
        const errorData = await diditResponse.json()
        throw new Error(`DIDIT API error: ${errorData.message || diditResponse.statusText}`)
      }

      const diditResult = await diditResponse.json()

      // Encrypt sensitive data before storing
      const sensitiveData = {
        id_number: idNumber,
        id_image_url: idImageUrl
      }
      const encrypted = await encryptSensitiveData(sensitiveData)

      // Store verification in database
      const { data, error } = await supabase
        .from('user_verifications')
        .upsert({
          user_id: userId,
          id_type: idType,
          id_number: encrypted ? encrypted.ciphertext : idNumber,
          id_image_url: encrypted ? `encrypted:${encrypted.iv}` : idImageUrl,
          status: diditResult.status || 'pending',
          verification_notes: JSON.stringify({
            didit_id: diditResult.id,
            didit_status: diditResult.status,
            confidence_score: diditResult.confidence_score,
            message: diditResult.message
          }),
          submitted_at: new Date(),
          updated_at: new Date()
        }, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        diditResult: {
          id: diditResult.id,
          status: diditResult.status,
          confidence_score: diditResult.confidence_score,
          message: diditResult.message
        }
      }
    } catch (error) {
      console.error('Error submitting verification to DIDIT:', error)
      throw error
    }
  },

  async getVerificationStatus(userId) {
    try {
      const { data, error } = await supabase
        .from('user_verifications')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error

      if (!data) return null

      // Parse verification notes from DIDIT
      let diditInfo = null
      if (data.verification_notes) {
        try {
          diditInfo = JSON.parse(data.verification_notes)
        } catch (e) {
          console.warn('Failed to parse verification notes:', e)
        }
      }

      return {
        ...data,
        diditInfo
      }
    } catch (error) {
      console.warn('Error fetching verification status:', error)
      return null
    }
  },

  async checkVerificationStatus(diditVerificationId) {
    try {
      if (!DIDIT_API_KEY || !DIDIT_APP_ID) {
        throw new Error('DIDIT API credentials not configured')
      }

      const response = await fetch(`${DIDIT_API_BASE}/verification/${diditVerificationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${DIDIT_API_KEY}`,
          'X-App-Id': DIDIT_APP_ID
        }
      })

      if (!response.ok) {
        throw new Error(`DIDIT API error: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error checking DIDIT verification status:', error)
      throw error
    }
  }
}

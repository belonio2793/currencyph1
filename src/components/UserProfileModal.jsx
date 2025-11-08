import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { p2pLoanService } from '../lib/p2pLoanService'

export default function UserProfileModal({ userId, onClose }) {
  const [profile, setProfile] = useState(null)
  const [verification, setVerification] = useState(null)
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, email, display_name, phone_number, created_at')
          .eq('id', userId)
          .single()
        if (userError) throw userError
        if (!mounted) return
        setProfile(user)

        const v = await p2pLoanService.getVerificationStatus(userId)
        if (mounted) setVerification(v)

        // Borrower ratings use the same table; fetch both lender and borrower reviews for this user
        try {
          const r = await p2pLoanService.getLenderRatings(userId)
          if (mounted) setRatings(r || [])
        } catch (e) {
          if (mounted) setRatings([])
        }
      } catch (err) {
        console.error('Error loading user profile', err)
        const msg = err && err.message ? err.message : JSON.stringify(err)
        if (mounted) setError(`Failed to load profile: ${msg}`)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [userId])

  if (!userId) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">User Profile</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="p-4">
          {loading && <p className="text-sm text-slate-600">Loading...</p>}
          {error && (
            <div className="mb-4">
              <p className="text-sm text-red-600">{error}</p>
              <button onClick={() => { setError(''); setLoading(true); (async ()=>{ try { const { data: user, error: userError } = await supabase.from('users').select('id, email, display_name, phone_number, created_at').eq('id', userId).single(); if (userError) throw userError; setProfile(user); const v = await p2pLoanService.getVerificationStatus(userId); setVerification(v); const r = await p2pLoanService.getLenderRatings(userId); setRatings(r || []); } catch (e) { setError(e && e.message ? e.message : JSON.stringify(e)); } finally { setLoading(false) } })() }} className="mt-2 px-3 py-1 bg-blue-600 text-white rounded">Retry</button>
            </div>
          )}

          {profile && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-600">Name</p>
                <p className="font-medium text-slate-900">{profile.display_name || profile.email}</p>
              </div>

              <div>
                <p className="text-xs text-slate-600">Phone</p>
                <p className="font-medium text-slate-900">{profile.phone_number ? (profile.phone_number.substring(0,3) + '****' + profile.phone_number.substring(profile.phone_number.length - 2)) : 'Not provided'}</p>
              </div>

              <div>
                <p className="text-xs text-slate-600">Member Since</p>
                <p className="font-medium text-slate-900">{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}</p>
              </div>

              <div>
                <p className="text-xs text-slate-600">Verification</p>
                <p className="font-medium text-slate-900">{verification && verification.status === 'approved' ? 'Verified' : (verification && verification.status === 'pending' ? 'Pending' : 'Not verified')}</p>
              </div>

              <div>
                <p className="text-xs text-slate-600">Recent Ratings</p>
                {ratings.length === 0 ? (
                  <p className="text-sm text-slate-600">No ratings yet</p>
                ) : (
                  <div className="space-y-2">
                    {ratings.slice(0,5).map(r => (
                      <div key={r.id} className="p-2 border border-slate-100 rounded">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map(i => (
                              <span key={i} className={i <= r.rating_score ? 'text-yellow-500' : 'text-slate-300'}>★</span>
                            ))}
                          </div>
                          <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        {r.review && <p className="text-sm text-slate-700 mt-1">{r.review}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

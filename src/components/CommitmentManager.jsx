import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import CommitmentForm from './CommitmentForm'
import CommitmentCalculator from './CommitmentCalculator'
import Auth from './Auth'

export default function CommitmentManager() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [authError, setAuthError] = useState('')
  const [commitmentProfile, setCommitmentProfile] = useState(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [activeTab, setActiveTab] = useState('profile') // 'profile' or 'commitments'

  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [])

  // Subscribe to auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setIsAuthenticated(true)
          setUserId(session.user.id)
          setUserEmail(session.user.email)
          loadCommitmentProfile(session.user.id)
        } else {
          setIsAuthenticated(false)
          setUserId(null)
          setUserEmail(null)
          setCommitmentProfile(null)
        }
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error

      if (user) {
        setIsAuthenticated(true)
        setUserId(user.id)
        setUserEmail(user.email)
        loadCommitmentProfile(user.id)
      } else {
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setAuthError(error.message)
    }
  }

  const loadCommitmentProfile = async (uid) => {
    try {
      setIsLoadingProfile(true)
      const { data, error } = await supabase
        .from('commitment_profiles')
        .select('*')
        .eq('user_id', uid)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is fine for new users
        throw error
      }

      setCommitmentProfile(data || null)
      // If profile exists, switch to commitments tab
      if (data) {
        setActiveTab('commitments')
      }
    } catch (error) {
      console.error('Load profile error:', error)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const handleProfileComplete = (profile) => {
    setCommitmentProfile(profile)
    setActiveTab('commitments')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">🥥 Partnership Network</h1>
            <p className="text-lg text-gray-600">
              Commit to the coconut ecosystem and build partnerships
            </p>
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {authError}
            </div>
          )}

          <Auth onAuthSuccess={checkAuth} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
            <span className="text-5xl">🥥</span>
            <span>Partnership Network</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Interactive commitment interface for collaborating with the coconut ecosystem.
            Sign commitments, calculate costs, and earn affiliate commissions.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Signed in as: <strong>{userEmail}</strong>
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-300">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'profile'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            My Profile
          </button>
          <button
            onClick={() => setActiveTab('commitments')}
            disabled={!commitmentProfile}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'commitments'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : commitmentProfile
                  ? 'text-gray-600 hover:text-gray-800'
                  : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            My Commitments
          </button>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {activeTab === 'profile' && (
            <CommitmentForm
              userId={userId}
              onProfileComplete={handleProfileComplete}
              initialData={commitmentProfile}
            />
          )}

          {activeTab === 'commitments' && commitmentProfile && (
            <CommitmentCalculator
              userId={userId}
              profileId={commitmentProfile.id}
            />
          )}

          {activeTab === 'commitments' && !commitmentProfile && !isLoadingProfile && (
            <div className="bg-white rounded-lg shadow-md p-12 border border-gray-200 text-center">
              <p className="text-gray-600 text-lg mb-4">
                Complete your business profile first to add commitments.
              </p>
              <button
                onClick={() => setActiveTab('profile')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg"
              >
                Go to Profile
              </button>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="font-bold text-gray-800 mb-2">Simple & Flexible</h3>
            <p className="text-sm text-gray-600">
              No obligations. Add or remove commitments anytime. People come and go easily.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="font-bold text-gray-800 mb-2">Transparent Costs</h3>
            <p className="text-sm text-gray-600">
              Real-time calculations for delivery, handling, shipping, and more.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <div className="text-3xl mb-3">🤝</div>
            <h3 className="font-bold text-gray-800 mb-2">Earn Commissions</h3>
            <p className="text-sm text-gray-600">
              50% recurring commissions for affiliates as part of contractual agreements.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-16 bg-white rounded-lg p-8 border border-gray-200 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-blue-600">
                1
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Create Profile</h4>
              <p className="text-sm text-gray-600">
                Fill in your business details and contact information
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-blue-600">
                2
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Add Commitments</h4>
              <p className="text-sm text-gray-600">
                Enter what you can commit to (coconuts, equipment, labor, etc.)
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-blue-600">
                3
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Calculate Costs</h4>
              <p className="text-sm text-gray-600">
                See real-time calculations for delivery, handling, and more
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-blue-600">
                4
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Collaborate</h4>
              <p className="text-sm text-gray-600">
                Team up with partners and earn affiliate commissions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

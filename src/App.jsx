import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { wisegcashAPI } from './lib/wisegcashAPI'
import backgroundSync from './lib/backgroundSync'
import { populateSlugsForListings } from './lib/slugUtils'
import Navbar from './components/Navbar'
import HeaderMap from './components/HeaderMap'
import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
import Wallet from './components/Wallet'
import SendMoney from './components/SendMoney'
import Investments from './components/Investments'
import BillPayments from './components/BillPayments'
import TransactionHistoryNew from './components/TransactionHistoryNew'
import Profile from './components/Profile'
import Auth from './components/Auth'
import Nearby from './components/Nearby'
import Business from './components/Business'
import ListingDetail from './components/ListingDetail'
import Network from './components/Network'

export default function App() {
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [globalCurrency, setGlobalCurrency] = useState('PHP')
  const [showAuth, setShowAuth] = useState(false)
  const [currentBusinessId, setCurrentBusinessId] = useState(null)
  const [currentListingSlug, setCurrentListingSlug] = useState(null)


  useEffect(() => {
    initializeUser()
    handleRouting()

    // Populate slugs for listings if needed (one-time operation)
    populateSlugsForListings(supabase).catch((err) => {
      console.warn('Could not populate slugs:', err)
    })

    // Start background sync for TripAdvisor listings only when explicitly enabled
    // Set ENABLE_BACKGROUND_SYNC (Vite: VITE_ENABLE_BACKGROUND_SYNC=true) to enable background sync
    const enableBackgroundSync = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_BACKGROUND_SYNC === 'true') || (typeof process !== 'undefined' && process.env && process.env.ENABLE_BACKGROUND_SYNC === 'true')
    if (enableBackgroundSync) {
      backgroundSync.start(24) // Sync every 24 hours
    }

    window.addEventListener('popstate', handleRouting)
    window.addEventListener('hashchange', handleRouting)
    return () => {
      window.removeEventListener('popstate', handleRouting)
      window.removeEventListener('hashchange', handleRouting)
      backgroundSync.stop()
    }
  }, [])

  const handleRouting = () => {
    const path = window.location.pathname
    const hash = window.location.hash

    if (path === '/login' || path === '/register') {
      setShowAuth(true)
    } else {
      setShowAuth(false)
    }

    // Redirect legacy admin route to home
    if (path === '/admin') {
      window.history.replaceState(null, '', '/')
      setActiveTab('home')
      setShowAuth(false)
    }

    // Redirect /community to /nearby
    if (path === '/community') {
      window.history.replaceState(null, '', '/nearby?view=community')
      setActiveTab('nearby')
      setShowAuth(false)
    }

    // Handle listing detail routes via hash
    if (hash.startsWith('#/listing/')) {
      const slug = hash.replace('#/listing/', '')
      setCurrentListingSlug(slug)
      setActiveTab('listing')
    }

    // Handle listing detail routes via pathname
    if (path.startsWith('/nearby/') && path !== '/nearby') {
      const slug = path.replace('/nearby/', '')
      setCurrentListingSlug(slug)
      setActiveTab('listing')
    }
  }

  const initializeUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUserId(user.id)
        setUserEmail(user.email)
        await wisegcashAPI.getOrCreateUser(user.email, user.user_metadata?.full_name || 'User')
        setShowAuth(false)
        window.history.replaceState(null, '', '/')
      } else {
        const testEmail = `test-${Math.random().toString(36).substring(7)}@currency.local`
        const testUser = await wisegcashAPI.getOrCreateUser(testEmail, 'Test User')
        setUserId(testUser.id)
        setUserEmail(testEmail)
      }
    } catch (err) {
      console.error('Error initializing user:', err)
      setError('Failed to initialize application')
    } finally {
      setLoading(false)
    }
  }

  const handleAuthSuccess = async (user) => {
    setUserId(user.id)
    setUserEmail(user.email)
    await wisegcashAPI.getOrCreateUser(user.email, user.user_metadata?.full_name || 'User')
    setShowAuth(false)
    window.history.replaceState(null, '', '/')
    setActiveTab('home')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl font-light text-slate-900 mb-4">currency.ph</div>
          <p className="text-slate-500 text-sm tracking-wide">Loading...</p>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-slate-50">
      <HeaderMap />
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} globalCurrency={globalCurrency} setGlobalCurrency={setGlobalCurrency} />

      {/* User Status Bar */}
      {activeTab !== 'home' && (
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-slate-500 tracking-wide">
              <span className="text-slate-400">Account:</span> {userEmail}
            </p>
            <button
              onClick={() => setActiveTab('home')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-b border-red-100">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main>
        {(activeTab === 'home' || showAuth) && (
          <>
            {!showAuth && <LandingPage userId={userId} userEmail={userEmail} globalCurrency={globalCurrency} />}
          </>
        )}
        {showAuth ? (
          <Auth onAuthSuccess={handleAuthSuccess} />
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard userId={userId} onNavigate={setActiveTab} />}
            {activeTab === 'wallet' && <Wallet userId={userId} />}
            {activeTab === 'send' && <SendMoney userId={userId} />}
            {activeTab === 'investments' && <Investments userId={userId} />}
            {activeTab === 'bills' && <BillPayments userId={userId} />}
            {activeTab === 'transactions' && <TransactionHistoryNew userId={userId} />}
            {activeTab === 'profile' && <Profile userId={userId} />}
            {activeTab === 'nearby' && <Nearby userId={userId} setActiveTab={setActiveTab} setCurrentBusinessId={setCurrentBusinessId} setCurrentListingSlug={setCurrentListingSlug} /> }
            {activeTab === 'business' && <Business businessId={currentBusinessId} onBack={() => setActiveTab('nearby')} userId={userId} /> }
            {activeTab === 'listing' && currentListingSlug && <ListingDetail slug={currentListingSlug} onBack={() => {
              setActiveTab('nearby')
              setCurrentListingSlug(null)
              window.history.pushState(null, '', '/nearby')
            }} /> }
            {activeTab === 'network' && <Network userId={userId} />}
          </>
        )}
      </main>

      {/* Footer - On all pages */}
      <footer className="bg-white border-t border-slate-100 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <h3 className="text-xl font-light text-slate-900 mb-4 tracking-wide">currency.ph</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Your modern platform for global financial management.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Transfer Money</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Pay Bills</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Multi-Currency</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Company</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">About</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Blog</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Privacy</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Terms</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-8 text-center text-xs text-slate-500 tracking-wide">
            <p>&copy; {new Date().getFullYear()} currency.ph. All rights reserved.</p>
            <p className="mt-3">
              <button onClick={() => setActiveTab('network')} className="text-slate-600 hover:text-slate-900 transition-colors font-medium">
                Network Balances
              </button>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

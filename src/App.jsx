import React, { useState, useEffect } from 'react'
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
import About from './components/About'
import Inbox from './components/Inbox'

export default function App() {
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [globalCurrency, setGlobalCurrency] = useState('PHP')
  const [showAuth, setShowAuth] = useState(false)
  const [authInitialTab, setAuthInitialTab] = useState('login')
  const [currentBusinessId, setCurrentBusinessId] = useState(null)
  const [currentListingSlug, setCurrentListingSlug] = useState(null)
  const [totalBalancePHP, setTotalBalancePHP] = useState(0)

  // Content locker: enable by setting VITE_CONTENT_LOCKER=TRUE (client) or CONTENT_LOCKER=TRUE (server)
  const contentLocked = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CONTENT_LOCKER === 'TRUE') ||
    (typeof process !== 'undefined' && process.env && process.env.CONTENT_LOCKER === 'TRUE')

  useEffect(() => {
    // Ensure default page title/meta is set
    if (typeof document !== 'undefined') {
      document.title = 'Currency - Philippines'
      const metaDesc = document.querySelector('meta[name="description"]')
      if (metaDesc) {
        metaDesc.setAttribute('content', 'Currency - Philippines: open-source multi-currency dashboard and network balances.')
      }
    }
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
        // No active session: show auth UI (no auto-test-user creation)
        setShowAuth(true)
      }
    } catch (err) {
      console.error('Error initializing user:', err)
      setError('Failed to initialize application')
    } finally {
      setLoading(false)
    }
  }

  // Load aggregated total balance converted to PHP
  const loadTotalBalance = async (uid) => {
    if (!uid) {
      setTotalBalancePHP(0)
      return
    }
    try {
      const wallets = await wisegcashAPI.getWallets(uid)
      const promises = (wallets || []).map(async (w) => {
        const bal = Number(w.balance || 0)
        if (!w.currency_code || w.currency_code === 'PHP') return bal
        const rate = await wisegcashAPI.getExchangeRate(w.currency_code, 'PHP')
        return rate ? bal * Number(rate) : 0
      })
      const values = await Promise.all(promises)
      const total = values.reduce((s, v) => s + v, 0)
      setTotalBalancePHP(total)
    } catch (err) {
      console.warn('Could not load wallets for total balance:', err?.message)
      setTotalBalancePHP(0)
    }
  }

  useEffect(() => {
    if (userId) loadTotalBalance(userId)
    else setTotalBalancePHP(0)
  }, [userId])

  const handleAuthSuccess = async (user) => {
    setUserId(user.id)
    setUserEmail(user.email)
    await wisegcashAPI.getOrCreateUser(user.email, user.user_metadata?.full_name || 'User')
    setShowAuth(false)
    window.history.replaceState(null, '', '/')
    setActiveTab('home')
    // load balance for new user session
    loadTotalBalance(user.id)
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

  // If content locker is enabled, show a full black 'UNDER DEVELOPMENT' splash
  if (contentLocked) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-3xl text-center">
          <div className="text-6xl font-bold tracking-wide mb-6">UNDER DEVELOPMENT</div>
          <p className="text-lg text-slate-300 mb-8">This site is currently under development and not publicly accessible.</p>
          <div className="flex items-center justify-center space-x-3">
            <span className="w-4 h-4 bg-white rounded-full animate-pulse" />
            <span className="w-4 h-4 bg-white rounded-full animate-pulse delay-200" />
            <span className="w-4 h-4 bg-white rounded-full animate-pulse delay-400" />
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-slate-50">
      <HeaderMap />
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        globalCurrency={globalCurrency}
        setGlobalCurrency={setGlobalCurrency}
        userEmail={userEmail}
        totalBalancePHP={totalBalancePHP}
        onShowAuth={(tab) => {
          setAuthInitialTab(tab || 'login')
          setShowAuth(true)
          if (tab === 'register') window.history.replaceState(null, '', '/register')
          else window.history.replaceState(null, '', '/login')
          // scroll to top so auth card is visible
          setTimeout(() => { try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (e) {} }, 50)
        }}
        onSignOut={async () => {
          try {
            await supabase.auth.signOut()
          } catch (e) {
            console.warn('Sign out error', e)
          }
          setUserId(null)
          setUserEmail(null)
          setShowAuth(true)
        }}
      />

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
          <Auth initialTab={authInitialTab} onAuthSuccess={handleAuthSuccess} />
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
            {activeTab === 'about' && <About />}
            {activeTab === 'inbox' && <Inbox userId={userId} />}
          </>
        )}
      </main>

      {/* Footer - On all pages */}
      <footer className="bg-white border-t border-slate-100 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            <div>
              <h3 className="text-xl font-light text-slate-900 mb-4 tracking-wide">currency.ph</h3>
              <p className="text-sm text-slate-500 leading-relaxed">An open-source application that displays all transactions across the network.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Transfer Money</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Pay Bills</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Multi-Currency</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-8 text-center text-xs text-slate-500 tracking-wide">
            <p>&copy; {new Date().getFullYear()} currency.ph. All rights reserved.</p>
            <p className="mt-3 space-x-4">
              <button onClick={() => setActiveTab('about')} className="text-slate-600 hover:text-slate-900 transition-colors font-medium">
                About
              </button>
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

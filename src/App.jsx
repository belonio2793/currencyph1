import React, { useState, useEffect, Suspense, lazy } from 'react'
import { supabase } from './lib/supabaseClient'
import { currencyAPI } from './lib/payments'
import backgroundSync from './lib/backgroundSync'
import { populateSlugsForListings } from './lib/slugUtils'
import { initializePresence, stopPresence } from './lib/presence'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { preferencesManager } from './lib/preferencesManager'
import { deviceFingerprint } from './lib/deviceFingerprint'
import { registerServiceWorker, onOnlineStatusChange } from './lib/serviceWorkerManager'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import LandingPage from './components/LandingPage'
import Auth from './components/Auth'
import PageLoader from './components/PageLoader'
import { ShoppingCartProvider } from './context/ShoppingCartContext'
import { DeviceProvider } from './context/DeviceContext'
import { LayoutOverrideProvider } from './context/LayoutOverrideContext'

// Lazy load feature pages for code splitting
const HomePage = lazy(() => import('./components/HomePage'))
const Deposits = lazy(() => import('./components/Deposits'))
const Rates = lazy(() => import('./components/Rates'))
const OnlineUsers = lazy(() => import('./components/OnlineUsers'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const Wallet = lazy(() => import('./components/Wallet'))
const SendMoney = lazy(() => import('./components/SendMoney'))
const ReceiveMoney = lazy(() => import('./components/ReceiveMoney'))
const Investments = lazy(() => import('./components/Investments'))
const BillPayments = lazy(() => import('./components/BillPayments'))
const TransactionHistoryNew = lazy(() => import('./components/TransactionHistoryNew'))
const Profile = lazy(() => import('./components/Profile'))
const Nearby = lazy(() => import('./components/Nearby'))
const Business = lazy(() => import('./components/Business'))
const MyBusiness = lazy(() => import('./components/MyBusiness'))
const PaymentsHub = lazy(() => import('./components/PaymentsHub'))
const PaymentCheckoutPage = lazy(() => import('./components/Payments/PaymentCheckoutPage'))
const Jobs = lazy(() => import('./components/Jobs'))
const ListingDetail = lazy(() => import('./components/ListingDetail'))
const Network = lazy(() => import('./components/Network'))
const NetworkBalances = lazy(() => import('./components/NetworkBalances'))
const BorrowMoney = lazy(() => import('./components/BorrowMoney'))
const P2PLoanMarketplace = lazy(() => import('./components/P2PLoanMarketplace'))
const About = lazy(() => import('./components/About'))
const PlanningChat = lazy(() => import('./components/PlanningChat'))
const CoconutsLanding = lazy(() => import('./components/CoconutsLanding'))
const PlanningSetup = lazy(() => import('./components/PlanningSetup'))
const Inbox = lazy(() => import('./components/Inbox'))
const ChatBar = lazy(() => import('./components/ChatBar'))
const PokerPage = lazy(() => import('./components/PokerPage'))
const ChessPage = lazy(() => import('./components/ChessPage'))
const Rides = lazy(() => import('./components/Rides'))
const TradingDashboard = lazy(() => import('./components/Trading/TradingDashboard'))
const Addresses = lazy(() => import('./components/Addresses'))
const BusinessMarketplace = lazy(() => import('./components/BusinessMarketplace'))
const IntegratedMarketplace = lazy(() => import('./components/IntegratedMarketplace'))
const BusinessMarketplaceDetail = lazy(() => import('./components/BusinessMarketplaceDetail'))
const InventoryDashboard = lazy(() => import('./components/InventoryDashboard'))
const ShopOnline = lazy(() => import('./components/ShopOnline'))
const ShopProductDetail = lazy(() => import('./components/ShopProductDetail'))
const ShoppingCart = lazy(() => import('./components/ShoppingCart'))
const ShopCheckout = lazy(() => import('./components/ShopCheckout'))
const OrderConfirmation = lazy(() => import('./components/OrderConfirmation'))
const SendPaymentRequest = lazy(() => import('./components/SendPaymentRequest'))
const DynamicCheckoutPage = lazy(() => import('./components/DynamicCheckoutPage'))

export default function App() {
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname
    if (path.startsWith('/payment/') || path.startsWith('/invoice/')) return 'payment-checkout'
    if (path === '/payments') return 'payments'
    return 'home'
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [globalCurrency, setGlobalCurrency] = useState(() => {
    try {
      const stored = localStorage.getItem('currency_preferences_guest')
      if (stored) {
        const prefs = JSON.parse(stored)
        return prefs.fiat || 'PHP'
      }
    } catch (e) {
      console.warn('Failed to load currency preference:', e)
    }
    return 'PHP'
  })
  const [globalCryptocurrency, setGlobalCryptocurrency] = useState(() => {
    try {
      const stored = localStorage.getItem('currency_preferences_guest')
      if (stored) {
        const prefs = JSON.parse(stored)
        return prefs.crypto || 'BTC'
      }
    } catch (e) {
      console.warn('Failed to load crypto currency preference:', e)
    }
    return 'BTC'
  })
  const [showAuth, setShowAuth] = useState(false)
  const [authInitialTab, setAuthInitialTab] = useState('login')
  const [currentBusinessId, setCurrentBusinessId] = useState(null)
  const [currentListingSlug, setCurrentListingSlug] = useState(null)
  const [currentProductId, setCurrentProductId] = useState(null)
  const [currentOrderId, setCurrentOrderId] = useState(null)
  const [totalBalancePHP, setTotalBalancePHP] = useState(0)
  const [totalBalanceConverted, setTotalBalanceConverted] = useState(0)
  const [totalDebtConverted, setTotalDebtConverted] = useState(0)
  const [totalCryptoBalancePHP, setTotalCryptoBalancePHP] = useState(0)
  const totalNet = Number(totalBalanceConverted || 0) - Number(totalDebtConverted || 0)

  useEffect(() => {
    // Ensure default page title/meta is set
    if (typeof document !== 'undefined') {
      document.title = 'Currency - Philippines'
      const metaDesc = document.querySelector('meta[name="description"]')
      if (metaDesc) {
        metaDesc.setAttribute('content', 'Currency - Philippines: open-source multi-currency dashboard and network balances.')
      }
    }

    // Initialize current user from Supabase and routing
    initializeUser()
    handleRouting()

    // Subscribe to Supabase auth state changes so session is kept in sync across tabs
    let authSubscription = null
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        try {
          if (session && session.user) {
            setUserId(session.user.id)
            setUserEmail(session.user.email)

            // Ensure user profile and wallets exist
            if (!session.user.id.includes('guest-local')) {
              currencyAPI.getOrCreateUser(session.user.email, session.user.user_metadata?.full_name || 'User', session.user.id)
                .then(() => console.log('User profile created/verified for:', session.user.id))
                .catch((err) => console.error('Failed to create user profile:', err?.message))

              currencyAPI.ensureUserWallets(session.user.id)
                .then((result) => console.log('Wallets ensured for user:', session.user.id, 'created:', result?.length || 0))
                .catch((err) => console.error('Failed to ensure wallets:', err?.message))
            }

            // Presence disabled due to network errors in edge/offline environments
            // Presence tracking is non-critical and causes "Failed to fetch" errors
            // TODO: Re-enable when network connectivity is reliable
            // try { if (navigator.onLine && (typeof isSupabaseConfigured === 'undefined' || isSupabaseConfigured)) initializePresence(session.user.id) } catch(e) {}
            loadTotalBalance(session.user.id).catch(() => {})
            setShowAuth(false)
          } else {
            // no active session
            setUserId(null)
            setUserEmail(null)
            // don't force the auth UI here; keep current route visible
          }
        } catch (e) {
          console.warn('Auth state handler error', e)
        }
      })
      authSubscription = data?.subscription || data
    } catch (e) {
      console.warn('Could not subscribe to auth state changes', e)
    }

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

    // Register Service Worker for offline support and caching
    registerServiceWorker().catch(err => {
      console.debug('Service Worker registration failed:', err)
    })

    // Listen for online/offline status changes
    const unsubscribeOnlineStatus = onOnlineStatusChange((isOnline) => {
      console.log(`App is now ${isOnline ? 'online' : 'offline'}`)
    })

    window.addEventListener('popstate', handleRouting)
    window.addEventListener('hashchange', handleRouting)
    return () => {
      window.removeEventListener('popstate', handleRouting)
      window.removeEventListener('hashchange', handleRouting)
      backgroundSync.stop()
      unsubscribeOnlineStatus()
      try { if (authSubscription && typeof authSubscription.unsubscribe === 'function') authSubscription.unsubscribe() } catch (e) { /* ignore */ }
    }
  }, [])

  // Scroll to top when activeTab (page) changes (if preference is enabled)
  useEffect(() => {
    const autoScroll = preferencesManager.getAutoScrollToTop(userId)
    if (autoScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [activeTab, userId])

  // Save currency preferences whenever they change
  useEffect(() => {
    preferencesManager.setCurrencyPreferences(userId, globalCurrency, globalCryptocurrency)
  }, [globalCurrency, globalCryptocurrency, userId])

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

    // Direct /nearby route should activate nearby tab
    if (path === '/nearby') {
      setActiveTab('nearby')
      setShowAuth(false)
    }

    // Direct /wallets route should activate wallets page
    if (path === '/wallets') {
      setActiveTab('wallet')
      setShowAuth(false)
    }

    // Direct /addresses route should activate addresses tab
    if (path === '/addresses') {
      setActiveTab('addresses')
      setShowAuth(false)
    }

    // Direct /planning route should activate planning tab
    if (path === '/planning') {
      setActiveTab('planning')
      setShowAuth(false)
    }

    // Direct /depots route should activate deposit tab
    if (path === '/depots') {
      setActiveTab('deposit')
      setShowAuth(false)
    }

    // Handle payment checkout routes
    if (path.startsWith('/payment/')) {
      setActiveTab('checkout')
      setShowAuth(false)
    }

    if (path.startsWith('/invoice/')) {
      setActiveTab('checkout')
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
      // supabase.auth.getUser() may return different shapes; handle defensively
    // Protect against it hanging by racing with a timeout
    const timeoutMs = 5000
    let res = null
    try {
      res = await Promise.race([
        supabase.auth.getUser(),
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
      ])
    } catch (err) {
      // Handle AuthSessionMissingError gracefully - means user is not logged in
      if (err?.name === 'AuthSessionMissingError' || err?.message?.includes('Auth session missing')) {
        res = null
      } else {
        throw err
      }
    }
    let user = null
    if (res && res.data && res.data.user) user = res.data.user
    else if (res && res.user) user = res.user
    else user = null

      const path = typeof window !== 'undefined' ? window.location.pathname : '/'

      if (user) {
        setUserId(user.id)
        setUserEmail(user.email)
        // Store device fingerprint on successful authentication
        try {
          const fingerprint = await deviceFingerprint.generate()
          deviceFingerprint.store(fingerprint, user.id)
        } catch (e) {
          console.warn('Could not store device fingerprint:', e)
        }
        try {
          // Add timeouts to prevent indefinite blocking
          await Promise.race([
            currencyAPI.getOrCreateUser(user.email, user.user_metadata?.full_name || 'User', user.id),
            new Promise((resolve) => setTimeout(() => resolve(null), 3000))
          ]).catch(e => console.warn('getOrCreateUser failed:', e))

          // Ensure user has wallets for all active currencies
          await Promise.race([
            currencyAPI.ensureUserWallets(user.id),
            new Promise((resolve) => setTimeout(() => resolve([]), 3000))
          ]).catch(e => console.warn('ensureUserWallets failed:', e))
        } catch (e) {
          console.error('Failed to initialize user profile:', e)
          setError('Failed to initialize user profile. Please try refreshing or signing out and back in.')
        }
        try { if (typeof isSupabaseConfigured === 'undefined' || isSupabaseConfigured) initializePresence(user.id) } catch (e) { console.warn('initializePresence failed', e) }
        try {
          // Add timeout to prevent blocking if fetch-rates is down
          await Promise.race([
            loadTotalBalance(user.id),
            new Promise((resolve) => setTimeout(() => resolve(null), 5000))
          ])
        } catch (e) { console.warn('loadTotalBalance failed', e) }
        // If user is authenticated, don't forcibly change the current route — let handleRouting manage it
        setShowAuth(false)
      } else {
        // Check if there's a persisted guest session
        const guestSession = typeof window !== 'undefined' ? localStorage.getItem('currency_ph_guest_session') : null
        if (guestSession) {
          try {
            const parsed = JSON.parse(guestSession)
            if (parsed.user && parsed.user.id) {
              setUserId(parsed.user.id)
              setUserEmail(parsed.user.email)
              setShowAuth(false)
            }
          } catch (e) {
            console.warn('Could not restore guest session', e)
          }
        }

        // Only show auth UI when user explicitly navigated to login/register
        if (path === '/login' || path === '/register') setShowAuth(true)
        else setShowAuth(false)
      }
    } catch (err) {
      console.error('Error initializing user:', err)
      setError('Failed to initialize application: ' + (err && err.message ? err.message : String(err)))
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

    // For guest-local accounts, skip balance loading
    if (uid.includes('guest-local')) {
      setTotalBalancePHP(0)
      return
    }

    try {
      const wallets = await currencyAPI.getWallets(uid)
      const promises = (wallets || []).map(async (w) => {
        try {
          const bal = Number(w.balance || 0)
          if (!w.currency_code || w.currency_code === 'PHP') return bal
          const rate = await currencyAPI.getExchangeRate(w.currency_code, 'PHP')
          return rate ? bal * Number(rate) : bal
        } catch (e) {
          console.warn(`Failed to convert ${w.currency_code}:`, e?.message)
          return Number(w.balance || 0)
        }
      })
      const values = await Promise.allSettled(promises)
      const total = values.reduce((sum, result) => {
        return sum + (result.status === 'fulfilled' ? (result.value || 0) : 0)
      }, 0)
      setTotalBalancePHP(total)
    } catch (err) {
      console.warn('Could not load wallets for total balance:', err?.message)
      setTotalBalancePHP(0)
    }
  }

  useEffect(() => {
    if (userId) {
      loadTotalBalance(userId)
    } else {
      setTotalBalancePHP(0)
    }

    let channel = null
    if (userId && !userId.includes('guest-local')) {
      try {
        channel = supabase
          .channel('public:wallets')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, () => {
            // Recalculate total whenever wallets change for this user
            loadTotalBalance(userId).catch(() => {})
          })
          .subscribe()
      } catch (e) {
        console.warn('Wallets realtime subscription failed', e)
      }
    }

    return () => {
      try { if (channel && typeof channel.unsubscribe === 'function') channel.unsubscribe() } catch (e) { /* ignore */ }
    }
  }, [userId])

  // Compute converted totals (balance and debt) in the selected display currency so the Navbar can show a synced NET
  useEffect(() => {
    let cancelled = false
    const computeConvertedTotals = async () => {
      if (!userId || userId.includes('guest-local')) {
        setTotalBalanceConverted(0)
        setTotalDebtConverted(0)
        return
      }
      try {
        const wallets = await currencyAPI.getWallets(userId).catch(() => [])
        const balancePromises = (wallets || []).map(async (w) => {
          const bal = Number(w.balance || 0)
          if (!bal) return 0
          const from = w.currency_code || globalCurrency
          if (from === globalCurrency) return bal
          const rate = await currencyAPI.getExchangeRate(from, globalCurrency)
          return rate ? bal * Number(rate) : 0
        })
        const balanceValues = await Promise.all(balancePromises)
        const balanceTotal = balanceValues.reduce((s, v) => s + v, 0)

        const loans = await currencyAPI.getLoans(userId).catch(() => [])
        const debtPromises = (loans || []).map(async (l) => {
          const d = Number(l.remaining_balance || l.total_owed || 0)
          if (!d) return 0
          const from = l.currency || l.currency_code || globalCurrency
          if (from === globalCurrency) return d
          const rate = await currencyAPI.getExchangeRate(from, globalCurrency)
          return rate ? d * Number(rate) : 0
        })
        const debtValues = await Promise.all(debtPromises)
        const debtTotal = debtValues.reduce((s, v) => s + v, 0)

        if (!cancelled) {
          setTotalBalanceConverted(balanceTotal)
          setTotalDebtConverted(debtTotal)
        }
      } catch (err) {
        console.warn('Failed to compute converted totals for navbar:', err)
        if (!cancelled) {
          setTotalBalanceConverted(0)
          setTotalDebtConverted(0)
        }
      }
    }
    computeConvertedTotals()
    return () => { cancelled = true }
  }, [userId, globalCurrency])

  const handleAuthSuccess = async (user) => {
    setUserId(user.id)
    setUserEmail(user.email)

    // Store device fingerprint on successful authentication
    try {
      const fingerprint = await deviceFingerprint.generate()
      deviceFingerprint.store(fingerprint, user.id)
    } catch (e) {
      console.warn('Could not store device fingerprint:', e)
    }

    // For guest-local users (not real Supabase auth), don't try database operations
    if (!user.id.includes('guest-local')) {
      // Initialize user profile and wallets non-blocking (in background)
      currencyAPI.getOrCreateUser(user.email, user.user_metadata?.full_name || 'User', user.id).catch(err => {
        console.warn('Failed to initialize user profile:', err)
      })
      // Ensure user has wallets for all active currencies (non-blocking)
      currencyAPI.ensureUserWallets(user.id).catch(err => {
        console.warn('Failed to ensure user wallets during initialization:', err)
      })
      if (typeof isSupabaseConfigured === 'undefined' || isSupabaseConfigured) initializePresence(user.id)
    } else {
      // For guest-local accounts, persist to localStorage
      try {
        localStorage.setItem('currency_ph_guest_session', JSON.stringify({
          user,
          timestamp: Date.now()
        }))
      } catch (e) {
        console.warn('Could not persist guest session', e)
      }
    }

    setShowAuth(false)
    window.history.replaceState(null, '', '/')
    setActiveTab('home')
    // load balance for new user session
    loadTotalBalance(user.id)
  }

  const handleSignOut = () => {
    // Sign out handler - clears device fingerprint and resets state
    deviceFingerprint.clear()

    // Clear cache but preserve user_preferences for UUID presets
    const allKeys = Object.keys(localStorage)
    allKeys.forEach(key => {
      // Keep user_preferences and quick access settings
      if (!key.includes('user_preferences') && !key.includes('quick-access')) {
        localStorage.removeItem(key)
      }
    })

    // Clear sessionStorage completely
    sessionStorage.clear()

    setUserId(null)
    setUserEmail(null)
    setShowAuth(false)
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
    <LayoutOverrideProvider>
      <DeviceProvider>
        <ShoppingCartProvider>
          {/* Planning Setup page - standalone fullscreen interface */}
          {activeTab === 'planning-setup' && (
            <Suspense fallback={<PageLoader />}>
              <PlanningSetup />
            </Suspense>
          )}

          {/* Coconuts.com.ph Landing Page */}
          {activeTab === 'planning' && (
            <Suspense fallback={<PageLoader />}>
              <CoconutsLanding />
            </Suspense>
          )}

          {activeTab === 'checkout' && (
            <Suspense fallback={<PageLoader />}>
              <PaymentCheckoutPage userId={userId} globalCurrency={globalCurrency} />
            </Suspense>
          )}

          {activeTab === 'payment-checkout' && (
            <Suspense fallback={<PageLoader />}>
              <DynamicCheckoutPage />
            </Suspense>
          )}

          {/* Normal layout for all other pages */}
          {activeTab !== 'planning-setup' && activeTab !== 'planning' && activeTab !== 'checkout' && (
            <div className="min-h-screen bg-slate-50 flex">
              {userId && (
                <Sidebar
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  userEmail={userEmail}
                  onShowAuth={(tab) => {
                    setAuthInitialTab(tab || 'login')
                    setShowAuth(true)
                    if (tab === 'register') window.history.replaceState(null, '', '/register')
                    else window.history.replaceState(null, '', '/login')
                  }}
                  onSignOut={async () => {
                    try {
                      stopPresence()
                      await supabase.auth.signOut()
                    } catch (e) {
                      console.warn('Sign out error', e)
                    }
                    try {
                      localStorage.removeItem('currency_ph_guest_session')
                    } catch (e) {
                      console.warn('Could not clear guest session', e)
                    }
                    setUserId(null)
                    setUserEmail(null)
                    setShowAuth(false)
                  }}
                />
              )}
              <div className="flex-1 flex flex-col">
                <div data-component="navbar">
                  <Navbar
                    activeTab={activeTab}
                  onTabChange={setActiveTab}
                  globalCurrency={globalCurrency}
                  setGlobalCurrency={setGlobalCurrency}
                  globalCryptocurrency={globalCryptocurrency}
                  setGlobalCryptocurrency={setGlobalCryptocurrency}
                  userEmail={userEmail}
                  userId={userId}
                  totalBalancePHP={totalBalancePHP}
                  totalBalanceConverted={totalBalanceConverted}
                  totalDebtConverted={totalDebtConverted}
                  totalNet={totalNet}
                  totalCryptoBalancePHP={totalCryptoBalancePHP}
                  onShowAuth={(tab) => {
                    setAuthInitialTab(tab || 'login')
                    setShowAuth(true)
                    if (tab === 'register') window.history.replaceState(null, '', '/register')
                    else window.history.replaceState(null, '', '/login')
                    const autoScroll = preferencesManager.getAutoScrollToTop(userId)
                    if (autoScroll) {
                      setTimeout(() => { try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (e) {} }, 50)
                    }
                  }}
                  onSignOut={async () => {
                    try {
                      stopPresence()
                      await supabase.auth.signOut()
                    } catch (e) {
                      console.warn('Sign out error', e)
                    }
                    try {
                      localStorage.removeItem('currency_ph_guest_session')
                    } catch (e) {
                      console.warn('Could not clear guest session', e)
                    }
                    setUserId(null)
                    setUserEmail(null)
                    setShowAuth(false)
                    }}
                  />
                </div>

                {/* User Status Bar */}
                {activeTab !== 'home' && (
                  <div data-component="user-status-bar" className="bg-white border-b border-slate-100">
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
                <main className="flex-1">
                  <Suspense fallback={<PageLoader />}>
                    {(activeTab === 'home' || showAuth) && (
                      <>
                        {!showAuth && <HomePage userId={userId} userEmail={userEmail} globalCurrency={globalCurrency} setGlobalCurrency={setGlobalCurrency} globalCryptocurrency={globalCryptocurrency} setGlobalCryptocurrency={setGlobalCryptocurrency} onTabChange={setActiveTab} onSetTotalCryptoBalance={setTotalCryptoBalancePHP} onShowAuth={(tab) => { setAuthInitialTab(tab || 'login'); setShowAuth(true) }} />}
                      </>
                    )}
                    {showAuth ? (
                      <Auth initialTab={authInitialTab} onAuthSuccess={handleAuthSuccess} />
                    ) : (
                      <>
                        {activeTab === 'deposit' && <Deposits userId={userId} globalCurrency={globalCurrency} />}
                        {activeTab === 'rates' && <Rates globalCurrency={globalCurrency} />}
                        {activeTab === 'dashboard' && <Dashboard userId={userId} onNavigate={setActiveTab} globalCurrency={globalCurrency} globalCryptocurrency={globalCryptocurrency} userEmail={userEmail} />}
                        {activeTab === 'wallet' && <Wallet userId={userId} totalBalancePHP={totalBalancePHP} globalCurrency={globalCurrency} />}
                        {activeTab === 'send' && <SendMoney userId={userId} />}
                        {activeTab === 'send-payment' && <SendPaymentRequest userId={userId} onClose={() => setActiveTab('wallet')} />}
                        {activeTab === 'receive' && <ReceiveMoney userId={userId} />}
                        {activeTab === 'investments' && <Investments userId={userId} />}
                        {activeTab === 'bills' && <BillPayments userId={userId} />}
                        {activeTab === 'transactions' && <TransactionHistoryNew userId={userId} />}
                        {activeTab === 'profile' && <Profile userId={userId} onSignOut={handleSignOut} />}
                        {activeTab === 'payments' && <PaymentsHub userId={userId} userEmail={userEmail} globalCurrency={globalCurrency} setGlobalCurrency={setGlobalCurrency} />}
                        {activeTab === 'nearby' && <Nearby userId={userId} setActiveTab={setActiveTab} setCurrentBusinessId={setCurrentBusinessId} setCurrentListingSlug={setCurrentListingSlug} /> }
                        {activeTab === 'jobs' && <Jobs userId={userId} />}
                        {activeTab === 'my-business' && <MyBusiness userId={userId} />}
                        {activeTab === 'business-marketplace' && <IntegratedMarketplace userId={userId} businessId={currentBusinessId} setActiveTab={setActiveTab} setCurrentProductId={setCurrentProductId} />}
                        {activeTab === 'product-detail' && currentProductId && <BusinessMarketplaceDetail productId={currentProductId} userId={userId} setActiveTab={setActiveTab} onBack={() => { setActiveTab('business-marketplace'); setCurrentProductId(null) }} />}
                        {activeTab === 'inventory' && <IntegratedMarketplace userId={userId} businessId={currentBusinessId} setActiveTab={setActiveTab} setCurrentProductId={setCurrentProductId} />}
                        {activeTab === 'poker' && <PokerPage userId={userId} userEmail={userEmail} onShowAuth={(tab) => { setAuthInitialTab(tab || 'login'); setShowAuth(true) }} />}
                        {activeTab === 'chess' && <ChessPage userId={userId} userEmail={userEmail} onShowAuth={(tab) => { setAuthInitialTab(tab || 'login'); setShowAuth(true) }} />}
                        {activeTab === 'rides' && <Rides userId={userId} userEmail={userEmail} onShowAuth={(tab) => { setAuthInitialTab(tab || 'login'); setShowAuth(true) }} />}
                        {activeTab === 'addresses' && <Addresses userId={userId} onClose={() => setActiveTab('home')} onShowAuth={(tab) => { setAuthInitialTab(tab || 'login'); setShowAuth(true) }} />}
                        {activeTab === 'business' && <Business businessId={currentBusinessId} onBack={() => setActiveTab('nearby')} userId={userId} /> }
                        {activeTab === 'listing' && currentListingSlug && <ListingDetail slug={currentListingSlug} onBack={() => {
                          setActiveTab('nearby')
                          setCurrentListingSlug(null)
                          window.history.pushState(null, '', '/nearby')
                        }} /> }
                        {activeTab === 'network' && <Network userId={userId} />}
                        {activeTab === 'network-balances' && <NetworkBalances userId={userId} />}
                        {activeTab === 'p2p-loans' && <P2PLoanMarketplace userId={userId} userEmail={userEmail} onTabChange={setActiveTab} />}
                        {activeTab === 'about' && <About />}
                        {activeTab === 'inbox' && <Inbox userId={userId} />}
                        {activeTab === 'online-users' && <OnlineUsers userId={userId} userEmail={userEmail} />}
                        {activeTab === 'shop' && <ShopOnline onProductSelect={(productId) => {
                          setCurrentProductId(productId)
                          setActiveTab('shop-product')
                        }} />}
                        {activeTab === 'shop-product' && currentProductId && <ShopProductDetail productId={currentProductId} onNavigate={setActiveTab} />}
                        {activeTab === 'shop-cart' && <ShoppingCart onNavigate={setActiveTab} />}
                        {activeTab === 'shop-checkout' && <ShopCheckout onNavigate={setActiveTab} onOrderCreated={setCurrentOrderId} />}
                        {activeTab === 'shop-order-confirmation' && currentOrderId && <OrderConfirmation orderId={currentOrderId} onNavigate={setActiveTab} />}
                      </>
                    )}
                  </Suspense>
                </main>

                {/* Chat Bar */}
                {userId && (
                  <Suspense fallback={null}>
                    <ChatBar userId={userId} userEmail={userEmail} />
                  </Suspense>
                )}

                {/* Footer - On all pages */}
                <footer className="bg-white border-t border-slate-100 mt-20">
                  <div className="max-w-7xl mx-auto px-6 py-16">
                    <div className="mb-8">
                      <h3 className="text-xl font-light text-slate-900 mb-4 tracking-wide">currency.ph</h3>
                      <p className="text-sm text-slate-500 leading-relaxed max-w-md">An open-source application that displays all transactions across the network.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 mb-12">
                      {/* Account */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Account</h4>
                        <ul className="space-y-3 text-sm">
                          <li><button onClick={() => setActiveTab('profile')} className="text-slate-600 hover:text-slate-900 transition-colors">Profile</button></li>
                          <li><button onClick={() => setActiveTab('inbox')} className="text-slate-600 hover:text-slate-900 transition-colors">Inbox</button></li>
                          <li><button onClick={() => setActiveTab('my-business')} className="text-slate-600 hover:text-slate-900 transition-colors">My Business</button></li>
                          <li><button onClick={() => setActiveTab('transactions')} className="text-slate-600 hover:text-slate-900 transition-colors">History</button></li>
                          <li><button onClick={() => setActiveTab('wallet')} className="text-slate-600 hover:text-slate-900 transition-colors">Wallet</button></li>
                          <li><button onClick={() => setActiveTab('deposit')} className="text-slate-600 hover:text-slate-900 transition-colors">Deposit Funds</button></li>
                        </ul>
                      </div>
                      {/* Main */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Main</h4>
                        <ul className="space-y-3 text-sm">
                          <li><button onClick={() => setActiveTab('nearby')} className="text-slate-600 hover:text-slate-900 transition-colors">Nearby</button></li>
                          <li><button onClick={() => setActiveTab('rides')} className="text-slate-600 hover:text-slate-900 transition-colors">Rides</button></li>
                        </ul>
                      </div>
                      {/* Financial */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Financial</h4>
                        <ul className="space-y-3 text-sm">
                          <li><button onClick={() => setActiveTab('rates')} className="text-slate-600 hover:text-slate-900 transition-colors">Currency Rates</button></li>
                          <li><button onClick={() => setActiveTab('payments-financial')} className="text-slate-600 hover:text-slate-900 transition-colors">Payments</button></li>
                          <li><button onClick={() => setActiveTab('send')} className="text-slate-600 hover:text-slate-900 transition-colors">Send Money</button></li>
                          <li><button onClick={() => setActiveTab('receive')} className="text-slate-600 hover:text-slate-900 transition-colors">Receive Money</button></li>
                        </ul>
                      </div>
                      {/* Marketplace */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Marketplace</h4>
                        <ul className="space-y-3 text-sm">
                          <li><button onClick={() => setActiveTab('jobs')} className="text-slate-600 hover:text-slate-900 transition-colors">Jobs</button></li>
                          <li><button onClick={() => setActiveTab('p2p-loans')} className="text-slate-600 hover:text-slate-900 transition-colors">Loans</button></li>
                        </ul>
                      </div>
                      {/* Community */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Community</h4>
                        <ul className="space-y-3 text-sm">
                          <li><button onClick={() => setActiveTab('online-users')} className="text-slate-600 hover:text-slate-900 transition-colors">Online Users</button></li>
                          <li><button onClick={() => setActiveTab('messages')} className="text-slate-600 hover:text-slate-900 transition-colors">Messages</button></li>
                          <li><button onClick={() => setActiveTab('investments')} className="text-slate-600 hover:text-slate-900 transition-colors">Market Opportunities</button></li>
                        </ul>
                      </div>
                      {/* Personal */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Personal</h4>
                        <ul className="space-y-3 text-sm">
                          <li><button onClick={() => setActiveTab('bills')} className="text-slate-600 hover:text-slate-900 transition-colors">Bills</button></li>
                        </ul>
                      </div>
                      {/* Games */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Games</h4>
                        <ul className="space-y-3 text-sm">
                          <li><button onClick={() => setActiveTab('poker')} className="text-slate-600 hover:text-slate-900 transition-colors">Poker</button></li>
                          <li><button onClick={() => setActiveTab('chess')} className="text-slate-600 hover:text-slate-900 transition-colors">Chess</button></li>
                        </ul>
                      </div>
                      {/* Maps */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Maps</h4>
                        <ul className="space-y-3 text-sm">
                          <li><button onClick={() => setActiveTab('shipping')} className="text-slate-600 hover:text-slate-900 transition-colors">Shipping</button></li>
                          <li><button onClick={() => setActiveTab('addresses')} className="text-slate-600 hover:text-slate-900 transition-colors">Addresses</button></li>
                        </ul>
                      </div>
                      {/* Network */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Network</h4>
                        <ul className="space-y-3 text-sm">
                          <li><button onClick={() => setActiveTab('network-balances')} className="text-slate-600 hover:text-slate-900 transition-colors">Network Balances</button></li>
                        </ul>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-8 text-center text-xs text-slate-500 tracking-wide">
                      <p>&copy; {new Date().getFullYear()} currency.ph. All rights reserved.</p>
                      <p className="mt-3 space-x-4">
                        <button onClick={() => setActiveTab('about')} className="text-slate-600 hover:text-slate-900 transition-colors font-medium">
                          About
                        </button>
                        <button onClick={() => setActiveTab('planning')} className="text-slate-600 hover:text-slate-900 transition-colors font-medium">
                          Planning
                        </button>
                        <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors font-medium">Privacy Policy</a>
                        <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors font-medium">Terms of Service</a>
                        <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors font-medium">Contact</a>
                      </p>
                    </div>
                  </div>
                </footer>
              </div>
            </div>
          )}
        </ShoppingCartProvider>
      </DeviceProvider>
    </LayoutOverrideProvider>
  )
}

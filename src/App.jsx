import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { wisegcashAPI } from './lib/wisegcashAPI'
import Navbar from './components/Navbar'
import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
import Wallet from './components/Wallet'
import SendMoney from './components/SendMoney'
import BillPayments from './components/BillPayments'
import TransactionHistoryNew from './components/TransactionHistoryNew'
import Profile from './components/Profile'
import Auth from './components/Auth'
import Nearby from './components/Nearby'
import Business from './components/Business'
import CommunityManagement from './components/CommunityManagement'
import AdminPopulate from './components/AdminPopulate'
import ListingDetail from './components/ListingDetail'

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

    window.addEventListener('popstate', handleRouting)
    window.addEventListener('hashchange', handleRouting)
    return () => {
      window.removeEventListener('popstate', handleRouting)
      window.removeEventListener('hashchange', handleRouting)
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

    // Handle listing detail routes
    if (hash.startsWith('#/listing/')) {
      const slug = hash.replace('#/listing/', '')
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
      {activeTab !== 'home' && <Navbar activeTab={activeTab} onTabChange={setActiveTab} />}

      {/* User Status Bar - Only on non-home pages */}
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
            {/* Home Page Navbar (also shown during auth for a persistent header) */}
            <nav className="bg-white border-b border-slate-100">
              <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center md:justify-between gap-4">
                <h1 className="text-2xl sm:text-2xl md:text-2xl font-light text-slate-900 tracking-wide">currency.ph</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">Display Currency:</label>
                    <select
                      value={globalCurrency}
                      onChange={(e) => setGlobalCurrency(e.target.value)}
                      className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm font-medium bg-white"
                    >
                      <option value="PHP">PHP - Philippine Peso</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="JPY">JPY - Japanese Yen</option>
                      <option value="CNY">CNY - Chinese Yuan</option>
                      <option value="INR">INR - Indian Rupee</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                      <option value="CHF">CHF - Swiss Franc</option>
                      <option value="SEK">SEK - Swedish Krona</option>
                      <option value="NZD">NZD - New Zealand Dollar</option>
                      <option value="SGD">SGD - Singapore Dollar</option>
                      <option value="HKD">HKD - Hong Kong Dollar</option>
                      <option value="IDR">IDR - Indonesian Rupiah</option>
                      <option value="MYR">MYR - Malaysian Ringgit</option>
                      <option value="THB">THB - Thai Baht</option>
                      <option value="VND">VND - Vietnamese Dong</option>
                      <option value="KRW">KRW - South Korean Won</option>
                      <option value="ZAR">ZAR - South African Rand</option>
                      <option value="BRL">BRL - Brazilian Real</option>
                      <option value="MXN">MXN - Mexican Peso</option>
                      <option value="NOK">NOK - Norwegian Krone</option>
                      <option value="DKK">DKK - Danish Krone</option>
                      <option value="AED">AED - UAE Dirham</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('home')
                      setShowAuth(false)
                      window.history.replaceState(null, '', '/')
                    }}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Home
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('nearby')
                      setShowAuth(false)
                      window.history.replaceState(null, '', '/nearby')
                    }}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Nearby
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('community')
                      setShowAuth(false)
                      window.history.replaceState(null, '', '/community')
                    }}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Community
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('admin-populate')
                      setShowAuth(false)
                      window.history.replaceState(null, '', '/admin')
                    }}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Admin
                  </button>
                  <button
                    onClick={() => {
                      setShowAuth(true)
                      window.history.replaceState(null, '', '/login')
                    }}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    More Tools
                  </button>
                </div>
              </div>
            </nav>
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
            {activeTab === 'bills' && <BillPayments userId={userId} />}
            {activeTab === 'transactions' && <TransactionHistoryNew userId={userId} />}
            {activeTab === 'profile' && <Profile userId={userId} />}
            {activeTab === 'nearby' && <Nearby userId={userId} setActiveTab={setActiveTab} setCurrentBusinessId={setCurrentBusinessId} /> }
            {activeTab === 'business' && <Business businessId={currentBusinessId} onBack={() => setActiveTab('nearby')} userId={userId} /> }
            {activeTab === 'community' && <CommunityManagement userId={userId} /> }
            {activeTab === 'admin-populate' && <AdminPopulate /> }
            {activeTab === 'listing' && currentListingSlug && <ListingDetail slug={currentListingSlug} onBack={() => {
              setActiveTab('nearby')
              setCurrentListingSlug(null)
              window.history.replaceState(null, '', '/nearby')
            }} /> }
          </>
        )}
      </main>

      {/* Footer - Only on non-home pages */}
      {activeTab !== 'home' && (
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
              <p>&copy; 2024 currency.ph. All rights reserved.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { wisegcashAPI } from './lib/wisegcashAPI'
import Navbar from './components/Navbar'
import Dashboard from './components/Dashboard'
import Wallet from './components/Wallet'
import SendMoney from './components/SendMoney'
import BillPayments from './components/BillPayments'
import TransactionHistoryNew from './components/TransactionHistoryNew'
import Profile from './components/Profile'

export default function App() {
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    initializeUser()
  }, [])

  const initializeUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUserId(user.id)
        setUserEmail(user.email)
        await wisegcashAPI.getOrCreateUser(user.email, user.user_metadata?.full_name || 'User')
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl font-light mb-4 text-white">currency.ph</div>
          <p className="text-slate-300 text-sm tracking-wide">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Minimalist User Status Bar */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500 tracking-wide">
            <span className="text-slate-400">Account:</span> {userEmail}
          </p>
        </div>
      </div>

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
        {activeTab === 'dashboard' && <Dashboard userId={userId} onNavigate={setActiveTab} />}
        {activeTab === 'wallet' && <Wallet userId={userId} />}
        {activeTab === 'send' && <SendMoney userId={userId} />}
        {activeTab === 'bills' && <BillPayments userId={userId} />}
        {activeTab === 'transactions' && <TransactionHistoryNew userId={userId} />}
        {activeTab === 'profile' && <Profile userId={userId} />}
      </main>

      {/* Sophisticated Footer */}
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
    </div>
  )
}

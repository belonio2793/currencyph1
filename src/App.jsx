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
        const testEmail = `test-${Math.random().toString(36).substring(7)}@wisegcash.local`
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💰</div>
          <p className="text-gray-600 text-lg">Loading WiseGCash...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* User Info Bar */}
      <div className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <p className="text-sm">
            Logged in as: <span className="font-semibold">{userEmail}</span>
          </p>
          <div className="text-sm">
            <span className="text-blue-100">Account ID: {userId?.substring(0, 8)}...</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <p className="text-red-700 text-sm">{error}</p>
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

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 mt-20">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-4">💰 WiseGCash</h3>
              <p className="text-sm">Your financial companion for global money transfers and bill payments.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Send Money</a></li>
                <li><a href="#" className="hover:text-white">Pay Bills</a></li>
                <li><a href="#" className="hover:text-white">Multi-Currency</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2024 WiseGCash. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

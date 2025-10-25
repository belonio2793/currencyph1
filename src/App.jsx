import { useState, useEffect } from 'react'
import Header from './components/Header'
import BalanceDisplay from './components/BalanceDisplay'
import DepositSection from './components/DepositSection'
import TransactionHistory from './components/TransactionHistory'
import Footer from './components/Footer'
import { dogTokenAPI, supabase } from './lib/supabaseClient'

export default function App() {
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [refreshHistory, setRefreshHistory] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          setUserId(user.id)
          setUserEmail(user.email)
          // Ensure user exists in our users table
          await dogTokenAPI.getOrCreateUser(user.email)
        } else {
          // For testing: create a test user with email
          const testEmail = `test-${Math.random().toString(36).substring(7)}@dog.local`
          const testUser = await dogTokenAPI.getOrCreateUser(testEmail)
          setUserId(testUser.id)
          setUserEmail(testEmail)
        }
      } catch (err) {
        console.error('Error initializing user:', err)
      } finally {
        setLoading(false)
      }
    }

    initializeUser()
  }, [])

  const handleDepositSuccess = () => {
    setRefreshHistory(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Header />
        
        {userEmail && (
          <p className="text-xs text-gray-500 mb-6 text-center">
            {userEmail}
          </p>
        )}

        <BalanceDisplay userId={userId} />
        <DepositSection userId={userId} onDepositSuccess={handleDepositSuccess} />
        <TransactionHistory userId={userId} refresh={refreshHistory} />
        
        <Footer />
      </div>
    </div>
  )
}

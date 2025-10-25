import { useState, useEffect } from 'react'
import Header from './components/Header'
import AddFundsSection from './components/AddFundsSection'
import BalanceSection from './components/BalanceSection'
import ProjectsSection from './components/ProjectsSection'
import Footer from './components/Footer'

export default function App() {
  const [userBalance, setUserBalance] = useState({ php: 0, tokens: 0, btc: 0, eth: 0 })
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data - will be replaced with Supabase calls
    const mockBalance = {
      php: 10000,
      tokens: 1000,
      btc: 0.005,
      eth: 0.15
    }
    setUserBalance(mockBalance)

    const mockProjects = [
      {
        id: 1,
        name: 'Art Installation',
        description: 'A community art installation project',
        goal: 1000000,
        ownership: 20,
        current: 250000
      },
      {
        id: 2,
        name: 'Social Venture',
        description: 'Community-driven social enterprise',
        goal: 500000,
        ownership: 30,
        current: 150000
      },
      {
        id: 3,
        name: 'Tech Education',
        description: 'Free tech education for underserved communities',
        goal: 750000,
        ownership: 25,
        current: 300000
      }
    ]
    setProjects(mockProjects)
    setLoading(false)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Header />
        <AddFundsSection />
        <BalanceSection balance={userBalance} />
        <ProjectsSection projects={projects} loading={loading} />
        <Footer />
      </div>
    </div>
  )
}

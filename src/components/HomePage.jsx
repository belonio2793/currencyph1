import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/payments'
import { quickAccessManager } from '../lib/quickAccessManager'
import DraggableQuickAccessCards from './DraggableQuickAccessCards'
import CustomizeQuickAccessModal from './CustomizeQuickAccessModal'
import ReceiptHistory from './ReceiptHistory'
import MyBusiness from './MyBusiness'
import Deposits from './Deposits'
import Nearby from './Nearby'
import Inbox from './Inbox'
import PokerPage from './PokerPage'
import NetworkBalances from './NetworkBalances'
import P2PLoanMarketplace from './P2PLoanMarketplace'

export default function HomePage({ userId, userEmail, globalCurrency = 'PHP', onTabChange }) {
  const [wallets, setWallets] = useState([])
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalBalanceConverted, setTotalBalanceConverted] = useState(null)
  const [totalDebtConverted, setTotalDebtConverted] = useState(null)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showNearbyModal, setShowNearbyModal] = useState(false)
  const [showInboxModal, setShowInboxModal] = useState(false)
  const [showP2PModal, setShowP2PModal] = useState(false)
  const [showPokerModal, setShowPokerModal] = useState(false)
  const [showNetworkBalancesModal, setShowNetworkBalancesModal] = useState(false)
  const [showReceiptsModal, setShowReceiptsModal] = useState(false)
  const [showMyBusinessModal, setShowMyBusinessModal] = useState(false)
  const [enabledCards, setEnabledCards] = useState(() => quickAccessManager.getEnabledCardsInOrderSync(userId))
  const [reorderKey, setReorderKey] = useState(0)
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [quickAccessCards, setQuickAccessCards] = useState(() => quickAccessManager.getCardVisibility(userId))

  useEffect(() => {
    loadData()
  }, [userId])

  // Load quick access preferences from database on mount and when userId changes
  useEffect(() => {
    const loadQuickAccessFromDB = async () => {
      if (!userId) return

      try {
        const visibility = await quickAccessManager.loadCardVisibilityFromDB(userId)
        const order = await quickAccessManager.loadCardOrderFromDB(userId)

        setQuickAccessCards(visibility)
        const enabledInOrder = order.filter(cardKey => visibility[cardKey] === true)
        setEnabledCards(enabledInOrder)
        setReorderKey(prev => prev + 1)
      } catch (err) {
        console.error('Error loading quick access preferences from DB:', err)
      }
    }

    loadQuickAccessFromDB()
  }, [userId])

  // Listen for localStorage changes (from profile settings)
  useEffect(() => {
    const handleStorageChange = () => {
      setEnabledCards(quickAccessManager.getEnabledCardsInOrderSync(userId))
    }

    const handleReorder = () => {
      setReorderKey(prev => prev + 1)
      setEnabledCards(quickAccessManager.getEnabledCardsInOrderSync(userId))
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('quick-access-updated', handleStorageChange)
    window.addEventListener('quick-access-reordered', handleReorder)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('quick-access-updated', handleStorageChange)
      window.removeEventListener('quick-access-reordered', handleReorder)
    }
  }, [userId])

  // Recompute converted totals when display currency changes
  useEffect(() => {
    if (!loading) {
      // run conversion in background
      convertTotals(wallets, loans)
    }
  }, [globalCurrency])

  const convertTotals = async (w = wallets, l = loans) => {
    try {
      // Total balance: sum wallet balances converted to globalCurrency
      let balanceSum = 0
      for (const wallet of (w || [])) {
        const amt = Number(wallet.balance || 0)
        if (amt === 0) continue
        const fromCurrency = wallet.currency_code || globalCurrency
        if (fromCurrency === globalCurrency) {
          balanceSum += amt
        } else {
          const rate = await wisegcashAPI.getExchangeRate(fromCurrency, globalCurrency)
          balanceSum += rate ? amt * Number(rate) : 0
        }
      }
      setTotalBalanceConverted(Number(balanceSum).toFixed(2))

      // Total debt: sum loan remaining_balance/total_owed converted to globalCurrency
      let debtSum = 0
      for (const loan of (l || [])) {
        const amt = Number(loan.remaining_balance || loan.total_owed || 0)
        if (amt === 0) continue
        const loanCurrency = loan.currency || loan.currency_code || globalCurrency
        if (loanCurrency === globalCurrency) {
          debtSum += amt
        } else {
          const rate = await wisegcashAPI.getExchangeRate(loanCurrency, globalCurrency)
          debtSum += rate ? amt * Number(rate) : 0
        }
      }
      setTotalDebtConverted(Number(debtSum).toFixed(2))
    } catch (convErr) {
      console.warn('Failed to convert totals to display currency', convErr)
      setTotalBalanceConverted(null)
      setTotalDebtConverted(null)
    }
  }

  const loadData = async () => {
    try {
      if (userId && !userId.includes('guest-local')) {
        const [walletsData, loansData] = await Promise.all([
          wisegcashAPI.getWallets(userId).catch(() => []),
          wisegcashAPI.getLoans(userId).catch(() => [])
        ])
        const w = walletsData || []
        const l = loansData || []
        setWallets(w)
        setLoans(l)

        // compute converted totals
        await convertTotals(w, l)
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTotalBalance = () => {
    return wallets.reduce((sum, w) => sum + (w.balance || 0), 0).toFixed(2)
  }

  const getActiveLoanCount = () => {
    return loans.filter(l => l.status === 'active' || l.status === 'pending').length
  }

  const getTotalDebt = () => {
    return loans.reduce((sum, l) => sum + (l.remaining_balance || l.total_owed || 0), 0).toFixed(2)
  }

  const personalLoans = loans.filter(l => l.loan_type === 'personal')
  const businessLoans = loans.filter(l => l.loan_type === 'business')

  const net = Number(totalBalanceConverted || 0) - Number(totalDebtConverted || 0)
  const isNegativeNet = net < 0
  const netDisplay = Number.isFinite(net) ? net.toFixed(2) : '0.00'

  const handleCardClick = (cardKey) => {
    const modalMap = {
      deposit: () => setShowDepositModal(true),
      nearby: () => setShowNearbyModal(true),
      messages: () => setShowInboxModal(true),
      p2p: () => setShowP2PModal(true),
      poker: () => setShowPokerModal(true),
      networkBalances: () => setShowNetworkBalancesModal(true),
      receipts: () => setShowReceiptsModal(true),
      myBusiness: () => setShowMyBusinessModal(true)
    }

    const handler = modalMap[cardKey]
    if (handler) {
      handler()
    }
  }

  const toggleQuickAccessCard = (cardKey) => {
    const updated = { ...quickAccessCards, [cardKey]: !quickAccessCards[cardKey] }
    setQuickAccessCards(updated)
  }

  const handleSaveQuickAccessPreferences = async () => {
    try {
      await quickAccessManager.setCardVisibility(userId, quickAccessCards)
      const newEnabledCards = await quickAccessManager.getEnabledCardsInOrder(userId)
      setEnabledCards(newEnabledCards)
      setReorderKey(prev => prev + 1)
      setShowCustomizeModal(false)
    } catch (err) {
      console.error('Error saving quick access preferences:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-light text-slate-900 mb-2">Welcome back, {userEmail?.split('@')[0] || 'User'}</h1>
          <p className="text-slate-600">Quick access to your most used features</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Balance */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <p className="text-sm text-blue-600 font-medium uppercase tracking-wider mb-1">Total Balance</p>
            <p className="text-3xl font-light text-blue-900">{totalBalanceConverted != null ? totalBalanceConverted : getTotalBalance()} {globalCurrency}</p>
          </div>

          {/* Net (Balance - Debt) */}
          <div className={`rounded-xl p-6 border ${isNegativeNet ? 'bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200' : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'}`}>
            <p className={`text-sm font-medium uppercase tracking-wider mb-1 ${isNegativeNet ? 'text-rose-600' : 'text-emerald-600'}`}>Net</p>
            <p className={`text-3xl font-light ${isNegativeNet ? 'text-rose-900' : 'text-emerald-900'}`}>{netDisplay} {globalCurrency}</p>
          </div>

          {/* Total Debt */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
            <p className="text-sm text-red-600 font-medium uppercase tracking-wider mb-1">Total Debt</p>
            <p className="text-3xl font-light text-red-900">{totalDebtConverted != null ? totalDebtConverted : getTotalDebt()} {globalCurrency}</p>
          </div>
        </div>

        {/* Quick Access Cards Section */}
        <div className="relative mb-8">
          <div className="absolute -top-8 right-0 flex items-center gap-2">
            <span className="text-sm font-medium text-slate-400 opacity-60">Quick Access</span>
            <button
              onClick={() => setShowCustomizeModal(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 opacity-60 hover:opacity-100"
              title="Configure quick access cards"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <DraggableQuickAccessCards
            key={reorderKey}
            userId={userId}
            cardKeys={enabledCards}
            onCardClick={handleCardClick}
            isDragEnabled={true}
            isLargeMode={true}
          />
        </div>

        {/* Exchange Rates Preview */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Exchange Rates</h3>
            <button
              onClick={() => onTabChange('rates')}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              View all →
            </button>
          </div>
          <p className="text-slate-600 text-sm">Current exchange rates and currency conversion tools available on the Rates page</p>
        </div>
      </div>

      <CustomizeQuickAccessModal
        isOpen={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        userId={userId}
        quickAccessCards={quickAccessCards}
        onToggleCard={toggleQuickAccessCard}
        enabledCards={enabledCards}
        customizeReorderKey={reorderKey}
        onSave={handleSaveQuickAccessPreferences}
        onCardClick={handleCardClick}
        showReorderSection={false}
      />

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-light text-slate-900">Deposit</h2>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <Deposits userId={userId} globalCurrency={globalCurrency} />
            </div>
          </div>
        </div>
      )}

      {/* Nearby Modal */}
      {showNearbyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-light text-slate-900">Nearby</h2>
              <button
                onClick={() => setShowNearbyModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <Nearby userId={userId} setActiveTab={() => {}} setCurrentListingSlug={() => {}} />
            </div>
          </div>
        </div>
      )}

      {/* Inbox Modal */}
      {showInboxModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-light text-slate-900">Messages</h2>
              <button
                onClick={() => setShowInboxModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <Inbox userId={userId} />
            </div>
          </div>
        </div>
      )}

      {/* P2P Loan Marketplace Modal */}
      {showP2PModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-light text-slate-900">Peer To Peer Loan Marketplace</h2>
              <button
                onClick={() => setShowP2PModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <P2PLoanMarketplace userId={userId} userEmail={userEmail} />
            </div>
          </div>
        </div>
      )}

      {/* Poker Modal */}
      {showPokerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-light text-slate-900">Poker</h2>
              <button
                onClick={() => setShowPokerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <PokerPage userId={userId} userEmail={userEmail} onShowAuth={() => {}} />
            </div>
          </div>
        </div>
      )}

      {/* Network Balances Modal */}
      {showNetworkBalancesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-light text-slate-900">Network Balances</h2>
              <button
                onClick={() => setShowNetworkBalancesModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <NetworkBalances userId={userId} />
            </div>
          </div>
        </div>
      )}

      {/* Receipts Modal */}
      {showReceiptsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-light text-slate-900">Receipt History</h2>
              <button
                onClick={() => setShowReceiptsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <ReceiptHistory userId={userId} userEmail={userEmail} />
            </div>
          </div>
        </div>
      )}

      {/* My Business Modal */}
      {showMyBusinessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-light text-slate-900">My Business</h2>
              <button
                onClick={() => setShowMyBusinessModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <MyBusiness userId={userId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

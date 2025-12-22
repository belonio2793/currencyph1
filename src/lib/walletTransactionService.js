import { supabase } from './supabaseClient'

export const walletTransactionService = {
  // Fetch transactions for a specific wallet
  async getWalletTransactions(walletId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (err) {
      console.warn('Failed to fetch wallet transactions:', err)
      return []
    }
  },

  // Fetch all transactions for a user across all wallets
  async getUserTransactions(userId, limit = 100) {
    try {
      // First, get all wallet IDs for this user
      const { data: userWallets, error: walletsError } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', userId)

      if (walletsError) throw walletsError
      if (!userWallets || userWallets.length === 0) {
        return []
      }

      const walletIds = userWallets.map(w => w.id)

      // Then fetch transactions for all those wallets
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*, wallets(user_id, currency_code)')
        .in('wallet_id', walletIds)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      // Flatten the data and ensure user_id is set
      const enrichedData = (data || []).map(tx => ({
        ...tx,
        user_id: tx.wallets?.user_id || userId,
        currency_code: tx.currency_code || tx.wallets?.currency_code
      }))

      return enrichedData
    } catch (err) {
      console.warn('Failed to fetch user transactions:', err)
      return []
    }
  },

  // Get transaction statistics for a wallet
  async getWalletStats(walletId, userId) {
    try {
      const transactions = await this.getWalletTransactions(walletId, 1000)

      const stats = {
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalTransfers: 0,
        transactionCount: transactions.length,
        firstTransaction: null,
        lastTransaction: null,
        averageTransaction: 0,
        largestDeposit: 0,
        largestWithdrawal: 0,
        depositCount: 0,
        withdrawalCount: 0
      }

      transactions.forEach(tx => {
        switch (tx.type) {
          case 'deposit':
          case 'transfer_in':
          case 'reward':
          case 'tip':
            stats.totalDeposited += Number(tx.amount || 0)
            stats.depositCount++
            if (Number(tx.amount || 0) > stats.largestDeposit) {
              stats.largestDeposit = Number(tx.amount || 0)
            }
            break
          case 'withdrawal':
          case 'transfer_out':
          case 'purchase':
          case 'rake':
            stats.totalWithdrawn += Number(tx.amount || 0)
            stats.withdrawalCount++
            if (Number(tx.amount || 0) > stats.largestWithdrawal) {
              stats.largestWithdrawal = Number(tx.amount || 0)
            }
            break
          default:
            break
        }

        if (tx.type === 'transfer_in' || tx.type === 'transfer_out') {
          stats.totalTransfers++
        }
      })

      if (transactions.length > 0) {
        stats.firstTransaction = transactions[transactions.length - 1]
        stats.lastTransaction = transactions[0]
        stats.averageTransaction = transactions.length > 0 
          ? (stats.totalDeposited + stats.totalWithdrawn) / transactions.length 
          : 0
      }

      return stats
    } catch (err) {
      console.warn('Failed to compute wallet stats:', err)
      return {
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalTransfers: 0,
        transactionCount: 0,
        depositCount: 0,
        withdrawalCount: 0
      }
    }
  },

  // Get daily balance history for charting
  async getBalanceHistory(walletId, daysBack = 30) {
    try {
      const transactions = await this.getWalletTransactions(walletId, 1000)

      // Group by date and calculate running balance
      const dailyBalances = {}
      let runningBalance = 0

      // Sort transactions oldest first
      const sortedTx = [...transactions].reverse()

      sortedTx.forEach(tx => {
        const date = new Date(tx.created_at).toISOString().split('T')[0]

        // Calculate balance change
        let change = 0
        switch (tx.type) {
          case 'deposit':
          case 'transfer_in':
          case 'reward':
          case 'tip':
            change = Number(tx.amount || 0)
            break
          case 'withdrawal':
          case 'transfer_out':
          case 'purchase':
          case 'rake':
            change = -Number(tx.amount || 0)
            break
          default:
            break
        }

        runningBalance += change

        if (!dailyBalances[date]) {
          dailyBalances[date] = {
            date,
            balance: 0,
            deposits: 0,
            withdrawals: 0,
            transactionCount: 0
          }
        }

        dailyBalances[date].balance = runningBalance
        dailyBalances[date].transactionCount++

        if (change > 0) {
          dailyBalances[date].deposits += change
        } else {
          dailyBalances[date].withdrawals += Math.abs(change)
        }
      })

      return Object.values(dailyBalances).slice(-daysBack)
    } catch (err) {
      console.warn('Failed to compute balance history:', err)
      return []
    }
  },

  // Get transaction trends (weekly/monthly)
  async getTransactionTrends(walletId, period = 'week') {
    try {
      const transactions = await this.getWalletTransactions(walletId, 1000)
      const trends = {}

      transactions.forEach(tx => {
        const txDate = new Date(tx.created_at)
        let key

        if (period === 'week') {
          const weekStart = new Date(txDate)
          weekStart.setDate(txDate.getDate() - txDate.getDay())
          key = weekStart.toISOString().split('T')[0]
        } else if (period === 'month') {
          key = txDate.toISOString().slice(0, 7) // YYYY-MM
        } else {
          key = txDate.toISOString().split('T')[0] // day
        }

        if (!trends[key]) {
          trends[key] = {
            period: key,
            deposits: 0,
            withdrawals: 0,
            count: 0
          }
        }

        if (['deposit', 'transfer_in', 'reward', 'tip'].includes(tx.type)) {
          trends[key].deposits += Number(tx.amount || 0)
        } else if (['withdrawal', 'transfer_out', 'purchase', 'rake'].includes(tx.type)) {
          trends[key].withdrawals += Number(tx.amount || 0)
        }

        trends[key].count++
      })

      return Object.values(trends).reverse()
    } catch (err) {
      console.warn('Failed to compute transaction trends:', err)
      return []
    }
  },

  // Format transaction type for display
  formatTransactionType(type) {
    const map = {
      'deposit': 'Deposit',
      'withdrawal': 'Withdrawal',
      'transfer_in': 'Received',
      'transfer_out': 'Sent',
      'purchase': 'Purchase',
      'reward': 'Reward',
      'rake': 'Fee',
      'tip': 'Tip',
      'adjustment': 'Adjustment'
    }
    return map[type] || type
  },

  // Get transaction icon/color based on type
  getTransactionStyle(type) {
    const styles = {
      'deposit': { icon: '📥', color: 'green', label: 'Deposit' },
      'withdrawal': { icon: '📤', color: 'red', label: 'Withdrawal' },
      'transfer_in': { icon: '📨', color: 'blue', label: 'Received' },
      'transfer_out': { icon: '📬', color: 'orange', label: 'Sent' },
      'purchase': { icon: '🛒', color: 'purple', label: 'Purchase' },
      'reward': { icon: '🎁', color: 'yellow', label: 'Reward' },
      'rake': { icon: '💰', color: 'gray', label: 'Fee' },
      'tip': { icon: '💸', color: 'green', label: 'Tip' },
      'adjustment': { icon: '⚙️', color: 'gray', label: 'Adjustment' }
    }
    return styles[type] || { icon: '📝', color: 'gray', label: 'Transaction' }
  }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { getProviderByName, getAvailableProviders, WALLET_PROVIDERS } from './walletProviders'

const WALLET_STORAGE_KEY = 'connected_wallets_v2'
const WALLET_BALANCE_CACHE_KEY = 'wallet_balances_v2'

export function useWalletManager() {
  const [connectedWallets, setConnectedWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Load wallets from storage on mount
  useEffect(() => {
    loadPersistedWallets()
  }, [])

  // Load wallets from session storage
  const loadPersistedWallets = useCallback(() => {
    try {
      const stored = sessionStorage.getItem(WALLET_STORAGE_KEY)
      if (stored) {
        const wallets = JSON.parse(stored)
        setConnectedWallets(
          wallets.map(w => ({
            ...w,
            id: `${w.providerName}-${w.address}-${Date.now()}`
          }))
        )
      }
    } catch (err) {
      console.error('Failed to load persisted wallets:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Persist wallets to session storage
  const persistWallets = useCallback((wallets) => {
    try {
      const toStore = wallets.map(w => ({
        providerName: w.providerName,
        providerType: w.providerType,
        address: w.address,
        chainId: w.chainId,
        chainName: w.chainName,
        balance: w.balance,
        lastSync: w.lastSync
      }))
      sessionStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(toStore))
    } catch (err) {
      console.error('Failed to persist wallets:', err)
    }
  }, [])

  // Connect to a wallet
  const connectWallet = useCallback(async (providerKey) => {
    setError(null)
    try {
      const provider = WALLET_PROVIDERS[providerKey]
      if (!provider) {
        throw new Error(`Unknown wallet provider: ${providerKey}`)
      }

      const walletInfo = await provider.connect()

      // Check if already connected
      const exists = connectedWallets.some(
        w => w.providerName === walletInfo.providerName && w.address === walletInfo.address
      )

      if (exists) {
        setError('This wallet is already connected')
        return null
      }

      const newWallet = {
        ...walletInfo,
        id: `${walletInfo.providerName}-${walletInfo.address}-${Date.now()}`,
        balance: null,
        lastSync: null
      }

      const updated = [...connectedWallets, newWallet]
      setConnectedWallets(updated)
      persistWallets(updated)

      return newWallet
    } catch (err) {
      const errorMsg = err.message || 'Failed to connect wallet'
      setError(errorMsg)
      console.error('Wallet connection error:', err)
      return null
    }
  }, [connectedWallets, persistWallets])

  // Disconnect a wallet
  const disconnectWallet = useCallback(async (walletId) => {
    try {
      const wallet = connectedWallets.find(w => w.id === walletId)
      if (!wallet) return

      const provider = getProviderByName(wallet.providerName)
      if (provider && wallet.provider) {
        await provider.disconnect(wallet.provider)
      }

      const updated = connectedWallets.filter(w => w.id !== walletId)
      setConnectedWallets(updated)
      persistWallets(updated)
    } catch (err) {
      console.error('Failed to disconnect wallet:', err)
      setError(err.message)
    }
  }, [connectedWallets, persistWallets])

  // Disconnect all wallets
  const disconnectAll = useCallback(async () => {
    try {
      for (const wallet of connectedWallets) {
        const provider = getProviderByName(wallet.providerName)
        if (provider && wallet.provider) {
          try {
            await provider.disconnect(wallet.provider)
          } catch (e) {
            console.debug(`Failed to disconnect ${wallet.providerName}:`, e.message)
          }
        }
      }
      setConnectedWallets([])
      sessionStorage.removeItem(WALLET_STORAGE_KEY)
    } catch (err) {
      console.error('Failed to disconnect all wallets:', err)
      setError(err.message)
    }
  }, [connectedWallets])

  // Sync balances for all connected wallets
  const syncWalletBalances = useCallback(async (userId) => {
    if (!userId || connectedWallets.length === 0) return

    setIsSyncing(true)
    const updated = [...connectedWallets]

    try {
      for (let i = 0; i < updated.length; i++) {
        const wallet = updated[i]
        try {
          let balance = null

          if (wallet.providerType === 'evm' && wallet.ethersProvider) {
            const balanceWei = await wallet.ethersProvider.getBalance(wallet.address)
            balance = parseFloat(ethers.utils.formatEther(balanceWei))
          } else if (wallet.providerType === 'solana') {
            const connection = new (await import('@solana/web3.js')).Connection(
              'https://api.mainnet-beta.solana.com'
            )
            const publicKey = new (await import('@solana/web3.js')).PublicKey(wallet.address)
            const lamports = await connection.getBalance(publicKey)
            balance = lamports / 1e9 // Convert to SOL
          }

          updated[i] = {
            ...wallet,
            balance,
            lastSync: new Date().toISOString()
          }

          // Save to database
          if (userId && balance !== null) {
            await supabase.from('wallets_crypto').upsert(
              {
                user_id: userId,
                address: wallet.address,
                provider: wallet.providerName.toLowerCase(),
                chain: wallet.chainName || 'Unknown',
                chain_id: wallet.chainId,
                balance: balance,
                updated_at: new Date().toISOString()
              },
              { onConflict: 'user_id,address' }
            )
          }
        } catch (err) {
          console.warn(`Failed to sync balance for ${wallet.providerName}:`, err.message)
        }
      }

      setConnectedWallets(updated)
      persistWallets(updated)
    } catch (err) {
      console.error('Balance sync error:', err)
      setError('Failed to sync wallet balances')
    } finally {
      setIsSyncing(false)
    }
  }, [connectedWallets, persistWallets])

  // Switch to different chain
  const switchChain = useCallback(async (walletId, chainId) => {
    try {
      const wallet = connectedWallets.find(w => w.id === walletId)
      if (!wallet || !wallet.provider) return

      if (wallet.provider.request) {
        await wallet.provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }]
        })

        const updated = connectedWallets.map(w =>
          w.id === walletId ? { ...w, chainId } : w
        )
        setConnectedWallets(updated)
        persistWallets(updated)
      }
    } catch (err) {
      console.error('Failed to switch chain:', err)
      setError(`Failed to switch to chain ${chainId}`)
    }
  }, [connectedWallets, persistWallets])

  // Get available wallets to connect
  const getAvailableWallets = useCallback(() => {
    return getAvailableProviders().map(p => ({
      key: p.key || p.name.toLowerCase(),
      name: p.name,
      available: !p.detectable || p.detect()
    }))
  }, [])

  // Sign a message with a wallet
  const signMessage = useCallback(async (walletId, message) => {
    try {
      const wallet = connectedWallets.find(w => w.id === walletId)
      if (!wallet) {
        throw new Error('Wallet not found')
      }

      if (wallet.providerType === 'solana' && wallet.provider) {
        const signature = await wallet.provider.signMessage(
          new TextEncoder().encode(message)
        )
        return signature
      } else if (wallet.signer) {
        return await wallet.signer.signMessage(message)
      }

      throw new Error(`Signing not supported for ${wallet.providerName}`)
    } catch (err) {
      console.error('Failed to sign message:', err)
      setError(err.message)
      return null
    }
  }, [connectedWallets])

  return {
    connectedWallets,
    loading,
    error,
    isSyncing,
    connectWallet,
    disconnectWallet,
    disconnectAll,
    syncWalletBalances,
    switchChain,
    getAvailableWallets,
    signMessage,
    setError,
    loadPersistedWallets
  }
}

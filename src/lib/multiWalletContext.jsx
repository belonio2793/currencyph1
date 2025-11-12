import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const MultiWalletContext = createContext()

export function MultiWalletProvider({ children }) {
  const [connectedWallets, setConnectedWallets] = useState([])
  const [walletErrors, setWalletErrors] = useState({})
  const [syncingWallets, setSyncingWallets] = useState(new Set())

  // Add a connected wallet
  const addWallet = useCallback((wallet) => {
    setConnectedWallets(prev => {
      const exists = prev.some(w => w.providerName === wallet.providerName && w.address === wallet.address)
      if (exists) return prev
      return [...prev, { ...wallet, id: `${wallet.providerName}-${wallet.address}-${Date.now()}` }]
    })
    setWalletErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[wallet.providerName]
      return newErrors
    })
  }, [])

  // Remove a connected wallet
  const removeWallet = useCallback((walletId) => {
    setConnectedWallets(prev => prev.filter(w => w.id !== walletId))
  }, [])

  // Update wallet balance
  const updateWalletBalance = useCallback((walletId, balance) => {
    setConnectedWallets(prev =>
      prev.map(w => w.id === walletId ? { ...w, balance } : w)
    )
  }, [])

  // Set error for a wallet provider
  const setWalletError = useCallback((providerName, error) => {
    setWalletErrors(prev => ({
      ...prev,
      [providerName]: error
    }))
  }, [])

  // Clear error for a wallet provider
  const clearWalletError = useCallback((providerName) => {
    setWalletErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[providerName]
      return newErrors
    })
  }, [])

  // Mark wallet as syncing
  const setWalletSyncing = useCallback((walletId, syncing) => {
    setSyncingWallets(prev => {
      const newSet = new Set(prev)
      if (syncing) {
        newSet.add(walletId)
      } else {
        newSet.delete(walletId)
      }
      return newSet
    })
  }, [])

  // Disconnect all wallets
  const disconnectAll = useCallback(() => {
    setConnectedWallets([])
    setWalletErrors({})
  }, [])

  const value = {
    connectedWallets,
    walletErrors,
    syncingWallets,
    addWallet,
    removeWallet,
    updateWalletBalance,
    setWalletError,
    clearWalletError,
    setWalletSyncing,
    disconnectAll
  }

  return (
    <MultiWalletContext.Provider value={value}>
      {children}
    </MultiWalletContext.Provider>
  )
}

export function useMultiWallet() {
  const context = useContext(MultiWalletContext)
  if (!context) {
    throw new Error('useMultiWallet must be used within MultiWalletProvider')
  }
  return context
}

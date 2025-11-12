import React, { useState, useEffect } from 'react'
import { useWalletManager } from '../lib/useWalletManager'
import { formatWalletAddress } from '../lib/thirdwebClient'
import { WALLET_PROVIDERS } from '../lib/walletProviders'

const WALLET_COLORS = {
  'MetaMask': 'from-orange-400 to-orange-600',
  'WalletConnect': 'from-blue-400 to-blue-600',
  'Coinbase Wallet': 'from-blue-500 to-cyan-600',
  'Phantom': 'from-purple-400 to-purple-600',
  'Venly': 'from-indigo-400 to-indigo-600'
}

const WALLET_ICONS = {
  'MetaMask': '🦊',
  'WalletConnect': '🔗',
  'Coinbase Wallet': '🪙',
  'Phantom': '👻',
  'Venly': '✨'
}

export default function MultiWalletPanel({ userId, onWalletChange }) {
  const {
    connectedWallets,
    loading,
    error,
    isSyncing,
    connectWallet,
    disconnectWallet,
    disconnectAll,
    syncWalletBalances,
    getAvailableWallets,
    setError
  } = useWalletManager()

  const [availableWallets, setAvailableWallets] = useState([])
  const [showConnectMenu, setShowConnectMenu] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedWalletId, setSelectedWalletId] = useState(null)

  useEffect(() => {
    setAvailableWallets(getAvailableWallets())
  }, [getAvailableWallets])

  useEffect(() => {
    if (connectedWallets.length > 0) {
      onWalletChange?.(connectedWallets)
    }
  }, [connectedWallets, onWalletChange])

  const handleConnect = async (providerKey) => {
    setShowConnectMenu(false)
    const wallet = await connectWallet(providerKey)
    if (wallet) {
      setSelectedWalletId(wallet.id)
      await syncWalletBalances(userId)
    }
  }

  const handleDisconnect = async (walletId) => {
    await disconnectWallet(walletId)
    if (selectedWalletId === walletId) {
      setSelectedWalletId(null)
    }
  }

  const handleSyncAll = async () => {
    await syncWalletBalances(userId)
  }

  const selectedWallet = connectedWallets.find(w => w.id === selectedWalletId) || connectedWallets[0]

  return (
    <div className="space-y-4">
      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-600 hover:text-red-800 mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Connected Wallets Overview */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Connected Wallets</h3>
            <p className="text-xs text-slate-500 mt-1">
              {connectedWallets.length} wallet{connectedWallets.length !== 1 ? 's' : ''} connected
            </p>
          </div>
          <div className="flex gap-2">
            {connectedWallets.length > 0 && (
              <>
                <button
                  onClick={handleSyncAll}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition-colors"
                >
                  {isSyncing ? '⟳ Syncing...' : '⟳ Sync'}
                </button>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="px-3 py-2 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 transition-colors"
                >
                  {showDetails ? 'Hide' : 'Show'} Details
                </button>
              </>
            )}
          </div>
        </div>

        {/* Connected Wallets List */}
        {connectedWallets.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm mb-4">No wallets connected yet</p>
            <button
              onClick={() => setShowConnectMenu(!showConnectMenu)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + Connect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {connectedWallets.map((wallet) => (
              <div
                key={wallet.id}
                onClick={() => setSelectedWalletId(wallet.id)}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedWallet?.id === wallet.id
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${WALLET_COLORS[wallet.providerName] || 'from-slate-400 to-slate-600'} flex items-center justify-center text-xl`}>
                      {WALLET_ICONS[wallet.providerName] || '💼'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{wallet.providerName}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {formatWalletAddress(wallet.address, 6)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDisconnect(wallet.id)
                    }}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Expanded details */}
                {showDetails && selectedWallet?.id === wallet.id && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Chain:</span>
                      <span className="font-mono text-slate-900">{wallet.chainName || 'Unknown'} (#{wallet.chainId})</span>
                    </div>
                    {wallet.balance !== null && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Balance:</span>
                        <span className="font-mono text-slate-900">
                          {wallet.providerType === 'solana' ? wallet.balance.toFixed(6) : wallet.balance.toFixed(8)} {wallet.chainName === 'Solana' ? 'SOL' : wallet.chainName === 'Ethereum' ? 'ETH' : 'ETH'}
                        </span>
                      </div>
                    )}
                    {wallet.lastSync && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Last Sync:</span>
                        <span className="text-slate-500">
                          {new Date(wallet.lastSync).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-600">Type:</span>
                      <span className="font-medium text-indigo-600 uppercase">
                        {wallet.providerType === 'solana' ? 'Solana' : 'EVM'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect New Wallet */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <button
          onClick={() => setShowConnectMenu(!showConnectMenu)}
          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          {showConnectMenu ? '✕ Hide' : '+ Connect New Wallet'}
        </button>

        {showConnectMenu && (
          <div className="mt-3 space-y-2">
            {availableWallets.map((wallet) => (
              <button
                key={wallet.key}
                onClick={() => handleConnect(wallet.key)}
                disabled={loading || isSyncing}
                className={`w-full px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 ${
                  wallet.available
                    ? 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span className="text-lg">
                  {WALLET_ICONS[wallet.name] || '💼'}
                </span>
                <span>{wallet.name}</span>
                {!wallet.available && (
                  <span className="text-xs text-slate-400 ml-auto">Not installed</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Disconnect All */}
      {connectedWallets.length > 1 && (
        <button
          onClick={disconnectAll}
          className="w-full px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
        >
          Disconnect All Wallets
        </button>
      )}

      {/* Selected Wallet Actions */}
      {selectedWallet && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-200 p-4">
          <h4 className="font-semibold text-slate-900 mb-3">Selected Wallet Actions</h4>
          <div className="space-y-2">
            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition-colors text-sm font-medium"
            >
              {isSyncing ? 'Syncing Balance...' : 'Sync Balance'}
            </button>
            <button
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              disabled
            >
              Send Transaction (Coming Soon)
            </button>
            <button
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              disabled
            >
              Sign Message (Coming Soon)
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

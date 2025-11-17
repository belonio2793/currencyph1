import React, { useState, useEffect } from 'react'
import {
  metamaskConnection,
  walletconnectConnection,
  coinbaseConnection,
  phantomConnection,
  venlyConnection,
  getAvailableWallets
} from '../lib/walletConnections'

const WALLETS = [
  {
    key: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    connection: metamaskConnection,
    description: 'Injected wallet - requires browser extension'
  },
  {
    key: 'walletconnect',
    name: 'WalletConnect',
    icon: '🔗',
    connection: walletconnectConnection,
    description: 'Multi-chain QR code connection'
  },
  {
    key: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '🪙',
    connection: coinbaseConnection,
    description: 'Coinbase wallet - extension or smart wallet'
  },
  {
    key: 'phantom',
    name: 'Phantom',
    icon: '👻',
    connection: phantomConnection,
    description: 'Phantom wallet - EVM support'
  },
  {
    key: 'venly',
    name: 'Venly',
    icon: '✨',
    connection: venlyConnection,
    description: 'Venly wallet - enterprise solution'
  }
]

function WalletTestCard({ wallet }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [walletInfo, setWalletInfo] = useState(null)
  const [isAvailable, setIsAvailable] = useState(false)

  useEffect(() => {
    setIsAvailable(wallet.connection.isAvailable?.())
  }, [wallet])

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setWalletInfo(null)

    try {
      const result = await wallet.connection.connect()
      setWalletInfo(result)
      setSuccess(`✓ Connected to ${wallet.name}`)
    } catch (err) {
      setError(err.message || `Failed to connect to ${wallet.name}`)
      console.error(`${wallet.name} connection error:`, err)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await wallet.connection.disconnect(walletInfo?.provider)
      setWalletInfo(null)
      setSuccess(`✓ Disconnected from ${wallet.name}`)
    } catch (err) {
      setError(`Failed to disconnect: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{wallet.icon}</div>
          <div>
            <h3 className="font-semibold text-slate-900">{wallet.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{wallet.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isAvailable ? (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
              Available
            </span>
          ) : (
            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
              Not detected
            </span>
          )}
        </div>
      </div>

      {walletInfo && (
        <div className="bg-slate-50 rounded p-3 mb-3 text-sm space-y-2 border border-slate-200">
          <div>
            <p className="text-xs text-slate-600 font-medium">Address</p>
            <p className="font-mono text-xs text-slate-900 break-all">{walletInfo.address}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium">Chain</p>
            <p className="text-xs text-slate-900">
              {walletInfo.chainName} (ID: {walletInfo.chainId})
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium">Type</p>
            <p className="text-xs text-slate-900">{walletInfo.providerType}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <p className="text-xs text-red-700 font-medium mb-1">Error</p>
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
          <p className="text-xs text-green-700">{success}</p>
        </div>
      )}

      <button
        onClick={walletInfo ? handleDisconnect : handleConnect}
        disabled={loading || (!isAvailable && wallet.key !== 'walletconnect')}
        className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
          walletInfo
            ? 'bg-red-100 text-red-700 hover:bg-red-200 disabled:bg-slate-100 disabled:text-slate-400'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400'
        }`}
      >
        {loading ? (
          <>
            <span className="inline-block mr-2">⟳</span>
            {walletInfo ? 'Disconnecting...' : 'Connecting...'}
          </>
        ) : walletInfo ? (
          'Disconnect'
        ) : (
          'Connect'
        )}
      </button>
    </div>
  )
}

export default function WalletTestPage() {
  const [availableWallets, setAvailableWallets] = useState([])

  useEffect(() => {
    const available = getAvailableWallets()
    console.log('Available wallets:', available)
    setAvailableWallets(available)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">🔐 Wallet Integration Test</h1>
          <p className="text-slate-600">
            Test each wallet provider independently to verify proper configuration and connectivity.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Project ID:</strong> {import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'Not configured'}
            </p>
            <p className="text-sm text-blue-900 mt-1">
              <strong>Environment:</strong> {import.meta.env.DEV ? 'Development' : 'Production'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WALLETS.map((wallet) => (
            <WalletTestCard key={wallet.key} wallet={wallet} />
          ))}
        </div>

        <div className="mt-8 bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Connection Status</h2>
          <div className="space-y-2 text-sm">
            <p className="text-slate-600">
              <strong>Available Wallets ({availableWallets.filter(w => w.isAvailable).length}):</strong>
            </p>
            <ul className="list-disc pl-6 text-slate-700">
              {availableWallets.filter(w => w.isAvailable).map((w) => (
                <li key={w.key}>{w.name}</li>
              ))}
            </ul>

            <p className="text-slate-600 mt-4">
              <strong>Not Detected ({availableWallets.filter(w => !w.isAvailable).length}):</strong>
            </p>
            <ul className="list-disc pl-6 text-slate-700">
              {availableWallets.filter(w => !w.isAvailable).map((w) => (
                <li key={w.key}>{w.name}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">Troubleshooting</h3>
            <ul className="text-xs text-slate-600 space-y-2">
              <li>
                <strong>MetaMask:</strong> Install the{' '}
                <a
                  href="https://metamask.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  MetaMask extension
                </a>
              </li>
              <li>
                <strong>WalletConnect:</strong> Requires a valid Project ID and supports QR code scanning
              </li>
              <li>
                <strong>Coinbase:</strong> Install{' '}
                <a
                  href="https://www.coinbase.com/wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Coinbase Wallet
                </a>
              </li>
              <li>
                <strong>Phantom:</strong> Install the{' '}
                <a
                  href="https://phantom.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Phantom wallet
                </a>
              </li>
              <li>
                <strong>Venly:</strong> Use{' '}
                <a
                  href="https://www.venly.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Venly
                </a>{' '}
                dashboard
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

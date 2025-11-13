import { ethers } from 'ethers'
import {
  metamaskConnection,
  walletconnectConnection,
  coinbaseConnection,
  phantomConnection,
  venlyConnection,
  getAvailableWallets as getAvailableWalletsFromConnections
} from './walletConnections'

// Re-export wallet connections as providers for backward compatibility
export const MetaMaskProvider = metamaskConnection
export const WalletConnectProviderAdapter = walletconnectConnection
export const CoinbaseWalletProvider = coinbaseConnection
export const PhantomProvider = phantomConnection
export const VenlyProvider = venlyConnection

// Export all providers
export const WALLET_PROVIDERS = {
  metamask: metamaskConnection,
  walletconnect: walletconnectConnection,
  coinbase: coinbaseConnection,
  phantom: phantomConnection,
  venly: venlyConnection
}

// Get all available providers
export function getAvailableProviders() {
  return Object.entries(WALLET_PROVIDERS).map(([key, provider]) => ({
    key,
    name: provider.name,
    icon: provider.icon,
    detectable: true,
    detect: typeof provider.isAvailable === 'function' ? provider.isAvailable : () => false,
    connect: provider.connect,
    disconnect: provider.disconnect
  }))
}

// Detect which wallets are available
export function detectAvailableWallets() {
  return getAvailableWalletsFromConnections()
    .filter(w => w.isAvailable)
    .map(w => ({ key: w.key, name: w.name }))
}

// Get provider by name
export function getProviderByName(name) {
  const providers = Object.values(WALLET_PROVIDERS)
  return providers.find(p => p.name === name)
}

// Get provider by key
export function getProviderByKey(key) {
  return WALLET_PROVIDERS[key]
}

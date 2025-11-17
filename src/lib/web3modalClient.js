import { connectToWallet, connectToAnyWallet, disconnectFromWallet, getAvailableWallets } from './walletConnections'

/**
 * Connect via Web3Modal - tries MetaMask first, then any available wallet
 */
export async function connectViaWeb3Modal() {
  try {
    // Try MetaMask first if available
    if (window.ethereum?.isMetaMask) {
      try {
        return await connectToWallet('metamask')
      } catch (e) {
        console.warn('MetaMask connection failed:', e.message)
      }
    }

    // Try any available wallet
    return await connectToAnyWallet()
  } catch (error) {
    throw new Error(`Web3Modal connection failed: ${error.message}`)
  }
}

/**
 * Connect with Coinbase
 */
export async function connectWithCoinbase() {
  try {
    return await connectToWallet('coinbase')
  } catch (error) {
    throw new Error(`Coinbase Wallet connection failed: ${error.message}`)
  }
}

/**
 * Connect with Phantom (EVM)
 */
export async function connectWithPhantom() {
  try {
    return await connectToWallet('phantom')
  } catch (error) {
    throw new Error(`Phantom connection failed: ${error.message}`)
  }
}

/**
 * Connect with Venly
 */
export async function connectWithVenly() {
  try {
    return await connectToWallet('venly')
  } catch (error) {
    throw new Error(`Venly connection failed: ${error.message}`)
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(provider) {
  try {
    if (provider && typeof provider.disconnect === 'function') {
      await provider.disconnect()
    }
  } catch (error) {
    console.debug('Disconnect error:', error.message)
  }
}

/**
 * Get available wallets
 */
export function getAvailableWalletsInfo() {
  return getAvailableWallets()
}

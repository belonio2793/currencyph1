import { connectToWallet, disconnectFromWallet, getAvailableWallets } from './walletConnections'

/**
 * Connect via Web3Modal - tries MetaMask first, then WalletConnect
 */
export async function connectViaWeb3Modal() {
  try {
    // Try MetaMask first if available
    if (window.ethereum?.isMetaMask) {
      try {
        return await connectToWallet('metamask')
      } catch (e) {
        console.warn('MetaMask connection failed:', e.message)
        // Fall through to WalletConnect
      }
    }
    
    // Fall back to WalletConnect
    return await connectToWallet('walletconnect')
  } catch (error) {
    throw new Error(`Web3Modal connection failed: ${error.message}`)
  }
}

/**
 * Connect with WalletConnect directly
 */
export async function connectWithWalletConnect() {
  try {
    return await connectToWallet('walletconnect')
  } catch (error) {
    throw new Error(`WalletConnect connection failed: ${error.message}`)
  }
}

/**
 * Connect with Coinbase
 */
export async function connectWithCoinbase() {
  try {
    return await connectToWallet('coinbase')
  } catch (error) {
    // If Coinbase fails, try WalletConnect as fallback
    try {
      return await connectToWallet('walletconnect')
    } catch (wcError) {
      throw new Error(`Coinbase Wallet connection failed: ${error.message}`)
    }
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

/**
 * Connect to any available wallet with fallback logic
 */
export async function connectToAnyWallet(preferredWallet = null) {
  const available = getAvailableWallets()
  
  // Try preferred wallet first
  if (preferredWallet) {
    const wallet = available.find(w => w.key === preferredWallet)
    if (wallet && (wallet.key === 'walletconnect' || wallet.isAvailable)) {
      try {
        return await connectToWallet(preferredWallet)
      } catch (error) {
        console.warn(`Failed to connect with ${preferredWallet}:`, error.message)
      }
    }
  }
  
  // Try available wallets in order of detection
  for (const wallet of available) {
    if (wallet.isAvailable || wallet.key === 'walletconnect') {
      try {
        return await connectToWallet(wallet.key)
      } catch (error) {
        console.debug(`Failed to connect with ${wallet.name}:`, error.message)
        continue
      }
    }
  }
  
  // Last resort: WalletConnect
  try {
    return await connectToWallet('walletconnect')
  } catch (error) {
    throw new Error('Could not connect to any wallet. Please install a Web3 wallet extension.')
  }
}

import { ethers } from 'ethers'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '339554ddb2542610ff4a0f53fc511981'
const rpcUrl = import.meta.env.VITE_RPC_URL_1 || 'https://eth.rpc.thirdweb.com'

/**
 * MetaMask Connection Handler
 */
export const metamaskConnection = {
  name: 'MetaMask',
  icon: '🦊',
  isAvailable: () => typeof window !== 'undefined' && window.ethereum?.isMetaMask === true,
  
  async connect() {
    if (!window.ethereum?.isMetaMask) {
      throw new Error('MetaMask is not installed. Please install the MetaMask extension.')
    }

    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask')
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()

      return {
        providerName: 'MetaMask',
        providerType: 'evm',
        address: accounts[0],
        provider: window.ethereum,
        ethersProvider: provider,
        signer,
        chainId: Number(network.chainId),
        chainName: network.name,
        connected: true
      }
    } catch (error) {
      if (error.code === 4001) {
        throw new Error('MetaMask connection was rejected by the user')
      }
      throw new Error(`MetaMask connection failed: ${error.message}`)
    }
  },

  async disconnect(provider) {
    // MetaMask doesn't require explicit disconnection
    return true
  }
}

/**
 * WalletConnect v2 Connection Handler
 */
export const walletconnectConnection = {
  name: 'WalletConnect',
  icon: '🔗',
  isAvailable: () => true,

  async connect() {
    if (!projectId || projectId.length < 32) {
      throw new Error('WalletConnect is not configured. Missing project ID.')
    }

    try {
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
      
      const wcProvider = await EthereumProvider.init({
        projectId,
        chains: [1, 137, 8453, 42161, 10, 43114],
        showQrModal: true,
        optionalChains: [1, 137, 8453],
        rpcMap: {
          1: rpcUrl,
          137: 'https://polygon.rpc.thirdweb.com',
          8453: 'https://base.rpc.thirdweb.com',
          42161: 'https://arbitrum.rpc.thirdweb.com',
          10: 'https://optimism.rpc.thirdweb.com',
          43114: 'https://avalanche.rpc.thirdweb.com'
        }
      })

      const accounts = await wcProvider.request({ 
        method: 'eth_requestAccounts' 
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from WalletConnect')
      }

      const provider = new ethers.BrowserProvider(wcProvider)
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()

      return {
        providerName: 'WalletConnect',
        providerType: 'evm',
        address: accounts[0],
        provider: wcProvider,
        ethersProvider: provider,
        signer,
        chainId: Number(network.chainId),
        chainName: network.name,
        connected: true
      }
    } catch (error) {
      if (error.message?.includes('frames-disallowed')) {
        throw new Error('WalletConnect cannot be used in an iframe. Try opening this page in a new tab.')
      }
      throw new Error(`WalletConnect connection failed: ${error.message}`)
    }
  },

  async disconnect(provider) {
    try {
      if (provider && typeof provider.disconnect === 'function') {
        await provider.disconnect()
      }
      return true
    } catch (error) {
      console.debug('WalletConnect disconnect error:', error.message)
      return true
    }
  }
}

/**
 * Coinbase Wallet Connection Handler
 */
export const coinbaseConnection = {
  name: 'Coinbase Wallet',
  icon: '🪙',
  isAvailable: () => {
    return typeof window !== 'undefined' && 
           (window.ethereum?.isCoinbaseWallet === true || window.ethereum?.providerMap?.get?.('CoinbaseWallet'))
  },

  async connect() {
    try {
      // Try to detect injected Coinbase provider first
      if (window.ethereum?.isCoinbaseWallet) {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })

        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts returned from Coinbase Wallet')
        }

        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const network = await provider.getNetwork()

        return {
          providerName: 'Coinbase Wallet',
          providerType: 'evm',
          address: accounts[0],
          provider: window.ethereum,
          ethersProvider: provider,
          signer,
          chainId: Number(network.chainId),
          chainName: network.name,
          connected: true
        }
      }

      // Fallback: Use Coinbase SDK
      const { default: CoinbaseWalletSDK } = await import('@coinbase/wallet-sdk')
      const coinbase = new CoinbaseWalletSDK({
        appName: 'Currency PH',
        appLogoUrl: '/logo.png'
      })

      const ethereum = coinbase.makeWeb3Provider(rpcUrl, 1)
      const accounts = await ethereum.request({ 
        method: 'eth_requestAccounts' 
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from Coinbase Wallet')
      }

      const provider = new ethers.BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()
      const address = await signer.getAddress()

      return {
        providerName: 'Coinbase Wallet',
        providerType: 'evm',
        address,
        provider: ethereum,
        ethersProvider: provider,
        signer,
        chainId: Number(network.chainId),
        chainName: network.name,
        connected: true
      }
    } catch (error) {
      if (error.code === 4001) {
        throw new Error('Coinbase Wallet connection was rejected by the user')
      }
      throw new Error(`Coinbase Wallet connection failed: ${error.message}`)
    }
  },

  async disconnect(provider) {
    try {
      if (provider && typeof provider.disconnect === 'function') {
        await provider.disconnect()
      }
      return true
    } catch (error) {
      console.debug('Coinbase disconnect error:', error.message)
      return true
    }
  }
}

/**
 * Phantom Wallet Connection Handler (EVM mode)
 */
export const phantomConnection = {
  name: 'Phantom',
  icon: '👻',
  isAvailable: () => {
    return typeof window !== 'undefined' && 
           (window.phantom?.ethereum?.isPhantom === true || window.ethereum?.isPhantom === true)
  },

  async connect() {
    try {
      const phantomProvider = window.phantom?.ethereum || window.ethereum

      if (!phantomProvider?.isPhantom) {
        throw new Error('Phantom is not installed. Please install the Phantom extension.')
      }

      const accounts = await phantomProvider.request({ 
        method: 'eth_requestAccounts' 
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from Phantom')
      }

      const provider = new ethers.BrowserProvider(phantomProvider)
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()

      return {
        providerName: 'Phantom',
        providerType: 'evm',
        address: accounts[0],
        provider: phantomProvider,
        ethersProvider: provider,
        signer,
        chainId: Number(network.chainId),
        chainName: network.name,
        connected: true
      }
    } catch (error) {
      if (error.code === 4001) {
        throw new Error('Phantom connection was rejected by the user')
      }
      throw new Error(`Phantom connection failed: ${error.message}`)
    }
  },

  async disconnect(provider) {
    try {
      if (provider && typeof provider.disconnect === 'function') {
        await provider.disconnect()
      }
      return true
    } catch (error) {
      console.debug('Phantom disconnect error:', error.message)
      return true
    }
  }
}

/**
 * Venly Wallet Connection Handler (via WalletConnect)
 */
export const venlyConnection = {
  name: 'Venly',
  icon: '✨',
  isAvailable: () => {
    return typeof window !== 'undefined' && 
           window.ethereum?.providerMap?.get?.('Venly')
  },

  async connect() {
    try {
      // Venly is available via injected provider
      if (window.ethereum?.providerMap?.get?.('Venly')) {
        const provider = window.ethereum
        const accounts = await provider.request({
          method: 'eth_requestAccounts',
          params: []
        })

        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts returned from Venly')
        }

        const ethersProvider = new ethers.BrowserProvider(provider)
        const signer = await ethersProvider.getSigner()
        const network = await ethersProvider.getNetwork()

        return {
          providerName: 'Venly',
          providerType: 'evm',
          address: accounts[0],
          provider: provider,
          ethersProvider,
          signer,
          chainId: Number(network.chainId),
          chainName: network.name,
          connected: true
        }
      }

      throw new Error('Venly is not available in this environment')
    } catch (error) {
      if (error.code === 4001) {
        throw new Error('Venly connection was rejected by the user')
      }
      throw new Error(`Venly connection failed: ${error.message}`)
    }
  },

  async disconnect(provider) {
    try {
      if (provider && typeof provider.disconnect === 'function') {
        await provider.disconnect()
      }
      return true
    } catch (error) {
      console.debug('Venly disconnect error:', error.message)
      return true
    }
  }
}

/**
 * All available wallet connections
 */
export const WALLET_CONNECTIONS = {
  metamask: metamaskConnection,
  walletconnect: walletconnectConnection,
  coinbase: coinbaseConnection,
  phantom: phantomConnection,
  venly: venlyConnection
}

/**
 * Get all available wallets (those that are installed or can be connected)
 */
export function getAvailableWallets() {
  return Object.entries(WALLET_CONNECTIONS)
    .map(([key, wallet]) => ({
      key,
      name: wallet.name,
      icon: wallet.icon,
      isAvailable: wallet.isAvailable()
    }))
    .filter(w => w.key === 'walletconnect' || w.isAvailable) // Always show WalletConnect
}

/**
 * Connect to a specific wallet
 */
export async function connectToWallet(walletKey) {
  const wallet = WALLET_CONNECTIONS[walletKey]
  
  if (!wallet) {
    throw new Error(`Unknown wallet: ${walletKey}`)
  }

  return wallet.connect()
}

/**
 * Disconnect from a wallet
 */
export async function disconnectFromWallet(walletKey, provider) {
  const wallet = WALLET_CONNECTIONS[walletKey]
  
  if (!wallet) {
    throw new Error(`Unknown wallet: ${walletKey}`)
  }

  return wallet.disconnect(provider)
}

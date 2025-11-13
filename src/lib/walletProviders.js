import { ethers } from 'ethers'

// MetaMask Provider Adapter
export const MetaMaskProvider = {
  name: 'MetaMask',
  detectable: true,
  detect: () => {
    return typeof window !== 'undefined' && 
           window.ethereum && 
           window.ethereum.isMetaMask === true
  },
  async connect() {
    if (!this.detect()) {
      throw new Error('MetaMask not detected. Please install MetaMask extension.')
    }
    
    const provider = window.ethereum
    const accounts = await provider.request({ method: 'eth_requestAccounts' })
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from MetaMask')
    }
    
    const ethersProvider = new ethers.BrowserProvider(provider)
    const signer = await ethersProvider.getSigner()
    const network = await ethersProvider.getNetwork()
    
    return {
      providerName: 'MetaMask',
      providerType: 'evm',
      address: accounts[0],
      provider: provider,
      ethersProvider,
      signer,
      chainId: network.chainId,
      chainName: network.name,
      connected: true
    }
  },
  async disconnect(provider) {
    if (provider && provider.isConnected && typeof provider.isConnected === 'function') {
      try {
        await provider.disconnect?.()
      } catch (e) {
        console.debug('MetaMask disconnect error:', e.message)
      }
    }
  }
}

// WalletConnect Provider Adapter
export const WalletConnectProviderAdapter = {
  name: 'WalletConnect',
  detectable: false,
  detect: () => false,
  async connect() {
    try {
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
      const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '339554ddb2542610ff4a0f53fc511981'

      if (!projectId || projectId.length < 32) {
        throw new Error('WalletConnect Project ID is not configured. Please set VITE_WALLETCONNECT_PROJECT_ID in your environment.')
      }

      const wcProvider = await EthereumProvider.init({
        projectId,
        chains: [1, 137, 8453],
        showQrModal: true,
        rpcMap: {
          1: import.meta.env.VITE_RPC_URL_1 || 'https://eth.rpc.thirdweb.com',
          137: 'https://polygon.rpc.thirdweb.com',
          8453: 'https://base.rpc.thirdweb.com'
        }
      })

      const accounts = await wcProvider.request({ method: 'eth_requestAccounts' })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from WalletConnect')
      }

      const ethersProvider = new ethers.BrowserProvider(wcProvider)
      const signer = await ethersProvider.getSigner()
      const network = await ethersProvider.getNetwork()

      return {
        providerName: 'WalletConnect',
        providerType: 'evm',
        address: accounts[0],
        provider: wcProvider,
        ethersProvider,
        signer,
        chainId: network.chainId,
        chainName: network.name,
        connected: true
      }
    } catch (error) {
      throw new Error(`WalletConnect connection failed: ${error.message}`)
    }
  },
  async disconnect(provider) {
    if (provider && typeof provider.disconnect === 'function') {
      try {
        await provider.disconnect()
      } catch (e) {
        console.debug('WalletConnect disconnect error:', e.message)
      }
    }
  }
}

// Coinbase Wallet Provider Adapter
export const CoinbaseWalletProvider = {
  name: 'Coinbase Wallet',
  detectable: true,
  detect: () => {
    return typeof window !== 'undefined' &&
           window.ethereum &&
           (window.ethereum.isCoinbaseWallet === true || window.ethereum.providerMap?.get?.('CoinbaseWallet'))
  },
  async connect() {
    if (window.ethereum && window.ethereum.isCoinbaseWallet) {
      const provider = window.ethereum
      const accounts = await provider.request({ method: 'eth_requestAccounts' })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from Coinbase Wallet')
      }

      const ethersProvider = new ethers.BrowserProvider(provider)
      const signer = await ethersProvider.getSigner()
      const network = await ethersProvider.getNetwork()

      return {
        providerName: 'Coinbase Wallet',
        providerType: 'evm',
        address: accounts[0],
        provider: provider,
        ethersProvider,
        signer,
        chainId: network.chainId,
        chainName: network.name,
        connected: true
      }
    }

    // Fallback: Try to initialize Coinbase SDK
    try {
      const { default: CoinbaseWalletSDK } = await import('@coinbase/wallet-sdk')
      const coinbase = new CoinbaseWalletSDK({
        appName: 'Currency PH',
        appLogoUrl: '/logo.png'
      })

      const rpcUrl = import.meta.env.VITE_RPC_URL_1 || 'https://eth.rpc.thirdweb.com'
      const ethereum = coinbase.makeWeb3Provider(rpcUrl, 1)
      
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from Coinbase Wallet SDK')
      }
      
      const ethersProvider = new ethers.providers.Web3Provider(ethereum)
      const signer = ethersProvider.getSigner()
      const network = await ethersProvider.getNetwork()
      
      return {
        providerName: 'Coinbase Wallet',
        providerType: 'evm',
        address: accounts[0],
        provider: ethereum,
        ethersProvider,
        signer,
        chainId: network.chainId,
        chainName: network.name,
        connected: true
      }
    } catch (error) {
      throw new Error(`Coinbase Wallet not available: ${error.message}`)
    }
  },
  async disconnect(provider) {
    if (provider && typeof provider.disconnect === 'function') {
      try {
        await provider.disconnect()
      } catch (e) {
        console.debug('Coinbase Wallet disconnect error:', e.message)
      }
    }
  }
}

// Phantom Provider Adapter (Solana + EVM)
export const PhantomProvider = {
  name: 'Phantom',
  detectable: true,
  detect: () => {
    return typeof window !== 'undefined' && 
           (window.phantom?.solana?.isPhantom === true || window.solana?.isPhantom === true)
  },
  async connect() {
    const solanaProvider = window.phantom?.solana || window.solana
    
    if (!solanaProvider) {
      throw new Error('Phantom wallet not detected. Please install Phantom extension.')
    }
    
    try {
      const response = await solanaProvider.connect()
      const publicKey = response.publicKey.toString()
      
      return {
        providerName: 'Phantom',
        providerType: 'solana',
        address: publicKey,
        provider: solanaProvider,
        chainId: 245022926, // Solana mainnet
        chainName: 'Solana',
        connected: true
      }
    } catch (error) {
      throw new Error(`Phantom connection failed: ${error.message}`)
    }
  },
  async disconnect(provider) {
    if (provider && typeof provider.disconnect === 'function') {
      try {
        await provider.disconnect()
      } catch (e) {
        console.debug('Phantom disconnect error:', e.message)
      }
    }
  }
}

// Venly Provider Adapter (via WalletConnect or direct)
export const VenlyProvider = {
  name: 'Venly',
  detectable: true,
  detect: () => {
    return typeof window !== 'undefined' && 
           window.ethereum && 
           window.ethereum.providerMap?.get?.('Venly')
  },
  async connect() {
    try {
      const provider = window.ethereum
      
      // Request accounts from Venly
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
        chainId: network.chainId,
        chainName: network.name,
        connected: true
      }
    } catch (error) {
      throw new Error(`Venly connection failed: ${error.message}`)
    }
  },
  async disconnect(provider) {
    if (provider && typeof provider.disconnect === 'function') {
      try {
        await provider.disconnect()
      } catch (e) {
        console.debug('Venly disconnect error:', e.message)
      }
    }
  }
}

// Export all providers
export const WALLET_PROVIDERS = {
  metamask: MetaMaskProvider,
  walletconnect: WalletConnectProviderAdapter,
  coinbase: CoinbaseWalletProvider,
  phantom: PhantomProvider,
  venly: VenlyProvider
}

// Get all available providers
export function getAvailableProviders() {
  return Object.entries(WALLET_PROVIDERS).map(([key, provider]) => ({
    key,
    ...provider
  }))
}

// Detect which wallets are available
export function detectAvailableWallets() {
  return getAvailableProviders()
    .filter(p => p.detectable && p.detect())
    .map(p => ({ key: p.key, name: p.name }))
}

// Get provider by name
export function getProviderByName(name) {
  return Object.values(WALLET_PROVIDERS).find(p => p.name === name)
}

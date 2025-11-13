import { EthereumProvider } from '@walletconnect/ethereum-provider'
import { ethers } from 'ethers'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '339554ddb2542610ff4a0f53fc511981'
const rpcUrl = import.meta.env.VITE_RPC_URL_1 || import.meta.env.VITE_RPC_URL || 'https://eth.rpc.thirdweb.com'

// Validate project ID
if (!projectId || projectId.length < 32) {
  console.warn('⚠️ WalletConnect Project ID is missing or invalid. Wallet connections may fail.')
}

export async function connectViaWeb3Modal() {
  try {
    if (window.ethereum?.isMetaMask) {
      return await connectViaMetaMask()
    }
    
    return await connectWithWalletConnect()
  } catch (e) {
    throw new Error(`Web3Modal connection failed: ${e.message}`)
  }
}

async function connectViaMetaMask() {
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts returned from MetaMask')
  }
  
  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  const network = await provider.getNetwork()
  
  return {
    address: accounts[0],
    provider: window.ethereum,
    connected: true,
    providerType: 'evm',
    providerName: 'metamask',
    chainId: Number(network.chainId)
  }
}

export async function connectWithWalletConnect() {
  try {
    const wcProvider = await EthereumProvider.init({
      projectId,
      chains: [1, 137, 8453],
      showQrModal: true,
      rpcMap: {
        1: rpcUrl,
        137: 'https://polygon.rpc.thirdweb.com',
        8453: 'https://base.rpc.thirdweb.com'
      }
    })
    
    const accounts = await wcProvider.request({ method: 'eth_requestAccounts' })
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from WalletConnect')
    }
    
    const provider = new ethers.BrowserProvider(wcProvider)
    const signer = await provider.getSigner()
    const network = await provider.getNetwork()
    
    return {
      address: accounts[0],
      provider: wcProvider,
      connected: true,
      providerType: 'evm',
      providerName: 'walletconnect',
      chainId: Number(network.chainId)
    }
  } catch (error) {
    throw new Error(`WalletConnect connection failed: ${error.message}`)
  }
}

export async function connectWithCoinbase() {
  try {
    const { default: CoinbaseWalletSDK } = await import('@coinbase/wallet-sdk').catch(() => ({ default: null }))
    
    if (!CoinbaseWalletSDK) {
      return await connectViaWeb3Modal()
    }

    const coinbase = new CoinbaseWalletSDK({
      appName: 'Currency PH'
    })
    
    const ethereum = coinbase.makeWeb3Provider(rpcUrl, 1)
    const provider = new ethers.BrowserProvider(ethereum)
    const signer = await provider.getSigner()
    const network = await provider.getNetwork()
    const address = await signer.getAddress()
    
    return {
      address,
      provider: ethereum,
      connected: true,
      providerType: 'evm',
      providerName: 'coinbase',
      chainId: Number(network.chainId)
    }
  } catch (e) {
    return await connectViaWeb3Modal()
  }
}

export async function disconnectWallet(provider) {
  try {
    if (provider && typeof provider.disconnect === 'function') {
      await provider.disconnect()
    }
  } catch (error) {
    console.debug('Disconnect error:', error.message)
  }
}

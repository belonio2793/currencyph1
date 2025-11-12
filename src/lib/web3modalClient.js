import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import Web3Modal from 'web3modal'
import { ethers } from 'ethers'

export async function connectViaWeb3Modal() {
  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        // Provide RPC mapping via env vars or default to public providers
        rpc: {
          1: process.env.VITE_RPC_URL_1 || process.env.RPC_URL_1 || 'https://mainnet.infura.io/v3/'
        }
      }
    }
  }

  const web3Modal = new Web3Modal({ cacheProvider: true, providerOptions })
  const instance = await web3Modal.connect()
  const provider = new ethers.providers.Web3Provider(instance)
  const signer = provider.getSigner()
  const address = await signer.getAddress()
  const network = await provider.getNetwork()

  return {
    address,
    provider: instance,
    connected: true,
    providerType: 'evm',
    providerName: instance.isMetaMask ? 'metamask' : (instance.wc ? 'walletconnect' : 'evm'),
    chainId: network.chainId
  }
}

// Explicit WalletConnect connector (bypasses Web3Modal UX)
export async function connectWithWalletConnect() {
  const rpc = {
    1: process.env.VITE_RPC_URL_1 || process.env.RPC_URL_1 || 'https://mainnet.infura.io/v3/'
  }
  const wcProvider = new WalletConnectProvider({ rpc })
  await wcProvider.enable()
  const provider = new ethers.providers.Web3Provider(wcProvider)
  const signer = provider.getSigner()
  const address = await signer.getAddress()
  const network = await provider.getNetwork()
  return {
    address,
    provider: wcProvider,
    connected: true,
    providerType: 'evm',
    providerName: 'walletconnect',
    chainId: network.chainId
  }
}

// Attempt to connect using Coinbase Wallet SDK if available, else fall back to Web3Modal
export async function connectWithCoinbase() {
  try {
    const { default: CoinbaseWalletSDK } = await import('@coinbase/wallet-sdk').catch(() => ({ default: null }))
    if (!CoinbaseWalletSDK) {
      return await connectViaWeb3Modal()
    }

    const coinbase = new CoinbaseWalletSDK({
      appName: 'My App',
      // appLogoUrl: '',
      // darkMode: false
    })
    const rpcUrl = process.env.VITE_RPC_URL_1 || process.env.RPC_URL_1 || 'https://mainnet.infura.io/v3/'
    const ethereum = coinbase.makeWeb3Provider(rpcUrl, 1)
    const provider = new ethers.providers.Web3Provider(ethereum)
    const signer = provider.getSigner()
    const address = await signer.getAddress()
    const network = await provider.getNetwork()
    return {
      address,
      provider: ethereum,
      connected: true,
      providerType: 'evm',
      providerName: 'coinbase',
      chainId: network.chainId
    }
  } catch (e) {
    return await connectViaWeb3Modal()
  }
}

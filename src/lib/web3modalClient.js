import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { ethers } from 'ethers'

export async function connectViaWeb3Modal() {
  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
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

export async function connectWithCoinbase() {
  try {
    const { default: CoinbaseWalletSDK } = await import('@coinbase/wallet-sdk').catch(() => ({ default: null }))
    if (!CoinbaseWalletSDK) {
      return await connectViaWeb3Modal()
    }

    const coinbase = new CoinbaseWalletSDK({
      appName: 'My App'
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

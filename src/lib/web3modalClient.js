import { getAccount, disconnect, watchAccount } from '@wagmi/core'
import { createConfig, http } from '@wagmi/core'
import { mainnet, polygon, sepolia } from '@wagmi/core/chains'
import { injected, walletConnect } from '@wagmi/connectors'
import { ethers } from 'ethers'

const chains = [mainnet, polygon, sepolia]
const projectId = process.env.VITE_WALLETCONNECT_PROJECT_ID || 'f7b2a1c3e8d4b9f2c5e8a1d4'

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected(),
    walletConnect({ projectId })
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [sepolia.id]: http()
  }
})

export async function connectViaWeb3Modal() {
  try {
    const account = getAccount(wagmiConfig)
    
    if (account.isConnected && account.address) {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()
      
      return {
        address: account.address,
        provider: window.ethereum,
        connected: true,
        providerType: 'evm',
        providerName: account.connector?.name || 'wallet',
        chainId: Number(network.chainId)
      }
    }
    
    throw new Error('No account connected')
  } catch (error) {
    throw new Error(`Web3Modal connection failed: ${error.message}`)
  }
}

export async function connectWithWalletConnect() {
  try {
    const { getConnectorClient } = await import('@wagmi/core')
    const client = await getConnectorClient(wagmiConfig)
    
    if (!client) {
      throw new Error('Failed to get connector client')
    }
    
    const provider = new ethers.BrowserProvider(client.transport.request)
    const signer = await provider.getSigner()
    const network = await provider.getNetwork()
    const account = getAccount(wagmiConfig)
    
    return {
      address: account.address,
      provider: client.transport.request,
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
    
    const rpcUrl = process.env.VITE_RPC_URL_1 || 'https://eth.rpc.thirdweb.com'
    const ethereum = coinbase.makeWeb3Provider(rpcUrl, 1)
    const provider = new ethers.BrowserProvider(ethereum)
    const signer = await provider.getSigner()
    const network = await provider.getNetwork()
    
    return {
      address: await signer.getAddress(),
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

export async function disconnectWallet() {
  try {
    await disconnect(wagmiConfig)
  } catch (error) {
    console.debug('Disconnect error:', error.message)
  }
}

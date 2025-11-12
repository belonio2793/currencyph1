import { createAppKit, useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, sepolia, polygon, arbitrum } from '@reown/appkit/networks'
import { ethers } from 'ethers'

let appKit = null

export function initializeAppKit() {
  if (appKit) return appKit

  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '1a63e5eda41be77d4d944c6684b9b588'

  const metadata = {
    name: 'Currency PH',
    description: 'Currency and Listings Platform',
    url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
    icons: ['https://avatars.githubusercontent.com/u/37784886']
  }

  const networks = [mainnet, sepolia, polygon, arbitrum]

  const ethersAdapter = new EthersAdapter({ signerType: 'json-rpc' })

  appKit = createAppKit({
    adapters: [ethersAdapter],
    networks: networks,
    projectId: projectId,
    metadata: metadata,
    features: {
      analytics: true,
      onramp: false
    }
  })

  return appKit
}

export async function connectViaWeb3Modal() {
  try {
    const kit = initializeAppKit()

    if (!kit) {
      throw new Error('AppKit initialization failed')
    }

    await kit.open({ view: 'Connect' })

    const { address, isConnected } = kit.getAccount()
    if (!isConnected || !address) {
      throw new Error('Connection cancelled or failed')
    }

    const provider = kit.getEthersProvider()
    const signer = await provider.getSigner()
    const network = await provider.getNetwork()

    return {
      address,
      provider: provider,
      signer: signer,
      connected: true,
      providerType: 'evm',
      providerName: 'walletconnect',
      chainId: network.chainId
    }
  } catch (error) {
    console.error('AppKit connection error:', error)
    throw error
  }
}

export async function connectWithWalletConnect() {
  try {
    const kit = initializeAppKit()

    if (!kit) {
      throw new Error('AppKit initialization failed')
    }

    await kit.open({ view: 'Connect' })

    const { address, isConnected } = kit.getAccount()
    if (!isConnected || !address) {
      throw new Error('Connection cancelled or failed')
    }

    const provider = kit.getEthersProvider()
    const signer = await provider.getSigner()
    const network = await provider.getNetwork()

    return {
      address,
      provider: provider,
      signer: signer,
      connected: true,
      providerType: 'evm',
      providerName: 'walletconnect',
      chainId: network.chainId
    }
  } catch (error) {
    console.error('WalletConnect error:', error)
    throw error
  }
}

export async function connectWithCoinbase() {
  try {
    const kit = initializeAppKit()

    if (!kit) {
      throw new Error('AppKit initialization failed')
    }

    await kit.open({ view: 'Connect' })

    const { address, isConnected } = kit.getAccount()
    if (!isConnected || !address) {
      throw new Error('Connection cancelled or failed')
    }

    const provider = kit.getEthersProvider()
    const signer = await provider.getSigner()
    const network = await provider.getNetwork()

    return {
      address,
      provider: provider,
      signer: signer,
      connected: true,
      providerType: 'evm',
      providerName: 'coinbase',
      chainId: network.chainId
    }
  } catch (error) {
    console.error('Coinbase connection error:', error)
    throw error
  }
}

export function getAppKit() {
  return initializeAppKit()
}

export function isAppKitConnected() {
  const kit = appKit
  if (!kit) return false
  const { isConnected } = kit.getAccount()
  return isConnected
}

export function getAppKitAddress() {
  const kit = appKit
  if (!kit) return null
  const { address } = kit.getAccount()
  return address
}

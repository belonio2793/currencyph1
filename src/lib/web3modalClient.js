import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
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

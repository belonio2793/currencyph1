import { createThirdwebClient, getContract, prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { toWei, fromWei } from 'thirdweb/utils'
import { ethereum, polygon, base, arbitrum, optimism, solana, avalanche } from 'thirdweb/chains'

const CLIENT_ID = import.meta.env.VITE_THIRDWEB_CLIENT_ID

if (!CLIENT_ID) {
  throw new Error('VITE_THIRDWEB_CLIENT_ID environment variable is required')
}

export const thirdwebClient = createThirdwebClient({ clientId: CLIENT_ID })

// Supported chains for Thirdweb integration
export const SUPPORTED_CHAINS = {
  ethereum: { chainId: 1, name: 'Ethereum', symbol: 'ETH', object: ethereum },
  polygon: { chainId: 137, name: 'Polygon', symbol: 'MATIC', object: polygon },
  base: { chainId: 8453, name: 'Base', symbol: 'BASE', object: base },
  arbitrum: { chainId: 42161, name: 'Arbitrum', symbol: 'ARB', object: arbitrum },
  optimism: { chainId: 10, name: 'Optimism', symbol: 'OP', object: optimism },
  solana: { chainId: 245022926, name: 'Solana', symbol: 'SOL', object: solana },
  avalanche: { chainId: 43114, name: 'Avalanche', symbol: 'AVAX', object: avalanche }
}

export const CHAIN_IDS = Object.values(SUPPORTED_CHAINS).reduce((acc, chain) => {
  acc[chain.chainId] = chain
  return acc
}, {})

export async function connectWallet() {
  try {
    const { connect } = await import('thirdweb/wallets')
    const { injected } = await import('thirdweb/wallets')
    
    const wallet = await connect({
      client: thirdwebClient,
      wallets: [
        injected({ chains: Object.values(SUPPORTED_CHAINS).map(c => c.object) })
      ]
    })
    
    return wallet
  } catch (error) {
    console.error('Error connecting wallet:', error)
    throw error
  }
}

export async function getWalletInfo(wallet) {
  try {
    const account = wallet.getAccount()
    if (!account) return null

    const address = account.address
    const chainId = account.chainId

    return {
      address,
      chainId,
      chainName: CHAIN_IDS[chainId]?.name || `Chain ${chainId}`,
      chainSymbol: CHAIN_IDS[chainId]?.symbol || 'UNKNOWN'
    }
  } catch (error) {
    console.error('Error getting wallet info:', error)
    throw error
  }
}

export async function switchChain(wallet, chainId) {
  try {
    const chainObj = CHAIN_IDS[chainId]?.object
    if (!chainObj) {
      throw new Error(`Unsupported chain ID: ${chainId}`)
    }

    const account = wallet.getAccount()
    if (!account) throw new Error('No account connected')

    await account.switchChain(chainObj)
    return true
  } catch (error) {
    console.error('Error switching chain:', error)
    throw error
  }
}

export async function sendTransaction(wallet, to, value, chainId) {
  try {
    const account = wallet.getAccount()
    if (!account) throw new Error('No account connected')

    if (account.chainId !== chainId) {
      await switchChain(wallet, chainId)
    }

    const transaction = prepareContractCall({
      contract: getContract({ client: thirdwebClient, address: to, chain: CHAIN_IDS[chainId].object }),
      method: 'transfer',
      params: [to, toWei(value)]
    })

    const receipt = await sendAndConfirmTransaction({
      account,
      transaction
    })

    return {
      hash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 'success' ? 'success' : 'failed'
    }
  } catch (error) {
    console.error('Error sending transaction:', error)
    throw error
  }
}

export async function getBalance(wallet, address, chainId) {
  try {
    const account = wallet.getAccount()
    if (!account) throw new Error('No account connected')

    const contract = getContract({
      client: thirdwebClient,
      address: address || account.address,
      chain: CHAIN_IDS[chainId].object
    })

    const balance = await contract.call('balanceOf', [address || account.address])
    return fromWei(balance)
  } catch (error) {
    console.error('Error getting balance:', error)
    return '0'
  }
}

export function formatWalletAddress(address) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Call the crypto-send edge function to record and process transaction
export async function sendCryptoTransaction(userId, toAddress, value, chainId, supabaseClient) {
  try {
    if (!supabaseClient) {
      throw new Error('Supabase client is required')
    }

    // Call the edge function
    const { data, error } = await supabaseClient.functions.invoke('crypto-send', {
      body: {
        user_id: userId,
        to_address: toAddress,
        value: parseFloat(value).toString(),
        chain_id: chainId
      }
    })

    if (error) {
      throw error
    }

    return {
      success: true,
      message: data.message,
      transaction: data.transaction
    }
  } catch (error) {
    console.error('Error sending crypto transaction:', error)
    throw error
  }
}

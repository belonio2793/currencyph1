// Thirdweb integration using Web3 API + dynamic imports
// Supports browser-injected wallet providers (MetaMask, WalletConnect, etc)

const CLIENT_ID = import.meta.env.VITE_THIRDWEB_CLIENT_ID

if (!CLIENT_ID) {
  console.warn('VITE_THIRDWEB_CLIENT_ID environment variable not set')
}

// Supported chains for Thirdweb integration
export const SUPPORTED_CHAINS = {
  ethereum: { chainId: 1, name: 'Ethereum', symbol: 'ETH', rpcUrl: 'https://eth.rpc.thirdweb.com' },
  polygon: { chainId: 137, name: 'Polygon', symbol: 'MATIC', rpcUrl: 'https://polygon.rpc.thirdweb.com' },
  base: { chainId: 8453, name: 'Base', symbol: 'BASE', rpcUrl: 'https://base.rpc.thirdweb.com' },
  arbitrum: { chainId: 42161, name: 'Arbitrum', symbol: 'ARB', rpcUrl: 'https://arbitrum.rpc.thirdweb.com' },
  optimism: { chainId: 10, name: 'Optimism', symbol: 'OP', rpcUrl: 'https://optimism.rpc.thirdweb.com' },
  solana: { chainId: 245022926, name: 'Solana', symbol: 'SOL', rpcUrl: 'https://solana.rpc.thirdweb.com' },
  avalanche: { chainId: 43114, name: 'Avalanche', symbol: 'AVAX', rpcUrl: 'https://avalanche.rpc.thirdweb.com' }
}

export const CHAIN_IDS = Object.values(SUPPORTED_CHAINS).reduce((acc, chain) => {
  acc[chain.chainId] = chain
  return acc
}, {})

// Check if browser has Web3 wallet support
function hasWeb3Provider() {
  return typeof window !== 'undefined' && window.ethereum !== undefined
}

// Request wallet connection via MetaMask/WalletConnect
export async function connectWallet() {
  if (!hasWeb3Provider()) {
    throw new Error('No Web3 wallet provider found. Please install MetaMask or use WalletConnect.')
  }

  try {
    const provider = window.ethereum
    const accounts = await provider.request({
      method: 'eth_requestAccounts'
    })

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet')
    }

    return {
      address: accounts[0],
      provider: provider,
      connected: true
    }
  } catch (error) {
    console.error('Wallet connection error:', error)
    throw new Error(`Failed to connect wallet: ${error.message}`)
  }
}

// Get current wallet info
export async function getWalletInfo(wallet) {
  if (!wallet || !wallet.provider) {
    return null
  }

  try {
    const provider = wallet.provider
    
    // Get current chain ID
    const chainIdHex = await provider.request({
      method: 'eth_chainId'
    })
    const chainId = parseInt(chainIdHex, 16)

    const chainInfo = CHAIN_IDS[chainId] || { 
      chainId, 
      name: `Chain ${chainId}`, 
      symbol: 'UNKNOWN' 
    }

    return {
      address: wallet.address,
      chainId: chainId,
      chainName: chainInfo.name,
      chainSymbol: chainInfo.symbol
    }
  } catch (error) {
    console.error('Error getting wallet info:', error)
    throw error
  }
}

// Switch to a different chain
export async function switchChain(wallet, chainId) {
  if (!wallet || !wallet.provider) {
    throw new Error('No wallet connected')
  }

  const chainInfo = SUPPORTED_CHAINS[Object.keys(SUPPORTED_CHAINS).find(k => SUPPORTED_CHAINS[k].chainId === chainId)]
  if (!chainInfo) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  try {
    const provider = wallet.provider
    const chainIdHex = `0x${chainId.toString(16)}`

    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }]
    })

    return true
  } catch (error) {
    // If chain doesn't exist, try to add it
    if (error.code === 4902) {
      try {
        await wallet.provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${chainId.toString(16)}`,
            chainName: chainInfo.name,
            rpcUrls: [chainInfo.rpcUrl],
            nativeCurrency: {
              name: chainInfo.symbol,
              symbol: chainInfo.symbol,
              decimals: 18
            }
          }]
        })
        return true
      } catch (addError) {
        throw new Error(`Failed to add chain: ${addError.message}`)
      }
    }
    throw error
  }
}

// Send transaction via connected wallet
export async function sendTransaction(wallet, to, value, chainId) {
  if (!wallet || !wallet.provider) {
    throw new Error('No wallet connected')
  }

  try {
    const provider = wallet.provider
    const txParams = {
      from: wallet.address,
      to: to,
      value: `0x${(BigInt(Math.floor(parseFloat(value) * 1e18))).toString(16)}`,
      gas: '0x5208', // 21000 gas for ETH transfer
      gasPrice: await provider.request({ method: 'eth_gasPrice' })
    }

    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [txParams]
    })

    return {
      hash: txHash,
      status: 'pending'
    }
  } catch (error) {
    console.error('Error sending transaction:', error)
    throw error
  }
}

// Get wallet balance
export async function getBalance(wallet, address, chainId) {
  try {
    if (!address && wallet) {
      address = wallet.address
    }

    if (!address) {
      throw new Error('No address provided')
    }

    const rpcUrl = CHAIN_IDS[chainId]?.rpcUrl
    if (!rpcUrl) {
      throw new Error(`No RPC URL for chain ${chainId}`)
    }

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
    })

    const data = await response.json()
    if (data.error) {
      throw new Error(data.error.message)
    }

    const balanceWei = BigInt(data.result)
    const balanceEth = Number(balanceWei) / 1e18
    return balanceEth.toString()
  } catch (error) {
    console.error('Error getting balance:', error)
    return '0'
  }
}

// Format wallet address for display
export function formatWalletAddress(address) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Call the crypto-send edge function to record transaction
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

// Check if wallet provider is available
export function isWalletAvailable() {
  return hasWeb3Provider()
}

// ============================================
// CHAIN-SPECIFIC SEND/RECEIVE FUNCTIONS
// ============================================

// Build transaction parameters for specific chains
function buildTransactionParams(chain, fromAddress, toAddress, amount) {
  const params = {
    from: fromAddress,
    to: toAddress
  }

  // Set amount based on chain (convert to wei for EVM chains)
  if ([1, 137, 8453, 42161, 10, 43114].includes(chain.chainId)) {
    // EVM chains - convert to wei
    const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18))
    params.value = '0x' + amountWei.toString(16)
    params.gas = '0x5208' // 21000 gas for basic transfer
  } else if (chain.chainId === 245022926) {
    // Solana - lamports (1 SOL = 1e9 lamports)
    params.lamports = Math.floor(parseFloat(amount) * 1e9)
  }

  return params
}

// Send transaction on specific chain
export async function sendOnChain(chainId, fromAddress, toAddress, amount, wallet) {
  const chain = CHAIN_IDS[chainId]
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  if (!wallet || !wallet.provider) {
    throw new Error('No wallet connected')
  }

  try {
    // Build transaction for the specific chain
    const txParams = buildTransactionParams(chain, fromAddress, toAddress, amount)

    // Send transaction via provider
    const txHash = await wallet.provider.request({
      method: 'eth_sendTransaction',
      params: [txParams]
    })

    return {
      hash: txHash,
      chain: chain.name,
      chainId: chainId,
      from: fromAddress,
      to: toAddress,
      amount: amount,
      status: 'pending'
    }
  } catch (error) {
    console.error(`Error sending on ${chain.name}:`, error)
    throw new Error(`Failed to send on ${chain.name}: ${error.message}`)
  }
}

// Verify transaction on specific chain
export async function verifyTransaction(chainId, txHash) {
  const chain = CHAIN_IDS[chainId]
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  try {
    const rpcUrl = chain.rpcUrl
    if (!rpcUrl) {
      throw new Error(`No RPC URL for ${chain.name}`)
    }

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      })
    })

    const data = await response.json()
    if (data.result) {
      return {
        confirmed: data.result.blockNumber !== null,
        blockNumber: data.result.blockNumber,
        status: data.result.status === '0x1' ? 'success' : 'failed'
      }
    }

    return { confirmed: false }
  } catch (error) {
    console.error(`Error verifying transaction on ${chain.name}:`, error)
    return { confirmed: false }
  }
}

// Get transaction history for address on specific chain
export async function getTransactionHistory(chainId, address, limit = 10) {
  const chain = CHAIN_IDS[chainId]
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  try {
    const rpcUrl = chain.rpcUrl
    if (!rpcUrl) {
      throw new Error(`No RPC URL for ${chain.name}`)
    }

    // Get block number
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      })
    })

    const blockData = await blockResponse.json()
    const currentBlock = parseInt(blockData.result, 16)

    // Get recent transactions (simplified)
    return {
      address,
      chain: chain.name,
      chainId: chainId,
      currentBlock: currentBlock,
      transactions: []
    }
  } catch (error) {
    console.error(`Error getting transaction history on ${chain.name}:`, error)
    return {
      address,
      chain: chain.name,
      chainId: chainId,
      transactions: []
    }
  }
}

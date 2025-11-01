// Supports browser-injected wallet providers (MetaMask, WalletConnect, Phantom)

const CLIENT_ID = import.meta.env.VITE_THIRDWEB_CLIENT_ID

if (!CLIENT_ID) {
  console.warn('VITE_THIRDWEB_CLIENT_ID environment variable not set')
}

// Supported chains for Thirdweb integration (expanded)
export const SUPPORTED_CHAINS = {
  ethereum: { chainId: 1, name: 'Ethereum', symbol: 'ETH', rpcUrl: 'https://eth.rpc.thirdweb.com' },
  optimism: { chainId: 10, name: 'Optimism', symbol: 'OP', rpcUrl: 'https://optimism.rpc.thirdweb.com' },
  bsc: { chainId: 56, name: 'BSC', symbol: 'BNB', rpcUrl: 'https://bsc.rpc.thirdweb.com' },
  gnosis: { chainId: 100, name: 'Gnosis', symbol: 'GNO', rpcUrl: 'https://gnosis.rpc.thirdweb.com' },
  polygon: { chainId: 137, name: 'Polygon', symbol: 'MATIC', rpcUrl: 'https://polygon.rpc.thirdweb.com' },
  fantom: { chainId: 250, name: 'Fantom', symbol: 'FTM', rpcUrl: 'https://fantom.rpc.thirdweb.com' },
  arbitrum: { chainId: 42161, name: 'Arbitrum', symbol: 'ARB', rpcUrl: 'https://arbitrum.rpc.thirdweb.com' },
  arbitrum_nova: { chainId: 42170, name: 'Arbitrum Nova', symbol: 'ARB', rpcUrl: 'https://arbitrum-nova.rpc.thirdweb.com' },
  base: { chainId: 8453, name: 'Base', symbol: 'BASE', rpcUrl: 'https://base.rpc.thirdweb.com' },
  avalanche: { chainId: 43114, name: 'Avalanche', symbol: 'AVAX', rpcUrl: 'https://avalanche.rpc.thirdweb.com' },
  moonbeam: { chainId: 1284, name: 'Moonbeam', symbol: 'GLMR', rpcUrl: 'https://moonbeam.rpc.thirdweb.com' },
  moonriver: { chainId: 1285, name: 'Moonriver', symbol: 'MOVR', rpcUrl: 'https://moonriver.rpc.thirdweb.com' },
  celo: { chainId: 42220, name: 'Celo', symbol: 'CELO', rpcUrl: 'https://celo.rpc.thirdweb.com' },
  cronos: { chainId: 25, name: 'Cronos', symbol: 'CRO', rpcUrl: 'https://cronos.rpc.thirdweb.com' },
  zksync: { chainId: 324, name: 'zkSync', symbol: 'ZK', rpcUrl: 'https://zksync.rpc.thirdweb.com' },
  linea: { chainId: 59144, name: 'Linea', symbol: 'LINEA', rpcUrl: 'https://linea.rpc.thirdweb.com' },
  mantle: { chainId: 5000, name: 'Mantle', symbol: 'MNT', rpcUrl: 'https://mantle.rpc.thirdweb.com' },
  evmos: { chainId: 9001, name: 'Evmos', symbol: 'EVMOS', rpcUrl: 'https://evmos.rpc.thirdweb.com' },
  boba: { chainId: 288, name: 'Boba', symbol: 'BOBA', rpcUrl: 'https://boba.rpc.thirdweb.com' },
  metis: { chainId: 1088, name: 'Metis', symbol: 'METIS', rpcUrl: 'https://metis.rpc.thirdweb.com' },
  okc: { chainId: 66, name: 'OKC', symbol: 'OKT', rpcUrl: 'https://okc.rpc.thirdweb.com' },
  aurora: { chainId: 1313161554, name: 'Aurora', symbol: 'AURORA', rpcUrl: 'https://aurora.rpc.thirdweb.com' },
  solana: { chainId: 245022926, name: 'Solana', symbol: 'SOL', rpcUrl: 'https://solana.rpc.thirdweb.com' },
  bitcoin: { chainId: 0, name: 'Bitcoin', symbol: 'BTC', rpcUrl: null }
}

export const CHAIN_IDS = Object.values(SUPPORTED_CHAINS).reduce((acc, chain) => {
  acc[chain.chainId] = chain
  return acc
}, {})

// Check if browser has Web3 wallet support (EVM)
function hasWeb3Provider() {
  return typeof window !== 'undefined' && window.ethereum !== undefined
}

// Check for Solana provider (Phantom)
function hasSolanaProvider() {
  return typeof window !== 'undefined' && window.solana !== undefined && window.solana.isPhantom
}

// Persist minimal provider info to localStorage/session for recovery
function persistWalletCache({ providerType, providerName, address }) {
  try {
    sessionStorage.setItem('wallet_provider', providerName || providerType || '')
    sessionStorage.setItem('wallet_type', providerType || '')
    sessionStorage.setItem('connected_wallet_address', address || '')
  } catch (e) {
    // ignore
  }
}

export function clearWalletCache() {
  try {
    sessionStorage.removeItem('wallet_provider')
    sessionStorage.removeItem('wallet_type')
    sessionStorage.removeItem('connected_wallet_address')
    localStorage.removeItem('wallet_provider')
    localStorage.removeItem('wallet_type')
    localStorage.removeItem('connected_wallet_address')
  } catch (e) {
    // ignore
  }
}

// Request wallet connection via MetaMask/WalletConnect (EVM)
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

    const result = {
      address: accounts[0],
      provider: provider,
      connected: true,
      providerType: 'evm',
      providerName: provider.isMetaMask ? 'metamask' : 'evm'
    }

    persistWalletCache(result)
    return result
  } catch (error) {
    console.error('Wallet connection error:', error)
    throw new Error(`Failed to connect wallet: ${error.message}`)
  }
}

// Connect to Phantom / Solana
export async function connectSolana() {
  if (!hasSolanaProvider()) {
    throw new Error('No Solana wallet (Phantom) found')
  }

  try {
    const provider = window.solana
    // connect returns { publicKey }
    const resp = await provider.connect()
    const address = (resp?.publicKey?.toString && resp.publicKey.toString()) || (provider.publicKey && provider.publicKey.toString())

    const result = {
      address,
      provider,
      connected: true,
      providerType: 'solana',
      providerName: provider.isPhantom ? 'phantom' : 'solana'
    }

    persistWalletCache(result)
    return result
  } catch (error) {
    console.error('Solana connect error:', error)
    throw new Error(`Failed to connect Solana wallet: ${error.message}`)
  }
}

// Generic connector that picks the best available provider
export async function connectAnyWallet() {
  // Prefer Solana provider when present (so Phantom users get Solana compatibility automatically)
  if (hasSolanaProvider()) {
    try {
      return await connectSolana()
    } catch (e) {
      // if solana connect fails, fall back to EVM if available
      console.warn('Solana connect failed, trying EVM as fallback', e)
    }
  }

  if (hasWeb3Provider()) {
    return await connectWallet()
  }

  throw new Error('No supported wallet provider found in this browser')
}

// Get current wallet info (works for EVM and Solana objects returned by the connectors)
export async function getWalletInfo(wallet) {
  if (!wallet || !wallet.provider) return null

  try {
    const provider = wallet.provider

    // Solana provider
    if (wallet.providerType === 'solana' || (provider && provider.isPhantom)) {
      const address = wallet.address || (provider.publicKey && provider.publicKey.toString && provider.publicKey.toString())
      const chainInfo = SUPPORTED_CHAINS.solana
      return {
        address,
        chainId: chainInfo.chainId,
        chainName: chainInfo.name,
        chainSymbol: chainInfo.symbol,
        providerType: 'solana',
        providerName: provider.isPhantom ? 'phantom' : 'solana',
        provider
      }
    }

    // EVM
    const chainIdHex = await provider.request({ method: 'eth_chainId' })
    const chainId = parseInt(chainIdHex, 16)
    const chainInfo = CHAIN_IDS[chainId] || { chainId, name: `Chain ${chainId}`, symbol: 'UNKNOWN' }

    return {
      address: wallet.address,
      chainId: chainId,
      chainName: chainInfo.name,
      chainSymbol: chainInfo.symbol,
      providerType: 'evm',
      providerName: provider.isMetaMask ? 'metamask' : 'evm',
      provider
    }
  } catch (error) {
    console.error('Error getting wallet info:', error)
    throw error
  }
}

// Switch to a different chain (EVM only)
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

// Send transaction via connected wallet (EVM)
export async function sendTransaction(wallet, to, value, chainId) {
  if (!wallet || !wallet.provider) {
    throw new Error('No wallet connected')
  }

  try {
    if (wallet.providerType === 'solana') {
      throw new Error('sendTransaction currently not supported for Solana via this helper')
    }

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

// Get wallet balance (EVM only)
export async function getBalance(wallet, address, chainId) {
  try {
    if (!address && wallet) address = wallet.address
    if (!address) throw new Error('No address provided')

    const rpcUrl = CHAIN_IDS[chainId]?.rpcUrl
    if (!rpcUrl) throw new Error(`No RPC URL for chain ${chainId}`)

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] })
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message)

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
    if (!supabaseClient) throw new Error('Supabase client is required')
    const { data, error } = await supabaseClient.functions.invoke('crypto-send', {
      body: { userId, toAddress, value, chainId }
    })
    if (error) throw error
    return data
  } catch (e) {
    console.error('sendCryptoTransaction error', e)
    throw e
  }
}

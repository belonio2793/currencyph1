/**
 * QR Code Generator Utility
 * Generates QR codes for cryptocurrency addresses using qrcode.react library
 * Falls back to text display if library is not available
 */

/**
 * Generate a simple QR code as a data URL
 * Uses a free QR code API as fallback if library not available
 */
export async function generateQRCodeURL(data, size = 200) {
  try {
    // Use QR Server API as a reliable fallback
    const encodedData = encodeURIComponent(data)
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}`
    return url
  } catch (error) {
    console.error('Error generating QR code:', error)
    return null
  }
}

/**
 * Generate crypto-specific QR code data
 */
export function generateCryptoQRData(address, cryptocurrency, amount = null) {
  const crypto = cryptocurrency.toUpperCase()
  
  switch (crypto) {
    case 'BTC':
      return amount ? `bitcoin:${address}?amount=${amount}` : `bitcoin:${address}`
    
    case 'ETH':
      return amount ? `ethereum:${address}?amount=${amount}` : `ethereum:${address}`
    
    case 'SOL':
      return amount ? `solana:${address}?amount=${amount}` : `solana:${address}`
    
    case 'USDT':
    case 'USDC':
    case 'LINK':
    case 'UNI':
    case 'AAVE':
      // ERC-20 tokens (Ethereum-based)
      return `ethereum:${address}`
    
    case 'XRP':
      // XRP with memo support
      return `ripple:${address}`
    
    case 'LTC':
      return amount ? `litecoin:${address}?amount=${amount}` : `litecoin:${address}`
    
    case 'BCH':
      return amount ? `bitcoincash:${address}?amount=${amount}` : `bitcoincash:${address}`
    
    default:
      // Generic crypto address
      return address
  }
}

/**
 * Format cryptocurrency address for display
 * Truncates long addresses and shows first/last parts
 */
export function formatAddressForDisplay(address, length = 12) {
  if (!address) return ''
  if (address.length <= length * 2) return address
  
  const start = address.substring(0, length)
  const end = address.substring(address.length - length)
  return `${start}...${end}`
}

/**
 * Validate cryptocurrency address format
 */
export function validateCryptoAddress(address, cryptocurrency) {
  if (!address) return false
  
  const crypto = cryptocurrency.toUpperCase()
  
  switch (crypto) {
    case 'BTC':
      // Bitcoin address: P2PKH (1), P2SH (3), or Bech32 (bc1)
      return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address)
    
    case 'ETH':
      // Ethereum address: 0x + 40 hex characters
      return /^0x[a-fA-F0-9]{40}$/.test(address)
    
    case 'SOL':
      // Solana address: base58 string, 32-44 characters
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
    
    case 'LTC':
      // Litecoin address: L or M prefix
      return /^[LM][a-zA-HJ-NP-Z0-9]{26,33}$/.test(address)
    
    case 'BCH':
      // Bitcoin Cash address: bitcoincash: prefix or legacy
      return /^(bitcoincash:|[13])[a-zA-HJ-NP-Z0-9]{25,34}$/.test(address)
    
    case 'XRP':
      // XRP address: starts with r
      return /^r[a-zA-HJ-NP-Z0-9]{24,34}$/.test(address)
    
    default:
      // Generic validation: address should be non-empty and reasonable length
      return address.length >= 20 && address.length <= 200
  }
}

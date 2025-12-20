/**
 * Crypto Deposit Service
 * Handles cryptocurrency deposit addresses, rate conversion, and balance crediting
 */

import { getCryptoPrice } from './cryptoRatesService'
import { currencyAPI } from './payments'

/**
 * Get available crypto deposit addresses from database
 */
export async function getCryptoDepositAddresses(supabase, cryptocurrency = null) {
  try {
    let query = supabase
      .from('wallets_house')
      .select('id, currency, network, address, provider, metadata, balance')
      .eq('wallet_type', 'crypto')
      .order('currency', { ascending: true })
      .order('network', { ascending: true })
    
    if (cryptocurrency) {
      query = query.eq('currency', cryptocurrency.toUpperCase())
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching crypto addresses:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getCryptoDepositAddresses:', error)
    return []
  }
}

/**
 * Get all unique cryptocurrencies available for deposit
 */
export async function getAvailableCryptocurrencies(supabase) {
  try {
    const { data, error } = await supabase
      .from('wallets_house')
      .select('currency')
      .eq('wallet_type', 'crypto')
      .distinct()
      .order('currency', { ascending: true })
    
    if (error) {
      console.error('Error fetching cryptocurrencies:', error)
      return []
    }
    
    return (data || []).map(row => row.currency)
  } catch (error) {
    console.error('Error in getAvailableCryptocurrencies:', error)
    return []
  }
}

/**
 * Convert crypto amount to PHP with real-time rate
 */
export async function convertCryptoToPHP(cryptoAmount, cryptocurrency) {
  try {
    if (!cryptoAmount || cryptoAmount <= 0) {
      return 0
    }
    
    const crypto = cryptocurrency.toUpperCase()
    const priceInPHP = await getCryptoPrice(crypto)
    
    if (!priceInPHP) {
      console.warn(`Could not fetch price for ${crypto}`)
      return null
    }
    
    return cryptoAmount * priceInPHP
  } catch (error) {
    console.error(`Error converting ${cryptocurrency} to PHP:`, error)
    return null
  }
}

/**
 * Credit user's wallet with crypto deposit amount
 */
export async function creditCryptoDeposit(
  supabase,
  userId,
  cryptocurrency,
  amountInCrypto,
  depositAddress,
  network,
  transactionHash = null,
  depositId = null
) {
  try {
    // Get current PHP price for the cryptocurrency
    const amountInPHP = await convertCryptoToPHP(amountInCrypto, cryptocurrency)
    
    if (!amountInPHP) {
      throw new Error(`Could not fetch current rate for ${cryptocurrency}`)
    }
    
    // Find or create PHP wallet for user
    let userWallet = await currencyAPI.getWallets(userId)
    let phpWallet = userWallet.find(w => w.currency_code === 'PHP')
    
    if (!phpWallet) {
      // Create PHP wallet if it doesn't exist
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert([{
          user_id: userId,
          currency_code: 'PHP',
          balance: 0
        }])
        .select()
        .single()
      
      if (createError) {
        throw new Error(`Failed to create PHP wallet: ${createError.message}`)
      }
      
      phpWallet = newWallet
    }
    
    // Update wallet balance
    const newBalance = phpWallet.balance + amountInPHP
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', phpWallet.id)
    
    if (updateError) {
      throw new Error(`Failed to update wallet balance: ${updateError.message}`)
    }
    
    // Create or update deposit record if depositId provided
    if (depositId) {
      const { error: depositError } = await supabase
        .from('deposits')
        .update({
          status: 'approved',
          converted_amount: amountInPHP,
          transaction_hash: transactionHash
        })
        .eq('id', depositId)
      
      if (depositError) {
        console.warn('Could not update deposit record:', depositError)
      }
    } else {
      // Create new deposit record
      const { error: createDepositError } = await supabase
        .from('deposits')
        .insert([{
          user_id: userId,
          wallet_id: phpWallet.id,
          amount: amountInCrypto,
          original_currency: cryptocurrency,
          converted_amount: amountInPHP,
          wallet_currency: 'PHP',
          currency_code: 'PHP',
          deposit_method: 'crypto_direct',
          status: 'approved',
          description: `${cryptocurrency} crypto deposit: ${amountInCrypto} ${cryptocurrency} (${amountInPHP} PHP) from ${network}`,
          transaction_hash: transactionHash,
          metadata: {
            deposit_address: depositAddress,
            network,
            transaction_hash: transactionHash
          }
        }])
      
      if (createDepositError) {
        console.warn('Could not create deposit record:', createDepositError)
      }
    }
    
    return {
      success: true,
      cryptoAmount: amountInCrypto,
      phpAmount: amountInPHP,
      cryptocurrency,
      phpWalletId: phpWallet.id,
      newBalance
    }
  } catch (error) {
    console.error('Error crediting crypto deposit:', error)
    throw error
  }
}

/**
 * Get deposit history for a cryptocurrency
 */
export async function getCryptoDepositHistory(supabase, userId, cryptocurrency = null) {
  try {
    let query = supabase
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .eq('deposit_method', 'crypto_direct')
      .order('created_at', { ascending: false })
    
    if (cryptocurrency) {
      query = query.eq('original_currency', cryptocurrency.toUpperCase())
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching deposit history:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getCryptoDepositHistory:', error)
    return []
  }
}

/**
 * Check if a deposit transaction exists in the blockchain
 * This is a placeholder for actual blockchain verification
 */
export async function verifyBlockchainDeposit(
  transactionHash,
  cryptocurrency,
  expectedAddress,
  expectedAmount = null
) {
  try {
    // This would integrate with blockchain APIs (etherscan, solscan, etc.)
    // For now, return a placeholder
    console.log(`Would verify ${cryptocurrency} deposit: ${transactionHash}`)
    
    return {
      verified: false,
      message: 'Blockchain verification not yet implemented',
      transactionHash,
      cryptocurrency
    }
  } catch (error) {
    console.error('Error verifying blockchain deposit:', error)
    return {
      verified: false,
      error: error.message
    }
  }
}

/**
 * Get real-time rates for all cryptocurrencies
 */
export async function getAllCryptoRatesInPHP(cryptocurrencies = []) {
  try {
    const rates = {}
    
    for (const crypto of cryptocurrencies) {
      try {
        const price = await getCryptoPrice(crypto)
        if (price) {
          rates[crypto] = price
        }
      } catch (error) {
        console.warn(`Could not fetch rate for ${crypto}:`, error.message)
      }
    }
    
    return rates
  } catch (error) {
    console.error('Error getting crypto rates:', error)
    return {}
  }
}

/**
 * Format crypto amount with proper decimal places
 */
export function formatCryptoAmount(amount, cryptocurrency) {
  const crypto = cryptocurrency.toUpperCase()
  
  // Most cryptocurrencies use 8 decimal places
  const decimals = {
    'BTC': 8,
    'ETH': 18,
    'SOL': 9,
    'USDC': 6,
    'USDT': 6,
    'DOGE': 8,
    'LTC': 8,
    'BCH': 8
  }
  
  const decimalPlaces = decimals[crypto] || 8
  return parseFloat(amount).toFixed(decimalPlaces)
}

/**
 * Calculate deposit fee (if applicable)
 */
export function calculateDepositFee(amount, feePercentage = 0) {
  if (feePercentage <= 0) return 0
  return (amount * feePercentage) / 100
}

/**
 * Get net amount after fees
 */
export function getNetDepositAmount(amount, feePercentage = 0) {
  const fee = calculateDepositFee(amount, feePercentage)
  return amount - fee
}

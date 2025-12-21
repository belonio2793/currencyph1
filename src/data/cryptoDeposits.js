/**
 * Cryptocurrency Deposits Configuration
 * 54 unique cryptocurrency/network combinations
 * Synced with database: wallets_house table
 */

export const CRYPTOCURRENCY_DEPOSITS = [
  // Bitcoin
  {
    currency: 'Bitcoin (BTC)',
    network: 'Bitcoin',
    address: '15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu'
  },

  // Ethereum
  {
    currency: 'Ethereum',
    network: 'ERC-20',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'Ethereum',
    network: 'Arbitrum One',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // Tether (USDT) - 11 networks
  {
    currency: 'Tether (USDT)',
    network: 'Asset Hub (Polkadot)',
    address: '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ'
  },
  {
    currency: 'Tether (USDT)',
    network: 'APT',
    address: '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe'
  },
  {
    currency: 'Tether (USDT)',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'Tether (USDT)',
    network: 'Tron',
    address: 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB'
  },
  {
    currency: 'Tether (USDT)',
    network: 'BNB Smart Chain (BEP20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'Tether (USDT)',
    network: 'Arbitrum One',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'Tether (USDT)',
    network: 'Solana',
    address: 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS'
  },
  {
    currency: 'Tether (USDT)',
    network: 'The Open Network',
    address: 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD',
    metadata: {
      tag: '641022568'
    }
  },
  {
    currency: 'Tether (USDT)',
    network: 'Polygon',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'Tether (USDT)',
    network: 'Kaia',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'Tether (USDT)',
    network: 'Plasma',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // Binance Coin
  {
    currency: 'Binance Coin',
    network: 'BNB Smart Chain (BEP20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // XRP
  {
    currency: 'XRP (XRP)',
    network: 'Ripple',
    address: 'rpWJmMcPM4ynNfvhaZFYmPhBq5FYfDJBZu',
    metadata: {
      tag: '2135060125'
    }
  },

  // USDC - 10 networks
  {
    currency: 'USDC',
    network: 'Asset Hub (Polkadot)',
    address: '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ'
  },
  {
    currency: 'USDC',
    network: 'APT',
    address: '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe'
  },
  {
    currency: 'USDC',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'USDC',
    network: 'BNB Smart Chain (BEP20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'USDC',
    network: 'Arbitrum One',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'USDC',
    network: 'RONIN',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'USDC',
    network: 'Stellar',
    address: '475001388'
  },
  {
    currency: 'USDC',
    network: 'BASE',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'USDC',
    network: 'Polygon',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // Solana
  {
    currency: 'SOL',
    network: 'Solana',
    address: 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS'
  },

  // TRX
  {
    currency: 'TRX',
    network: 'TRON',
    address: 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB'
  },

  // DOGE
  {
    currency: 'DOGE',
    network: 'BNB Smart Chain (BEP20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'DOGE',
    network: 'DogeCoin',
    address: 'DJungBB29tYgcuUXnXUpParVN9BTwKj4kH'
  },

  // ADA
  {
    currency: 'ADA',
    network: 'Cardano',
    address: 'addr1vxs8l5cw4vczt00m4va5yqy3ygtgu6rdequn82ncq3umn3stg67g2'
  },

  // BCH
  {
    currency: 'BCH',
    network: 'BNB Smart Chain (BEP20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'BCH',
    network: 'Bitcoin Cash',
    address: '1C9hSv7WGZ3LBWaam6QFvXmPzyHDrVJnxr'
  },

  // LINK
  {
    currency: 'LINK',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'LINK',
    network: 'BNB Smart Chain (BEP20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // XLM
  {
    currency: 'XLM',
    network: 'Stellar',
    address: 'GCB4QJYFM56UC2UCVIEYMELK6QVCCTF533OMKU4QRUY5MHLP5ZDQXEQU',
    metadata: {
      memo: '475001388'
    }
  },

  // HYPE
  {
    currency: 'HYPE',
    network: 'Hyperliquid',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // LITECOIN
  {
    currency: 'LITECOIN',
    network: 'Litecoin',
    address: 'LcwH9ny5ykyuhX83xQ86j8FqM3ut2dKvJ6'
  },

  // Sui
  {
    currency: 'Sui',
    network: 'Sui',
    address: '0x5522950a29882692e38949a1da2bad51e676058a9caf76f7edf1f02ed73f20bb'
  },

  // AVAX
  {
    currency: 'AVAX',
    network: 'AVAX C-Chain',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // HBAR
  {
    currency: 'HBAR',
    network: 'Hedera Hashgraph',
    address: '0.0.9932322',
    metadata: {
      tag: '2102701194'
    }
  },

  // SHIB
  {
    currency: 'SHIB',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // PYUSD
  {
    currency: 'PYUSD',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // WLD - 2 networks (no duplicates)
  {
    currency: 'WLD',
    network: 'World Chain',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'WLD',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // TON
  {
    currency: 'TON',
    network: 'The Open Network',
    address: 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD',
    metadata: {
      tag: '641022568'
    }
  },

  // UNI
  {
    currency: 'UNI',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'UNI',
    network: 'BNB Smart Chain (BEP20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // DOT
  {
    currency: 'DOT',
    network: 'Asset Hub (Polkadot)',
    address: '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ'
  },

  // AAVE
  {
    currency: 'AAVE',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },
  {
    currency: 'AAVE',
    network: 'BNB Smart Chain (BEP20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // XAUT
  {
    currency: 'XAUT',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // PEPE
  {
    currency: 'PEPE',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // ASTER
  {
    currency: 'ASTER',
    network: 'BNB Smart Chain (BEP20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // ENA
  {
    currency: 'ENA',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  },

  // SKY
  {
    currency: 'SKY',
    network: 'Ethereum (ERC20)',
    address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'
  }
]

/**
 * Build lookup maps for efficient access
 */
export const buildCryptoMaps = () => {
  const byNetwork = {}
  const byCurrency = {}

  CRYPTOCURRENCY_DEPOSITS.forEach(deposit => {
    // Map by network
    if (!byNetwork[deposit.network]) {
      byNetwork[deposit.network] = []
    }
    byNetwork[deposit.network].push(deposit)

    // Map by currency
    if (!byCurrency[deposit.currency]) {
      byCurrency[deposit.currency] = []
    }
    byCurrency[deposit.currency].push(deposit)
  })

  return { byNetwork, byCurrency }
}

/**
 * Get available networks for a currency
 */
export const getNetworksForCurrency = (currency) => {
  return CRYPTOCURRENCY_DEPOSITS
    .filter(d => d.currency === currency)
    .map(d => ({ network: d.network, address: d.address, metadata: d.metadata }))
}

/**
 * Get deposit address for a specific currency/network combination
 */
export const getDepositAddress = (currency, network) => {
  const deposit = CRYPTOCURRENCY_DEPOSITS.find(
    d => d.currency === currency && d.network === network
  )
  return deposit || null
}

/**
 * Get all unique currencies
 */
export const getAllCurrencies = () => {
  const seen = new Set()
  return CRYPTOCURRENCY_DEPOSITS
    .filter(d => {
      if (seen.has(d.currency)) return false
      seen.add(d.currency)
      return true
    })
    .map(d => ({ currency: d.currency, networks: getNetworksForCurrency(d.currency).length }))
}

/**
 * Validate deposit data
 */
export const validateCryptoDeposits = () => {
  const errors = []
  const seen = new Set()

  CRYPTOCURRENCY_DEPOSITS.forEach((deposit, index) => {
    // Check required fields
    if (!deposit.currency) errors.push(`Entry ${index}: Missing currency`)
    if (!deposit.network) errors.push(`Entry ${index}: Missing network`)
    if (!deposit.address) errors.push(`Entry ${index}: Missing address`)

    // Check duplicates
    const key = `${deposit.currency}|${deposit.network}`
    if (seen.has(key)) {
      errors.push(`Entry ${index}: Duplicate currency/network combination: ${key}`)
    }
    seen.add(key)
  })

  return {
    valid: errors.length === 0,
    errors,
    totalEntries: CRYPTOCURRENCY_DEPOSITS.length,
    uniqueCurrencies: getAllCurrencies().length
  }
}

export default CRYPTOCURRENCY_DEPOSITS

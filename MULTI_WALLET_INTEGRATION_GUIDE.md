# Multi-Wallet Integration Guide

## Overview

This document describes the comprehensive multi-wallet support system that has been integrated into the Currency PH application. Users can now connect, manage, and interact with multiple crypto wallets simultaneously from different providers.

## Features

### ✅ Implemented Features

1. **Multi-Wallet Support**
   - Connect multiple wallets from different providers simultaneously
   - Each wallet is tracked independently
   - Wallets persist in session storage

2. **Supported Wallet Providers**
   - 🦊 **MetaMask** - EVM chains (Ethereum, Polygon, Arbitrum, etc.)
   - 🔗 **WalletConnect** - Multi-chain support
   - 🪙 **Coinbase Wallet** - EVM chains with SDK support
   - 👻 **Phantom** - Solana blockchain + EVM
   - ✨ **Venly** - Web3 wallet integration

3. **Wallet Management**
   - Connect new wallets with one click
   - Disconnect individual wallets
   - Disconnect all wallets at once
   - View wallet details (address, chain, balance, last sync)
   - Select active wallet for operations

4. **Balance Synchronization**
   - Sync balances for all connected wallets
   - Auto-detect wallet type (Solana vs EVM)
   - Store balances in Supabase for persistence
   - Real-time balance updates

5. **Chain Support**
   - **EVM Chains**: Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, Fantom, Celo, Cronos, zkSync, Linea, Mantle, Evmos, Boba, Metis, OKC, Aurora
   - **Solana**: Full Phantom integration
   - **Bitcoin**: Manual wallet support

6. **User Interface**
   - Beautiful wallet display cards with provider icons and colors
   - Connected wallets list with expandable details
   - Available wallets menu showing installed vs. non-installed providers
   - Error messaging and status indicators
   - Sync progress indicators

## Architecture

### File Structure

```
src/lib/
├── walletProviders.js          # Wallet provider adapters (MetaMask, WalletConnect, Coinbase, Phantom, Venly)
├── useWalletManager.js         # Main wallet management hook
├── multiWalletContext.jsx      # React context for wallet state (optional)

src/components/
├── MultiWalletPanel.jsx        # Main UI component for wallet management
└── Wallet.jsx                  # Updated to include MultiWalletPanel
```

### Key Components

#### 1. Wallet Providers (`walletProviders.js`)

Each provider has a standardized interface:

```javascript
const ProviderAdapter = {
  name: 'Provider Name',
  detectable: true/false,
  detect: () => boolean,  // Check if provider is available
  async connect() {       // Connect to wallet
    return {
      providerName: string,
      providerType: 'evm' | 'solana',
      address: string,
      provider: object,
      ethersProvider: object,  // For EVM
      signer: object,          // For EVM
      chainId: number,
      chainName: string,
      connected: boolean
    }
  },
  async disconnect(provider) {  // Clean disconnect
    // Implementation
  }
}
```

#### 2. useWalletManager Hook

Main hook for wallet management:

```javascript
const {
  connectedWallets,        // Array of connected wallets
  loading,                 // Loading state
  error,                   // Error message
  isSyncing,              // Syncing state
  connectWallet,          // (providerKey) => Promise
  disconnectWallet,       // (walletId) => Promise
  disconnectAll,          // () => Promise
  syncWalletBalances,     // (userId) => Promise
  switchChain,            // (walletId, chainId) => Promise
  getAvailableWallets,    // () => Array
  signMessage,            // (walletId, message) => Promise
  setError,               // (error) => void
  loadPersistedWallets    // () => void
} = useWalletManager()
```

#### 3. MultiWalletPanel Component

The main UI component for wallet management. Features:

- Connected wallets overview
- Individual wallet details (expandable)
- Connect new wallet button with available providers list
- Sync balance button
- Disconnect individual or all wallets
- Selected wallet actions

## Usage

### Basic Implementation

```jsx
import MultiWalletPanel from './components/MultiWalletPanel'

export default function MyComponent({ userId }) {
  return (
    <div>
      <MultiWalletPanel 
        userId={userId} 
        onWalletChange={(wallets) => {
          console.log('Connected wallets:', wallets)
        }} 
      />
    </div>
  )
}
```

### Using the Hook Directly

```jsx
import { useWalletManager } from '../lib/useWalletManager'

export default function CustomWalletUI() {
  const { 
    connectedWallets, 
    connectWallet, 
    disconnectWallet,
    syncWalletBalances 
  } = useWalletManager()

  const handleConnect = async (providerKey) => {
    const wallet = await connectWallet(providerKey)
    if (wallet) {
      console.log('Connected:', wallet)
    }
  }

  return (
    <div>
      {connectedWallets.map(wallet => (
        <div key={wallet.id}>
          <p>{wallet.providerName} - {wallet.address}</p>
          <button onClick={() => disconnectWallet(wallet.id)}>
            Disconnect
          </button>
        </div>
      ))}
      
      <button onClick={() => handleConnect('metamask')}>
        Connect MetaMask
      </button>
    </div>
  )
}
```

## Wallet Connection Flow

### MetaMask Connection
```
User clicks "Connect MetaMask"
  → Detect wallet.ethereum.isMetaMask
  → Request eth_requestAccounts
  → Get signer and network info
  → Store wallet info
  → Add to connected wallets
  → Persist to session storage
```

### WalletConnect Connection
```
User clicks "Connect WalletConnect"
  → Initialize WalletConnectProvider
  → Show QR code (via provider)
  → Scan with mobile wallet
  → Confirm connection
  → Receive accounts
  → Store wallet info
  → Add to connected wallets
```

### Phantom Connection
```
User clicks "Connect Phantom"
  → Detect window.solana.isPhantom
  → Call solana.connect()
  → Get public key
  → Store wallet info
  → Add to connected wallets
```

## Data Flow

### Persistence

**Session Storage:**
- Connected wallet list stored in `connected_wallets_v2` key
- Wallets loaded on component mount
- Updated whenever wallet list changes

**Database (Supabase):**
- Balance data stored in `wallets_crypto` table
- Fields: user_id, address, provider, chain, chain_id, balance, updated_at
- Upserted on sync with onConflict on (user_id, address)

### Balance Sync

```javascript
For each connected wallet:
  1. Detect wallet type (EVM vs Solana)
  2. If EVM: Use ethers.provider.getBalance()
  3. If Solana: Use Solana RPC connection.getBalance()
  4. Format balance appropriately
  5. Store in database
  6. Update local state
  7. Update lastSync timestamp
```

## API Integration

### Wallet Provider APIs Used

| Provider | API | Documentation |
|----------|-----|---|
| MetaMask | window.ethereum | https://docs.metamask.io/ |
| WalletConnect | @walletconnect/web3-provider | https://docs.walletconnect.network/ |
| Coinbase | @coinbase/wallet-sdk | https://docs.cdp.coinbase.com/coinbase-wallet/introduction/welcome |
| Phantom | window.solana | https://docs.phantom.com/ulti-wallet |
| Venly | window.ethereum | https://docs.venly.io/docs/web3modal-walletconnect |

### RPC Endpoints Used

- **Ethereum**: https://eth.rpc.thirdweb.com
- **Polygon**: https://polygon.rpc.thirdweb.com
- **Solana**: https://api.mainnet-beta.solana.com

Environment variables:
- `VITE_RPC_URL_1` - Custom Ethereum RPC (optional)
- Other chains use Thirdweb public RPC endpoints

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "No Web3 wallet provider found" | Wallet not installed | Install MetaMask or use WalletConnect |
| "User rejected request" | User denied connection | Ask user to approve in wallet |
| "No accounts returned" | Wallet locked or no accounts | Unlock wallet and try again |
| "Failed to switch chain" | Chain not supported | Make sure wallet supports the chain |

## Security Considerations

1. **Private Keys**: Never stored or transmitted
2. **Session Storage**: Only browser session memory
3. **Clear on Logout**: Call `disconnectAll()` on logout
4. **Sign-only Operations**: No automatic transactions
5. **User Confirmation**: All operations require wallet confirmation

## Advanced Features (Coming Soon)

- [ ] Send transactions from connected wallets
- [ ] Sign messages with connected wallets
- [ ] Chain switching for EVM wallets
- [ ] Token balance detection
- [ ] NFT detection and display
- [ ] Transaction history per wallet
- [ ] Gasless transactions integration
- [ ] Hardware wallet support (Ledger, Trezor)

## Troubleshooting

### Wallet Not Detected
```javascript
// Check if wallet is available
const isMetaMaskAvailable = window.ethereum?.isMetaMask
console.log('MetaMask Available:', isMetaMaskAvailable)

// Check Solana
const isSolanaAvailable = window.solana?.isPhantom
console.log('Phantom Available:', isSolanaAvailable)
```

### Balance Not Syncing
```javascript
// Check if userId is valid
console.log('User ID:', userId)

// Check network connectivity
// Verify RPC endpoint is responding
// Check Supabase connection
```

### Wallets Not Persisting
```javascript
// Clear session storage if corrupted
sessionStorage.removeItem('connected_wallets_v2')

// Reload wallets
loadPersistedWallets()
```

## Testing Checklist

- [ ] MetaMask connection works
- [ ] WalletConnect displays QR code
- [ ] Coinbase Wallet integration works
- [ ] Phantom Solana wallet connection works
- [ ] Venly wallet connection works
- [ ] Multiple wallets can be connected simultaneously
- [ ] Balance sync works for all wallet types
- [ ] Disconnect works correctly
- [ ] Wallets persist across page refreshes
- [ ] Error messages display appropriately
- [ ] UI is responsive on mobile

## Performance Considerations

- **Lazy Loading**: Providers are dynamically imported
- **Polling**: Balance sync is user-initiated (no continuous polling)
- **Caching**: Provider detection is cached
- **Session Storage**: Minimizes re-connections on page refresh

## Migration Guide

If you had an existing wallet connection system:

1. **Old System**: `connectedWallet` (singular)
2. **New System**: `connectedWallets` (array)

Update your code:
```javascript
// Before
if (connectedWallet) {
  // Use wallet
}

// After
if (connectedWallets.length > 0) {
  const activeWallet = connectedWallets[0]
  // Use wallet
}
```

## Contributing

When adding new wallet providers:

1. Create adapter in `walletProviders.js`
2. Implement required methods (connect, disconnect, detect)
3. Add to `WALLET_PROVIDERS` export
4. Add icon and color to `MultiWalletPanel.jsx`
5. Test all connection scenarios
6. Document in this guide

## Support

For issues or questions:
1. Check the [Wallet API Documentation](https://docs.metamask.io/)
2. Review error messages in browser console
3. Check wallet provider documentation
4. Test with demo wallet (e.g., MetaMask test network)

## Related Files

- `src/lib/thirdwebClient.js` - Legacy wallet integration (still supported)
- `src/lib/web3modalClient.js` - Legacy Web3Modal integration (deprecated)
- `src/components/Wallet.jsx` - Main wallet component

## Version History

- **v2.0.0** (Current) - Multi-wallet support with all providers
- **v1.0.0** - Single wallet connection via Web3Modal

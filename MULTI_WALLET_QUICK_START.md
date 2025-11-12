# Multi-Wallet Quick Start Guide

## 5-Minute Setup

### Step 1: Import the Component
```jsx
import MultiWalletPanel from './components/MultiWalletPanel'
```

### Step 2: Add to Your Component
```jsx
export default function MyWalletPage({ userId }) {
  return (
    <div>
      <h1>My Wallets</h1>
      <MultiWalletPanel userId={userId} onWalletChange={(wallets) => {
        console.log('Updated wallets:', wallets)
      }} />
    </div>
  )
}
```

### Step 3: Done! ✅

Users can now:
- 🔌 Connect MetaMask, WalletConnect, Coinbase, Phantom, or Venly
- 💼 Manage multiple wallets at once
- ⟳ Sync wallet balances
- ✕ Disconnect any wallet
- 👀 View wallet details

---

## Common Tasks

### Check Connected Wallets
```javascript
const { connectedWallets } = useWalletManager()
console.log('Connected:', connectedWallets)
// Output: [{ providerName, address, balance, ... }, ...]
```

### Connect a Specific Wallet
```javascript
const { connectWallet } = useWalletManager()

// MetaMask
const wallet = await connectWallet('metamask')

// WalletConnect  
const wallet = await connectWallet('walletconnect')

// Coinbase
const wallet = await connectWallet('coinbase')

// Phantom (Solana)
const wallet = await connectWallet('phantom')

// Venly
const wallet = await connectWallet('venly')
```

### Disconnect a Wallet
```javascript
const { disconnectWallet } = useWalletManager()
await disconnectWallet(walletId)  // walletId from connectedWallets
```

### Sync Balances
```javascript
const { syncWalletBalances } = useWalletManager()
await syncWalletBalances(userId)
```

### Get Available Wallets
```javascript
const { getAvailableWallets } = useWalletManager()
const available = getAvailableWallets()
// Output: [
//   { key: 'metamask', name: 'MetaMask', available: true },
//   { key: 'walletconnect', name: 'WalletConnect', available: true },
//   ...
// ]
```

### Sign a Message
```javascript
const { signMessage } = useWalletManager()
const signature = await signMessage(walletId, 'Hello World')
```

---

## Wallet Detection

### Check if Wallet is Installed
```javascript
// MetaMask
if (window.ethereum?.isMetaMask) {
  console.log('MetaMask is installed')
}

// Phantom
if (window.solana?.isPhantom) {
  console.log('Phantom is installed')
}

// Coinbase Wallet
if (window.ethereum?.isCoinbaseWallet) {
  console.log('Coinbase Wallet is installed')
}
```

### List Available Wallets
```javascript
const { getAvailableWallets } = useWalletManager()
const available = getAvailableWallets()
const installed = available.filter(w => w.available)
console.log('Installed wallets:', installed)
```

---

## Accessing Wallet Data

```javascript
const { connectedWallets } = useWalletManager()

const wallet = connectedWallets[0]

// Address
console.log(wallet.address)

// Provider Type
console.log(wallet.providerType) // 'evm' or 'solana'

// Chain Info
console.log(wallet.chainId, wallet.chainName)

// Balance (if synced)
console.log(wallet.balance)

// Raw Provider
console.log(wallet.provider)

// Ethers Provider (EVM only)
console.log(wallet.ethersProvider)

// Signer (EVM only)
console.log(wallet.signer)
```

---

## Error Handling

```javascript
const { error, setError } = useWalletManager()

return (
  <div>
    {error && (
      <div className="error">
        {error}
        <button onClick={() => setError(null)}>Dismiss</button>
      </div>
    )}
  </div>
)
```

---

## UI Customization

### Show/Hide Connected Wallets
```jsx
const [showWallets, setShowWallets] = useState(false)

return (
  <div>
    <button onClick={() => setShowWallets(!showWallets)}>
      {showWallets ? 'Hide' : 'Show'} Wallets
    </button>
    
    {showWallets && <MultiWalletPanel userId={userId} />}
  </div>
)
```

### Custom Wallet Display
```jsx
import { useWalletManager } from '../lib/useWalletManager'

export default function CustomWalletList() {
  const { connectedWallets, disconnectWallet } = useWalletManager()
  
  return (
    <div>
      {connectedWallets.map(wallet => (
        <div key={wallet.id} style={{
          padding: '12px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          marginBottom: '8px'
        }}>
          <div>{wallet.providerName}</div>
          <div>{wallet.address}</div>
          <button onClick={() => disconnectWallet(wallet.id)}>
            Disconnect
          </button>
        </div>
      ))}
    </div>
  )
}
```

---

## Real-World Examples

### Transaction with Connected Wallet
```javascript
const { connectedWallets } = useWalletManager()

async function sendTransaction(amount) {
  const wallet = connectedWallets.find(w => w.providerType === 'evm')
  
  if (!wallet || !wallet.signer) {
    console.error('No EVM wallet connected')
    return
  }
  
  const tx = await wallet.signer.sendTransaction({
    to: '0x...',
    value: ethers.utils.parseEther(amount)
  })
  
  console.log('Transaction sent:', tx.hash)
}
```

### Sign & Verify Message
```javascript
const { signMessage, connectedWallets } = useWalletManager()

async function signAndVerify() {
  const wallet = connectedWallets[0]
  const message = 'I own this wallet'
  
  const signature = await signMessage(wallet.id, message)
  console.log('Signature:', signature)
  
  // Send to backend for verification
  const isValid = await verifySignature(wallet.address, message, signature)
  console.log('Valid:', isValid)
}
```

### Multi-Wallet Balance Summary
```javascript
const { connectedWallets, syncWalletBalances } = useWalletManager()

useEffect(() => {
  syncWalletBalances(userId)
}, [userId])

const totalBalance = connectedWallets
  .filter(w => w.balance !== null)
  .reduce((sum, w) => sum + w.balance, 0)

return <div>Total Balance: {totalBalance} ETH</div>
```

---

## Troubleshooting

### "Wallet not detected"
Make sure the wallet extension is installed and enabled in the browser.

### "Connection rejected"
User needs to approve the connection request in their wallet extension.

### "Balance showing as null"
Call `syncWalletBalances(userId)` after connecting a wallet.

### "Wallet not persisting"
Check browser session storage is not disabled. Wallets are stored in `session` storage, not `local` storage.

### "No accounts returned"
Wallet might be locked. Ask user to unlock their wallet and try again.

---

## Environment Variables

Add to `.env` or `.env.local`:

```
VITE_RPC_URL_1=https://eth.rpc.thirdweb.com
```

Optional: Custom Ethereum RPC endpoint. If not set, uses Thirdweb public RPC.

---

## Files Overview

| File | Purpose |
|------|---------|
| `src/lib/walletProviders.js` | Wallet provider adapters |
| `src/lib/useWalletManager.js` | Main wallet management hook |
| `src/components/MultiWalletPanel.jsx` | UI component |
| `MULTI_WALLET_INTEGRATION_GUIDE.md` | Full documentation |

---

## Next Steps

1. **Install wallets** - MetaMask, Phantom, etc.
2. **Test locally** - Connect and sync wallets
3. **Customize UI** - Match your app's design
4. **Add transactions** - Send ETH/tokens from connected wallets
5. **Sign messages** - Verify wallet ownership

---

## Support Resources

- **MetaMask Docs**: https://docs.metamask.io/
- **WalletConnect Docs**: https://docs.walletconnect.network/
- **Coinbase Wallet Docs**: https://docs.cdp.coinbase.com/coinbase-wallet/introduction/welcome
- **Phantom Docs**: https://docs.phantom.com/ulti-wallet
- **Venly Docs**: https://docs.venly.io/

---

## Tips & Tricks

**Tip 1**: Use `getAvailableWallets()` to show only installed wallets
```javascript
const installed = getAvailableWallets().filter(w => w.available)
```

**Tip 2**: Store selected wallet in localStorage
```javascript
const [selectedId, setSelectedId] = useState(() => 
  localStorage.getItem('selectedWalletId')
)

useEffect(() => {
  localStorage.setItem('selectedWalletId', selectedId)
}, [selectedId])
```

**Tip 3**: Show wallet avatar from ENS or similar
```javascript
const ensName = await ethersProvider.lookupAddress(wallet.address)
```

**Tip 4**: Auto-switch to connected wallet
```javascript
useEffect(() => {
  if (connectedWallets.length > 0 && !selectedWalletId) {
    setSelectedWalletId(connectedWallets[0].id)
  }
}, [connectedWallets])
```

---

Happy coding! 🚀

# /wallets Page - Complete Technical Analysis

## Overview
The `/wallets` page is a multi-currency wallet management system built with React, Supabase, and a clean separation between UI, services, and database layers. It handles viewing, creating, and managing user wallets across fiat currencies (PHP, USD, EUR) and cryptocurrencies (BTC, ETH, USDT, etc.).

---

## 1. ROUTING & ENTRY POINT

### How the route is activated:
```
Browser Request: /wallets
  ↓
App.jsx handleRouting() → Checks window.location.pathname
  ↓
Sets activeTab = 'wallet'
  ↓
App.jsx renders <Wallet userId={userId} globalCurrency="PHP" />
```

**Files involved:**
- `src/App.jsx` (lines 251-286) - Route detection in handleRouting()
- `src/App.jsx` (lines 795+) - Wallet component rendering based on activeTab
- `src/components/Sidebar.jsx` (lines 48-51, 860-862) - Navigation links to /wallets

**Navigation entry points:**
1. Sidebar menu: "Wallets" item with id='wallet'
2. Direct href="/wallets" links in various components
3. User click → onClick={() => setActiveTab('wallet')}

---

## 2. COMPONENT HIERARCHY

```
App.jsx
├── Wallet.jsx (Main page component)
│   ├── WalletDisplayCustomizer.jsx (Modal for adding currencies)
│   └── TransactionsList.jsx (Transaction history section)
│
└── Related components:
    ├── Sidebar.jsx (Navigation)
    ├── Navbar.jsx (Header with currency display)
    └── HeaderMap.jsx (Header content)
```

### Wallet Component Props:
```javascript
<Wallet userId={string} globalCurrency={string} />
```

### State Management in Wallet.jsx:
```javascript
const [wallets, setWallets] = useState([])                    // User's wallets
const [selectedCurrencies, setSelectedCurrencies] = useState(['PHP']) // Display prefs
const [loading, setLoading] = useState(true)
const [showCustomizer, setShowCustomizer] = useState(false)
const [error, setError] = useState('')
const [copied, setCopied] = useState(null)                    // Wallet ID copy feedback
const [viewMode, setViewMode] = useState('grid')              // 'grid' or 'list'
const [activeType, setActiveType] = useState('all')           // Filter: all/currency/cryptocurrency/wire
const [authStatus, setAuthStatus] = useState(null)            // Auth info for RLS checks
const [showDiagnostics, setShowDiagnostics] = useState(true)
const [availableTypes, setAvailableTypes] = useState([])      // Dynamic tabs based on wallets
```

### Component Lifecycle:
```javascript
useEffect(() => { loadData() }, [userId])
// Called once on mount, or when userId changes
// Triggers the complete wallet data loading sequence
```

---

## 3. DATA FLOW ARCHITECTURE

### Primary Data Fetching Flow:

```
User opens /wallets
  ↓
Wallet.loadData() invoked
  ↓
┌─────────────────────────────────────┐
│ 1. Validate authentication          │
│    supabase.auth.getSession()       │
│    Sets authStatus                  │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 2. Ensure account numbers           │
│    currencyAPI.ensureWalletsHave... │
│    AccountNumbers(userId)           │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 3. Load user preferences            │
│    getWalletDisplayPreferences()    │
│    Returns: ['PHP', 'USD', 'BTC']   │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────┐
│ 4. CORE: Fetch wallets with details                     │
│    walletService.getUserWalletsWithDetails(userId)      │
│                                                         │
│    Step A: Query public.wallets                         │
│    ├── SELECT id, user_id, currency_code,              │
│    │        balance, type, account_number, ...         │
│    │ WHERE user_id = {userId}                          │
│    │ AND is_active = TRUE                              │
│    │                                                    │
│    Step B: Get currencies metadata                      │
│    ├── SELECT code, name, type, symbol, decimals       │
│    │ FROM public.currencies                            │
│    │ WHERE code IN (wallet.currency_codes)             │
│    │                                                    │
│    Step C: Transform & enrich wallet objects           │
│    └── Map each wallet + join with currency info      │
│        Set currency_type from:                         │
│          1. wallet.type (from DB trigger)              │
│          2. currency.type (fallback)                   │
│          3. 'fiat' (final default)                     │
└─────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 5. Build available types            │
│    availableTypes = ['all',         │
│                     'currency',     │
│                     'cryptocurrency']│
│    (Always show both even if empty) │
└─────────────────────────────────────┘
  ↓
UI renders with data
```

### Detailed Wallet Service Query:

**File:** `src/lib/walletService.js` lines 51-173

```javascript
async getUserWalletsWithDetails(userId) {
  // Query 1: Fetch wallets
  const { data: walletData } = await supabase
    .from('wallets')
    .select('id, user_id, currency_code, balance, total_deposited, ' +
            'total_withdrawn, is_active, created_at, updated_at, ' +
            'account_number, type')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('currency_code')

  // Query 2: Fetch currency info for those codes
  const { data: currencyData } = await supabase
    .from('currencies')
    .select('code, name, type, symbol, decimals')
    .in('code', currencyCodes)

  // Build currency lookup map
  let currencyMap = {}
  currencyData.forEach(c => {
    currencyMap[c.code] = c
  })

  // Transform wallets
  const wallets = walletData.map(w => {
    const currencyInfo = currencyMap[w.currency_code]
    const currencyType = w.type || currencyInfo?.type || 'fiat'
    
    return {
      id: w.id,
      wallet_id: w.id,
      user_id: w.user_id,
      currency_code: w.currency_code,
      currency_name: currencyInfo?.name || w.currency_code,
      currency_type: currencyType,              // KEY FIELD
      symbol: currencyInfo?.symbol,
      decimals: currencyInfo?.decimals || 2,
      balance: w.balance,
      total_deposited: w.total_deposited,
      total_withdrawn: w.total_withdrawn,
      is_active: w.is_active,
      created_at: w.created_at,
      updated_at: w.updated_at,
      account_number: w.account_number
    }
  })

  return wallets
}
```

---

## 4. DATABASE SCHEMA

### Table: `public.currencies`
```sql
CREATE TABLE currencies (
  code VARCHAR(16) PRIMARY KEY,           -- 'BTC', 'PHP', 'USD', 'ETH', etc.
  name TEXT NOT NULL,                     -- 'Bitcoin', 'Philippine Peso', etc.
  type TEXT NOT NULL CHECK (type IN ('fiat', 'crypto')),
  symbol TEXT,                            -- '₿', '₱', '$', 'Ξ'
  decimals INTEGER DEFAULT 2,             -- Bitcoin: 8, others: 2-6
  active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,       -- PHP is default
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data includes:
-- ('PHP', 'Philippine Peso', 'fiat', '₱', 2)
-- ('USD', 'US Dollar', 'fiat', '$', 2)
-- ('BTC', 'Bitcoin', 'crypto', '₿', 8)
-- ('ETH', 'Ethereum', 'crypto', 'Ξ', 8)
-- ('USDT', 'Tether USD', 'crypto', 'USDT', 6)
-- ... and many more
```

### Table: `public.wallets`
```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),
  balance NUMERIC(36, 8) NOT NULL DEFAULT 0,
  total_deposited NUMERIC(36, 8) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(36, 8) NOT NULL DEFAULT 0,
  account_number VARCHAR(255),            -- Unique bank-like account number
  is_active BOOLEAN DEFAULT TRUE,
  type TEXT CHECK (type IN ('fiat', 'crypto', 'wire')), -- Added by migration 059
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, currency_code)          -- One wallet per currency per user
);

-- Indexes
CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_currency ON wallets(currency_code);
CREATE INDEX idx_wallets_type ON wallets(type);
CREATE INDEX idx_wallets_user_type ON wallets(user_id, type);
CREATE INDEX idx_wallets_active ON wallets(is_active) WHERE is_active = TRUE;
```

### Table: `public.wallet_transactions`
```sql
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'deposit', 'withdrawal', 'transfer_in', 'transfer_out', 
    'purchase', 'reward', 'rake', 'tip', 'adjustment'
  )),
  reference_id UUID,                      -- Link to deposits, transfers, etc.
  amount NUMERIC(36, 8) NOT NULL CHECK (amount > 0),
  balance_before NUMERIC(36, 8),
  balance_after NUMERIC(36, 8),
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()    -- Always set to transaction time
);

-- Indexes
CREATE INDEX idx_wallet_tx_user ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_tx_created ON wallet_transactions(created_at DESC);
```

### Critical Trigger: `set_wallet_type()`

**File:** `supabase/migrations/059_add_wallet_type_column.sql`

```sql
CREATE OR REPLACE FUNCTION public.set_wallet_type()
RETURNS TRIGGER AS $$
DECLARE
  v_currency_type TEXT;
BEGIN
  -- Always look up type from currency table
  SELECT type INTO v_currency_type
  FROM public.currencies
  WHERE code = NEW.currency_code
  LIMIT 1;
  
  -- Set wallet type to currency type, default to 'fiat' if not found
  NEW.type := COALESCE(v_currency_type, 'fiat');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS wallet_type_trigger ON public.wallets;

CREATE TRIGGER wallet_type_trigger
BEFORE INSERT ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.set_wallet_type();
```

**How it works:**
1. When a new wallet is inserted into `public.wallets`
2. Before the INSERT completes, this trigger executes
3. It looks up the `currency_code` in the `currencies` table
4. If found, sets `wallets.type` to match `currencies.type` (either 'crypto' or 'fiat')
5. If not found, defaults to 'fiat'
6. This ensures wallets are **automatically classified** without relying on application logic

### Critical Function: `record_wallet_transaction()`

**File:** `supabase/sql/wallet_schema.sql` lines 127-198

```sql
CREATE OR REPLACE FUNCTION record_wallet_transaction(
  p_user_id UUID,
  p_wallet_id UUID,
  p_transaction_type TEXT,
  p_amount NUMERIC,
  p_currency_code VARCHAR,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get current balance WITH ROW LOCK (prevents concurrent updates)
  SELECT balance INTO v_balance_before 
  FROM wallets 
  WHERE id = p_wallet_id 
  FOR UPDATE;  -- CRITICAL: Row-level lock for atomicity
  
  IF v_balance_before IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Calculate new balance based on transaction type
  CASE p_transaction_type
    WHEN 'deposit', 'transfer_in', 'reward', 'tip' THEN
      v_balance_after := v_balance_before + p_amount;
    WHEN 'withdrawal', 'transfer_out', 'purchase', 'rake' THEN
      v_balance_after := v_balance_before - p_amount;
    WHEN 'adjustment' THEN
      -- Allow negative for adjustments
      v_balance_after := v_balance_before - p_amount;
    ELSE
      RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
  END CASE;

  -- Prevent negative balance (except adjustments)
  IF v_balance_after < 0 AND p_transaction_type != 'adjustment' THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Attempted: %', 
                    v_balance_before, p_amount;
  END IF;

  -- Update wallet balance atomically
  UPDATE wallets
  SET 
    balance = v_balance_after,
    total_deposited = CASE WHEN p_transaction_type IN ('deposit', 'transfer_in', 'reward', 'tip') 
                           THEN total_deposited + p_amount 
                           ELSE total_deposited END,
    total_withdrawn = CASE WHEN p_transaction_type IN ('withdrawal', 'transfer_out', 'purchase', 'rake') 
                           THEN total_withdrawn + p_amount 
                           ELSE total_withdrawn END,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  -- Record transaction in immutable ledger
  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, amount, 
    balance_before, balance_after, currency_code, 
    description, reference_id
  ) VALUES (
    p_wallet_id, p_user_id, p_transaction_type, p_amount,
    v_balance_before, v_balance_after, p_currency_code,
    p_description, p_reference_id
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;
```

**Why this is critical:**
- Uses `FOR UPDATE` to lock the row, preventing race conditions
- Atomically updates balance and creates ledger entry in one transaction
- Enforces business rules (no negative balance)
- Immutable audit trail in wallet_transactions

---

## 5. SERVICE LAYER

### Service: `src/lib/walletService.js`

**Key Methods:**

| Method | Purpose | Returns |
|--------|---------|---------|
| `getAllCurrencies()` | Get list of all active currencies | Currency[] |
| `getCurrenciesGrouped()` | Group currencies by type | { fiat: [], crypto: [] } |
| `getUserWalletsWithDetails(userId)` | **PRIMARY** - Fetch user's wallets with metadata | Wallet[] |
| `createWallet(userId, currencyCode)` | Create a new wallet for user | Wallet \| null |
| `ensurePhpWallet(userId)` | Ensure user has PHP wallet | Wallet \| null |
| `buildCompleteWalletList(userId, filters)` | Build wallet list with placeholders | Wallet[] |

### Service: `src/lib/payments.js` - `currencyAPI`

**Key Methods:**

| Method | Purpose | Returns |
|--------|---------|---------|
| `getOrCreateUser(email, fullName, userId)` | Get or create user | User |
| `createWallet(userId, currencyCode)` | Create wallet with unique account number | Wallet |
| `getWallets(userId)` | Get user's wallets | Wallet[] |
| `ensureUserWallets(userId)` | Ensure user has wallets for all currencies | Wallet[] |
| `sendMoney(userId, toUserId, amount, currency)` | **CRITICAL** - Atomic transfer | Transfer |

**Critical Method: sendMoney()**
```javascript
async sendMoney(userId, toUserId, amount, currency) {
  // Calls Supabase RPC function
  const { data, error } = await supabase.rpc(
    'execute_transfer_atomic',
    {
      p_from_user_id: userId,
      p_to_user_id: toUserId,
      p_amount: amount,
      p_currency_code: currency,
      p_fee_percentage: 0.01  // 1% fee
    }
  )
  
  // RPC handles:
  // 1. Debit from sender's wallet (call record_wallet_transaction)
  // 2. Fee calculation and syndication
  // 3. Credit to recipient's wallet (call record_wallet_transaction)
  // All atomic - either all succeed or all rollback
}
```

### Service: `src/lib/walletTransactionService.js`

**Key Methods:**

| Method | Purpose | Returns |
|--------|---------|---------|
| `getWalletTransactions(walletId, limit)` | Get transaction history for wallet | Transaction[] |
| `getUserTransactions(userId, limit)` | Get all transactions for user across wallets | Transaction[] |
| `getWalletStats(walletId)` | Get balance stats for wallet | Stats |
| `getBalanceHistory(walletId, days)` | Get historical balance data | BalanceHistory[] |
| `getTransactionTrends(walletId)` | Get transaction trends | Trends |

**Implementation Detail:**
```javascript
async getUserTransactions(userId, limit = 50) {
  // Get user's wallet IDs
  const { data: wallets } = await supabase
    .from('wallets')
    .select('id')
    .eq('user_id', userId)

  const walletIds = wallets?.map(w => w.id) || []

  // Query transactions for those wallets
  const { data: transactions } = await supabase
    .from('wallet_transactions')
    .select(`
      id, type, amount, balance_before, balance_after,
      currency_code, description, created_at, reference_id,
      wallets(user_id, currency_code)
    `)
    .in('wallet_id', walletIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  return transactions.map(tx => ({
    ...tx,
    user_id: tx.wallets.user_id,
    currency_code: tx.wallets.currency_code
  }))
}
```

---

## 6. UI/UX FEATURES

### 6.1 Tab System

**Implementation:** `src/components/Wallet.jsx` lines 236-262

```javascript
const typeConfig = {
  all: { label: 'All Wallets', activeClass: 'border-slate-600 text-slate-600' },
  currency: { label: 'Fiat Currency', activeClass: 'border-blue-600 text-blue-600' },
  cryptocurrency: { label: 'Cryptocurrency', activeClass: 'border-orange-600 text-orange-600' },
  wire: { label: 'Wire Transfer', activeClass: 'border-purple-600 text-purple-600' }
}

// Always show Fiat Currency and Cryptocurrency tabs
const availableTypesList = ['all', 'currency', 'cryptocurrency']
if (types.has('wire')) availableTypesList.push('wire')
setAvailableTypes(availableTypesList)

// Render tabs
{availableTypes.map(type => (
  <button onClick={() => setActiveType(type)}>
    {typeConfig[type].label}
  </button>
))}
```

**Filtering Logic:**
```javascript
const fiatWallets = wallets.filter(w => w.currency_type === 'fiat')
const cryptoWallets = wallets.filter(w => w.currency_type === 'crypto')
const wireWallets = wallets.filter(w => w.currency_type === 'wire')

const getFilteredWallets = () => {
  if (activeType === 'all') return wallets
  if (activeType === 'currency') return fiatWallets
  if (activeType === 'cryptocurrency') return cryptoWallets
  if (activeType === 'wire') return wireWallets
  return wallets
}
```

### 6.2 Grid vs List View

**State:** `const [viewMode, setViewMode] = useState('grid')`

**Grid View:**
- Display wallets as cards in a responsive grid
- 1 column on mobile, 2 on tablet, 3 on desktop
- Shows: symbol, balance, wallet ID (copy button), metadata, status badge

**List View:**
- Display wallets in HTML tables
- Columns: Code, Symbol, Balance, Deposited, Wallet ID, Account, Status
- Better for comparing multiple wallets

### 6.3 Add More Currencies Modal

**Component:** `src/components/WalletDisplayCustomizer.jsx`

**Flow:**
1. User clicks "+ Add More Currencies" button
2. Modal opens with two tabs: "Fiat Currency" and "Cryptocurrency"
3. Each tab shows list of available currencies with checkboxes
4. PHP is force-included (cannot be unchecked)
5. User selects currencies → clicks "Save"
6. Process:
   - `setWalletDisplayPreferences(userId, selectedCurrencies)` - saves to user_preferences table
   - For any new currencies, calls `currencyAPI.createWallet(userId, currencyCode)`
   - createWallet:
     - Generates unique 12-digit account_number
     - INSERTs into public.wallets
     - Trigger set_wallet_type() automatically assigns correct type
     - Returns new wallet object
7. Modal closes, parent calls `loadData()` to refresh

**Key Code:**
```javascript
const handleSave = async () => {
  // Save preferences to database
  await setWalletDisplayPreferences(userId, selectedCurrencies)

  // Create missing wallets
  const missingCurrencies = selectedCurrencies.filter(
    code => !existingCodes.includes(code)
  )

  for (const currencyCode of missingCurrencies) {
    await currencyAPI.createWallet(userId, currencyCode)
  }

  // Refresh parent component
  if (onUpdate) onUpdate(selectedCurrencies)
}
```

### 6.4 Transaction History

**Component:** `src/components/Wallets/TransactionsList.jsx`

**Features:**
- Real-time updates via Supabase subscriptions
- Paginated table showing recent transactions
- Columns: Type, Description, Amount, Balance After, Date
- Expandable rows showing: ID, Wallet ID, Balance Before, Reference ID

**Real-time Implementation:**
```javascript
useEffect(() => {
  // Subscribe to wallet_transactions insertions for this user
  const channel = supabase
    .channel('public:wallet_transactions')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'wallet_transactions',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        // New transaction received → reload transactions
        loadTransactions()
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [userId])
```

---

## 7. AUTHENTICATION & SECURITY

### 7.1 Session Validation

**In Wallet.jsx:**
```javascript
const { data: { session }, error: sessionError } = await supabase.auth.getSession()

if (sessionError) {
  console.error('Auth session error:', sessionError)
  setError('Authentication error - please log in again')
  return
}

if (!session) {
  setError('Not authenticated - please log in to see your wallets')
  return
}

setAuthStatus({
  authenticated: true,
  userId: session.user.id,
  email: session.user.email
})
```

### 7.2 Row-Level Security (RLS)

**Policies on public.wallets:**
```sql
-- Users can view their own wallets
CREATE POLICY "Users can view own wallets" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own wallets
CREATE POLICY "Users can insert own wallets" ON wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own wallets
CREATE POLICY "Users can update own wallets" ON wallets
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**Policies on public.wallet_transactions:**
```sql
-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);
```

**Policies on public.currencies:**
```sql
-- Anyone can view active currencies
CREATE POLICY "Anyone can view active currencies" ON currencies
  FOR SELECT USING (active = TRUE);
```

### 7.3 Atomicity & Data Integrity

**Wallet Balance Updates:**
- All balance updates done via DB function `record_wallet_transaction()`
- Uses `FOR UPDATE` row lock to prevent race conditions
- Single atomic transaction: update balance + insert ledger entry
- Either both succeed or both rollback

**Transfer Atomicity:**
- RPC `execute_transfer_atomic()` handles sender → recipient transfers
- Debits sender, credits recipient, calculates fees, all in one transaction
- If any step fails, entire transaction rolls back

---

## 8. COMPLETE DATA FLOW DIAGRAM

### Scenario: User creates a new cryptocurrency wallet (BTC)

```
┌─────────────────────────────────────────────────────────┐
│ User clicks "+ Add More Currencies"                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ WalletDisplayCustomizer modal opens                     │
│ - Loads currencies from public.currencies               │
│ - Shows two tabs: Fiat Currency | Cryptocurrency       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ User clicks "Cryptocurrency" tab                        │
│ User checks "Bitcoin (BTC)"                             │
│ User clicks "Save"                                      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ handleSave() called                                     │
│ ├─ setWalletDisplayPreferences(userId, [..., 'BTC'])  │
│ │  └─ Saves to user_preferences table                  │
│ └─ For missing currencies (BTC)                         │
│    └─ Call currencyAPI.createWallet(userId, 'BTC')    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ currencyAPI.createWallet('BTC')                         │
│ ├─ Check if wallet already exists                       │
│ ├─ Generate unique account_number (12 digits)           │
│ └─ INSERT INTO public.wallets (                         │
│     user_id, currency_code='BTC', balance=0,           │
│     account_number, is_active=true                     │
│   )                                                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ DATABASE TRIGGER: set_wallet_type()                     │
│ BEFORE INSERT triggered                                 │
│ ├─ SELECT type FROM currencies WHERE code='BTC'        │
│ │  └─ Returns: 'crypto'                                │
│ └─ SET NEW.type = 'crypto'                             │
│                                                         │
│ ROW inserted into public.wallets with:                  │
│ ├─ id: UUID                                             │
│ ├─ user_id: {userId}                                    │
│ ├─ currency_code: 'BTC'                                │
│ ├─ balance: 0.00000000                                 │
│ ├─ type: 'crypto'  ← Set by trigger                    │
│ ├─ account_number: '123456789012'                      │
│ └─ created_at: NOW()                                    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ createWallet returns wallet object                      │
│ {                                                       │
│   id: 'abc123...',                                      │
│   wallet_id: 'abc123...',                               │
│   currency_code: 'BTC',                                 │
│   currency_type: 'crypto',  ← From trigger             │
│   balance: 0,                                           │
│   symbol: '₿',                                          │
│   account_number: '123456789012',                       │
│   ...                                                   │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Modal closes                                             │
│ Parent Wallet.jsx calls loadData()                      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ loadData() → walletService.getUserWalletsWithDetails()  │
│ ├─ Query public.wallets for user                        │
│ │  └─ Now includes BTC wallet with type='crypto'       │
│ ├─ Join with public.currencies                          │
│ └─ Transform & enrich                                   │
│    └─ BTC wallet now has currency_type='crypto'        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ availableTypes = ['all', 'currency', 'cryptocurrency'] │
│ (Both tabs always shown, 'cryptocurrency' now has data) │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ UI updates:                                              │
│ ├─ "Cryptocurrency" tab now shows BTC wallet            │
│ ├─ Card displays:                                       │
│ │  - BTC symbol                                         │
│ │  - Balance: 0.00000000 ₿                             │
│ │  - Wallet ID (copy button)                           │
│ │  - Status: Active                                     │
│ │  - Styling: Orange theme (crypto)                    │
│ └─ Grid or List view as selected                        │
└─────────────────────────────────────────────────────────┘
```

---

## 9. ERROR HANDLING & EDGE CASES

### Session Errors
- **Scenario:** User session expired mid-action
- **Handling:** 
  - Check session at start of loadData()
  - Show "Not authenticated" error
  - Offer login button

### Wallet Already Exists
- **Scenario:** User tries to add currency they already have
- **Handling:**
  - createWallet checks for existing wallet
  - Skips creation, returns existing wallet
  - No duplicate entries due to UNIQUE constraint

### Insufficient Balance
- **Scenario:** User tries to send more than they have
- **Handling:**
  - record_wallet_transaction() checks balance
  - Raises exception before inserting
  - Transaction rolled back, user informed

### Currency Not Found
- **Scenario:** Wallet created for non-existent currency code
- **Handling:**
  - Trigger defaults type to 'fiat'
  - Service falls back to 'fiat' as well
  - Logged for debugging

---

## 10. PERFORMANCE CONSIDERATIONS

### Optimizations:
1. **Indexed Queries:**
   - `idx_wallets_user` - Fast lookup by user_id
   - `idx_wallets_type` - Fast tab filtering
   - `idx_wallet_tx_created` - Fast transaction sorting

2. **Query Limiting:**
   - TransactionsList limits to 50 transactions by default
   - Pagination available for larger datasets

3. **Real-time Subscriptions:**
   - Only subscribe to relevant user's transactions
   - Filter at DB level using Postgres change filters

4. **Client-side Caching:**
   - Wallet data loaded once on mount
   - Re-fetched when modal closes
   - Not refetched on every view toggle

### N+1 Avoidance:
- walletService fetches currencies in separate query with IN clause
- Not fetching currency for each wallet individually
- Builds map and joins in-memory

---

## 11. KEY FILES REFERENCE

| File | Purpose | Lines |
|------|---------|-------|
| `src/App.jsx` | Route activation, global auth | 251-286, 795+ |
| `src/components/Wallet.jsx` | Main /wallets page | 1-802 |
| `src/components/WalletDisplayCustomizer.jsx` | Add currencies modal | 1-402 |
| `src/components/Wallets/TransactionsList.jsx` | Transaction history | 1-402 |
| `src/lib/walletService.js` | Core wallet data service | 1-402 |
| `src/lib/payments.js` | Currency API, money transfers | 1-500+ |
| `src/lib/walletTransactionService.js` | Transaction queries & stats | 1-242 |
| `src/lib/walletPreferences.js` | User display preferences | 1-202 |
| `supabase/sql/wallet_schema.sql` | Core DB schema & functions | 1-262 |
| `supabase/migrations/059_add_wallet_type_column.sql` | Type trigger & column | 1-122 |

---

## 12. SUMMARY: THE COMPLETE FLOW

```
/wallets Request
  ├─ Route: App.jsx detects /wallets in URL
  ├─ Component: Wallet.jsx renders
  ├─ Load: walletService.getUserWalletsWithDetails()
  │         ├─ Query public.wallets (user's wallets)
  │         ├─ Query public.currencies (metadata)
  │         └─ Transform & enrich with currency_type
  ├─ Display: 
  │         ├─ Tabs: All | Fiat | Crypto | Wire
  │         ├─ Views: Grid | List
  │         ├─ Each wallet card shows: balance, account ID, metadata
  │         └─ Real-time transaction history
  ├─ Actions:
  │         ├─ Add More Currencies → Modal
  │         │  └─ Select → Save → currencyAPI.createWallet()
  │         │     └─ INSERT public.wallets → trigger set_wallet_type()
  │         ├─ Copy wallet ID → clipboard
  │         └─ View transactions → TransactionsList component
  └─ Security:
            ├─ RLS policies enforce user_id = auth.uid()
            ├─ Atomicity via DB functions (record_wallet_transaction)
            └─ Immutable ledger (wallet_transactions)
```


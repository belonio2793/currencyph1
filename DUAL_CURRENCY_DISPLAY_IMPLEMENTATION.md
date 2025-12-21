# Dual Currency & Cryptocurrency Display Implementation

## Overview
Implement simultaneous display of both fiat currency and cryptocurrency balances throughout the application. Users select one fiat currency (PHP, USD, AUD, etc.) and one cryptocurrency (BTC, ETH, DOGE, etc.), and both are displayed together in all balance displays across the app.

**Status:** In Progress  
**Last Updated:** 2025-12-21

---

## Implementation Tasks

### ✅ Phase 1: Foundation & State Management (COMPLETED)
- [x] Add currency persistence to localStorage in `preferencesManager.js`
- [x] Update `App.jsx` to load currency preferences on app start
- [x] Add auto-save of currency preferences when selections change
- [x] Enhance `CurrencySelectionModal.jsx` with visual indicators

### 🔄 Phase 2: Modal & Selection (COMPLETED)
- [x] Simplify `CurrencySelectionModal.jsx` to show "Currently Selected"
- [x] Remove balance reconciliation preview
- [x] Keep both dropdowns for Currency and Cryptocurrency selection
- [x] Ensure both selections persist to localStorage

---

## Pending Tasks - Phase 3: Dual Display Implementation

### Task 1: Update Navbar Balance Display
**File:** `src/components/Navbar.jsx`  
**Lines:** ~70-105  
**Current State:** Shows Fiat/Crypto toggle buttons with single balance display  
**Change Required:** 
- Remove the toggle buttons (Fiat/Crypto)
- Display both balances simultaneously in format: `100.50 AUD + 0.00123456 BTC`
- Keep the `totalBalancePHP` and `totalBalanceConverted` state
- Add live crypto conversion when balance changes
- Remove `displayType` state variable
- Keep total balance display visible at all times

**Acceptance Criteria:**
- [ ] Both balances visible in navbar simultaneously
- [ ] Updates when currency selection changes
- [ ] Updates when cryptocurrency selection changes
- [ ] Properly formatted with correct decimal places (2 for fiat, 8 for crypto)

**Dependencies:** `convertFiatToCryptoDb()` from `src/lib/cryptoRatesDb.js`

---

### Task 2: Update HomePage Balance Cards
**File:** `src/components/HomePage.jsx`  
**Lines:** Search for balance display sections  
**Current State:** Shows single balance (if exists)  
**Change Required:**
- Find all balance display locations (TOTAL BALANCE, NET, etc.)
- Add dual display showing both fiat and crypto
- Format: "100.50 AUD + 0.00123456 BTC"
- Ensure conversions update when either currency selection changes

**Files to Check:**
- Balance card components
- Net balance section
- Any other monetary value displays

**Acceptance Criteria:**
- [ ] All balance displays show both currencies
- [ ] Formatting is consistent across page
- [ ] Updates when selections change

---

### Task 3: Find & Update All Balance Display Components
**Search Pattern:** Look for components displaying:
- `totalBalance`
- `totalBalanceConverted`
- `totalBalancePHP`
- `totalDebtConverted`
- `totalNet`
- Any monetary value displays

**Key Files to Check:**
- `src/components/Wallet.jsx` (if exists and shows balances)
- `src/components/Dashboard.jsx` (if exists)
- `src/components/Deposits.jsx` (if shows balances)
- `src/components/NetworkBalances.jsx` (if exists)
- Any other components that display monetary values

**Change Required for Each:**
- Add crypto balance conversion alongside fiat display
- Show both values: "X.XX CURRENCY + Y.YYYYYY CRYPTO"
- Update whenever `globalCurrency` or `globalCryptocurrency` changes

**Acceptance Criteria:**
- [ ] All balance displays updated
- [ ] Consistent formatting throughout app
- [ ] No broken references to removed `displayType` state

---

### Task 4: Update Navbar Props
**File:** `src/components/Navbar.jsx`  
**Current Props Passed from App.jsx:**
```javascript
<Navbar
  ...
  globalCurrency={globalCurrency}
  setGlobalCurrency={setGlobalCurrency}
  globalCryptocurrency={globalCryptocurrency}
  setGlobalCryptocurrency={setGlobalCryptocurrency}
  totalBalancePHP={totalBalancePHP}
  totalBalanceConverted={totalBalanceConverted}
  userEmail={userEmail}
/>
```

**Verify these props exist in App.jsx and are properly passed**

**Acceptance Criteria:**
- [ ] All required props available in Navbar
- [ ] No console errors about missing props

---

### Task 5: Update CurrencySelectionModal Documentation
**File:** `src/components/CurrencySelectionModal.jsx`  
**Change Required:**
- Add comment explaining both currencies are always selected
- Clarify that selecting one fiat + one crypto is required
- Update "Currently Selected" section title if needed (optional)

**Acceptance Criteria:**
- [ ] Code is self-documenting
- [ ] Clear explanation of dual selection behavior

---

### Task 6: Testing & Verification
**Manual Tests to Perform:**

1. **Currency Selection Modal**
   - [ ] Open modal
   - [ ] Verify "Currently Selected" shows both currency and cryptocurrency
   - [ ] Change currency dropdown
   - [ ] Change cryptocurrency dropdown
   - [ ] Click Apply
   - [ ] Verify selections persist on page reload

2. **Balance Display**
   - [ ] Verify both balances show in navbar
   - [ ] Verify both balances show on HomePage
   - [ ] Change currency selection → verify navbar updates
   - [ ] Change crypto selection → verify navbar updates
   - [ ] Check formatting (2 decimals for fiat, 8 for crypto)

3. **Data Persistence**
   - [ ] Select AUD + ETH
   - [ ] Refresh page
   - [ ] Verify selections persist
   - [ ] Verify balances show correctly

4. **Error Cases**
   - [ ] If crypto conversion fails → show fallback message
   - [ ] If rates unavailable → graceful handling
   - [ ] Check browser console for errors

**Acceptance Criteria:**
- [ ] All manual tests pass
- [ ] No console errors
- [ ] Both balances always visible
- [ ] Selections persist across page reloads

---

## Reference Implementation

### Dual Balance Display Format
```jsx
// Example of dual display
const [cryptoBalance, setCryptoBalance] = useState(null)

useEffect(() => {
  if (totalBalanceConverted && globalCryptocurrency) {
    convertFiatToCryptoDb(totalBalanceConverted, globalCurrency, globalCryptocurrency)
      .then(balance => setCryptoBalance(balance))
      .catch(err => console.error('Conversion failed:', err))
  }
}, [totalBalanceConverted, globalCurrency, globalCryptocurrency])

// In JSX:
<span className="font-semibold">
  {formatNumber(totalBalanceConverted)} {globalCurrency}
  {cryptoBalance !== null && (
    <>
      {' + '}
      {cryptoBalance.toFixed(8)} {globalCryptocurrency}
    </>
  )}
</span>
```

### Import Statement Needed
```javascript
import { convertFiatToCryptoDb } from '../lib/cryptoRatesDb'
```

---

## Files Modified Summary

### Already Modified
- ✅ `src/lib/preferencesManager.js` - Added currency preference functions
- ✅ `src/App.jsx` - Added currency initialization and auto-save
- ✅ `src/components/CurrencySelectionModal.jsx` - Simplified with visual indicators

### To Be Modified
- `src/components/Navbar.jsx` - Remove toggle, add dual display
- `src/components/HomePage.jsx` - Update balance displays
- Other balance display components (TBD)

---

## Known Issues / Notes

### HTTP Errors (from recent logs)
```
503 Offline - resource not available (fetch-rates)
406 PGRST116 (user_onboarding_state)
```
These are pre-existing and don't block this feature.

### Dependencies
- `convertFiatToCryptoDb()` function exists and works
- `formatNumber()` function exists and works
- Both `globalCurrency` and `globalCryptocurrency` state exists in App.jsx

---

## Checkpoints (Work in Sections)

**Checkpoint 1 - Navbar Update**
- Task 1 + Task 4 + partial Task 6

**Checkpoint 2 - HomePage Update**
- Task 2 + partial Task 6

**Checkpoint 3 - Other Components**
- Task 3 + Task 5 + full Task 6

---

## How to Use This Document

1. Start with **Checkpoint 1**
2. Complete all tasks in that section
3. Run tests for that section
4. Mark tasks as complete with ✅
5. Move to next checkpoint
6. If browser crashes, come back to this doc and continue where you left off

---

## Related Files for Reference

- `src/lib/cryptoRatesDb.js` - Contains conversion functions
- `src/lib/currency.js` - Contains formatNumber()
- `src/lib/preferencesManager.js` - Currency persistence logic
- `src/App.jsx` - Main app state and props distribution

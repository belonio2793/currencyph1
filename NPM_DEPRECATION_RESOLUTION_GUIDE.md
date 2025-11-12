# NPM Deprecation Warnings - Resolution Guide

## Overview

Your project has 43 npm deprecation warnings. Most come from old Web3/Ethereum ecosystem packages that are no longer actively maintained. This guide outlines the warnings, their sources, and a migration strategy.

## Warning Categories & Solutions

### 1. Level/LevelDB Ecosystem (9 warnings)

**Affected Packages:**
- `deferred-leveldown@1.2.2` 
- `memdown@1.4.1`
- `level-codec@7.0.1`
- `abstract-leveldown@2.6.3`, `@2.7.2`
- `levelup@1.3.9`
- `level-errors@1.0.5`

**Source:** These come from old blockchain/crypto dependencies through chains like:
- `@solana/web3.js` → various dependencies

**Recommended Solution:**
- These are from nested dependencies and upgrading `@solana/web3.js` to a newer version might help
- **Current Status:** Low priority - doesn't affect app functionality

---

### 2. MetaMask/Ethereum Core Utilities (3 warnings)

**Affected Packages:**
- `eth-sig-util@1.4.2` → Use `@metamask/eth-sig-util` 
- `safe-event-emitter@1.0.1` → Use `@metamask/safe-event-emitter`

**Source:** Nested dependencies from blockchain packages

**Recommended Solution:**
- Update parent packages that use these
- **Current Status:** These should be replaced in transitive deps

---

### 3. EthereumJS Packages - Need @ethereumjs Scoped Format (5 warnings)

**Affected Packages:**
- `ethereumjs-tx@1.3.7` → `@ethereumjs/tx`
- `ethereumjs-tx@2.1.2` → `@ethereumjs/tx` 
- `ethereumjs-vm@2.6.0` → `@ethereumjs/vm`
- `ethereumjs-block@1.7.1` → `@ethereumjs/block`
- `ethereumjs-block@2.2.2` → `@ethereumjs/block`
- `ethereumjs-common@1.5.2` → `@ethereumjs/common`

**Source:** Old Ethereum protocol packages

**Recommended Solution:**
- These are likely from `@thirdweb-dev/sdk` or similar blockchain libraries
- Would require updating parent packages
- **Current Status:** Requires updates to parent blockchain libraries

---

### 4. WalletConnect v1 Deprecation (11 warnings) - **HIGH PRIORITY**

**Affected Packages:**
- `@walletconnect/client@1.8.0` 
- `@walletconnect/web3-provider@1.8.0`
- `@walletconnect/qrcode-modal@1.8.0`
- `@walletconnect/types@1.8.0` (5x)

**Source:** Direct dependency in `package.json`

**Migration Path:**
```json
// CURRENT (package.json)
"@walletconnect/web3-provider": "^1.7.8",
"web3modal": "^1.9.8"

// RECOMMENDED (Option 1 - AppKit)
"@reown/appkit": "^1.0.0",
"@reown/appkit-adapter-ethers": "^1.0.0"

// RECOMMENDED (Option 2 - WalletConnect v2 Direct)
"@walletconnect/ethereum-provider": "^2.12.2"
```

**Code Changes Needed:**
- Update `src/lib/web3modalClient.js` to use AppKit
- Update `src/components/Wallet.jsx` to work with new connection flow
- Test all wallet connection scenarios

**Challenge:** Requires `ethers@^6` but `@thirdweb-dev/sdk` requires `ethers@^5`

**Solution:** Use `.npmrc` with `legacy-peer-deps=true` during transition

---

### 5. Web3 Provider Engine (1 warning)

**Affected Package:**
- `web3-provider-engine@16.0.1` - **Package deprecated**

**Source:** Nested dependency

**Recommendation:** 
- Replace with modern Web3 provider libraries
- Part of larger Web3 ecosystem modernization

---

### 6. Infura & Infrastructure Services (2 warnings)

**Affected Packages:**
- `eth-json-rpc-infura@5.1.0` - **Package no longer supported**
- `web3modal@1.9.12` - **Package no longer supported**
- `request@2.88.2` - Use native `fetch()` or `axios`

**Recommendation:**
- Use Infura REST API directly instead of these deprecated packages
- Replace `request` with `node-fetch` (already in your deps) or native `fetch()`

---

### 7. IPFS/Multiformats Ecosystem (4 warnings)

**Affected Packages:**
- `multibase@4.0.6` → `multiformats`
- `multicodec@3.2.1` → `multiformats`
- `cids@1.1.9` → `multiformats`

**Source:** IPFS-related libraries

**Recommendation:**
- Update IPFS libraries if used
- Use `multiformats` package instead

---

### 8. Vue Animation Library (1 warning)

**Affected Package:**
- `@motionone/vue@10.16.4` → `oku-motion`

**Status:** Only relevant if Vue is used in the project (it's not - you're using React)

---

### 9. WalletConnect Modal Update (1 warning)

**Affected Package:**
- `@walletconnect/modal@2.7.0` - Migration guide at https://docs.reown.com/appkit/upgrade/wcm

**Recommendation:**
- Part of WalletConnect v2 → AppKit migration

---

### 10. UUID Package (1 warning)

**Affected Package:**
- `uuid@3.4.0` → Upgrade to `uuid@^9.0.0`

**Reason:** v3 uses Math.random() which can be problematic

**Solution:** Update directly in your dependencies
```json
"uuid": "^9.0.1"
```

---

## Implementation Strategy

### Phase 1: Immediate Actions (Low Risk)
1. ✅ Add `.npmrc` with `legacy-peer-deps=true` (done)
2. Update `uuid` to v9+
3. Suppress/document known warnings from transitive deps

### Phase 2: Medium-term (Requires Planning)
1. Evaluate if blockchain features are actively used
2. Consider updating `@thirdweb-dev/sdk` to newer version
3. Plan WalletConnect migration timeline

### Phase 3: Major Refactor (High Impact)
1. **Upgrade ethers v5 → v6** (breaking changes)
2. **Migrate WalletConnect v1 → AppKit/v2** (code changes)
3. **Update blockchain dependencies** (testing required)
4. **Migrate away from web3modal** (UX changes)

## Current Status

✅ **Completed:**
- Added `.npmrc` with legacy-peer-deps and timeout configs
- Restored original package.json to maintain app stability

🔄 **In Progress:**
- Identified all warning sources
- Planned migration paths

⏳ **Recommended Next Steps:**
1. Update uuid to v9+ (quick win)
2. Test app with updated uuid
3. Plan Phase 2 upgrades based on actual feature usage
4. Create separate branch for Phase 3 major refactor

## Migration Timeline

**Short-term (1-2 weeks):**
- Update non-breaking packages (uuid, etc.)
- Add proper error handling for deprecated code paths

**Medium-term (1-2 months):**
- Evaluate blockchain feature usage
- Plan and test new provider libraries

**Long-term (3-6 months):**
- Major refactor to modern Web3 stack
- Consider alternatives to @thirdweb-dev/sdk if it blocks progress

## Key Insights

- **43 warnings from ~8 main sources** - Not all from your direct dependencies
- **WalletConnect v1 is the biggest issue** - It and web3modal have many deprecated transitive deps
- **Ethers version conflict** - Upgrading blocks WalletConnect migration without `legacy-peer-deps`
- **Blockchain ecosystem is fragmented** - Different packages require different versions

## References

- WalletConnect Migration: https://docs.walletconnect.com/
- AppKit Docs: https://docs.reown.com/appkit/
- Ethereumjs Migration: https://github.com/ethereumjs/ethereumjs-monorepo
- Level/LevelDB Alternatives: https://github.com/Level/community#faq

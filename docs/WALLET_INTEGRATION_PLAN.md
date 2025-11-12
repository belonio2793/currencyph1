Overview

This document inventories popular wallet/connectors and maps provider APIs/connectors to the database schema, backend sync endpoints and frontend UI flows. It also lists the SQL migrations and a recommended architecture for syncing on‑chain balances and token balances to Supabase.

1) Wallet providers & integration notes

- MetaMask (injected, EIP‑1193)
  - Integration: browser injected provider (window.ethereum), use ethers.js or web3.js to request accounts, sign messages and use signer for transactions.
  - Endpoints/operations exposed to app (client side): requestAccounts, getBalance (via provider), signer.signTransaction/sendTransaction, request to switch chain, requestPermissions.
  - Mapping to schema: create or update an entry in wallets (user_id, provider = 'metamask', address, chain_id, currency_code, provider_meta JSON). No private keys stored.

- WalletConnect v2
  - Integration: QR + mobile deep linking, supports multiple wallets (Trust Wallet, Rainbow, Coinbase, etc.) via connectors.
  - Offloads provider connection and supports EVM chains. Use official WalletConnect libraries (v2) and Web3Modal/Onboard.js wrappers.
  - Mapping: store connection metadata in wallets.connect_session (JSON), addresses, chain IDs, and last connected time.

- Coinbase Wallet (walletlink / injected)
  - Similar to MetaMask in behavior. Use same flows. Store provider = 'coinbase'.

- Phantom (Solana)
  - Solana provider (window.solana). Use @solana/web3.js to fetch balances and send transactions.
  - Mapping: wallets entries will have chain='solana', address (base58), balance (in lamports converted to SOL), token balances stored in wallets_tokens table with mint addresses.

- Trust Wallet / Rainbow / Exodus
  - Often supported via WalletConnect or as injected providers. Treat like WalletConnect or injected depending on availability.

- Ledger / Trezor (hardware)
  - Connect via WebUSB / WebHID or via WalletConnect. Do not store private keys; store only address and hardware metadata (model, derivation path). Sign via the device using the connector.

- Phantom / Solflare / Solana wallets
  - For Solana, use specific RPCs and mapping for SPL tokens. Use separate table schema for token balances.

2) Database schema mapping (high level)

We recommend central normalized tables. SQL migration is included in the repo (supabase/migrations/001_create_wallets_tables.sql). Key tables:

- wallets
  Fields: id (uuid), user_id (uuid), provider TEXT, provider_type TEXT, address TEXT, chain_id INT, currency_code TEXT, balance NUMERIC, token_balances JSONB, metadata JSONB, last_synced_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP
  Purpose: single source for user wallets (fiat/crypto/manual). For on‑chain wallets, balance is the native token balance.

- wallets_crypto (optional specialized view/table)
  Purpose: if you prefer separate table for on‑chain wallets, use wallets_crypto referencing wallets.id and storing chain specific data.

- wallets_fiat
  Fields: id, user_id, provider, account_number, currency_code, balance, metadata, last_synced_at, created_at

- wallets_house
  Fields: id, network, currency_code, address, balance, metadata
  Purpose: platform/house wallets on each chain for fee collection, custodial flows, liquidity.

- transactions
  Generic TX ledger: id, user_id, wallet_id, type (onchain|fiat|internal), amount, currency_code, status, tx_hash, raw JSON, created_at

- network_wallets / network_transactions
  Used for house wallets activity and ledgered onchain transactions.

3) API / Edge functions

Create serverless endpoints to do the following:

- POST /sync-wallets
  Body: { addresses: [{ address, chain_id, wallet_id? }], force?: boolean }
  Behavior: use configured RPC providers to fetch native balances (eth_getBalance) for EVM chains, solana getBalance for Solana, and optionally token balances. Store results in wallets table and insert transaction records if diffs detected.

- GET /rates (existing function fetch-rates) — use it to compute conversions to display currency.

- POST /fetch-token-balances
  Body: { address, chain_id }
  Behavior: run token list and ERC20 balanceOf calls (or call multicall), return token balances as JSON. Store in wallets.token_balances.

Implementation notes:
- Use multicall for EVM token reads for efficiency (Alchemy, Infura, RPC + multicall contract). Use provider batching where supported.
- For Solana and other chains, use dedicated RPC or indexer (e.g., Helius, QuickNode) to list SPL tokens.
- Use service role key to write to Supabase (server functions). Never send service role to client.
- Rate limit and cache results; use last_synced_at to avoid redundant fetches.

4) Frontend

- Use Web3Modal/Onboard.js or thirdweb SDK for unified connect UI. Provide connectors for MetaMask, Coinbase Wallet, WalletConnect v2, Phantom, Fortmatic, Portis, Ledger, Trezor.
- On connect: upsert wallet in wallets table via an authenticated server endpoint (or supabase client using service role on server). Store metadata locally for UI.
- Show real native balance and token balances in Cryptocurrency Wallets section. Use the sync endpoint for server authoritative values and fall back to provider read for instant UI feedback.
- For send: use connected signer to build tx, estimate gas, sign and send; optimistically update UI and record tx with status pending on server.

5) Security considerations

- Never store private keys or sensitive provider tokens. Only store addresses and provider metadata.
- Use signed messages for authentication linking a wallet to a user (SIWE style) if supporting wallet-based login.
- Ensure all server endpoints use Supabase service role only on server side.
- Validate chain_id/address inputs and sanitize outputs.

6) Query mappings (endpoint → table)

- Connect wallet (client) → POST /api/wallets/upsert → inserts into wallets (user_id, provider, address, chain_id, metadata)
- Sync balances → POST /supabase/functions/sync-wallets → updates wallets.balance, wallets.token_balances, wallets.last_synced_at
- Fetch token balances → POST /supabase/functions/fetch-token-balances → updates wallets.token_balances
- Send transaction (client) → POST /api/tx/record (server) to record tx metadata, optionally broadcast via server RPC if custodial.

Appendix
- Libraries: ethers.js, @walletconnect/web3modal, web3modal, onboard, @solana/web3.js, coinbase-wallet-sdk
- Providers: Alchemy/Infura/QuickNode/Maptizer (for many RPCs)


End of document

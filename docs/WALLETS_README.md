Wallets architecture — overview

This document describes the wallets architecture implemented in this project, the SQL tables created, how data flows between user wallets and the platform (house/network) balances, and the UI integration points.

Overview

There are three logical wallet categories in the system:

1) Internal / Legacy wallets
   - Stored in the existing `wallets` table (see supabase/sql/wallet_schema.sql).
   - Supports multi-currency balances (fiat + crypto), per-user balances, and the existing audit trail `wallet_transactions`.
   - Used for legacy flows and internal features that rely on SQL-only wallets and exchange rates fetched from the Rates service.

2) Fiat wallets (new)
   - Table: `wallets_fiat` (created by supabase/migrations/007_create_wallets_fiat_crypto.sql)
   - Purpose: Integrate with real-money payment providers (banks, PSPs) while keeping a clear ledger in SQL.
   - Key columns: id, user_id (FK), provider, provider_account_id, currency, balance, metadata, status, created_at, updated_at.
   - UI: Shown under “Fiat Wallets” section on /wallets. Providers can be added to metadata; deposits to provider accounts are recorded and reconciled into `wallet_transactions`.

3) Crypto wallets (new)
   - Table: `wallets_crypto` (created by migration)
   - Purpose: Track on-chain or custodial crypto addresses per-user, synced balances and metadata for third-party integrations (thirdweb or other SDKs).
   - Key columns: id, user_id (FK), chain, address, provider, balance, synced_at, metadata, created_at, updated_at.
   - UI: Shown under “Crypto Wallets” on /wallets. Users can create/connect wallets; actions (Send/Receive) should be wired to thirdweb or chosen SDK.

House / Network balances

- Table: `wallets_house` (migration creates this)
- Purpose: Store platform-level balances (house / network reserves) for both fiat and crypto.
- Display: The Network Balances tab on /wallets reads `wallets_house` and shows recent house transactions from `wallet_transactions` filtered by types like `rake`, `deposit`, `transfer_in`.
- Behavior: Transfers from user wallets into any house wallet should also create a `wallet_transactions` row to reflect incoming funds; that same table is used for transaction history in the Network Balances tab.

Audit and transactions

- The project uses `wallet_transactions` (see supabase/sql/wallet_schema.sql) as the single audit trail for balance changes. The function `record_wallet_transaction(...)` ensures atomic updates of wallet balances and inserts transaction records.
- When integrating payment providers or on-chain flows, always record reconciled events in `wallet_transactions` to keep the ledger consistent and auditable.

Security & RLS

- RLS is enabled for the new tables with minimal policies:
  - `wallets_fiat` and `wallets_crypto`: users can SELECT rows where `auth.uid() = user_id`.
  - `wallets_house` is intentionally admin-only (no public RLS policy added) — restrict access to service roles or backend-only endpoints.
- Keep service-role keys in environment variables (do not commit) and only use them server-side for privileged operations.

UI integration

- Frontend shows three sections in `src/components/Wallet.jsx`:
  - My Wallets (legacy/internal wallets)
  - Fiat Wallets (wallets_fiat)
  - Crypto Wallets (wallets_crypto)
  - Network Balances tab (reads wallets_house + recent wallet_transactions)
- The file `src/components/Wallet.jsx` contains the data fetching and UI. It queries Supabase client exported from `src/lib/supabaseClient.js`.

Migrations and files

- Migration created: `supabase/migrations/007_create_wallets_fiat_crypto.sql` — run this in your Supabase project if not applied yet.
- Existing schema reference: `supabase/sql/wallet_schema.sql` contains primary wallets and transaction functions used by the platform.

Operational notes

- For Fiat integrations: create provider configuration records (provider API credentials) and store provider-specific metadata per row in `wallets_fiat.metadata` (jsonb). Reconciliation jobs should match provider webhook events or polling results and call `record_wallet_transaction` for ledger entries.
- For Crypto integrations: use thirdweb or your chosen SDK to create wallets and sign/send transactions. After on-chain activity is confirmed, record reconciled balances and transactions in `wallets_crypto` and `wallet_transactions`.
- For House balances: update `wallets_house` using backend-only processes (server functions or Supabase Functions) and log every modification in `wallet_transactions` so Network Balances tab can show accurate audited history.

Next steps / Recommendations

- Add server-side endpoints (Edge Functions / backend) for privileged operations:
  - Reconcile fiat provider webhooks (create `wallet_transactions` + update balances)
  - On-chain listener for deposits to house addresses (update wallets_house and wallet_transactions)
  - Admin endpoints to adjust or query `wallets_house` safely

- Implement real-time updates for wallets and house balances via Supabase Realtime or Channels to update the UI instantly when transactions are processed.

- Integration checklist before going live:
  - Configure secure storage for service role keys
  - Add robust reconciliation for each payment provider
  - Add monitoring/alerts for mismatches between provider balances and internal ledger

If you want, I can:
- Add server-side endpoint templates (Supabase Edge Functions) for webhook reconciliation
- Wire thirdweb connect/auth flow into `src/components/Wallet.jsx` and persist wallet records
- Add real-time subscriptions to update the Network Balances tab automatically

Contact me which of the above you'd like next and I will implement the code changes.

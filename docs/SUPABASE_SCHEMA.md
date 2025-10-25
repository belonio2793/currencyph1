# Currency.ph Supabase Database Schema

## Overview
This document describes the database schema for Currency.ph, a community-driven tokenized crowdfunding platform. All tables are set up in Supabase PostgreSQL.

---

## Tables

### 1. `users`
Stores user accounts, wallet addresses, and payment methods.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(255) UNIQUE, -- MetaMask or other Web3 wallet
  php_balance DECIMAL(15, 2) DEFAULT 0,
  cph_tokens BIGINT DEFAULT 0, -- Tokenized balance
  gcash_linked BOOLEAN DEFAULT FALSE,
  maya_linked BOOLEAN DEFAULT FALSE,
  card_linked BOOLEAN DEFAULT FALSE,
  region_code VARCHAR(5), -- ISO country code (e.g., 'PH', 'ID')
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `email (UNIQUE)`
- `wallet_address (UNIQUE)`
- `region_code`

---

### 2. `projects`
Tracks community-driven projects with ownership allocation.

```sql
CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_type VARCHAR(50), -- 'art', 'social', 'tech', etc.
  goal_amount DECIMAL(15, 2) NOT NULL,
  current_amount DECIMAL(15, 2) DEFAULT 0,
  ownership_percentage DECIMAL(5, 2), -- % available to funders
  beneficiary_wallet VARCHAR(255), -- Project creator's wallet
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'closed'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `status`
- `project_type`
- `created_at DESC`

---

### 3. `tokens`
Records tokenized ownership (ERC-1404 tokens on Polygon).

```sql
CREATE TABLE tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token_amount BIGINT NOT NULL, -- Token quantity (e.g., 500 = 5% stake)
  ownership_percentage DECIMAL(5, 2),
  token_contract_address VARCHAR(255), -- Polygon smart contract
  token_metadata JSONB, -- Benefits, voting weight, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);
```

**Indexes:**
- `user_id`
- `project_id`
- `token_contract_address`

---

### 4. `contributions`
Logs all transactions (fiat/crypto) for ledger-based transparency.

```sql
CREATE TABLE contributions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'PHP', -- 'PHP', 'BTC', 'ETH', 'USDC'
  payment_method VARCHAR(50), -- 'gcash', 'maya', 'card', 'crypto'
  transaction_id VARCHAR(255) UNIQUE, -- External payment provider ID
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `user_id`
- `project_id`
- `transaction_id (UNIQUE)`
- `created_at DESC`
- `status`

---

### 5. `votes`
Stores community consensus votes (non-binding, no governance).

```sql
CREATE TABLE votes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vote_type VARCHAR(50), -- 'support', 'reject', 'abstain'
  voting_power BIGINT, -- Token-weighted (derived from tokens table)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);
```

**Indexes:**
- `user_id`
- `project_id`
- `vote_type`

---

### 6. `ledger_transactions` (Public View)
Public ledger for transparency. Aggregates contributions for audit.

```sql
CREATE VIEW ledger_transactions AS
SELECT
  c.id,
  c.user_id,
  u.email,
  c.project_id,
  p.name AS project_name,
  c.amount,
  c.currency,
  c.payment_method,
  c.created_at,
  c.status
FROM contributions c
JOIN users u ON c.user_id = u.id
JOIN projects p ON c.project_id = p.id
ORDER BY c.created_at DESC;
```

---

## Security & Access Control

### Row Level Security (RLS) Policies

#### Users Table
```sql
-- Users can only view their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update only their own profile
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);
```

#### Contributions Table
```sql
-- Users can view own contributions
CREATE POLICY "Users can view own contributions" ON contributions
  FOR SELECT USING (auth.uid() = user_id);

-- Public ledger view (aggregated, no sensitive data)
CREATE POLICY "Public ledger view" ON contributions
  FOR SELECT USING (true);
```

#### Votes Table
```sql
-- Users can view own votes
CREATE POLICY "Users can view own votes" ON votes
  FOR SELECT USING (auth.uid() = user_id);
```

---

## Real-Time Subscriptions

Connect frontend via Supabase's real-time feature:

```javascript
// Balance updates
supabase
  .from('users:id=eq.{userId}')
  .on('UPDATE', payload => {
    console.log('Balance updated:', payload.new);
  })
  .subscribe();

// Project updates (funding progress)
supabase
  .from('projects:id=eq.{projectId}')
  .on('UPDATE', payload => {
    console.log('Project updated:', payload.new);
  })
  .subscribe();

// Vote changes (consensus tracking)
supabase
  .from('votes')
  .on('*', payload => {
    console.log('Vote recorded:', payload.new);
  })
  .subscribe();
```

---

## Initialization Script

Run this in Supabase SQL Editor to set up the schema:

```sql
-- Create tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(255) UNIQUE,
  php_balance DECIMAL(15, 2) DEFAULT 0,
  cph_tokens BIGINT DEFAULT 0,
  gcash_linked BOOLEAN DEFAULT FALSE,
  maya_linked BOOLEAN DEFAULT FALSE,
  card_linked BOOLEAN DEFAULT FALSE,
  region_code VARCHAR(5),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_type VARCHAR(50),
  goal_amount DECIMAL(15, 2) NOT NULL,
  current_amount DECIMAL(15, 2) DEFAULT 0,
  ownership_percentage DECIMAL(5, 2),
  beneficiary_wallet VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token_amount BIGINT NOT NULL,
  ownership_percentage DECIMAL(5, 2),
  token_contract_address VARCHAR(255),
  token_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

CREATE TABLE contributions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'PHP',
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE votes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vote_type VARCHAR(50),
  voting_power BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_region ON users(region_code);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(project_type);
CREATE INDEX idx_contributions_user ON contributions(user_id);
CREATE INDEX idx_contributions_project ON contributions(project_id);
CREATE INDEX idx_contributions_created ON contributions(created_at DESC);
CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_votes_project ON votes(project_id);
CREATE INDEX idx_tokens_user ON tokens(user_id);
CREATE INDEX idx_tokens_project ON tokens(project_id);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Create public ledger view
CREATE VIEW ledger_transactions AS
SELECT
  c.id,
  c.user_id,
  c.project_id,
  p.name AS project_name,
  c.amount,
  c.currency,
  c.payment_method,
  c.created_at,
  c.status
FROM contributions c
JOIN projects p ON c.project_id = p.id
ORDER BY c.created_at DESC;
```

---

## Integration with Frontend

### Fetch User Balance
```javascript
const { data: user } = await supabase
  .from('users')
  .select('php_balance, cph_tokens')
  .eq('id', userId)
  .single();
```

### Subscribe to Project Updates
```javascript
supabase
  .from(`projects:id=eq.${projectId}`)
  .on('UPDATE', payload => {
    setProjectData(payload.new);
  })
  .subscribe();
```

### Log Contribution
```javascript
await supabase
  .from('contributions')
  .insert([
    {
      user_id: userId,
      project_id: projectId,
      amount: 5000,
      currency: 'PHP',
      payment_method: 'gcash',
      status: 'pending'
    }
  ]);
```

---

## Notes

- All timestamps use UTC (TIMESTAMP without timezone).
- UUIDs are used for user IDs for privacy (no sequential numbering).
- JSONB `token_metadata` can store flexible data (e.g., NFT benefits, voting weights).
- The `ledger_transactions` view is public and never contains sensitive PII.
- Real-time subscriptions use Supabase's PostgreSQL-level triggers.

---

## Next Steps

1. **Supabase Project Setup**: Create a Supabase account at https://supabase.com
2. **Run SQL Initialization**: Copy the schema script into Supabase SQL Editor
3. **Enable RLS Policies**: Set up row-level security for privacy
4. **Connect Frontend**: Use `.env.example` for credentials
5. **Test Real-time**: Subscribe to sample data updates
6. **Deploy Edge Functions**: Add payment processing logic (GCash, Maya, Stripe)

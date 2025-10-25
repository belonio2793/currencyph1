#!/bin/bash

# DOG Tokens - Supabase Table Setup Script
# This script creates the necessary tables for the DOG token application

SUPABASE_URL="https://dfhanacsmsvvkpunurnp.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmaGFuYWNzbXN2dmtwdW51cm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NTY2NDcsImV4cCI6MjA2ODUzMjY0N30.MZcB4P_TAOOTktXSG7bNK5BsIMAf1bKXVgT87Zqa5RY"

echo "🐕 Setting up DOG Tokens Supabase tables..."
echo ""
echo "Note: Run this SQL script in your Supabase dashboard SQL Editor:"
echo "1. Go to https://supabase.com"
echo "2. Open your project"
echo "3. Go to SQL Editor"
echo "4. Create new query"
echo "5. Paste the SQL below and execute"
echo ""
echo "=========================================="
echo ""

cat << 'EOF'
-- DOG Tokens Application - Supabase Schema
-- Execute this SQL in your Supabase SQL Editor

-- Create currency.symbol table (for tracking token symbols/types)
CREATE TABLE IF NOT EXISTS currency.symbol (
  id BIGSERIAL PRIMARY KEY,
  symbol VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  wallet_address VARCHAR(255) UNIQUE,
  dog_balance DECIMAL(15, 2) DEFAULT 0,
  region_code VARCHAR(5),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create deposits table (transaction ledger)
CREATE TABLE IF NOT EXISTS deposits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  deposit_type VARCHAR(50) DEFAULT 'manual',
  transaction_id VARCHAR(255) UNIQUE,
  status VARCHAR(20) DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_region ON users(region_code);
CREATE INDEX idx_deposits_user ON deposits(user_id);
CREATE INDEX idx_deposits_created ON deposits(created_at DESC);
CREATE INDEX idx_withdrawals_user ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawal_requests(status);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for deposits
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert deposits" ON deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for withdrawals
CREATE POLICY "Users can view own withdrawals" ON withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert withdrawals" ON withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert DOG token symbol
INSERT INTO currency.symbol (symbol, name, description)
VALUES ('DOG', 'DOG Token', 'Decentralized Open Governance Token')
ON CONFLICT (symbol) DO NOTHING;

-- Create public view for token stats (no PII)
CREATE OR REPLACE VIEW token_stats AS
SELECT
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT SUM(dog_balance) FROM users) as total_supply,
  (SELECT COUNT(*) FROM deposits) as total_deposits,
  (SELECT SUM(amount) FROM deposits) as deposited_total,
  NOW() as last_updated;

EOF

echo ""
echo "=========================================="
echo ""
echo "✅ Copy the SQL above and paste it into your Supabase SQL Editor"
echo "   URL: https://dfhanacsmsvvkpunurnp.supabase.co/projects"

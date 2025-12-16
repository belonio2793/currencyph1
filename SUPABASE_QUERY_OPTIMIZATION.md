# Supabase Query Optimization Guide

This document outlines optimization opportunities and best practices for Supabase queries in the Currency.ph application.

## Current Issues and Solutions

### 1. **Overfetching Data (N+1 Queries)**

**Problem**: Queries fetch all columns with `select('*')` when only a few are needed.

**Solution**: Specify only required columns
```javascript
// ❌ Before
const { data } = await supabase.from('wallets').select('*')

// ✅ After
const { data } = await supabase
  .from('wallets')
  .select('id,user_id,currency_code,balance,is_active')
```

### 2. **Missing Indexes**

**Problem**: Queries filter on `user_id` and `currency_code` without proper indexes.

**Solution**: Add indexes in Supabase console:
```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_user_currency ON wallets(user_id, currency_code);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_loans_user_id ON loans(user_id);
```

### 3. **Batch Operations**

**Problem**: Multiple sequential queries when batch operations would be more efficient.

**Solution**: Use batch operations or transaction-like patterns:
```javascript
// ✅ Optimized: Get wallets and their balances in one query
const { data: wallets } = await supabase
  .from('wallets')
  .select('id,user_id,currency_code,balance')
  .eq('user_id', userId)
  .eq('is_active', true)
```

### 4. **Connection Pooling**

**Problem**: Each query might create new connections.

**Solution**: The supabase-js client handles connection pooling automatically, but ensure you're reusing the same client instance.

```javascript
// ✅ Good: Reuse the same supabase instance
import { supabase } from './lib/supabaseClient'
```

### 5. **Query Caching**

**Problem**: Same queries are executed multiple times.

**Solution**: Use the apiCache layer created for this project.

```javascript
// ✅ With caching
const { data } = await apiCache.getExchangeRate(currencyAPI, 'USD', 'PHP')
```

### 6. **Pagination**

**Problem**: Fetching large datasets without pagination.

**Solution**: Implement pagination for large tables:
```javascript
const ITEMS_PER_PAGE = 20

const { data, count } = await supabase
  .from('transactions')
  .select('*', { count: 'exact' })
  .eq('user_id', userId)
  .range(0, ITEMS_PER_PAGE - 1)
  .order('created_at', { ascending: false })
```

### 7. **Real-time Subscriptions**

**Problem**: Subscribing to unnecessary real-time channels increases CPU/bandwidth.

**Solution**: Only subscribe when data needs to be real-time:
```javascript
// ✅ Subscribe only to critical updates
const channel = supabase
  .channel('user-wallets:' + userId)
  .on('postgres_changes', 
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'wallets',
      filter: `user_id=eq.${userId}`
    },
    payload => {
      updateWalletBalance(payload.new)
    }
  )
  .subscribe()
```

## Recommended Query Patterns

### Pattern 1: Simple Fetch with Column Selection
```javascript
const { data, error } = await supabase
  .from('table_name')
  .select('id,name,email')
  .eq('column', value)
  .single()
```

### Pattern 2: Fetch with Aggregation
```javascript
const { data, error } = await supabase
  .from('transactions')
  .select('user_id,sum(amount)')
  .eq('user_id', userId)
  .group_by('user_id')
  .single()
```

### Pattern 3: Batch Insert with Error Handling
```javascript
const { data, error } = await supabase
  .from('transactions')
  .insert([
    { user_id: userId, amount: 100, type: 'deposit' },
    { user_id: userId, amount: 50, type: 'withdrawal' }
  ])
  .select()

if (error) {
  // Handle rollback if needed
  console.error('Batch insert failed:', error)
}
```

### Pattern 4: Transaction-like Operations
```javascript
// Use RPC functions for complex transactions
const { data, error } = await supabase.rpc('complex_operation', {
  param1: value1,
  param2: value2
})
```

## Performance Metrics to Monitor

1. **Query Execution Time**: Use Supabase Analytics to track slow queries
2. **Row Count**: Monitor if queries return unexpectedly large result sets
3. **Error Rate**: Track failed queries and optimize them
4. **Cache Hit Rate**: Measure effectiveness of the caching layer

## Quick Wins

- [ ] Add indexes on `user_id` and frequently filtered columns
- [ ] Replace `select('*')` with specific column selection
- [ ] Implement pagination for list queries
- [ ] Add caching to exchange rate queries (DONE)
- [ ] Batch related queries together
- [ ] Use RPC functions for complex operations
- [ ] Remove unused real-time subscriptions

## Testing Query Performance

```javascript
// Add performance monitoring
const startTime = performance.now()
const { data } = await supabase.from('wallets').select('*')
const endTime = performance.now()

console.log(`Query took ${endTime - startTime}ms`)
```

## Database Schema Recommendations

### Ensure proper indexing
```sql
-- High-priority indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id) WHERE is_active = true;
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_wallets_user_currency ON wallets(user_id, currency_code);

-- Composite indexes for common filters
CREATE INDEX idx_transactions_user_date ON transactions(user_id, created_at DESC);
```

### Use partitioning for large tables
```sql
-- Partition transactions by date for better query performance
CREATE TABLE transactions_2024 PARTITION OF transactions
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

## RPC Function Optimization

Create RPC functions for complex multi-table operations:

```sql
-- Example: Get user wallet summary efficiently
CREATE OR REPLACE FUNCTION get_user_wallet_summary(p_user_id UUID)
RETURNS TABLE (
  currency_code VARCHAR,
  total_balance DECIMAL,
  total_transactions INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.currency_code,
    SUM(w.balance)::DECIMAL as total_balance,
    COUNT(t.id)::INT as total_transactions
  FROM wallets w
  LEFT JOIN transactions t ON w.id = t.wallet_id
  WHERE w.user_id = p_user_id
  GROUP BY w.currency_code;
END;
$$ LANGUAGE plpgsql;
```

Then use it in JavaScript:
```javascript
const { data } = await supabase.rpc('get_user_wallet_summary', {
  p_user_id: userId
})
```

## Monitoring and Logging

Add query performance logging:

```javascript
// Create a wrapper for all Supabase queries
async function executeQuery(queryFn, label) {
  const startTime = performance.now()
  try {
    const result = await queryFn()
    const duration = performance.now() - startTime
    
    if (duration > 1000) {
      console.warn(`Slow query [${label}]: ${duration}ms`)
    } else {
      console.debug(`Query [${label}]: ${duration}ms`)
    }
    
    return result
  } catch (error) {
    console.error(`Query failed [${label}]:`, error)
    throw error
  }
}

// Usage
const { data } = await executeQuery(
  () => supabase.from('wallets').select('id,balance').eq('user_id', userId),
  'get-wallets'
)
```

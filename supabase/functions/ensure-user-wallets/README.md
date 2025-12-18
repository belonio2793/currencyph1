# Ensure User Wallets Edge Function

This edge function ensures that a user has a PHP wallet. If the user doesn't have one, it creates it automatically.

## Endpoint

```
POST /functions/v1/ensure-user-wallets
```

## Authentication

Requires `Authorization` header with a valid Supabase token (user or service role).

## Request Body

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Parameters

- `user_id` (required, string): The UUID of the user

## Response

### Success (200)

```json
{
  "success": true,
  "message": "PHP wallet created successfully",
  "wallet_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

Or if wallet already exists:

```json
{
  "success": true,
  "message": "User already has a PHP wallet",
  "wallet_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

### Error (400/500)

```json
{
  "error": "Error message describing what went wrong"
}
```

## Usage Example

### JavaScript/TypeScript

```javascript
const { data, error } = await supabase.functions.invoke('ensure-user-wallets', {
  body: {
    user_id: userId
  }
})

if (error) {
  console.error('Error:', error)
} else {
  console.log('Success:', data)
}
```

### cURL

```bash
curl -X POST https://your-project.supabase.co/functions/v1/ensure-user-wallets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "550e8400-e29b-41d4-a716-446655440000"}'
```

## Behavior

1. **Check existing wallet**: Queries the `wallets` table to see if the user already has a PHP wallet
2. **If exists**: Returns success with the existing wallet ID
3. **If not exists**: Creates a new PHP wallet with:
   - `balance`: 0
   - `total_deposited`: 0
   - `total_withdrawn`: 0
   - `is_active`: true

## Deployment

This function is automatically deployed with your Supabase project. To update it:

1. Edit `supabase/functions/ensure-user-wallets/index.ts`
2. Run `supabase functions deploy ensure-user-wallets` from your terminal

## Integration with Frontend

The frontend can call this function to ensure a user has a PHP wallet:

```javascript
import { supabase } from '../lib/supabaseClient'

async function ensurePhpWallet(userId) {
  try {
    const { data, error } = await supabase.functions.invoke('ensure-user-wallets', {
      body: { user_id: userId }
    })
    
    if (error) throw error
    return data
  } catch (err) {
    console.error('Failed to ensure PHP wallet:', err)
    return null
  }
}
```

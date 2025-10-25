# Currency.ph Staging Environment Setup Guide

## Overview

This is a step-by-step guide to set up the complete Currency.ph staging environment for testing before production launch.

---

## Prerequisites

- **Node.js 16+**: https://nodejs.org/
- **Git**: https://git-scm.com/
- **Yarn 1.22+**: `npm install -g yarn`
- **Supabase Account**: https://supabase.com (free tier)
- **Stripe Test Account**: https://stripe.com (test mode)
- **OANDA Account**: https://developer.oanda.com (free)
- **AbstractAPI Account**: https://www.abstractapi.com (free tier)
- **MetaMask Extension**: https://metamask.io/

---

## Step 1: Clone & Setup Repository

```bash
# 1. Clone the repository
git clone https://github.com/your-org/currency-ph.git
cd currency-ph

# 2. Install dependencies
yarn install

# 3. Create environment file
cp .env.example .env.local

# 4. Start dev server
yarn dev
```

Visit `http://localhost:3000` in your browser. You should see:
- Currency.ph header
- Add Funds section with GCash, Maya, Card buttons
- Balance section with mock data
- Community Projects section

---

## Step 2: Supabase Backend Setup

### Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in:
   - **Project Name**: `currency-ph-staging`
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to Asia (Singapore recommended)
4. Wait for database initialization (~2 minutes)
5. Go to "Settings > API" and copy:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon Key**: Your public anon key

### Initialize Database Schema

1. In Supabase dashboard, go to "SQL Editor"
2. Click "New Query"
3. Copy entire content from `docs/SUPABASE_SCHEMA.md` (the SQL initialization script)
4. Paste into SQL Editor
5. Click "Run"
6. Verify tables created in "Table Editor":
   - `users`
   - `projects`
   - `tokens`
   - `contributions`
   - `votes`

### Enable Real-time Subscriptions

1. Go to "Database > Replication"
2. Toggle ON for:
   - `users`
   - `projects`
   - `contributions`
   - `votes`

### Update Environment Variables

Edit `.env.local`:
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Verify**: Check browser console for Supabase connection success message

---

## Step 3: Payment Integration (Sandbox)

### GCash Integration

#### Register for GCash Sandbox

1. Go to https://developer.gcash.com
2. Sign up as merchant
3. Complete KYC verification
4. Create test merchant account
5. Get credentials:
   - **Merchant ID**: `your-merchant-id`
   - **API Key**: `your-secret-key`

#### Update Environment
```bash
VITE_GCASH_SANDBOX_URL=https://sandbox.dragonpay.com/api
VITE_GCASH_MERCHANT_ID=your-merchant-id
VITE_GCASH_API_KEY=your-secret-key
```

#### Test Payment Flow
1. Click "Add via GCash" button
2. You'll see sandbox confirmation (mock in staging)
3. Check Supabase "contributions" table for entry

### Stripe Integration

#### Register for Stripe Test Account

1. Go to https://stripe.com
2. Sign up
3. Skip business setup (test mode)
4. Go to "Developers > API Keys"
5. Copy:
   - **Publishable Key**: `pk_test_...`
   - **Secret Key**: `sk_test_...` (server-side only)

#### Update Environment
```bash
VITE_STRIPE_PUBLIC_KEY=pk_test_your_key
VITE_STRIPE_SECRET_KEY=sk_test_your_key
```

#### Test Cards (Stripe)
| Card | Number | Expiry | CVC |
|------|--------|--------|-----|
| Visa | 4242 4242 4242 4242 | 12/25 | 123 |
| Mastercard | 5555 5555 5555 4444 | 12/25 | 123 |

#### Test Payment Flow
1. Click "Add via Maya" or "Add via Card"
2. Enter test card details
3. Payment should complete in sandbox
4. Check Supabase contributions table

---

## Step 4: Cryptocurrency Rate APIs

### OANDA (Fiat Rates)

#### Registration

1. Go to https://developer.oanda.com
2. Sign up for free developer account
3. Create API token:
   - Go to "Account Settings > Generate New Token"
   - Name it: `currency-ph-staging`
   - Copy token

#### Update Environment
```bash
VITE_OANDA_API_KEY=your-api-token
```

#### Test Real-time Rates
```bash
# From your terminal
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api-fxpractice.oanda.com/v3/instruments/USD_PHP/candles?granularity=M1&count=1"
```

Expected output: Current PHP/USD exchange rate

### AbstractAPI (Crypto Rates)

#### Registration

1. Go to https://www.abstractapi.com/api/cryptocurrency
2. Sign up for free account
3. Get API key from dashboard
4. Free tier: 500 requests/month

#### Update Environment
```bash
VITE_ABSTRACTAPI_KEY=your-api-key
```

#### Test Crypto Rates
```bash
# From your terminal
curl "https://api.abstractapi.com/v1/crypto/token_exchange_rate?api_key=YOUR_KEY&base=USD&target=BTC,ETH"
```

Expected output: BTC/USD and ETH/USD rates

### Verify in Frontend

1. Open browser DevTools → Console
2. You should see crypto rates being fetched
3. Check BalanceSection displays rates without errors

---

## Step 5: Polygon Mumbai Testnet Setup

### Install Web3 Tools

```bash
yarn add ethers web3
```

### Create Wallet (MetaMask)

1. Install MetaMask extension: https://metamask.io/
2. Create new wallet (or import existing)
3. Switch to "Polygon Mumbai" network:
   - Open MetaMask
   - Click network dropdown
   - Click "Add Network"
   - Fill in:
     - **Network Name**: Polygon Mumbai
     - **RPC URL**: https://rpc-mumbai.maticvigil.com
     - **Chain ID**: 80001
     - **Currency**: MATIC
     - **Explorer**: https://mumbai.polygonscan.com
4. Get your wallet address (copy from MetaMask)

### Get Test MATIC (for gas fees)

1. Go to https://faucet.polygon.technology/
2. Select "Mumbai"
3. Paste your wallet address
4. Complete CAPTCHA
5. Click "Submit"
6. Wait 5-10 minutes for MATIC to arrive
7. Check in MetaMask: Should see MATIC balance

### Update Environment

```bash
VITE_POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
VITE_POLYGON_CHAIN_ID=80001
```

### Verify MetaMask Connection

1. In browser console, check if MetaMask is detected:
```javascript
console.log(window.ethereum); // Should return MetaMask provider
```

---

## Step 6: Smart Contract Deployment (Optional)

### Set Up Hardhat

```bash
# In project root
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init # Select "Typescript project"
npm install --save-dev @openzeppelin/contracts
```

### Deploy Contract

1. Create `contracts/CurrencyPHToken.sol` (copy from `docs/POLYGON_SETUP.md`)
2. Create `scripts/deploy.ts` (copy from `docs/POLYGON_SETUP.md`)
3. Update `hardhat.config.ts` with Mumbai RPC URL and private key

```bash
# Compile
npx hardhat compile

# Deploy to Mumbai
npx hardhat run scripts/deploy.ts --network polygonMumbai
```

4. Copy contract address from output
5. Update `.env.local`:
```bash
VITE_CPH_TOKEN_ADDRESS=0x...contract_address
```

---

## Step 7: Mock Data Setup

### Add Sample Projects

1. Go to Supabase dashboard
2. Open "Table Editor" → "projects"
3. Click "Insert Row" and add:

**Project 1: Art Installation**
```
name: Art Installation
description: A community art installation project
project_type: art
goal_amount: 1000000
current_amount: 250000
ownership_percentage: 20
status: active
```

**Project 2: Social Venture**
```
name: Social Venture
description: Community-driven social enterprise
project_type: social
goal_amount: 500000
current_amount: 150000
ownership_percentage: 30
status: active
```

**Project 3: Tech Education**
```
name: Tech Education
description: Free tech education for underserved communities
project_type: tech
goal_amount: 750000
current_amount: 300000
ownership_percentage: 25
status: active
```

### Add Sample User

1. Go to "Table Editor" → "users"
2. Click "Insert Row":

```
email: test@currency.ph
wallet_address: 0x...your_metamask_address
php_balance: 10000
cph_tokens: 1000
region_code: PH
gcash_linked: true
```

### Verify in Frontend

1. Refresh browser (`http://localhost:3000`)
2. Balance should display from database (PHP: 10,000, CPH Tokens: 1,000)
3. Community Projects section should show all 3 projects
4. Project progress bars should show correct percentages

---

## Step 8: Testing Payment Flow

### Test GCash Payment

1. Click "Add via GCash" button
2. In staging, you'll see a confirmation message
3. In production, it would redirect to GCash sandbox
4. Check Supabase: New row in "contributions" table with:
   - `user_id`: Your user ID
   - `payment_method`: gcash
   - `status`: pending → completed

### Test Project Contribution

1. Scroll to Community Projects
2. Click "Contribute" on any project
3. In staging, you'll see confirmation
4. Check Supabase: New row in "contributions" table
5. In BalanceSection, see PHP balance decrease

### Test Community Voting

1. Click "Vote to Support" on any project
2. Button should turn green (✓ Support)
3. Check Supabase: New row in "votes" table
4. In real implementation, this tracks consensus

---

## Step 9: Real-time Updates Testing

### Test Balance Updates (Supabase Subscription)

```javascript
// In browser console
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', 'your-user-id')
  .single()

console.log(data); // Should show your balance
```

### Test Project Real-time Updates

1. Open two browser tabs with `http://localhost:3000`
2. In **Tab 1**: Click "Contribute" to a project
3. In **Tab 2**: Watch project progress bar update in real-time
4. This tests Supabase real-time subscriptions

---

## Step 10: Load Testing (Optional)

### Simulate Multiple Users

```bash
# Install load testing tool
npm install -g artillery

# Create load-test.yml
cat > load-test.yml << 'EOF'
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10  # 10 users per second
      name: "Ramp up"

scenarios:
  - name: "User Journey"
    flow:
      - get:
          url: "/"
      - think: 5
      - post:
          url: "/api/contribute"
          json:
            projectId: 1
            amount: 5000
EOF

# Run test
artillery run load-test.yml
```

### Monitor Performance

1. Open browser DevTools → Performance
2. Note response times
3. Check Supabase dashboard for database load

---

## Step 11: Security Testing

### Test Geofencing (IP Blocking)

1. Connect to VPN in non-Asian country
2. Try to access `http://localhost:3000`
3. In production, should block with region message
4. In staging, geofencing disabled

### Test RLS (Row-Level Security)

1. In Supabase SQL Editor, test RLS policies:
```sql
-- Check if user can only see own contributions
SELECT * FROM contributions WHERE user_id = 'their-id';
-- Should succeed if logged in

SELECT * FROM contributions WHERE user_id = 'other-id';
-- Should fail (RLS blocks it)
```

### Test CORS & HTTPS

1. Create test HTTPS connection:
```bash
# Generate self-signed cert (staging only)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

---

## Step 12: Performance Optimization

### Analyze Bundle Size

```bash
yarn build
# Check dist/ folder size
```

### Optimize Images (if added)

```bash
# Install image optimizer
npm install --save-dev imagemin imagemin-mozjpeg

# Compress images in src/assets
npx imagemin src/assets/* --out-dir=src/assets
```

---

## Staging Checklist

- [ ] **Repository Setup**
  - [ ] Cloned repo
  - [ ] Dependencies installed (`yarn install`)
  - [ ] Dev server running (`yarn dev`)

- [ ] **Supabase Backend**
  - [ ] Project created + database initialized
  - [ ] Schema tables created (users, projects, tokens, contributions, votes)
  - [ ] Real-time replication enabled
  - [ ] Environment variables configured

- [ ] **Payment Integration**
  - [ ] GCash sandbox account created
  - [ ] Stripe test account created
  - [ ] Payment flow tested (mock responses)
  - [ ] Contributions table populated

- [ ] **Cryptocurrency APIs**
  - [ ] OANDA API key obtained + tested
  - [ ] AbstractAPI key obtained + tested
  - [ ] Real-time rate fetching working
  - [ ] Balance display showing crypto equivalents

- [ ] **Polygon Mumbai Testnet**
  - [ ] MetaMask installed + configured
  - [ ] Test MATIC faucet claimed
  - [ ] Wallet connected (optional for now)
  - [ ] RPC URL configured

- [ ] **Mock Data**
  - [ ] 3+ sample projects created
  - [ ] Sample user created with balance
  - [ ] Projects display in frontend
  - [ ] Balance displays correctly

- [ ] **Testing**
  - [ ] Payment flow tested
  - [ ] Real-time updates working (subscription test)
  - [ ] Project contribution tested
  - [ ] Community voting tested
  - [ ] No console errors

- [ ] **Performance**
  - [ ] Page loads < 3 seconds
  - [ ] Bundle size < 500KB
  - [ ] No memory leaks (DevTools)
  - [ ] API calls cached (no duplicate requests)

- [ ] **Security**
  - [ ] No hardcoded secrets in code
  - [ ] Environment variables used
  - [ ] CORS headers correct
  - [ ] RLS policies working

---

## Troubleshooting

### Dev Server Won't Start
```bash
# Clear node_modules and reinstall
rm -rf node_modules yarn.lock
yarn install
yarn dev
```

### Supabase Connection Fails
1. Check `.env.local` has correct URLs
2. Verify Supabase project is active
3. Check Anon Key is correct (not Secret Key)
4. Clear browser cache and hard refresh

### Payment API Returns 404
1. Verify API URLs in `.env.local`
2. Check API credentials are valid
3. Ensure API accounts are in "test mode"
4. Check firewall/CORS settings

### Crypto Rates Not Displaying
1. Verify API keys in `.env.local`
2. Check free tier limits (500/month for AbstractAPI)
3. Look at browser console for HTTP errors
4. Test API with cURL from terminal

### MetaMask Connection Fails
1. Ensure MetaMask is installed
2. Check Mumbai network is added
3. Try restarting browser
4. Disconnect and reconnect wallet

---

## Next Steps

1. **Frontend Refinement**: Polish UI based on feedback
2. **Backend Optimization**: Optimize Supabase queries
3. **Smart Contract Testing**: Deploy + test ERC-1404 contract
4. **Community Testing**: Invite beta testers
5. **Production Deployment**: Follow deployment guide

---

## Support

- **Issues**: Check GitHub issues or create new one
- **Docs**: See `/docs` folder for detailed guides
- **Community**: Join Discord (future) for support

---

## Environment Checklist

```bash
# Verify all environment variables are set
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
echo $VITE_OANDA_API_KEY
echo $VITE_ABSTRACTAPI_KEY
echo $VITE_POLYGON_RPC_URL
```

If any return empty, update `.env.local`.

---

**Staging environment setup complete! 🎉**

Your Currency.ph platform is now ready for testing. Next, invite beta testers and gather feedback before production launch.

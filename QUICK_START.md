# Currency.ph - Quick Start Guide

## 🚀 30-Second Setup

You're running a **staging environment** for Currency.ph! Here's what's already set up:

### What You Have Right Now
✅ **Frontend**: React + Vite + Tailwind (running on http://localhost:3000)
✅ **Database Schema**: Complete Supabase PostgreSQL schema with 5 tables
✅ **Components**: Add Money, Balance Display, Projects, Voting
✅ **API Integration**: Supabase client configured
✅ **Documentation**: 5 comprehensive guides + architecture docs

---

## 🎯 What to Do Next

### Step 1: Connect Supabase (5 minutes)

1. Go to https://supabase.com and create a **free account**
2. Create a new project called `currency-ph-staging`
3. Go to **Settings > API** and copy:
   - **Project URL**: `https://xxx.supabase.co`
   - **Anon Key**: Your public key

4. Edit `.env.local`:
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-key-here
```

5. Initialize database:
   - Open Supabase SQL Editor
   - Paste content from `docs/SUPABASE_SCHEMA.md`
   - Click **Run**

✅ **Done!** Your database is now connected.

---

### Step 2: Add Sample Data (2 minutes)

1. In Supabase, go to **Table Editor > projects**
2. Click **Insert Row** and add your first project:

```
name: Art Installation
description: Community art installation
goal_amount: 1000000
current_amount: 250000
ownership_percentage: 20
status: active
```

3. Add 2-3 more projects with different goals
4. Go to **Table Editor > users**
5. Add yourself as a test user:

```
email: your-email@test.com
wallet_address: 0x123... (MetaMask address, optional)
php_balance: 10000
cph_tokens: 1000
region_code: PH
```

✅ **Done!** Refresh browser, data will appear automatically.

---

### Step 3: Integrate Crypto APIs (5 minutes)

#### Get OANDA API Key
1. Go to https://developer.oanda.com
2. Sign up (free)
3. Create API token
4. Add to `.env.local`:
```bash
VITE_OANDA_API_KEY=your-token
```

#### Get AbstractAPI Key
1. Go to https://www.abstractapi.com/api/cryptocurrency
2. Sign up (free, 500 requests/month)
3. Copy API key
4. Add to `.env.local`:
```bash
VITE_ABSTRACTAPI_KEY=your-key
```

✅ **Done!** Real-time crypto rates now enabled.

---

### Step 4: Payment Integration (Optional, Staging)

#### Stripe Test Account
1. Go to https://stripe.com
2. Sign up (free test mode)
3. Copy test **Publishable Key**: `pk_test_...`
4. Add to `.env.local`:
```bash
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

Test with card: **4242 4242 4242 4242** (any date, any CVC)

#### GCash Sandbox
1. Go to https://developer.gcash.com
2. Sign up as merchant
3. Get sandbox credentials
4. Add to `.env.local` (optional for now)

---

## 📁 File Structure

```
currency-ph/
├── src/
│   ├── components/          ← React components (ready to use)
│   ├── lib/supabaseClient.js ← Supabase API (update with your credentials)
│   ├── App.jsx              ← Main app
│   └── index.css            ← Global styles (Tailwind)
│
├── docs/
│   ├── ARCHITECTURE.md      ← System design
│   ├── SUPABASE_SCHEMA.md   ← Database setup
│   ├── API_INTEGRATION.md   ← Payment + crypto APIs
│   ├── POLYGON_SETUP.md     ← Smart contracts
│   └── STAGING_SETUP.md     ← Complete step-by-step guide
│
├── .env.local               ← Your environment variables (create from .env.example)
├── package.json             ← Dependencies
└── index.html               ← Entry point
```

---

## 🎨 Customizing the UI

All components use **Tailwind CSS**. To modify styles:

### Change Colors
Edit `tailwind.config.js`:
```javascript
colors: {
  primary: '#1a73e8',  // Change this for primary color
  success: '#2e7d32'
}
```

### Add New Components
Create in `src/components/YourComponent.jsx`:
```jsx
export default function YourComponent() {
  return (
    <div className="bg-white p-5 rounded-lg shadow">
      <h2 className="text-2xl font-bold">Your Content</h2>
    </div>
  );
}
```

### Import and Use in App.jsx:
```jsx
import YourComponent from './components/YourComponent'

export default function App() {
  return (
    <div>
      <YourComponent />
    </div>
  );
}
```

---

## 🔄 Real-time Data Updates

When data changes in Supabase, your UI updates instantly:

```javascript
// This happens automatically via Supabase subscriptions
// No manual refresh needed!
```

**Example**: If you add ₱5,000 to a user's balance in Supabase, the balance display updates within 1 second.

---

## 🧪 Testing Features

### Test Payment Flow
1. Click "Add via GCash" → See confirmation (mock in staging)
2. Check Supabase → New row in "contributions" table

### Test Voting
1. Click "Vote to Support" → Button turns green
2. Check Supabase → New row in "votes" table

### Test Real-time Updates
1. Open 2 browser tabs with same app
2. In Tab 1: Add project contribution
3. In Tab 2: Watch balance update instantly

---

## 🚨 Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
```bash
yarn install  # Reinstall dependencies
```

### "Failed to fetch from Supabase"
- Check `.env.local` has correct URL and key
- Verify Supabase project exists and is active
- Hard refresh: Ctrl+Shift+R

### "Crypto rates not showing"
- Verify OANDA and AbstractAPI keys
- Check API rate limits (free tier has limits)
- Look at browser console for errors

### Dev server won't start
```bash
# Clear and reinstall
rm -rf node_modules yarn.lock
yarn install
yarn dev
```

---

## 📚 Learning Path

1. **Start Here**: This file (you're reading it!)
2. **Understand System**: Read `docs/ARCHITECTURE.md`
3. **Setup Database**: Follow `docs/SUPABASE_SETUP.md`
4. **Add Payments**: Follow `docs/API_INTEGRATION.md`
5. **Smart Contracts**: Read `docs/POLYGON_SETUP.md` (optional for now)
6. **Complete Setup**: Follow `docs/STAGING_SETUP.md`

---

## 💡 Key Concepts

### CPH Tokens
- 1 PHP = 1 CPH token (1:1 stablecoin peg)
- Tracks ownership % in projects
- Stored on Polygon blockchain (future)
- Used for community voting

### Project Ownership
- ₱1M project with 20% available
- User contributes ₱200k → Gets 20% ownership
- Gains voting rights + project credits
- Non-profit structure (no guaranteed returns)

### Community Voting
- Token-weighted consensus
- "Support", "Reject", "Abstain" options
- >50% "Support" = project approved
- Non-binding (advisory only)

### Transparency Ledger
- All contributions logged in Supabase
- Public view (anonymized user IDs)
- On-chain Polygon ledger (future)
- Monthly reports to community

---

## 🌏 Supported Regions (Staging)

**Asia-Only**:
- 🇵🇭 Philippines (Primary)
- 🇮🇩 Indonesia
- 🇲🇾 Malaysia
- 🇹🇭 Thailand
- 🇻🇳 Vietnam
- 🇸🇬 Singapore
- 🇹🇼 Taiwan

*IP geofencing enabled in production (disabled in staging for testing)*

---

## 🔐 Security Notes

- **Never commit `.env.local`** (contains secrets)
- **Never hardcode API keys** in code
- **Use environment variables** for all credentials
- **Test payment flows** in sandbox mode only
- **Review smart contracts** before mainnet deployment

---

## 📞 Need Help?

1. **Check docs/**: Detailed guides for each component
2. **Check browser console**: Error messages help debug
3. **Check Supabase logs**: Database errors visible in dashboard
4. **GitHub Issues**: Report bugs and request features

---

## 🎉 What's Working Now

✅ Frontend UI (React + Tailwind)
✅ Database schema (ready to connect)
✅ Supabase integration (API calls)
✅ Real-time subscriptions (data updates)
✅ Component structure (extensible)
✅ Mock data display
✅ Responsive design (mobile-first)
✅ CSS styling (Tailwind utilities)

---

## 🔜 What's Next

After connecting Supabase:
1. Add real payment processing (Stripe/GCash)
2. Deploy smart contracts (Polygon Mumbai)
3. Enable MetaMask wallet connection
4. Launch beta testing with users
5. Gather feedback and iterate
6. Deploy to production (Polygon mainnet)

---

## 📝 Developer Notes

### Adding a New Component
```bash
# 1. Create component file
touch src/components/MyComponent.jsx

# 2. Write component with Tailwind classes
# 3. Import in App.jsx
# 4. Add to JSX
# 5. Refresh browser (auto-reload enabled)
```

### Working with Supabase
```javascript
// Example: Fetch projects
const { data: projects } = await supabase
  .from('projects')
  .select('*')
  .order('created_at', { ascending: false })

console.log(projects); // Display in UI
```

### Styling Best Practices
- Use Tailwind utility classes (no custom CSS unless needed)
- Keep component styles in className attributes
- Use color variables from tailwind.config.js
- Test on mobile devices (responsive design critical)

---

## 🚀 Deploy to Production (Future)

When ready:
```bash
# Build for production
yarn build

# Deploy to Netlify (free tier)
netlify deploy --prod

# Deploy smart contracts to Polygon mainnet
npx hardhat run scripts/deploy.ts --network polygonMainnet
```

---

## 📊 Success Metrics

Your staging environment is ready when:
- [ ] Supabase connected + data loads in UI
- [ ] Crypto rates display in Balance section
- [ ] Projects display with accurate progress
- [ ] Voting updates in real-time
- [ ] No errors in browser console
- [ ] Mobile view looks good (test on phone)
- [ ] Payment flow completes (mock OK in staging)

---

## 🎯 30-Day Roadmap

**Week 1-2**: Supabase + API integration (you are here)
**Week 3**: Payment processing + testing
**Week 4**: Smart contracts + blockchain
**Week 5**: Community testing + feedback
**Week 6+**: Production deployment

---

## Key Environment Variables

```bash
# Required
VITE_SUPABASE_URL=          # From Supabase dashboard
VITE_SUPABASE_ANON_KEY=     # From Supabase API settings

# Crypto APIs (recommended)
VITE_OANDA_API_KEY=         # From OANDA developer
VITE_ABSTRACTAPI_KEY=       # From AbstractAPI

# Payment (optional for staging)
VITE_STRIPE_PUBLIC_KEY=     # From Stripe test keys
VITE_GCASH_MERCHANT_ID=     # From GCash developer

# Polygon (optional, for smart contracts)
VITE_POLYGON_RPC_URL=       # https://rpc-mumbai.maticvigil.com
VITE_CPH_TOKEN_ADDRESS=     # After contract deployment
```

---

**You're all set! 🎉**

Your Currency.ph staging environment is running. Next step: Connect Supabase and add your first project.

Questions? Check the `/docs` folder or review `docs/ARCHITECTURE.md` for detailed explanations.

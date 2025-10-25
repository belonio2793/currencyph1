# Currency.ph Architecture & Setup Guide

## Project Overview

**Currency.ph** is a minimalist, community-oriented, tokenized cryptocurrency crowdfunding platform for Asia-only operations. It enables users to contribute fiat funds (₱ PHP) via GCash, Maya, and bank cards, view real-time cryptocurrency balances, and participate in community-driven projects with transparent ownership allocation.

### Core Values
- **Community-Driven**: Consensus-based voting without centralized governance
- **Transparent**: Public ledger-based financial reporting
- **Non-Profit**: Tax-deductible write-off investments for creative/artistic projects
- **Asia-Focused**: Philippines, Indonesia, Malaysia, Thailand, Vietnam, Singapore, Taiwan
- **Tokenized**: ERC-1404 tokens on Polygon for ownership tracking

---

## Technology Stack

### Frontend
- **Framework**: React 18 (via Vite)
- **Styling**: Tailwind CSS + PostCSS
- **State Management**: React hooks (useState, useEffect)
- **UI Library**: Custom components (Header, AddFundsSection, BalanceSection, ProjectsSection)

### Backend
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime subscriptions
- **Serverless**: Supabase Edge Functions (Node.js/TypeScript)
- **Authentication**: JWT-based (via Supabase Auth + MetaMask)

### Blockchain
- **Network**: Polygon (Mumbai testnet for staging)
- **Token Standard**: ERC-1404 (Regulated Token)
- **Smart Contracts**: Solidity (for tokenized ownership)
- **Web3 Library**: ethers.js or web3.js

### External APIs
- **Fiat Rates**: OANDA API (real-time PHP/USD conversions)
- **Crypto Rates**: AbstractAPI or CoinGecko (BTC, ETH, USDC prices)
- **Payment Gateway**: Stripe (GCash, Maya, Card sandbox)
- **Chainlink**: Oracle data for on-chain price feeds

---

## Project Structure

```
currency-ph/
├── index.html                 # Entry HTML
├── package.json              # Dependencies
├── vite.config.js            # Vite configuration
├── tailwind.config.js        # Tailwind CSS config
├── postcss.config.js         # PostCSS config
│
├── src/
│   ├── main.jsx              # React entry point
│   ├── App.jsx               # Main app component
│   ├── index.css             # Global styles (Tailwind)
│   │
│   ├── components/
│   │   ├── Header.jsx        # Header with branding
│   │   ├── AddFundsSection.jsx # GCash, Maya, Card payment UI
│   │   ├── BalanceSection.jsx  # Balance display (PHP, CPH, BTC, ETH)
│   │   ├── ProjectsSection.jsx # Projects list with contribute/vote
│   │   └── Footer.jsx          # Footer with info
│   │
│   ├── lib/
│   │   ├── supabaseClient.js   # Supabase client + API utilities
│   │   ├── paymentAPI.js       # Payment integration (future)
│   │   ├── cryptoAPI.js        # Crypto rates + balance conversion (future)
│   │   └── web3.js             # Polygon/Web3 integration (future)
│   │
│   └── hooks/
│       ├── useBalance.js       # Balance fetching + real-time updates (future)
│       ├── useProjects.js      # Project data fetching (future)
│       └── useAuth.js          # Authentication logic (future)
│
├── docs/
│   ├── ARCHITECTURE.md        # This file
│   ├── SUPABASE_SCHEMA.md     # Database schema
│   ├── API_INTEGRATION.md     # API setup guides
│   ├── POLYGON_SETUP.md       # Smart contract deployment
│   └── STAGING_SETUP.md       # Step-by-step staging guide
│
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
└── README.md                 # Project README
```

---

## Frontend Architecture

### Component Hierarchy
```
App
├── Header
├── AddFundsSection
│   └── Payment method buttons (GCash, Maya, Card)
├── BalanceSection
│   └── Balance cards (PHP, CPH Tokens, BTC, ETH)
├── ProjectsSection
│   └── ProjectCard[] (each with contribute/vote buttons)
└── Footer
```

### State Management
Currently using React hooks. Future migration to:
- **Context API** for global auth state
- **TanStack Query (React Query)** for server state
- **Zustand** or **Jotai** for complex state management

### Data Flow
1. **App** mounts → Fetch projects from Supabase
2. **BalanceSection** → Real-time balance updates via Supabase subscriptions
3. **ProjectsSection** → Real-time project progress updates
4. **AddFundsSection** → Payment methods trigger external integrations

---

## Backend Architecture

### Supabase Tables
1. **users**: User accounts, wallets, payment methods
2. **projects**: Community-driven projects with ownership allocation
3. **tokens**: Tokenized ownership (ERC-1404 metadata)
4. **contributions**: Transaction ledger (fiat/crypto)
5. **votes**: Community consensus voting
6. **ledger_transactions**: Public view (transparency)

### Database Relationships
```
users (1) ──────────────── (M) contributions
  │                              │
  │                              ├─ projects
  │                              │
  └─ tokens ──────────────────── (M) projects

projects (1) ──────────────── (M) votes
  └─ (1)────────────────── (M) tokens
```

### Real-time Subscriptions
- **Balance Updates**: User balance changes → BalanceSection re-renders
- **Project Progress**: Contribution to project → Progress bar updates
- **Voting Changes**: New votes → Vote count updates

---

## Payment Flow (Staging)

### Add Funds Sequence
1. User selects payment method (GCash, Maya, Card)
2. Frontend redirects to payment provider sandbox
3. Payment provider confirms transaction
4. Webhook → Supabase edge function processes payment
5. User balance updated in `users` table
6. CPH tokens minted (1 PHP = 1 CPH token, 1:1 stablecoin peg)
7. Real-time subscription triggers balance update in UI

### Payment Methods
| Method | Min | Sandbox | API |
|--------|-----|---------|-----|
| GCash | ₱500 | developer.gcash.com | Dragonpay |
| Maya | ₱500 | developer.maya.ph | Stripe |
| Card | ₱1000 | Stripe test mode | Stripe |

---

## Crypto Balance Display

### Conversion Logic
1. Fetch fiat rates: OANDA (1 PHP = X USD)
2. Fetch crypto rates: AbstractAPI (1 BTC = Y USD, 1 ETH = Z USD)
3. Calculate: PHP balance → USD → BTC/ETH equivalent
4. Display: "₱10,000 / 0.005 BTC / 0.15 ETH"

### Update Frequency
- Staging: Manual refresh or 60-second polling
- Production: Real-time Chainlink oracle updates

---

## Community Voting

### Voting Mechanism
- **Type**: Non-binding consensus voting (no governance enforcement)
- **Voting Power**: Token-weighted (1 token = 1 vote)
- **Options**: "Support", "Reject", "Abstain"
- **Visibility**: Public vote counts (anonymous user IDs)

### Consensus Logic
- **Simple Majority**: >50% "Support" votes = project approved
- **Proof-of-Stake**: Weighted by token ownership percentage
- **Decision**: Community uses consensus to decide project funding

---

## Tokenization (Polygon)

### ERC-1404 Smart Contract
- **Chain**: Polygon Mumbai testnet (staging) → Mainnet (production)
- **Token**: CPH (Currency.ph token)
- **Supply**: Unlimited (1:1 PHP peg)
- **Features**: Transfer restrictions, role-based access

### Token Minting
1. User deposits ₱5,000
2. Supabase edge function → Polygon RPC
3. Mint 5,000 CPH tokens to user's wallet
4. Store token metadata in `tokens` table:
   - Ownership % of project
   - Voting weight
   - Benefit entitlements (NFTs, project credits)

---

## Non-Profit & Write-Off Model

### Structure
- Platform registered as **non-profit cooperative** (Philippines)
- Contributions treated as **tax-deductible write-offs**
- No guaranteed financial returns
- Ownership grants **benefits**, not profits:
  - Project voting rights
  - Digital collectibles (NFTs)
  - Community credits
  - Recognition (contributor hall of fame)

### Ledger Transparency
- Public `ledger_transactions` view
- On-chain Polygon ledger (immutable)
- Supabase audit logs (contributors, amounts, dates)
- Monthly reports published to community

---

## Asia-Only Operations

### Geofencing
**Supabase Edge Function** filters non-Asian IP addresses:
```javascript
const allowedRegions = ['PH', 'ID', 'MY', 'TH', 'VN', 'SG', 'TW'];
const userRegion = geoip.country_code(request.headers['x-forwarded-for']);
if (!allowedRegions.includes(userRegion)) {
  return new Response('Service not available in your region', { status: 403 });
}
```

### Localization
- **Languages**: Tagalog, Bahasa Indonesia, Thai, Vietnamese
- **Currencies**: PHP, IDR, MYR, THB, VND, SGD, TWD
- **Payment Methods**: GCash (PH), Dana (ID), Touch 'n Go (MY), etc.
- **UI**: Mobile-first for low-end devices common in Asia

---

## Security Considerations

### Data Protection
- **Authentication**: MetaMask (Web3) + Email (Web2)
- **Encryption**: TLS 1.3 for all API calls
- **RLS**: Row-level security on sensitive tables
- **Audit Logs**: All transactions logged

### Smart Contract Security
- **Audits**: Community-audited Solidity code
- **Reentrancy**: Guards against re-entrance attacks
- **Transfer Restrictions**: ERC-1404 prevents unauthorized transfers
- **Testnet First**: All contracts tested on Polygon Mumbai before mainnet

### Regulatory Compliance
- **Non-regulated**: No SEC/BSP oversight (community enforced)
- **Transparency**: Public ledger + on-chain verification
- **Community Governance**: Major decisions via consensus voting

---

## Staging Environment Checklist

### Backend Setup
- [ ] Create Supabase project (free tier)
- [ ] Run schema initialization SQL
- [ ] Enable RLS policies
- [ ] Set up environment variables

### Frontend Setup
- [ ] Clone repository
- [ ] Install dependencies: `yarn install`
- [ ] Configure `.env` with Supabase credentials
- [ ] Start dev server: `yarn dev`

### Payment Integration
- [ ] Register GCash sandbox (developer.gcash.com)
- [ ] Register Stripe test account
- [ ] Create Supabase edge functions for payment processing
- [ ] Test payment flows with sandbox credentials

### Crypto APIs
- [ ] Register OANDA API (fiat rates)
- [ ] Register AbstractAPI (crypto rates)
- [ ] Set up real-time balance conversion

### Blockchain (Polygon Mumbai)
- [ ] Deploy ERC-1404 contract to Mumbai testnet
- [ ] Whitelist contract address in Supabase
- [ ] Set up Web3.js connection to Polygon RPC
- [ ] Test token minting + transfer

### Geofencing
- [ ] Set up Supabase edge function for IP filtering
- [ ] Test with VPN (should block non-Asian IPs)

### Testing
- [ ] Manual test: GCash sandbox payment
- [ ] Manual test: Balance display + real-time updates
- [ ] Manual test: Project contribution + voting
- [ ] Load test: Simulate 100 concurrent users
- [ ] Security test: Token minting + transfer restrictions

---

## Development Workflow

### Local Development
```bash
# Install dependencies
yarn install

# Start dev server (http://localhost:3000)
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

### Environment Variables
Create `.env.local` from `.env.example`:
```bash
cp .env.example .env.local
# Edit .env.local with your actual credentials
```

### Git Workflow
- Create feature branches: `git checkout -b feature/payment-integration`
- Commit changes: `git commit -m "feat: add GCash payment"`
- Push to remote: `git push origin feature/payment-integration`
- Create pull request for code review

---

## Deployment

### Staging Deployment
- **Frontend**: Deploy to Netlify (free tier)
- **Backend**: Supabase (free tier)
- **Domain**: staging.currency.ph
- **CI/CD**: GitHub Actions → Netlify automatic deploy

### Production Deployment
- **Frontend**: Deploy to Netlify (paid, custom domain)
- **Backend**: Supabase (paid tier, backup enabled)
- **Blockchain**: Polygon mainnet (low fees)
- **CDN**: Cloudflare (geofencing + DDoS protection)
- **Monitoring**: Sentry (error tracking)

---

## Next Steps

1. **[Supabase Setup](./SUPABASE_SCHEMA.md)**: Initialize database + tables
2. **[API Integration](./API_INTEGRATION.md)**: Connect payment + crypto APIs
3. **[Polygon Setup](./POLYGON_SETUP.md)**: Deploy smart contracts
4. **[Staging Guide](./STAGING_SETUP.md)**: Complete staging checklist
5. **Community Feedback**: Gather feedback from early testers
6. **Production Launch**: Deploy to Polygon mainnet + domain

---

## Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Polygon Docs**: https://polygon.technology/developers
- **ethers.js**: https://docs.ethers.org/v6/
- **Stripe API**: https://stripe.com/docs
- **OANDA API**: https://developer.oanda.com/rest-live-v20/introduction/
- **AbstractAPI**: https://www.abstractapi.com/api/cryptocurrency

---

## Support & Contact

- **GitHub Issues**: Report bugs and feature requests
- **Community Discord**: Join https://discord.gg/currency-ph (future)
- **Email**: support@currency.ph (future)

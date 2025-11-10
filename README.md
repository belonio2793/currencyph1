# Currency.ph - Community Crowdfunding Platform

## 🌏 Overview

**Currency.ph** is a minimalist, community-oriented, tokenized cryptocurrency crowdfunding platform for Asia-only operations. It enables users to contribute fiat funds (PHP) via mobile payment methods (GCash, Maya), view real-time cryptocurrency balances, and participate in community-driven projects with transparent ownership allocation.

### Core Features
- ✅ **Add Funds**: GCash, Maya, Bank Card payments (Philippines-focused)
- ✅ **Real-time Balances**: PHP, BTC, ETH, CPH tokens (live conversion)
- ✅ **Community Projects**: Browse, contribute, and vote on creative/social initiatives
- ✅ **Tokenized Ownership**: ERC-1404 tokens on Polygon blockchain
- ✅ **Transparent Ledger**: Public transaction history for full transparency
- ✅ **Non-Profit Model**: Tax-deductible contributions, no guaranteed returns
- ✅ **Community Voting**: Consensus-based project approval (token-weighted)
- ✅ **Asia-Only**: Geofenced to Philippines, Indonesia, Malaysia, Thailand, Vietnam, Singapore, Taiwan

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ or Yarn 1.22+
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Supabase account (free): https://supabase.com

### Installation
```bash
# 1. Clone repository
git clone https://github.com/your-org/currency-ph.git
cd currency-ph

# 2. Install dependencies
yarn install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Start development server
yarn dev
```

Visit `http://localhost:3000` in your browser.

---

## 📁 Project Structure

```
currency-ph/
├── src/
│   ├── components/           # React components (Header, AddFunds, Balance, etc.)
│   ├── lib/
│   │   └── supabaseClient.js # Supabase integration + API utilities
│   ├── hooks/                # Custom React hooks (future)
│   ├── App.jsx               # Main app component
│   └── main.jsx              # React entry point
├── docs/
│   ├── ARCHITECTURE.md       # System architecture + tech stack
│   ├── SUPABASE_SCHEMA.md    # Database schema + setup
│   ├─�� API_INTEGRATION.md    # Payment + crypto API setup
│   ├── POLYGON_SETUP.md      # Smart contract deployment
│   └── STAGING_SETUP.md      # Step-by-step staging guide
├── index.html                # HTML entry point
├── package.json              # Dependencies
├── vite.config.js            # Vite configuration
├── tailwind.config.js        # Tailwind CSS config
└── .env.example              # Environment variables template
```

---

## �� Configuration

### Environment Variables
Create `.env.local` from `.env.example` and fill in:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Payment APIs (Staging)
VITE_GCASH_SANDBOX_URL=https://sandbox.dragonpay.com
VITE_STRIPE_PUBLIC_KEY=pk_test_...

# Crypto APIs
VITE_OANDA_API_KEY=your-oanda-token
VITE_ABSTRACTAPI_KEY=your-abstractapi-key

# Polygon (Mumbai testnet for staging)
VITE_POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
```

---

## 📚 Documentation

- **[Architecture Guide](./docs/ARCHITECTURE.md)**: System design, tech stack, data flow
- **[Supabase Setup](./docs/SUPABASE_SCHEMA.md)**: Database schema, tables, real-time subscriptions
- **[API Integration](./docs/API_INTEGRATION.md)**: Payment, crypto, geofencing APIs
- **[Polygon Setup](./docs/POLYGON_SETUP.md)**: Smart contract deployment (ERC-1404)
- **[Staging Guide](./docs/STAGING_SETUP.md)**: Step-by-step environment setup

---

## 🛠️ Development

### Available Commands
```bash
yarn dev        # Start development server (http://localhost:3000)
yarn build      # Build for production
yarn preview    # Preview production build locally
```

### Code Style
- **Formatting**: Prettier (automatic via pre-commit hooks, future)
- **Linting**: ESLint for React (future)
- **CSS**: Tailwind CSS utilities (no custom CSS unless necessary)

### Component Structure
```javascript
// Example component (src/components/MyComponent.jsx)
export default function MyComponent({ prop1, prop2 }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{prop1}</h1>
      <p className="text-gray-600">{prop2}</p>
    </div>
  );
}
```

---

## 🌐 Deployment

### Staging (Free Tier)
```bash
# Deploy frontend to Netlify
netlify deploy --prod

# Backend automatically deployed via Supabase (free tier)
```

### Production
1. Upgrade Supabase to paid tier (database backups, higher limits)
2. Deploy to custom domain via Netlify
3. Deploy smart contracts to Polygon mainnet
4. Enable Cloudflare for DDoS protection + geofencing

---

## 💰 Payment Methods

| Method | Min Amount | Status | Sandbox |
|--------|-----------|--------|---------|
| GCash | ₱500 | ✅ Ready | Dragonpay |
| Maya | ₱500 | ✅ Ready | Stripe |
| Bank Card | ₱1,000 | ✅ Ready | Stripe |
| Crypto | 0.001 BTC | 🔜 Coming | Polygon |

---

## 🔐 Security

**Style guide — No emojis in code or UI**

Please avoid using emoji characters in source files (components, docs, UI text). Emojis cause inconsistent rendering across platforms and complicate accessibility. Use icons, SVGs, or CSS classes for visual indicators instead.


- **Authentication**: Supabase Auth (JWT) + MetaMask Web3 wallet
- **Data Protection**: TLS 1.3 encryption, Row-Level Security (RLS) on database
- **Smart Contracts**: ERC-1404 transfer restrictions, community-audited code
- **Geofencing**: IP-based region filtering (Asia-only)
- **Audit Logs**: All transactions logged for transparency

---

## 🌏 Supported Regions

**Asia-Only Operations**:
- 🇵🇭 Philippines (Primary)
- 🇮🇩 Indonesia
- 🇲🇾 Malaysia
- 🇹🇭 Thailand
- 🇻🇳 Vietnam
- 🇸🇬 Singapore
- 🇹🇼 Taiwan

*Other regions blocked via IP geofencing.*

---

## 📊 Project Ownership Model

### Example: Art Installation Project
- **Goal**: ₱1,000,000
- **Ownership Available**: 20% to funders
- **Min Contribution**: ₱500 (0.2% stake)
- **Benefits**:
  - Art NFT (limited edition)
  - Community credits (future purchases)
  - Voting rights on project decisions
- **Tax Write-off**: Contributions are tax-deductible (non-profit)

---

## 🗳️ Community Voting

### How It Works
1. **Vote to Support**: Token-weighted consensus
2. **Threshold**: >50% "Support" votes approves project
3. **Transparency**: Public vote counts, anonymous users
4. **Execution**: Community decides funding based on consensus

---

## 🔄 Real-time Updates

All balance and project data updates in real-time via Supabase subscriptions:

```javascript
// Example: Real-time balance updates
supabase
  .from('users:id=eq.user-123')
  .on('UPDATE', payload => {
    console.log('Balance updated:', payload.new);
  })
  .subscribe();
```

---

## 🐛 Troubleshooting

### Balance Not Updating
1. Check browser console for errors
2. Verify Supabase credentials in `.env.local`
3. Ensure real-time subscriptions are enabled in Supabase
4. Try hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### Payment Fails
1. Check sandbox credentials match API provider
2. Verify IP geofencing isn't blocking your region
3. Check Supabase edge function logs
4. Review browser DevTools → Network tab

### Crypto Rates Not Displaying
1. Verify OANDA/AbstractAPI keys are correct
2. Check API rate limits (free tier has limits)
3. Look at browser console for HTTP errors
4. Implement caching to reduce API calls

### Smart Contract Issues (Future)
1. Verify contract deployed to correct network (Mumbai testnet)
2. Check contract address whitelisted in Supabase
3. Ensure Web3 wallet connected (MetaMask)
4. Review contract audit report

---

## 📝 Contributing

### Bug Reports
1. Check [GitHub Issues](https://github.com/your-org/currency-ph/issues)
2. Provide steps to reproduce
3. Include screenshot/error message
4. Tag as `bug` or `help wanted`

### Feature Requests
1. Check existing issues first
2. Describe use case and expected behavior
3. Tag as `enhancement`
4. Wait for community feedback

### Code Contributions
1. Fork repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "feat: add my feature"`
4. Push to branch: `git push origin feature/my-feature`
5. Create pull request with description

---

## 📄 License

[Add your chosen license here - MIT, Apache 2.0, GPL 3.0, etc.]

---

## 🙏 Acknowledgments

- **Supabase**: Backend database + real-time subscriptions
- **React**: Frontend framework
- **Tailwind CSS**: Styling
- **Polygon**: Blockchain infrastructure
- **GCash/Stripe**: Payment processing
- **Community**: Feedback, testing, governance

---

## 📞 Support

- **Documentation**: See `/docs` folder
- **GitHub Issues**: Report bugs and request features
- **Email**: support@currency.ph (future)
- **Discord**: Join community server (future)

---

## 🚀 Roadmap

### Phase 1: Staging (Current)
- [x] Frontend UI with React + Tailwind
- [x] Supabase database setup
- [ ] Payment API integration (GCash, Stripe)
- [ ] Real-time balance + rate conversion
- [ ] Polygon Mumbai testnet deployment

### Phase 2: Production
- [ ] Polygon mainnet deployment
- [ ] Compliance review + non-profit registration
- [ ] Community campaigns (Twitter, Discord)
- [ ] Mobile app (React Native)

### Phase 3: Scale
- [ ] Regional expansion (10K+ users)
- [ ] Additional payment methods (crypto, bank transfer)
- [ ] NFT marketplace for project benefits
- [ ] DAO governance (Aragon)

---

## 💡 Vision

Currency.ph is building a transparent, community-driven investment platform for ambitious creative and social projects across Asia. We believe in:

- **Transparency**: Public ledger-based financial reporting
- **Community**: Decisions made via consensus, not centralized governance
- **Impact**: Support for art, social ventures, tech education without guaranteed financial returns
- **Accessibility**: Mobile-first for underserved communities
- **Non-Profit**: Tax-deductible contributions supporting meaningful work

---

**Made with ❤️ for the Asian creative community.**

---

## Quick Links

- 🌐 Website: https://currency.ph (future)
- 📖 Docs: https://docs.currency.ph (future)
- 💬 Discord: https://discord.gg/currency-ph (future)
- 🐦 Twitter: https://twitter.com/currency_ph (future)
- 🔗 Polygon: Mumbai testnet / Mainnet (future)

---

## Environment Setup Checklist

- [ ] Node.js 16+ installed
- [ ] Supabase account created + project initialized
- [ ] `.env.local` configured with Supabase credentials
- [ ] Dependencies installed: `yarn install`
- [ ] Dev server running: `yarn dev`
- [ ] Open http://localhost:3000 in browser
- [ ] Test components render without errors

---

## What's Next?

Start with the **[Architecture Guide](./docs/ARCHITECTURE.md)** to understand the system design, then follow the **[Supabase Setup](./docs/SUPABASE_SCHEMA.md)** to initialize your database.

Happy building! 🚀

---

## 🗺️ Real-world mapping & Google APIs

This project supports building a playable real-world map of the Philippines using MapTiler (satellite tiles) and Google Maps / Street View panoramas. Add the following keys to your environment file (use `.env.template` as a starter):

Required env variables (add to `.env.local` or your host environment):

- VITE_MAPTILER_KEY — MapTiler API key (satellite tiles)
- VITE_GOOGLE_API_KEY — Google Maps / Street View API key
- VITE_SUPABASE_URL — Supabase project URL (for POIs and metadata)
- VITE_SUPABASE_ANON_KEY — Supabase anon key
- VITE_SUPABASE_SERVICE_ROLE_KEY — (optional) Supabase service role key for server-side tasks

Notes:
- Do NOT commit real API keys to the repository. Use `.env.local` or your CI/secrets manager.
- Street View coverage varies by location; the app falls back to satellite tiles when no panorama is available.

Quick setup:

1. Copy `.env.template` to `.env.local` and fill keys.

   cp .env.template .env.local

2. Start dev server:

   yarn dev

3. Open the Play view and use the "Street View" button (top-right) when zoomed in to preview available panoramas.

See docs/PLAY_CURRENCY_GOOGLE_APIS.md for the detailed API plan and phased rollout.

Happy building! 🚀

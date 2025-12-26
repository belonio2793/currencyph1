# Currency.ph - Your Complete Financial Ecosystem for Asia

## What is Currency.ph?

**Currency.ph** is a community-driven, all-in-one financial and social platform built for the Philippines and Asia. It's not just about money—it's about giving people real tools to earn, invest, connect, and build better lives together.

We put **you** in control. No corporate middlemen deciding what you can do with your finances. No hidden fees. Just honest, transparent, peer-to-peer services that actually work for regular people.

---

## What Can You Do Here?

### Money & Wallets
- Send money to anyone, anytime
- Manage multiple wallets in different currencies (PHP, BTC, ETH, and more)
- See real-time balances and currency conversion
- Track every transaction with a complete, transparent history
- Pay bills directly from your wallet
- Never worry about losing track of your money

### Earn Money
- **Find work**: Browse thousands of job listings from local businesses
- **Drive or ride**: Join the ride-sharing network and earn per trip or find a ride home
- **Lend money**: Become a lender in our P2P loan marketplace and earn interest on your money
- **Build a business**: Create a business profile, manage employees, and track inventory and equipment
- **Invest in projects**: Support community projects and initiatives that matter to you

### Borrow When You Need It
- Request loans from real people, not banks
- Compare loan offers from different lenders
- Transparent terms, clear payment schedules
- Peer-to-peer lending without the bank's bureaucracy

### Buy & Sell Services
- Discover local businesses, restaurants, attractions, and services near you
- Browse a complete map of everything around you with real photos and reviews
- List your own services and attract customers
- Support local commerce, not corporate chains

### Connect & Chat
- Message anyone on the platform
- See who's online right now
- Build your reputation through real feedback from real people
- Join communities with shared interests

### Have Fun (And Maybe Win)
- Play poker with real people, real stakes
- Play chess with players from across Asia
- Trade cryptocurrencies with real-time dashboards
- Gamify your finances—make earning and investing fun

### Track Everything
- Network balances show you what you own across all wallets
- Complete audit trail of every transaction
- Digital receipts for all payments
- Total visibility into your financial life

---

## Why Currency.ph is Different

**Built for Asia, not Silicon Valley**
- Works with GCash, Maya, bank cards—payment methods that Asians actually use
- Available in the Philippines, Indonesia, Malaysia, Thailand, Vietnam, Singapore, and Taiwan
- Built by people who understand Asian markets

**Actually Peer-to-Peer**
- No corporation taking a cut of your transactions (well, we need small fees to keep the lights on, but nothing greedy)
- Real people lending to real people
- Real people hiring real people
- Real people buying from real people

**Transparent**
- Every transaction logged and visible
- No hidden fees or surprise charges
- Real-time updates, no delays
- Public ledger for all to see

**Mobile-First**
- Works seamlessly on your phone
- Designed for people with spotty internet
- Fast, responsive, reliable
- Works online and offline

**Secure & Trustworthy**
- Your data is encrypted with military-grade security
- Blockchain-based smart contracts for transactions
- Multi-wallet support for maximum control
- Two-factor authentication and verification systems
- DIDIT integration for identity verification

---

## Getting Started

### Quick Setup
1. **Sign up** with your email or Google account
2. **Add money** via GCash, Maya, or bank transfer
3. **Start using**: Send money, find jobs, discover businesses, connect with people
4. No minimum balance. No monthly fees. No nonsense.

### Prerequisites
- Node.js 16+ (for development)
- Modern web browser
- A Supabase account (free) if you want to host your own

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/currency-ph.git
cd currency-ph

# Install dependencies
yarn install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase and API keys

# Start the development server
yarn dev
```

Visit `http://localhost:3000` in your browser.

---

## Platform Features at a Glance

| Feature | What You Get | Use It For |
|---------|-------------|-----------|
| **Wallet** | Multi-currency storage | Store PHP, crypto, and more |
| **Send Money** | Instant transfers | Pay friends, family, businesses |
| **Deposits** | Add funds easily | GCash, Maya, bank cards |
| **Bill Payments** | Pay from your wallet | Utilities, subscriptions, anything |
| **Jobs** | Browse & post jobs | Find work or hire workers |
| **Rides** | Share transportation | Earn by driving or save by sharing |
| **Loans** | Peer-to-peer lending | Borrow from or lend to people |
| **Nearby** | Discover local businesses | Find restaurants, shops, services |
| **Business Profile** | Go digital | Manage your business online |
| **Chat** | Connect with others | Message anyone, build relationships |
| **Trading** | Real-time crypto | Manage portfolios and trade |
| **Games** | Poker & Chess | Play for fun or for stakes |
| **Network** | See all your balances | Track multiple wallets at once |
| **Receipts** | Digital proof | Save every transaction |

---

## Project Structure

```
currency-ph/
├── src/
│   ├── components/           # All the UI (130+ React components)
│   ├── lib/                  # Helpers (wallets, chat, sync, auth)
│   ├── styles/               # CSS and theming
│   ├── App.jsx               # Main app router
│   └── main.jsx              # Entry point
├── supabase/
│   └── functions/            # Serverless functions (photo scraping, syncing, wallets)
├── scripts/                  # Data processing and population scripts
├── docs/                     # Detailed documentation
├── package.json              # Dependencies
├── vite.config.js            # Build configuration
├── tailwind.config.js        # Styling configuration
└── .env.example              # Environment variables template
```

---

## Configuration

### Required Environment Variables

See `.env.example` for a complete template.

**Important:** Never commit `.env.local` or real API keys to git. Keep all keys private and secure.

To set up your environment:
1. Copy `.env.example` to `.env.local`
2. Fill in your API keys (request from service providers as needed)
3. Keep `.env.local` in your `.gitignore`

For a complete list of all available environment variables and what each one does, refer to the `.env.example` file in the project root.

---

## Development

### Available Commands
```bash
yarn dev              # Start development server (localhost:3000)
yarn build            # Build for production
yarn preview          # Preview production build locally
yarn test             # Run tests

# Data management
yarn fetch-tripadvisor      # Fetch restaurant/venue data
yarn fetch-all-cities       # Populate listings for all cities
yarn populate-nearby        # Add nearby locations
yarn import-photos          # Download and import photos
```

---

## Technology Stack

- **Frontend**: React 18 + Vite (blazingly fast)
- **Backend**: Supabase (PostgreSQL + real-time subscriptions)
- **Maps**: MapTiler + Google Maps + Leaflet
- **Crypto**: Ethers.js + Polygon blockchain
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (via Supabase)
- **Real-time**: Supabase subscriptions
- **Authentication**: Supabase Auth + JWT

---

## Security & Privacy

**We take your security seriously.** Here's what we do:

- **Encryption**: TLS 1.3 for all data in transit
- **Database Security**: Row-Level Security (RLS) on all tables
- **Smart Contracts**: ERC-1404 tokens with transfer restrictions
- **Verification**: DIDIT identity verification integration
- **Audit Logs**: Every transaction is logged and traceable
- **No third-party tracking**: Your data is yours
- **Open source**: Anyone can audit the code

---

## Supported Countries

**We operate in Asia:**
- Philippines (Home base)
- Indonesia
- Malaysia
- Thailand
- Vietnam
- Singapore
- Taiwan

*Other regions are blocked for compliance reasons.*

---

## Troubleshooting

### Balance Not Updating?
1. Check the browser console for errors
2. Make sure Supabase credentials are correct in `.env.local`
3. Try a hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
4. Check your internet connection

### Can't Add Funds?
1. Verify your payment method is active
2. Check if your region is supported
3. Look at the browser's Network tab for error details
4. Ensure you're using a supported payment provider

### Crypto Rates Not Showing?
1. Check your API keys in `.env.local`
2. Make sure your API hasn't hit rate limits
3. Look at browser console for errors
4. Try refreshing the page

### Chat Not Working?
1. Ensure real-time subscriptions are enabled in Supabase
2. Check your internet connection
3. Try signing out and back in
4. Check Supabase logs for connection issues

---

## How to Contribute

We're building this together. All contributions are welcome.

### Report a Bug
1. Check if someone already reported it (GitHub Issues)
2. Create a new issue with:
   - Steps to reproduce the problem
   - Screenshot or error message
   - Your browser and device
3. Tag it as `bug`

### Request a Feature
1. Check if someone already asked for it
2. Describe your use case
3. Explain why it would help
4. Tag it as `enhancement`

### Contribute Code
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Commit: `git commit -m "feat: add my feature"`
5. Push: `git push origin feature/my-feature`
6. Create a pull request with a clear description

**Code Style:**
- Use Tailwind CSS for styling (no inline styles)
- Keep components small and focused
- Write clear variable names
- Comment complex logic

---

## Documentation

- **[Architecture Guide](./docs/ARCHITECTURE.md)** - How the system works
- **[API Integration](./docs/API_INTEGRATION.md)** - Payment and crypto APIs
- **[Supabase Setup](./docs/SUPABASE_SCHEMA.md)** - Database schema
- **[Polygon Setup](./docs/POLYGON_SETUP.md)** - Smart contracts
- **[Maps & APIs](./docs/PLAY_CURRENCY_GOOGLE_APIS.md)** - Real-world mapping

---

## Roadmap

### Now (Completed)
- Multi-currency wallets ✓
- Job marketplace ✓
- Peer-to-peer loans ✓
- Ride-sharing ✓
- Business profiles ✓
- Local listings & maps ✓
- Chat & messaging ✓
- Games (Poker, Chess) ✓
- Trading dashboard ✓
- Receipt management ✓

### Next (In Progress)
- Enhanced verification systems
- Advanced trading features
- Mobile app (React Native)
- More payment methods
- Regional expansion

### Future (Coming Soon)
- NFT marketplace for projects
- DAO governance
- API access for partners
- White-label solutions
- Desktop app

---

## Deployment

### Local Development
```bash
yarn dev
# Opens http://localhost:3000
```

### Deploy to Netlify
```bash
netlify deploy --prod
```

### Deploy to Your Own Server
1. Build the project: `yarn build`
2. Serve the `dist/` folder
3. Set up backend on Supabase

---

## Support

- **Documentation**: Check the `/docs` folder
- **Issues**: Report bugs on GitHub
- **Email**: support@currency.ph (future)
- **Discord**: Join our community (future)
- **Twitter**: @currency_ph (future)

---

## License

[Your chosen license - MIT, Apache 2.0, GPL 3.0, etc.]

---

## Acknowledgments

This wouldn't exist without:

- **Supabase** - Backend database and real-time subscriptions
- **React** - Frontend framework
- **Tailwind CSS** - Beautiful styling
- **Polygon** - Blockchain infrastructure
- **Stripe** - Payment processing
- **GCash & Maya** - Mobile payments
- **Our community** - Testing, feedback, and making this real

---

## The Vision

**Currency.ph is for people who want control.**

Control over your money. Control over your work. Control over how you invest. Control over who you connect with.

We're building a financial system that works for regular people—not just the rich, not just the tech-savvy, not just those with passports to developed countries.

A system where:
- A jeepney driver can loan money to a student and earn interest
- A small business owner can hire workers without a corporate middleman
- A young person can invest in a friend's dream without a bank saying no
- Anyone can send money to anyone else instantly, for almost nothing
- Trust and reputation mean something

We're not perfect. We make mistakes. But we're trying. We're learning. And we're doing it in the open.

**Join us.**

---

**Made with love for the people of Asia.**

---

## Quick Links

- 🌍 **Website**: https://currency.ph (coming soon)
- 📚 **Documentation**: See `/docs` folder
- 💬 **Community**: Join our Discord (coming soon)
- 🐦 **Twitter**: @currency_ph
- 🔗 **Blockchain**: Polygon (Mumbai testnet / Mainnet)
- 🚀 **GitHub**: This repository

---

## Environment Setup Checklist

Before you start:

- [ ] Node.js 16+ installed
- [ ] Supabase account created (free)
- [ ] `.env.local` file created with all keys
- [ ] Dependencies installed: `yarn install`
- [ ] Dev server running: `yarn dev`
- [ ] Can see the app at http://localhost:3000
- [ ] Can create an account and sign in

---

## What's Next?

1. **Read the [Architecture Guide](./docs/ARCHITECTURE.md)** to understand how everything works
2. **Set up [Supabase](./docs/SUPABASE_SCHEMA.md)** for your database
3. **Configure your [API keys](./docs/API_INTEGRATION.md)** for payments and maps
4. **Start the development server**: `yarn dev`
5. **Explore the app** and find the features you want to work on

---

## Real-World Maps & Location Features

Currency.ph includes a real-world map of the Philippines using:

- **MapTiler** for satellite imagery
- **Google Maps** and **Street View** for panoramas
- **Local business data** from TripAdvisor and custom sources
- **Real-time POI updates** via Supabase

### Set Up Maps

Add these keys to `.env.local`:

```bash
VITE_MAPTILER_API_KEY=your-key-here
VITE_GOOGLE_API_KEY=your-key-here
VITE_SUPABASE_URL=your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then:

1. Start dev server: `yarn dev`
2. Click the "Nearby" button
3. Use "Street View" (top-right) to see panoramas when available

See **[Maps & APIs Documentation](./docs/PLAY_CURRENCY_GOOGLE_APIS.md)** for details.

---

**Let's build something amazing together. We're just getting started.** 🚀

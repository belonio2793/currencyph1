export default function Planning() {
  const projectScopes = [
    {
      name: 'Digital Wallet & Payments',
      description: 'Core wallet functionality, balance management, and fund transfers across multiple currency types.',
      status: 'Active',
      features: [
        'Multi-currency wallet support (PHP, USD, BTC, ETH)',
        'Real-time balance updates',
        'Transaction history and receipts',
        'Send money to friends and family',
        'Integration with payment partners'
      ]
    },
    {
      name: 'Business & Marketplace',
      description: 'Enable users to create businesses, list products, and manage inventory in an integrated marketplace.',
      status: 'Active',
      features: [
        'Business registration and management',
        'Product catalog and inventory',
        'Order management system',
        'Business analytics dashboard',
        'Customer reviews and ratings'
      ]
    },
    {
      name: 'Job Marketplace',
      description: 'Connect job seekers with employers and facilitate employment opportunities.',
      status: 'Active',
      features: [
        'Job posting and search',
        'Application management',
        'Employer profiles',
        'Job seeker profiles',
        'Applicant tracking'
      ]
    },
    {
      name: 'P2P Lending',
      description: 'Facilitate peer-to-peer loans with interest management and automated repayment tracking.',
      status: 'Active',
      features: [
        'Loan marketplace',
        'Borrower and lender profiles',
        'Interest rate management',
        'Automated repayment scheduling',
        'Loan history and statements'
      ]
    },
    {
      name: 'Nearby Listings & Discovery',
      description: 'Help users discover businesses and points of interest near their location using maps and geo-location.',
      status: 'Active',
      features: [
        'Interactive map view',
        'Location-based search',
        'Business discovery',
        'Reviews and ratings',
        'Real-time location sharing'
      ]
    },
    {
      name: 'Rides & Transportation',
      description: 'Facilitate peer-to-peer ride sharing and carpooling services.',
      status: 'Active',
      features: [
        'Ride posting and matching',
        'Route optimization',
        'Driver and passenger ratings',
        'Real-time tracking',
        'Payment integration'
      ]
    },
    {
      name: 'Inventory Management',
      description: 'Comprehensive tools for businesses to manage stock, track inventory levels, and automate ordering.',
      status: 'Active',
      features: [
        'Stock level tracking',
        'Automated reorder alerts',
        'Inventory forecasting',
        'Multi-location support',
        'Inventory analytics'
      ]
    },
    {
      name: 'Games & Entertainment',
      description: 'In-platform games including poker and chess with real stakes using platform currency.',
      status: 'Active',
      features: [
        'Poker game engine',
        'Chess with AI and multiplayer',
        'Tournament system',
        'Leaderboards',
        'Prize distribution'
      ]
    },
    {
      name: 'Network & Community',
      description: 'Connect users across the platform, manage relationships, and enable social features.',
      status: 'Active',
      features: [
        'User profiles and networking',
        'Inbox and messaging',
        'Online user discovery',
        'Network balances view',
        'Community engagement tools'
      ]
    },
    {
      name: 'Cryptocurrency Integration',
      description: 'Support for cryptocurrencies including Bitcoin, Ethereum, and Solana with wallet management.',
      status: 'Active',
      features: [
        'Multi-chain support (Solana, Ethereum, Bitcoin)',
        'Wallet creation and management',
        'Crypto transactions',
        'Balance reconciliation',
        'Thirdweb integration'
      ]
    },
    {
      name: 'Trading & Investments',
      description: 'Enable users to trade stocks, securities, and manage investment portfolios.',
      status: 'Active',
      features: [
        'CoinsPhilippines integration',
        'Stock and securities trading',
        'Portfolio tracking',
        'Performance analytics',
        'Market analysis tools'
      ]
    },
    {
      name: 'Shipping & Logistics',
      description: 'Manage shipping addresses, ports, and order fulfillment for e-commerce.',
      status: 'Active',
      features: [
        'Address management',
        'Shipping port support',
        'Order tracking',
        'Delivery management',
        'Shipping partner integration'
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-12">
          <h1 className="text-4xl font-light text-slate-900 mb-4 tracking-wide">Project Planning</h1>
          <p className="text-lg text-slate-600">
            Comprehensive overview of currency.ph development scopes and active features.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projectScopes.map((project, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow border border-slate-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">{project.name}</h2>
                  <p className="text-sm text-slate-600">{project.description}</p>
                </div>
                <span className="inline-block px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium whitespace-nowrap ml-4">
                  {project.status}
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Key Features</h3>
                <ul className="space-y-2">
                  {project.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <span className="text-green-600 mr-3 font-bold">•</span>
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-white rounded-lg shadow border border-slate-200 p-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">Development Status</h2>
          <p className="text-slate-600 mb-4">
            currency.ph is an open-source, multi-featured digital ecosystem designed to provide financial literacy and responsibility through a fun and engaging platform. All listed features are currently active and available for user access.
          </p>
          <p className="text-slate-600">
            The platform continues to evolve with regular updates, new features, and improvements based on user feedback and market demands. New features are in active development to expand use cases and create additional value for our community.
          </p>
        </div>
      </div>
    </div>
  )
}

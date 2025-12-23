import { useState, useEffect } from 'react'

export default function CoconutsLanding() {
  const [scrollPosition, setScrollPosition] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const handleScroll = () => setScrollPosition(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <Leaf className="w-8 h-8 text-amber-600" />
              <span className="text-2xl font-bold text-gray-900">Coconuts.com.ph</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#overview" className="text-gray-600 hover:text-gray-900 font-medium">Overview</a>
              <a href="#products" className="text-gray-600 hover:text-gray-900 font-medium">Products</a>
              <a href="#opportunity" className="text-gray-600 hover:text-gray-900 font-medium">Market</a>
              <a href="#ecosystem" className="text-gray-600 hover:text-gray-900 font-medium">Ecosystem</a>
              <a href="#impact" className="text-gray-600 hover:text-gray-900 font-medium">Impact</a>
              <button className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium">
                Join Now
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-amber-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block mb-6 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                🚀 Q1 2025 Launch
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Global Coconut Enterprise. <span className="text-amber-600">Built for Impact.</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Transform Philippine coconut farming into a world-class, vertically integrated manufacturing, processing, and distribution powerhouse. From farms to global retailers—100% pure, transparently managed.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="px-8 py-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold text-lg transition-colors flex items-center justify-center gap-2">
                  Start Your Contribution <ArrowRight className="w-5 h-5" />
                </button>
                <button className="px-8 py-4 border-2 border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 font-bold text-lg transition-colors">
                  Explore Platform
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-amber-200 to-orange-200 rounded-2xl aspect-square flex items-center justify-center text-8xl">
                🥥
              </div>
              <div className="absolute top-10 right-10 bg-white rounded-xl shadow-lg p-6 max-w-xs">
                <div className="text-3xl font-bold text-amber-600 mb-2">350%</div>
                <p className="text-gray-700 font-medium">Projected ROI over 5 years with transparent capital allocation</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Stats */}
      <section className="bg-white py-16 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Product Lines', value: '4', icon: '📦' },
              { label: 'Target Markets', value: '50+', icon: '🌍' },
              { label: 'Jobs Created', value: '10,000+', icon: '👥' },
              { label: 'Community Share', value: '60%', icon: '🤝' }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl mb-3">{stat.icon}</div>
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                <p className="text-gray-600 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section id="overview" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
              THE VISION
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              A Complete Value Chain from Land to Global Distribution
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl leading-relaxed">
              Coconuts.com.ph is a revolutionary integrated platform that connects Philippine coconut farmers, landowners, and manufacturers with global markets. We're building an entire ecosystem—from acquisition through processing to international distribution—all transparently managed through our currency.ph integration.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {[
              {
                icon: <Leaf className="w-12 h-12" />,
                title: 'Farming & Acquisition',
                description: 'Direct partnerships with Philippine coconut farmers and landowners. Fair-price contracts with transparent pricing mechanisms and currency hedging through exconvert integration.'
              },
              {
                icon: <Zap className="w-12 h-12" />,
                title: 'Manufacturing & Processing',
                description: 'State-of-the-art facilities for 100% pure product extraction and processing. Zero additives, zero preservatives—just pure coconut goodness at scale.'
              },
              {
                icon: <Globe className="w-12 h-12" />,
                title: 'Global Distribution',
                description: 'Strategic logistics partnerships, port management, and direct-to-retailer distribution channels across 50+ countries with real-time tracking.'
              }
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="text-amber-600 mb-4">{item.icon}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
              PREMIUM PRODUCT LINES
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              100% Pure Coconut Products. Global Standard Quality.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {[
              {
                emoji: '💧',
                name: 'Coconut Water',
                description: 'Cold-pressed, pasteurized, microfiltered. Electrolyte-rich hydration without additives.',
                specs: ['Packaging: 200ml, 500ml, 1L aseptic cartons', 'Shelf life: 18 months', 'Production capacity: 5M units/year'],
                markets: 'Health & wellness, fitness, retail chains',
                margin: '45-60% retail margin'
              },
              {
                emoji: '🫒',
                name: 'Virgin Coconut Oil',
                description: 'Cold-pressed, organic certified. Premium grade for culinary and cosmetic applications.',
                specs: ['Packaging: 250ml, 500ml glass bottles', 'Cold-pressed extraction', 'USDA & EU certified'],
                markets: 'Food service, retail beauty, culinary premium',
                margin: '55-70% retail margin'
              },
              {
                emoji: '✨',
                name: 'Coconut Moisturizer',
                description: 'All-natural skincare with pure coconut oil, aloe, and natural antioxidants.',
                specs: ['Packaging: 50ml, 100ml cosmetic jars', 'Dermatologist tested', 'No parabens or silicones'],
                markets: 'Beauty retailers, spas, e-commerce, premium skincare',
                margin: '65-75% retail margin'
              },
              {
                emoji: '🥄',
                name: 'Coconut Sugar & Flour',
                description: 'Low glycemic sweetener and nutrient-dense flour for health-conscious consumers.',
                specs: ['Granulated & powdered varieties', 'Low glycemic index (GI: 35)', 'Rich in minerals and fiber'],
                markets: 'Health food, baking industry, keto/paleo markets',
                margin: '50-65% retail margin'
              }
            ].map((product, i) => (
              <div key={i} className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-10 border border-amber-200 hover:shadow-lg transition-shadow">
                <div className="text-6xl mb-4">{product.emoji}</div>
                <h3 className="text-3xl font-bold text-gray-900 mb-3">{product.name}</h3>
                <p className="text-gray-600 text-lg mb-6 leading-relaxed">{product.description}</p>
                
                <div className="mb-6">
                  <p className="font-semibold text-gray-900 mb-3">Product Specifications:</p>
                  <ul className="space-y-2">
                    {product.specs.map((spec, j) => (
                      <li key={j} className="text-gray-700 flex items-start gap-3">
                        <span className="text-amber-600 mt-1">▸</span>
                        {spec}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white p-4 rounded-lg mb-4 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-600 mb-1">Primary Markets</p>
                  <p className="text-gray-900">{product.markets}</p>
                </div>

                <div className="bg-amber-100 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-amber-700">{product.margin}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Market Opportunity */}
      <section id="opportunity" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
              MARKET ANALYSIS
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Massive Market Opportunity. Untapped Potential.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 mb-12">
            <div className="bg-white rounded-xl p-10 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-amber-600" />
                Market Size & Growth
              </h3>
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-6">
                  <p className="text-gray-600 font-medium mb-2">Global Coconut Water Market</p>
                  <p className="text-3xl font-bold text-amber-600">$3.2B</p>
                  <p className="text-gray-600 text-sm mt-2">CAGR: 12.3% through 2030</p>
                </div>
                <div className="border-b border-gray-200 pb-6">
                  <p className="text-gray-600 font-medium mb-2">Virgin Coconut Oil Market</p>
                  <p className="text-3xl font-bold text-amber-600">$2.8B</p>
                  <p className="text-gray-600 text-sm mt-2">CAGR: 14.1% through 2030</p>
                </div>
                <div className="border-b border-gray-200 pb-6">
                  <p className="text-gray-600 font-medium mb-2">Natural Cosmetics Market</p>
                  <p className="text-3xl font-bold text-amber-600">$18.7B</p>
                  <p className="text-gray-600 text-sm mt-2">CAGR: 9.8% (coconut segment growing faster)</p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium mb-2">Functional Foods & Superfoods</p>
                  <p className="text-3xl font-bold text-amber-600">$24.3B</p>
                  <p className="text-gray-600 text-sm mt-2">Coconut products = fastest growing category</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-10 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                <Target className="w-8 h-8 text-amber-600" />
                Strategic Advantages
              </h3>
              <div className="space-y-4">
                {[
                  { title: 'Geographic Advantage', desc: 'Philippines = #1 coconut producer (40% global share)' },
                  { title: 'Cost Efficiency', desc: 'Labor costs 70% lower than competitors; land availability' },
                  { title: 'Quality Control', desc: 'Direct source control eliminates middleman contamination' },
                  { title: 'Market Timing', desc: 'Explosive growth in health/wellness, vegan, clean beauty trends' },
                  { title: 'Sustainability Focus', desc: 'Premium positioning for eco-conscious consumers' },
                  { title: 'Vertical Integration', desc: 'Control entire supply chain = margin protection' }
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-gradient-to-r from-amber-50 to-white rounded-lg border border-amber-200">
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="text-gray-600 text-sm mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl p-12">
            <h3 className="text-3xl font-bold mb-6">Market Gaps We're Filling</h3>
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <p className="text-amber-100 font-semibold mb-3">🎯 Quality Gap</p>
                <p className="text-amber-50 leading-relaxed">Most coconut products use dried/stored coconuts. We use fresh-pressed within 48 hours—superior quality, longer shelf-life, better margins.</p>
              </div>
              <div>
                <p className="text-amber-100 font-semibold mb-3">🌉 Supply Chain Gap</p>
                <p className="text-amber-50 leading-relaxed">Existing players lack vertical integration. We control source-to-retail, reducing costs by 35% and improving product consistency.</p>
              </div>
              <div>
                <p className="text-amber-100 font-semibold mb-3">💰 Transparency Gap</p>
                <p className="text-amber-50 leading-relaxed">No platform connects communities transparently to global markets. We're building it with real-time accounting through currency.ph.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Business Model & Financials */}
      <section id="financials" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
              FINANCIAL PROJECTIONS
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Transparent Capital Allocation & Returns
            </h2>
          </div>

          <div className="space-y-12">
            {/* Capital Requirements */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-12 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">Initial Capital Requirements</h3>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { category: 'Facility Development', items: ['Manufacturing plant', 'Processing units', 'Storage infrastructure', 'Quality lab'], amount: '$2.8M', percent: 35 },
                  { category: 'Equipment & Machinery', items: ['Cold-press systems', 'Pasteurization units', 'Bottling lines', 'Logistics vehicles'], amount: '$2.1M', percent: 26 },
                  { category: 'Working Capital', items: ['Farmer advances (12 months)', 'Inventory buffer', 'Marketing launch', 'Operational reserves'], amount: '$2.6M', percent: 33 },
                  { category: 'Software & Systems', items: ['Currency.ph integration', 'Supply chain platform', 'Analytics dashboard', 'Security infrastructure'], amount: '$400K', percent: 5 },
                  { category: 'Operations (Year 1)', items: ['Labor force (200+ staff)', 'Utilities & maintenance', 'Insurance & compliance', 'Distribution channels'], amount: '$600K', percent: 7.5 },
                  { category: 'Marketing & Partnerships', items: ['Global market entry', 'Retailer partnerships', 'Sustainability certification', 'Brand development'], amount: '$480K', percent: 6 }
                ].map((item, i) => (
                  <div key={i} className="bg-white p-8 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                    <h4 className="font-bold text-gray-900 mb-4">{item.category}</h4>
                    <ul className="space-y-2 mb-6">
                      {item.items.map((subitem, j) => (
                        <li key={j} className="text-gray-600 text-sm flex items-start gap-2">
                          <span className="text-amber-600 mt-1">▸</span>
                          {subitem}
                        </li>
                      ))}
                    </ul>
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-3xl font-bold text-amber-600">{item.amount}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 bg-amber-100 p-6 rounded-lg border-2 border-amber-600">
                <p className="text-gray-900 font-bold text-lg">Total Initial Investment: $9.08M</p>
                <p className="text-gray-700 mt-2">Structured as equity contributions with transparent governance and token-based ownership through currency.ph</p>
              </div>
            </div>

            {/* Revenue Projections */}
            <div className="bg-white rounded-xl p-12 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">5-Year Revenue Projections</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-4 px-4 font-bold text-gray-900">Metric</th>
                      <th className="text-center py-4 px-4 font-bold text-gray-900">Year 1</th>
                      <th className="text-center py-4 px-4 font-bold text-gray-900">Year 2</th>
                      <th className="text-center py-4 px-4 font-bold text-gray-900">Year 3</th>
                      <th className="text-center py-4 px-4 font-bold text-gray-900">Year 4</th>
                      <th className="text-center py-4 px-4 font-bold text-gray-900">Year 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { metric: 'Units Produced (millions)', data: ['2.4M', '6.8M', '14.2M', '24.6M', '38.5M'] },
                      { metric: 'Total Revenue', data: ['$8.2M', '$24.6M', '$51.8M', '$89.4M', '$142.7M'] },
                      { metric: 'COGS (35%)', data: ['$2.87M', '$8.61M', '$18.13M', '$31.29M', '$49.95M'] },
                      { metric: 'Operating Expenses', data: ['$4.1M', '$7.5M', '$11.2M', '$15.8M', '$21.4M'] },
                      { metric: 'EBITDA Margin', data: ['20.4%', '35.1%', '41.6%', '47.2%', '51.8%'] },
                      { metric: 'Net Profit After Tax (30% rate)', data: ['$1.04M', '$5.62M', '$12.45M', '$21.75M', '35.81M'] }
                    ].map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-4 px-4 font-semibold text-gray-900">{row.metric}</td>
                        {row.data.map((value, j) => (
                          <td key={j} className="py-4 px-4 text-center text-gray-700 font-medium">{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl p-12 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Cost Structure per Unit</h3>
                <div className="space-y-4">
                  {[
                    { item: 'Raw coconuts (farm gate)', cost: '$0.32', note: 'Direct farmer partnerships' },
                    { item: 'Processing & extraction', cost: '$0.18', note: 'Facility economies of scale' },
                    { item: 'Packaging & labeling', cost: '$0.14', note: 'Premium sustainable materials' },
                    { item: 'Quality assurance', cost: '$0.08', note: 'Lab testing & certification' },
                    { item: 'Distribution to port', cost: '$0.12', note: 'Logistics partners' },
                    { item: 'Export & shipping', cost: '$0.28', note: 'International carriers' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-white rounded-lg border border-amber-200">
                      <div>
                        <p className="font-semibold text-gray-900">{item.item}</p>
                        <p className="text-xs text-gray-600 mt-1">{item.note}</p>
                      </div>
                      <p className="text-lg font-bold text-amber-600">{item.cost}</p>
                    </div>
                  ))}
                  <div className="pt-4 border-t-2 border-gray-300 flex items-center justify-between">
                    <p className="font-bold text-gray-900 text-lg">Total COGS per unit</p>
                    <p className="text-2xl font-bold text-amber-600">$1.12</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-12 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Revenue per Unit (Average)</h3>
                <div className="space-y-4">
                  {[
                    { item: 'Retail selling price (global)', price: '$3.40', note: 'Premium positioning' },
                    { item: 'Retailer margin (40%)', price: '($1.36)', note: 'Standard 40% retail markup' },
                    { item: 'Wholesaler share (15%)', price: '($0.51)', note: 'Distributor/logistics partners' },
                    { item: 'Marketing & brand (8%)', price: '($0.27)', note: 'Digital + partnership marketing' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
                      <div>
                        <p className="font-semibold text-gray-900">{item.item}</p>
                        <p className="text-xs text-gray-600 mt-1">{item.note}</p>
                      </div>
                      <p className={`text-lg font-bold ${item.price.startsWith('-') ? 'text-red-600' : 'text-green-600'}`}>{item.price}</p>
                    </div>
                  ))}
                  <div className="pt-4 border-t-2 border-gray-300 flex items-center justify-between">
                    <p className="font-bold text-gray-900 text-lg">Net Revenue per Unit</p>
                    <p className="text-2xl font-bold text-green-600">$1.26</p>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-300 rounded-lg">
                    <p className="text-sm text-blue-900"><strong>Gross Profit Margin:</strong> 48.2% per unit (after retail & distribution)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ROI & Returns */}
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl p-12">
              <h3 className="text-3xl font-bold mb-8">Return on Investment</h3>
              <div className="grid md:grid-cols-4 gap-8">
                <div>
                  <p className="text-amber-100 font-semibold mb-2">Breakeven Timeline</p>
                  <p className="text-3xl font-bold">18 Months</p>
                  <p className="text-amber-50 text-sm mt-2">From first capital deployment to cash positive</p>
                </div>
                <div>
                  <p className="text-amber-100 font-semibold mb-2">Year 5 IRR</p>
                  <p className="text-3xl font-bold">32.4%</p>
                  <p className="text-amber-50 text-sm mt-2">Internal rate of return on equity</p>
                </div>
                <div>
                  <p className="text-amber-100 font-semibold mb-2">5-Year Total Return</p>
                  <p className="text-3xl font-bold">350%</p>
                  <p className="text-amber-50 text-sm mt-2">On initial $9.08M investment</p>
                </div>
                <div>
                  <p className="text-amber-100 font-semibold mb-2">Year 5 EBITDA</p>
                  <p className="text-3xl font-bold">$73.9M</p>
                  <p className="text-amber-50 text-sm mt-2">Enterprise valuation potential</p>
                </div>
              </div>
              <div className="mt-10 pt-10 border-t border-amber-400">
                <p className="text-amber-100 font-semibold mb-3">Exit Strategy (Year 5-7):</p>
                <p className="text-amber-50 leading-relaxed">Strategic acquisition by major beverage/food company (typical multiples: 8-12x EBITDA), IPO potential given scale, or buyback program funded by cash flows. All scenarios transparent to community stakeholders.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Ecosystem */}
      <section id="ecosystem" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
              PARTNERSHIP NETWORK
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              A Growing Collaborative Community
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl">
              We're not a top-down corporation. Coconuts.com.ph is built as a transparent ecosystem where farmers, manufacturers, distributors, and impact investors all participate in governance and share proportional returns.
            </p>
          </div>

          <div className="space-y-12">
            {/* Main Stakeholder Groups */}
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: '🌾 Coconut Farmers & Landowners',
                  description: 'Supply the foundation of our operation',
                  benefits: [
                    'Guaranteed purchase agreements (12-24 month contracts)',
                    'Fair-market pricing + 5% sustainability premium',
                    'Direct access to currency.ph for transparent payments',
                    'Training programs for yield optimization',
                    'Share in profits above baseline revenue (2-5% of net profit)',
                    'Weather insurance & crop protection'
                  ],
                  role: '35% of equity distribution'
                },
                {
                  title: '🏭 Equipment & Machinery Providers',
                  description: 'Enable processing at scale',
                  benefits: [
                    'Long-term equipment leasing agreements',
                    'Maintenance contracts with guaranteed margins',
                    'Equity stake in processing facilities (5-10%)',
                    'Performance-based bonuses tied to uptime',
                    'Joint R&D opportunities for new products',
                    'Access to market data & scaling insights'
                  ],
                  role: '10% of equity distribution'
                },
                {
                  title: '📦 Distribution & Logistics Partners',
                  description: 'Connect us to global markets',
                  benefits: [
                    'Exclusive regional distribution rights',
                    'Margin sharing: 12-18% of wholesale price',
                    'Co-marketing fund (3% of regional sales)',
                    'Technology platform for real-time tracking',
                    'Equity participation in logistics subsidiary (5-8%)',
                    'Training & certification programs'
                  ],
                  role: '15% of equity distribution'
                }
              ].map((group, i) => (
                <div key={i} className="bg-white rounded-xl p-10 border border-gray-200 hover:shadow-lg transition-shadow">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{group.title}</h3>
                  <p className="text-gray-600 mb-6">{group.description}</p>
                  <div className="space-y-3 mb-6">
                    {group.benefits.map((benefit, j) => (
                      <div key={j} className="flex items-start gap-3">
                        <span className="text-amber-600 font-bold">✓</span>
                        <p className="text-gray-700 text-sm">{benefit}</p>
                      </div>
                    ))}
                  </div>
                  <div className="pt-6 border-t border-gray-200">
                    <p className="font-semibold text-amber-600">{group.role}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Impact Partners */}
            <div className="bg-white rounded-xl p-12 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                <Users className="w-8 h-8 text-amber-600" />
                Impact & Community Partners
              </h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-bold text-gray-900 mb-4">🌏 NGOs & Development Organizations</h4>
                  <p className="text-gray-600 mb-4">Partner roles in farmer training, sustainability certification, and community development programs</p>
                  <ul className="space-y-2">
                    <li className="text-gray-700 text-sm flex items-start gap-3">
                      <span className="text-green-600 mt-1">▸</span>
                      3% of net profit allocated to community development
                    </li>
                    <li className="text-gray-700 text-sm flex items-start gap-3">
                      <span className="text-green-600 mt-1">▸</span>
                      5,000+ farmer family educational scholarships
                    </li>
                    <li className="text-gray-700 text-sm flex items-start gap-3">
                      <span className="text-green-600 mt-1">▸</span>
                      Women empowerment initiatives (min 40% female leadership)
                    </li>
                    <li className="text-gray-700 text-sm flex items-start gap-3">
                      <span className="text-green-600 mt-1">▸</span>
                      Ecosystem restoration projects (1% of revenue)
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-4">📊 Analytics & Technology Partners</h4>
                  <p className="text-gray-600 mb-4">Supply chain transparency, blockchain verification, and impact measurement systems</p>
                  <ul className="space-y-2">
                    <li className="text-gray-700 text-sm flex items-start gap-3">
                      <span className="text-blue-600 mt-1">▸</span>
                      Real-time supply chain visibility
                    </li>
                    <li className="text-gray-700 text-sm flex items-start gap-3">
                      <span className="text-blue-600 mt-1">▸</span>
                      Blockchain-verified sourcing & sustainability
                    </li>
                    <li className="text-gray-700 text-sm flex items-start gap-3">
                      <span className="text-blue-600 mt-1">▸</span>
                      Impact measurement dashboards for stakeholders
                    </li>
                    <li className="text-gray-700 text-sm flex items-start gap-3">
                      <span className="text-blue-600 mt-1">▸</span>
                      Integration with currency.ph for transparent payments
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Investor & Funder Partners */}
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-12 border border-amber-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">💰 Impact Investors & Capital Partners</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Equity Investment Opportunities</h4>
                  <ul className="space-y-3">
                    <li className="p-4 bg-white rounded-lg border border-amber-200">
                      <p className="font-semibold text-gray-900">General Investment: 25% Total Equity</p>
                      <p className="text-gray-600 text-sm mt-2">Open to impact funds, family offices, institutional investors. Proportional dividend policy.</p>
                    </li>
                    <li className="p-4 bg-white rounded-lg border border-amber-200">
                      <p className="font-semibold text-gray-900">Strategic Sector Investments: 15% Equity</p>
                      <p className="text-gray-600 text-sm mt-2">Export companies, logistics, retailers. Sector-specific returns + operational synergies.</p>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Investment Structure</h4>
                  <ul className="space-y-3">
                    <li className="p-4 bg-white rounded-lg border border-amber-200">
                      <p className="font-semibold text-gray-900">Governance Participation</p>
                      <p className="text-gray-600 text-sm mt-2">Board seats based on investment size. Quarterly transparent financial reports + impact audits.</p>
                    </li>
                    <li className="p-4 bg-white rounded-lg border border-amber-200">
                      <p className="font-semibold text-gray-900">Currency.ph Integration</p>
                      <p className="text-gray-600 text-sm mt-2">Digital equity ownership & automated dividend distributions. Full transparency of capital flows.</p>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* How to Participate */}
            <div className="bg-white rounded-xl p-12 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">🚀 How to Join the Ecosystem</h3>
              <div className="space-y-6">
                {[
                  {
                    step: '1',
                    title: 'Complete Due Diligence',
                    description: 'Review detailed business plan, meet team, understand impact model and financial projections'
                  },
                  {
                    step: '2',
                    title: 'Choose Your Role',
                    description: 'Select contribution type: capital investment, equipment/services, farm partnerships, or logistics channels'
                  },
                  {
                    step: '3',
                    title: 'Execute Agreements',
                    description: 'Formalize partnership with legal contracts, set terms, equity allocation, and governance rights'
                  },
                  {
                    step: '4',
                    title: 'Set Up on currency.ph',
                    description: 'Register on our integrated platform, link bank accounts, set dividend preferences, track real-time performance'
                  },
                  {
                    step: '5',
                    title: 'Monitor & Participate',
                    description: 'Receive quarterly reports, participate in governance votes, access partnership tools and analytics dashboards'
                  }
                ].map((item, i) => (
                  <div key={i} className="flex gap-8 items-start">
                    <div className="w-16 h-16 bg-amber-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xl">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h4>
                      <p className="text-gray-600 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact & Beneficiaries */}
      <section id="impact" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
              IMPACT & CHANGE
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Economic Prosperity for Philippine Communities
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 mb-12">
            <div className="bg-gradient-to-br from-green-50 to-white rounded-xl p-12 border border-green-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">By Year 5, Coconuts.com.ph Will:</h3>
              <div className="space-y-4">
                {[
                  { icon: '👥', text: 'Create 10,000+ direct jobs (processing, logistics, admin)' },
                  { icon: '🌾', text: 'Partner with 5,000+ coconut farming families' },
                  { icon: '💰', text: 'Generate $450M+ direct income to Philippine communities' },
                  { icon: '🎓', text: 'Fund 5,000 educational scholarships annually' },
                  { icon: '🏥', text: 'Support healthcare programs in 50+ barangays' },
                  { icon: '♀️', text: '40% of leadership roles filled by women' },
                  { icon: '🌱', text: 'Restore 10,000 hectares of coconut forest' },
                  { icon: '🌍', text: 'Reduce agricultural poverty by 35% in target regions' }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-green-200">
                    <span className="text-3xl">{item.icon}</span>
                    <p className="text-gray-700 font-medium leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Primary Beneficiaries</h3>
                <div className="space-y-4">
                  {[
                    {
                      group: 'Coconut Farming Communities',
                      description: 'Direct income increase of 3-4x through fair contracts, bonus profit sharing, and equipment support',
                      region: 'Quezon, Davao, Pangasinan provinces'
                    },
                    {
                      group: 'Manufacturing Workforce',
                      description: 'Skilled factory & processing jobs with benefits, training, career progression, profit sharing',
                      region: 'Central processing facility locations'
                    },
                    {
                      group: 'Logistics & Distribution Partners',
                      description: 'Business ownership opportunities, logistics jobs, partnership equity stakes',
                      region: 'Port cities & export hubs'
                    },
                    {
                      group: 'Women Entrepreneurs',
                      description: '40%+ representation in management, specific microfinance programs, leadership development',
                      region: 'Nationwide'
                    }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
                      <p className="font-bold text-gray-900">{item.group}</p>
                      <p className="text-gray-700 text-sm mt-2">{item.description}</p>
                      <p className="text-green-700 font-semibold text-sm mt-2">📍 {item.region}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-100 rounded-xl p-10 border-2 border-amber-600">
                <h3 className="text-xl font-bold text-gray-900 mb-4">SDG Alignment</h3>
                <p className="text-gray-700 mb-4">Our model directly advances UN Sustainable Development Goals:</p>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>✓ SDG 1: No Poverty (income generation)</p>
                  <p>✓ SDG 5: Gender Equality (40% women in leadership)</p>
                  <p>✓ SDG 8: Decent Work (fair wages, jobs)</p>
                  <p>✓ SDG 12: Responsible Consumption (100% natural, waste reduction)</p>
                  <p>✓ SDG 13: Climate Action (forest restoration, carbon neutral by 2030)</p>
                  <p>✓ SDG 15: Life on Land (ecosystem restoration)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Success Stories / Testimonials */}
          <div className="bg-gray-50 rounded-xl p-12 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-8">Community Success Indicators</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: 'Maria Santos',
                  role: 'Coconut Farmer, Quezon',
                  story: 'From subsistence farming on 2 hectares to 50-hectare managed plantation with guaranteed pricing and training support. Income increased 4x.'
                },
                {
                  name: 'Juan Reyes',
                  role: 'Processing Plant Manager',
                  story: 'Factory supervisor role with equity stake. Skills development program led to management position. Wife now leads quality assurance team.'
                },
                {
                  name: 'Rosa Mercado',
                  role: 'Women Entrepreneur, Davao',
                  story: 'Started as farm cooperative organizer, now managing distribution for 3-province region with profit-sharing stake and team of 12 staff.'
                }
              ].map((person, i) => (
                <div key={i} className="bg-white rounded-lg p-8 border border-gray-200">
                  <p className="text-gray-700 italic mb-6 leading-relaxed">"{person.story}"</p>
                  <p className="font-bold text-gray-900">{person.name}</p>
                  <p className="text-gray-600 text-sm">{person.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sustainability & Transparency */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
              SUSTAINABILITY & GOVERNANCE
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Built on Transparency & Accountability
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <Shield className="w-8 h-8 text-blue-600" />
                  Governance Structure
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-white rounded-lg border border-blue-200">
                    <p className="font-bold text-gray-900">Board of Directors (7 members)</p>
                    <p className="text-gray-700 text-sm mt-2">Founder, major investors (2), farmer community representative, equipment partner representative, impact partner, independent director</p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-white rounded-lg border border-blue-200">
                    <p className="font-bold text-gray-900">Stakeholder Council (Quarterly)</p>
                    <p className="text-gray-700 text-sm mt-2">Representatives from all partner groups. Voting power proportional to equity stake. Decisions on major strategic changes, profit distribution, new partnerships.</p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-white rounded-lg border border-blue-200">
                    <p className="font-bold text-gray-900">Transparency Requirements</p>
                    <p className="text-gray-700 text-sm mt-2">Monthly operational updates, quarterly audited financials, annual impact report, blockchain-verified supply chain data</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">currency.ph Integration</h3>
                <p className="text-gray-700 mb-6 leading-relaxed">All payments, equity ownership, and dividend distributions flow through currency.ph's transparent platform:</p>
                <ul className="space-y-3">
                  {[
                    'Automated payments to farmers with currency conversion & hedging',
                    'Real-time equity ownership & voting power visible to all stakeholders',
                    'Dividend distributions calculated & distributed automatically',
                    'Full audit trail of all transactions for compliance',
                    'Multi-currency support for international partners',
                    'Fraud prevention & security built into every transaction'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-700">
                      <span className="text-blue-600 font-bold mt-1">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <Leaf className="w-8 h-8 text-green-600" />
                  Environmental Commitments
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
                    <p className="font-bold text-gray-900">Carbon Neutral by 2030</p>
                    <p className="text-gray-700 text-sm mt-2">Renewable energy at processing facilities, offset reforestation projects, electric vehicle logistics fleet</p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
                    <p className="font-bold text-gray-900">Zero Waste Processing</p>
                    <p className="text-gray-700 text-sm mt-2">Coconut shells → biochar/fuel, husks → fiber products, waste water → biogas energy, coir → sustainable packaging</p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
                    <p className="font-bold text-gray-900">Forest Restoration</p>
                    <p className="text-gray-700 text-sm mt-2">1% of annual profit to reforestation. Target: 10,000 hectares of coconut agroforest by year 5</p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
                    <p className="font-bold text-gray-900">Biodiversity Protection</p>
                    <p className="text-gray-700 text-sm mt-2">Shade-grown coconut farming maintains native tree canopy. Protects endemic species in Mindanao & Quezon regions</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Certifications & Standards</h3>
                <div className="flex flex-wrap gap-4">
                  {[
                    'Organic Certified',
                    'Fair Trade',
                    'B-Corp',
                    'ISO 9001',
                    'HACCP',
                    'Carbon Neutral',
                    'Rainforest Alliance',
                    'EU Standards'
                  ].map((cert, i) => (
                    <div key={i} className="px-4 py-3 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-300 font-semibold text-gray-800 text-sm">
                      {cert}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            Join a Movement Transforming Philippine Agriculture
          </h2>
          <p className="text-xl text-amber-50 mb-12 leading-relaxed max-w-2xl mx-auto">
            Whether you're a farmer seeking fair pricing, an investor looking for impact returns, a partner building logistics networks, or a technology provider—Coconuts.com.ph is built for your contribution and success.
          </p>

          <div className="grid md:grid-cols-4 gap-6 mb-12">
            {[
              { label: 'I\'m a Farmer', description: 'Fair contracts & prosperity' },
              { label: 'I\'m an Investor', description: 'Impact + returns' },
              { label: 'I\'m a Partner', description: 'Business growth' },
              { label: 'I\'m a Supporter', description: 'Community impact' }
            ].map((item, i) => (
              <button key={i} className="p-6 bg-white/20 hover:bg-white/30 rounded-xl border border-white/40 transition-colors backdrop-blur-sm">
                <p className="font-bold mb-2">{item.label}</p>
                <p className="text-amber-50 text-sm">{item.description}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-10 py-4 bg-white text-amber-600 rounded-lg hover:bg-gray-100 font-bold text-lg transition-colors flex items-center justify-center gap-2">
              Get Started Now <ArrowRight className="w-5 h-5" />
            </button>
            <button className="px-10 py-4 border-2 border-white text-white rounded-lg hover:bg-white/10 font-bold text-lg transition-colors">
              Download Full Prospectus
            </button>
          </div>

          <div className="mt-16 pt-8 border-t border-white/30">
            <p className="text-amber-50 text-sm">
              Coconuts.com.ph | Transforming Philippine Agriculture through Technology, Transparency & Community
            </p>
            <p className="text-amber-100 text-sm mt-4">
              Contact: partnerships@coconuts.com.ph | +63 (2) 1234-5678
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <h3 className="text-white font-bold mb-4">Coconuts.com.ph</h3>
              <p className="text-sm leading-relaxed">Global coconut enterprise, built with Philippine communities, powered by transparency.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Dashboard</a></li>
                <li><a href="#" className="hover:text-white transition">Supply Chain</a></li>
                <li><a href="#" className="hover:text-white transition">Community</a></li>
                <li><a href="#" className="hover:text-white transition">Analytics</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Impact Reports</a></li>
                <li><a href="#" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition">Governance</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2024 Coconuts.com.ph. All rights reserved. Building prosperity for Philippine communities.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

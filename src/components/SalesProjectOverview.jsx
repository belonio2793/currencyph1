import React, { useState } from 'react'

export default function SalesProjectOverview({
  project,
  equipment,
  costs,
  financialMetrics,
  productionCapacity,
  revenueForecast,
  suppliers,
  partnerships
}) {
  const [activeTab, setActiveTab] = useState('executive-summary')

  if (!project) return null

  // Get project-specific sales messaging
  const getSalesMessaging = () => {
    const name = project.name?.toLowerCase() || ''
    if (name.includes('hydrogen')) {
      return {
        executiveSummary: {
          problemStatement: 'Global water infrastructure is aging. Bottled water is wasteful and expensive. Consumers demand premium, sustainable hydration.',
          solution: 'Hydrogen-infused mineral water delivered via stainless steel infrastructure eliminates plastic waste while commanding premium pricing ($1.00/L retail vs. $0.40/L for standard bottled water).',
          marketOpportunity: 'Hydrogen water market projected to hit $1.2B by 2030 with 10%+ annual growth. Philippine market severely undersaturated.',
          competitiveAdvantage: 'Zero-plastic, closed-loop system. No RO waste. Superior product quality with therapeutic hydrogen infusion.',
          roi: {
            year1Revenue: 420000,
            year1Profit: 300000,
            paybackPeriod: '2.1-2.7 years',
            fiveYearROI: '145-210%'
          }
        },
        keyBenefits: [
          { icon: '💰', title: 'Multiple Revenue Streams', desc: 'Premium drinking water, mineral water, whole-house systems, shower units, bulk B2B delivery' },
          { icon: '♻️', title: 'Zero Environmental Impact', desc: 'No plastic waste, no RO reject water, fully closed-loop stainless steel system' },
          { icon: '🏥', title: 'Health-Conscious Market', desc: 'Therapeutic hydrogen water targets premium health/wellness segment with 40%+ margins' },
          { icon: '📈', title: 'Scalable Model', desc: 'Expandable from 70k L/day to 150k L/day with minimal capex additions' },
          { icon: '🌍', title: 'Export Potential', desc: 'Premium product suitable for ASEAN distribution and high-end international markets' },
          { icon: '⚡', title: 'Low Operating Cost', desc: 'Minimal electricity, deep well reduces supply cost, high margins on all products' }
        ],
        riskMitigation: [
          { risk: 'Water Supply Risk', mitigation: 'Deep well tested for sustainability; 500mm+ annual rainfall in region; backup extraction systems' },
          { risk: 'Market Adoption', mitigation: 'Strategic partnerships with health clinics, fitness centers, premium restaurants; demo programs' },
          { risk: 'Equipment Downtime', mitigation: 'Backup UV-C system, redundant hydrogen generator, spare pump on-site' },
          { risk: 'Cost Overruns', mitigation: '5.6% contingency reserve; fixed-price supplier contracts; milestone-based payments' },
          { risk: 'Regulatory Changes', mitigation: 'DOH/DENR pre-approval; annual certification; in-house quality testing lab' }
        ],
        trustFactors: [
          '✓ ISO-grade facility infrastructure',
          '✓ DOH & DENR compliance pathway',
          '✓ Stainless steel (SUS 304/316) food-grade materials',
          '✓ Real-time water quality monitoring',
          '✓ Daily testing & certification',
          '✓ Scalable to 150,000 L/day capacity'
        ]
      }
    } else if (name.includes('coconut')) {
      return {
        executiveSummary: {
          problemStatement: 'Coconut value is trapped in commodity markets. Standard processing wastes 40% of plant material. Limited export channels reduce farmer income.',
          solution: 'Vertically-integrated facility converts entire coconut (husk, shell, water, meat) into 15+ premium products. Zero-waste circular model.',
          marketOpportunity: 'VCO market: $3B+ annual. Coir fiber market: $700M+. Coconut water exports growing 12%+ YoY. Premium export channels pay 3-5x commodity prices.',
          competitiveAdvantage: 'Integrated 6-line processing facility. ISO/HACCP certified. Direct export relationships. Organic certification pathway.',
          roi: {
            year1Revenue: 672000,
            year1Profit: 280000,
            paybackPeriod: '2.1-2.7 years',
            fiveYearROI: '145-210%'
          }
        },
        keyBenefits: [
          { icon: '🥥', title: '15+ Product Lines', desc: 'VCO, bottled water, coir fiber, activated carbon, coco peat, desiccated coconut, animal feed, fertilizer' },
          { icon: '♻️', title: 'True Zero-Waste Model', desc: 'Every part of coconut becomes revenue. Shell → fuel. Husk → fiber. Residues → fertilizer.' },
          { icon: '🌍', title: 'Premium Export Markets', desc: 'Direct access to EU, Japan, North America markets. Organic & HACCP certifications.' },
          { icon: '💎', title: 'VCO Premium Pricing', desc: 'Virgin Coconut Oil commands $5-7/L wholesale vs. $2-3 for commodity oil' },
          { icon: '📦', title: 'Scalable Production', desc: '500L/hour base capacity with expansion potential to 1,000+ L/hour' },
          { icon: '🤝', title: 'Farmer Cooperative Ties', desc: 'Secure supply chain. 30-40% higher prices than commodity buyers support farmer loyalty' }
        ],
        riskMitigation: [
          { risk: 'Supply Volatility', mitigation: 'Long-term contracts with farmer cooperatives; buffer inventory; seasonal diversification' },
          { risk: 'Price Fluctuation', mitigation: 'Diversified product portfolio reduces oil-price dependency; hedging strategy for futures' },
          { risk: 'Export Compliance', mitigation: 'HACCP certified; organic certification pathway; ISO 22000 compliance infrastructure' },
          { risk: 'Equipment Issues', mitigation: 'Premium equipment (GENYOND Machinery); preventive maintenance program; spare parts on-site' },
          { risk: 'Market Competition', mitigation: 'Strong branding; direct export relationships; vertical integration provides cost advantage' }
        ],
        trustFactors: [
          '��� 12+ months equipment warranty from GENYOND',
          '✓ HACCP-certified processing protocols',
          '✓ 4 dedicated production lines',
          '✓ On-site QA laboratory',
          '✓ Cold chain & storage infrastructure',
          '✓ Export-ready facility standards'
        ]
      }
    }
    return {
      executiveSummary: {
        problemStatement: 'Market opportunity identified',
        solution: 'Strategic investment opportunity',
        marketOpportunity: 'Growing market demand',
        competitiveAdvantage: 'Unique value proposition',
        roi: { year1Revenue: 0, year1Profit: 0, paybackPeriod: 'TBD', fiveYearROI: 'TBD' }
      },
      keyBenefits: [],
      riskMitigation: [],
      trustFactors: []
    }
  }

  const messaging = getSalesMessaging()
  const summary = messaging.executiveSummary

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {[
          { id: 'executive-summary', label: '🎯 Executive Summary' },
          { id: 'benefits', label: '💡 Key Benefits' },
          { id: 'financials', label: '💰 Financial Highlights' },
          { id: 'risks', label: '⚠️ Risk Mitigation' },
          { id: 'trust', label: '✓ Trust Factors' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Executive Summary Tab */}
      {activeTab === 'executive-summary' && (
        <div className="space-y-6">
          {/* Problem - Solution - Opportunity */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
              <h4 className="font-bold text-slate-900 mb-2">🚨 The Problem</h4>
              <p className="text-sm text-slate-700">{summary.problemStatement}</p>
            </div>
            <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
              <h4 className="font-bold text-slate-900 mb-2">💡 Our Solution</h4>
              <p className="text-sm text-slate-700">{summary.solution}</p>
            </div>
            <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
              <h4 className="font-bold text-slate-900 mb-2">🎯 The Opportunity</h4>
              <p className="text-sm text-slate-700">{summary.marketOpportunity}</p>
            </div>
          </div>

          {/* Competitive Advantage */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
            <h4 className="text-lg font-bold text-slate-900 mb-3">🏆 Competitive Advantage</h4>
            <p className="text-slate-700 text-base leading-relaxed">{summary.competitiveAdvantage}</p>
          </div>

          {/* ROI Highlights with Psychology */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-6 border border-slate-200">
            <h4 className="text-lg font-bold text-slate-900 mb-4">📊 Investment Returns At a Glance</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                <div className="text-xs text-slate-600 font-semibold mb-1 uppercase">Year 1 Revenue</div>
                <div className="text-2xl font-bold text-green-600">${summary.roi.year1Revenue.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-emerald-200 shadow-sm">
                <div className="text-xs text-slate-600 font-semibold mb-1 uppercase">Year 1 Profit</div>
                <div className="text-2xl font-bold text-emerald-600">${summary.roi.year1Profit.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                <div className="text-xs text-slate-600 font-semibold mb-1 uppercase">Payback Period</div>
                <div className="text-2xl font-bold text-blue-600">{summary.roi.paybackPeriod}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                <div className="text-xs text-slate-600 font-semibold mb-1 uppercase">5-Year ROI</div>
                <div className="text-2xl font-bold text-purple-600">{summary.roi.fiveYearROI}</div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="bg-slate-800 text-white rounded-lg p-6">
            <h4 className="text-lg font-bold mb-4">✨ Why This Investment Works</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-green-400 font-bold text-lg">���</span>
                <span><strong>Clear Market Demand</strong> - Proven consumer demand with growing market segments (health-conscious, eco-aware, premium buyers)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400 font-bold text-lg">✓</span>
                <span><strong>Multiple Revenue Streams</strong> - Diversified income reduces risk; not dependent on single product or market</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400 font-bold text-lg">✓</span>
                <span><strong>Strong Unit Economics</strong> - High margins (55-70% on key products), low cost of goods sold, scalable operations</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400 font-bold text-lg">✓</span>
                <span><strong>Sustainable Competitive Advantage</strong> - Integrated facility design, zero-waste model, premium positioning hard to replicate</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400 font-bold text-lg">✓</span>
                <span><strong>Rapid Payback</strong> - 2-3 year payback means your capital is back in your pocket; profit is upside</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Key Benefits Tab */}
      {activeTab === 'benefits' && (
        <div className="space-y-4">
          {messaging.keyBenefits.map((benefit, idx) => (
            <div key={idx} className="bg-white border-l-4 border-blue-500 rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="flex gap-4">
                <div className="text-4xl">{benefit.icon}</div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 text-base mb-1">{benefit.title}</h4>
                  <p className="text-sm text-slate-600">{benefit.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Financial Highlights Tab */}
      {activeTab === 'financials' && (
        <div className="space-y-6">
          {/* Revenue Breakdown */}
          {revenueForecast && revenueForecast.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h4 className="font-bold text-slate-900 mb-4 text-lg">Revenue by Product</h4>
              <div className="space-y-3">
                {revenueForecast.slice(0, 6).map((rev, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                    <div className="text-sm font-medium text-slate-900">{rev.product_type?.replace(/_/g, ' ')}</div>
                    <div className="text-sm font-bold text-green-600">${(rev.projected_annual_volume * rev.unit_price_usd).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost Breakdown */}
          {costs && costs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h4 className="font-bold text-slate-900 mb-4 text-lg">Capital Allocation</h4>
              <div className="space-y-2">
                {costs.map((cost, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="text-sm text-slate-700">{cost.cost_category?.replace(/_/g, ' ')}</div>
                    <div className="flex gap-4 items-center">
                      <div className="w-32 bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${cost.percentage_of_total}%` }}
                        />
                      </div>
                      <div className="text-sm font-bold text-slate-900 w-16 text-right">${cost.budgeted_amount_usd.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Risk Mitigation Tab */}
      {activeTab === 'risks' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-900">
              <strong>Smart investors understand risk.</strong> Here's how we mitigate every major risk:
            </p>
          </div>
          {messaging.riskMitigation.map((item, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="flex gap-4">
                <div className="text-2xl">⚙️</div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 mb-1">{item.risk}</h4>
                  <p className="text-sm text-slate-700">✓ {item.mitigation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trust Factors Tab */}
      {activeTab === 'trust' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            {messaging.trustFactors.map((factor, idx) => (
              <div key={idx} className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <div className="text-2xl">✓</div>
                <div className="text-sm font-medium text-slate-900">{factor}</div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg p-6">
            <h4 className="font-bold text-slate-900 mb-3 text-lg">📋 Investor Protections</h4>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><span className="text-blue-600 font-bold">✓</span> Quarterly financial updates & transparency reports</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">✓</span> Clear profit-sharing model based on investment amount</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">✓</span> Early investor priority allocation & preferential terms</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">✓</span> Dedicated project manager assigned</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">✓</span> Monthly progress updates via investor dashboard</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

import React from 'react'
import { formatCurrency, formatPhp, formatUsd } from '../lib/currency'
import { phpToUsd } from '../lib/currencyConversion'
import { cleanProjectName, cleanDescription } from '../lib/textSanitizer'

export default function SalesProjectCard({
  project,
  funded,
  exchangeRate,
  onInvest,
  onViewDetails
}) {
  if (!project) return null

  const totalPhp = Number(project.total_cost || 0)
  const totalUsd = phpToUsd(totalPhp, exchangeRate)
  const fundedPhp = Number(funded || 0)
  const fundedUsd = phpToUsd(fundedPhp, exchangeRate)
  const remainingPhp = totalPhp - fundedPhp
  const remainingUsd = totalUsd - fundedUsd
  const pct = totalPhp > 0 ? ((fundedPhp / totalPhp) * 100).toFixed(1) : 0
  const investorCount = Math.floor(fundedPhp / 5000) || 0

  // Get project-specific messaging
  const getProjectMessaging = () => {
    const name = project.name?.toLowerCase() || ''
    if (name.includes('hydrogen')) {
      return {
        headline: '🌱 Next-Gen Water Revolution',
        tagline: 'Premium hydrogen-infused water for health-conscious markets',
        benefits: ['Zero-waste production', '177% 5-year ROI', 'Premium pricing model'],
        opportunity: 'Hydrogen water market growing 10%+ annually through 2030'
      }
    } else if (name.includes('coconut')) {
      return {
        headline: '🥥 Coconut Processing Powerhouse',
        tagline: 'Vertically integrated, zero-waste coconut ecosystem',
        benefits: ['6 revenue streams', '185% 5-year ROI', 'Export-ready products'],
        opportunity: 'Premium VCO & coconut water global demand surging'
      }
    }
    return {
      headline: '📈 High-Growth Investment',
      tagline: project.description || '',
      benefits: ['Diversified revenue', 'Strong returns', 'Sustainable model'],
      opportunity: 'Proven market demand'
    }
  }

  const messaging = getProjectMessaging()
  const fundingPercentage = Math.min(pct, 100)
  const urgencyLevel = fundingPercentage > 75 ? 'critical' : fundingPercentage > 50 ? 'moderate' : 'low'

  return (
    <div
      onClick={onViewDetails}
      className="group bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer hover:border-blue-400 overflow-hidden relative"
    >
      {/* Urgency Badge */}
      {urgencyLevel === 'critical' && (
        <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
          🔥 FILLING FAST
        </div>
      )}
      {urgencyLevel === 'moderate' && (
        <div className="absolute top-4 right-4 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
          ⏰ LIMITED SPOTS
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <div className="text-2xl font-bold text-slate-900 mb-1">{messaging.headline}</div>
        <p className="text-sm text-slate-600 font-medium">{messaging.tagline}</p>
      </div>

      {/* Key Benefits */}
      <div className="grid grid-cols-3 gap-2 mb-5 pb-4 border-b border-slate-200">
        {messaging.benefits.map((benefit, idx) => (
          <div key={idx} className="text-xs">
            <div className="text-green-600 font-bold mb-1">✓</div>
            <div className="text-slate-700 font-medium text-xs leading-tight">{benefit}</div>
          </div>
        ))}
      </div>

      {/* Investment Opportunity */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="text-xs text-slate-600 mb-1">MARKET OPPORTUNITY</div>
        <div className="text-sm font-semibold text-blue-900">{messaging.opportunity}</div>
      </div>

      {/* Progress Bar with Psychology */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <span className="text-xs text-slate-600 font-semibold uppercase">Funding Progress</span>
            <div className="text-lg font-bold text-slate-900">{fundingPercentage.toFixed(1)}% Funded</div>
          </div>
          {investorCount > 0 && (
            <div className="text-right">
              <div className="text-xs text-slate-600">Investors</div>
              <div className="text-xl font-bold text-green-600">{investorCount}+</div>
            </div>
          )}
        </div>
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-500 to-emerald-600 h-full transition-all duration-500 rounded-full"
            style={{ width: `${fundingPercentage}%` }}
          />
        </div>
      </div>

      {/* Financial Highlights */}
      <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="text-xs text-slate-600 mb-1">NEEDED</div>
          <div className="font-bold text-slate-900">{formatPhp(remainingPhp)}</div>
          <div className="text-xs text-slate-500">{formatUsd(remainingUsd)}</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-slate-600 mb-1">MIN. INVESTMENT</div>
          <div className="font-bold text-slate-900">{formatPhp(project.min_investment || 1000)}</div>
          <div className="text-xs text-slate-500">per investor</div>
        </div>
      </div>

      {/* Social Proof */}
      <div className="bg-slate-100 rounded-lg p-2 mb-4 text-center">
        <div className="text-xs text-slate-600">
          💡 Early investors have <span className="font-bold text-slate-900">priority allocation rights</span> and <span className="font-bold text-slate-900">quarterly updates</span>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onInvest()
          }}
          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 rounded-lg hover:shadow-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105"
        >
          💰 Invest Now
        </button>
        <button
          onClick={onViewDetails}
          className="flex-1 border-2 border-slate-300 text-slate-700 font-semibold py-3 rounded-lg hover:bg-slate-100 hover:border-slate-400 transition-all duration-200"
        >
          📊 Details
        </button>
      </div>
    </div>
  )
}

import React, { useState } from 'react'

const PROPERTY_ACHIEVEMENTS = {
  basic: [
    { id: 'first-property', name: 'First Step', desc: 'Buy your first property', icon: '🏠', requirement: { ownedCount: 1 } },
    { id: 'property-duo', name: 'Partnership', desc: 'Own 2 different properties', icon: '🏢', requirement: { ownedCount: 2 } },
    { id: 'property-trio', name: 'Real Estate Investor', desc: 'Own 3 properties', icon: '🏘️', requirement: { ownedCount: 3 } },
    { id: 'property-quartet', name: 'Portfolio Manager', desc: 'Own 4 different properties', icon: '🏗️', requirement: { ownedCount: 4 } },
  ],

  income: [
    { id: 'income-100', name: 'Passive Income', desc: 'Generate ₱100/10s from properties', icon: '💰', requirement: { income: 100 } },
    { id: 'income-500', name: 'Steady Stream', desc: 'Generate ₱500/10s from properties', icon: '💸', requirement: { income: 500 } },
    { id: 'income-1000', name: 'Money Machine', desc: 'Generate ₱1000/10s from properties', icon: '🤑', requirement: { income: 1000 } },
  ],

  upgrades: [
    { id: 'first-upgrade', name: 'Improvement', desc: 'Upgrade a property to level 2', icon: '⬆️', requirement: { maxLevel: 2 } },
    { id: 'level-5', name: 'Enhanced', desc: 'Upgrade a property to level 5', icon: '⬆️⬆️', requirement: { maxLevel: 5 } },
    { id: 'level-10', name: 'Mastery', desc: 'Upgrade a property to level 10', icon: '⭐', requirement: { maxLevel: 10 } },
  ],

  diversity: [
    { id: 'all-types', name: 'Balanced Portfolio', desc: 'Own all 3 property types', icon: '📊', requirement: { allTypes: true } },
    { id: 'district-spread', name: 'Citywide Presence', desc: 'Own properties in 3+ districts', icon: '🗺️', requirement: { districtsCount: 3 } },
  ],

  wealth: [
    { id: 'portfolio-50k', name: 'Real Estate Mogul', desc: 'Portfolio worth ₱50,000', icon: '👑', requirement: { totalValue: 50000 } },
    { id: 'portfolio-100k', name: 'Property Tycoon', desc: 'Portfolio worth ₱100,000', icon: '👑👑', requirement: { totalValue: 100000 } },
    { id: 'portfolio-500k', name: 'Empire Builder', desc: 'Portfolio worth ₱500,000', icon: '🏰', requirement: { totalValue: 500000 } },
  ],

  special: [
    { id: 'debt-free', name: 'Debt Free', desc: 'Own properties worth more than starting capital', icon: '✓', requirement: { noDebt: true } },
    { id: 'passive-rich', name: 'Passive Income King', desc: 'Let properties generate 50x your starting wealth', icon: '♕', requirement: { passiveMultiplier: 50 } },
  ]
}

export default function PropertyEmpireAchievements({
  character,
  properties = []
}) {
  const [expandedCategory, setExpandedCategory] = useState('basic')

  const calculateAchievements = () => {
    const earned = {}

    // Calculate stats
    const ownedCount = properties.length
    const totalIncome = properties.reduce((sum, p) => sum + (p.income || 0), 0)
    const totalValue = properties.reduce((sum, p) => sum + (p.current_value || 0), 0)
    const maxLevel = Math.max(...properties.map(p => p.upgrade_level || 0), 0)
    const propertyTypes = new Set(properties.map(p => p.id))
    const hasAllTypes = propertyTypes.has('sari-sari') && propertyTypes.has('food-cart') && propertyTypes.has('tricycle')

    // Check basic achievements
    PROPERTY_ACHIEVEMENTS.basic.forEach(ach => {
      if (ownedCount >= ach.requirement.ownedCount) {
        earned[ach.id] = true
      }
    })

    // Check income achievements
    PROPERTY_ACHIEVEMENTS.income.forEach(ach => {
      if (totalIncome >= ach.requirement.income) {
        earned[ach.id] = true
      }
    })

    // Check upgrade achievements
    PROPERTY_ACHIEVEMENTS.upgrades.forEach(ach => {
      if (maxLevel >= ach.requirement.maxLevel) {
        earned[ach.id] = true
      }
    })

    // Check diversity achievements
    PROPERTY_ACHIEVEMENTS.diversity.forEach(ach => {
      if (ach.requirement.allTypes && hasAllTypes) {
        earned[ach.id] = true
      }
    })

    // Check wealth achievements
    PROPERTY_ACHIEVEMENTS.wealth.forEach(ach => {
      if (totalValue >= ach.requirement.totalValue) {
        earned[ach.id] = true
      }
    })

    return earned
  }

  const earned = calculateAchievements()
  const earnedCount = Object.values(earned).filter(Boolean).length
  const totalCount = Object.keys(PROPERTY_ACHIEVEMENTS).reduce((sum, cat) => sum + PROPERTY_ACHIEVEMENTS[cat].length, 0)

  const renderCategory = (categoryKey, categoryAchievements) => {
    return (
      <div key={categoryKey} className="mb-4">
        <button
          onClick={() => setExpandedCategory(expandedCategory === categoryKey ? null : categoryKey)}
          className="w-full flex items-center justify-between p-3 bg-slate-900/40 border border-slate-700 rounded-lg hover:bg-slate-900/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">
              {categoryKey === 'basic' && '🏠'}
              {categoryKey === 'income' && '💰'}
              {categoryKey === 'upgrades' && '⬆️'}
              {categoryKey === 'diversity' && '📊'}
              {categoryKey === 'wealth' && '👑'}
              {categoryKey === 'special' && '✨'}
            </span>
            <div className="text-left">
              <h3 className="font-semibold text-slate-100 capitalize">{categoryKey.replace('-', ' ')} Achievements</h3>
              <p className="text-xs text-slate-400">
                {categoryAchievements.filter(a => earned[a.id]).length} / {categoryAchievements.length} completed
              </p>
            </div>
          </div>
          <span className="text-slate-400">
            {expandedCategory === categoryKey ? '▼' : '▶'}
          </span>
        </button>

        {expandedCategory === categoryKey && (
          <div className="mt-2 space-y-2 ml-4">
            {categoryAchievements.map(achievement => {
              const isEarned = earned[achievement.id]
              return (
                <div
                  key={achievement.id}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isEarned
                      ? 'bg-emerald-900/20 border-emerald-500 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800/40 border-slate-700 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{achievement.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-slate-100">{achievement.name}</h4>
                        {isEarned && <span className="text-xs bg-emerald-600 px-2 py-1 rounded text-white">Unlocked</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{achievement.desc}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-slate-100">🏰 Property Empire Achievements</h2>
          <div className="text-sm font-semibold text-emerald-400">
            {earnedCount} / {totalCount}
          </div>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-green-500 h-full transition-all"
            style={{ width: `${(earnedCount / totalCount) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {Object.entries(PROPERTY_ACHIEVEMENTS).map(([categoryKey, categoryAchievements]) =>
          renderCategory(categoryKey, categoryAchievements)
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg text-sm text-blue-200">
        <div className="font-semibold mb-1">💡 Property Empire Tips</div>
        <ul className="text-xs space-y-1 text-blue-300">
          <li>• Upgrade properties strategically to maximize returns</li>
          <li>• Diversify across property types for stability</li>
          <li>• Spread properties across districts for citywide presence</li>
          <li>• Focus on passive income to reach higher achievements</li>
        </ul>
      </div>
    </div>
  )
}

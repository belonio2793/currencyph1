import React, { useState } from 'react'
import { ACHIEVEMENTS } from '../../lib/gameAchievementSystem'

export default function AchievementsPanel({ achievements, stats = {} }) {
  const [selectedCategory, setSelectedCategory] = useState('all')

  const categories = [
    { id: 'all', label: 'All Achievements', icon: '🏆' },
    { id: 'wealth', label: 'Wealth', icon: '💰' },
    { id: 'experience', label: 'Experience', icon: '⭐' },
    { id: 'work', label: 'Work', icon: '💼' },
    { id: 'property', label: 'Property', icon: '🏠' },
    { id: 'skills', label: 'Skills', icon: '🎓' },
    { id: 'social', label: 'Social', icon: '👥' },
    { id: 'exploration', label: 'Exploration', icon: '🗺️' },
    { id: 'combo', label: 'Combo', icon: '🔥' }
  ]

  const filteredAchievements = selectedCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === selectedCategory)

  const totalAchievements = Object.keys(ACHIEVEMENTS).length
  const unlockedCount = achievements.filter(a => a.unlocked).length

  const getProgressBarColor = (progress) => {
    if (progress === 100) return 'bg-yellow-500'
    if (progress >= 75) return 'bg-green-500'
    if (progress >= 50) return 'bg-blue-500'
    if (progress >= 25) return 'bg-orange-500'
    return 'bg-slate-500'
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      {/* Header with completion stats */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg p-6 border border-cyan-500/30">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-cyan-300 flex items-center gap-2">
            Achievements
          </h2>
          <div className="text-right">
            <div className="text-2xl font-bold text-cyan-300">
              {unlockedCount}/{totalAchievements}
            </div>
            <div className="text-sm text-cyan-200/70">
              {Math.round((unlockedCount / totalAchievements) * 100)}% Complete
            </div>
          </div>
        </div>

        {/* Completion bar */}
        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${(unlockedCount / totalAchievements) * 100}%` }}
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-300'
                : 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map(achievement => (
          <div
            key={achievement.id}
            className={`p-4 rounded-lg border transition-all ${
              achievement.unlocked
                ? 'bg-slate-700/50 border-green-500/50 shadow-lg shadow-green-500/20'
                : 'bg-slate-800/50 border-slate-700/50 opacity-70'
            }`}
          >
            {/* Icon and locked indicator */}
            <div className="flex items-center justify-between mb-2">
                            {achievement.unlocked && (
                <span className="text-green-400 text-sm font-bold">✓ UNLOCKED</span>
              )}
            </div>

            {/* Title */}
            <h3 className={`font-bold text-sm mb-1 ${
              achievement.unlocked ? 'text-green-300' : 'text-slate-300'
            }`}>
              {achievement.title}
            </h3>

            {/* Description */}
            <p className="text-xs text-slate-400 mb-3">
              {achievement.description}
            </p>

            {/* Progress bar (only show for unlocked or with progress) */}
            {!achievement.unlocked && achievement.progress > 0 && (
              <div className="space-y-1">
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${getProgressBarColor(achievement.progress)} transition-all duration-300`}
                    style={{ width: `${achievement.progress}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400">
                  {Math.round(achievement.progress)}%
                </div>
              </div>
            )}

            {achievement.unlocked && (
              <div className="text-xs text-green-400/70 pt-2 border-t border-green-500/20">
                🎉 Achievement unlocked!
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filteredAchievements.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg mb-2">No achievements in this category yet.</p>
          <p className="text-sm">Keep playing to unlock them!</p>
        </div>
      )}
    </div>
  )
}

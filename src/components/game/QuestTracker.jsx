import React, { useState } from 'react'
import { QUEST_TYPES } from '../../lib/gameQuestSystem'

export default function QuestTracker({ quests, onQuestSelect, onStartQuest, onClose }) {
  const [selectedTab, setSelectedTab] = useState('active')
  const [expandedQuest, setExpandedQuest] = useState(null)

  const tabs = [
    { id: 'active', label: 'Active', icon: '📋' },
    { id: 'main', label: 'Main Story', icon: '🗺️' },
    { id: 'side', label: 'Side Quests', icon: '⭐' },
    { id: 'daily', label: 'Daily', icon: '🌅' },
    { id: 'achievements', label: 'Achievements', icon: '🏆' }
  ]

  const getQuestsByTab = () => {
    switch (selectedTab) {
      case 'active':
        return quests.active
      case 'main':
        return quests.available.filter(q => q.type === QUEST_TYPES.main)
      case 'side':
        return quests.available.filter(q => q.type === QUEST_TYPES.side)
      case 'daily':
        return quests.available.filter(q => q.type === QUEST_TYPES.daily)
      case 'achievements':
        return quests.available.filter(q => q.type === QUEST_TYPES.achievement)
      default:
        return []
    }
  }

  const questList = getQuestsByTab()

  const getQuestTypeColor = (type) => {
    const colors = {
      main: 'from-purple-500 to-purple-600',
      side: 'from-blue-500 to-blue-600',
      daily: 'from-orange-500 to-orange-600',
      achievement: 'from-yellow-500 to-yellow-600'
    }
    return colors[type] || 'from-slate-500 to-slate-600'
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Quests</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-2 p-4 border-b border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-3 py-2 rounded font-medium transition-colors whitespace-nowrap ${
                selectedTab === tab.id
                  ? 'bg-yellow-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {questList.length === 0 ? (
            <div className="text-slate-400 text-center py-12">
              No quests available in this category
            </div>
          ) : (
            <div className="space-y-3">
              {questList.map(quest => (
                <div
                  key={quest.id}
                  className={`bg-gradient-to-r ${getQuestTypeColor(quest.type)} p-4 rounded-lg cursor-pointer hover:shadow-lg transition-all`}
                  onClick={() => setExpandedQuest(expandedQuest === quest.id ? null : quest.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-lg">{quest.title}</h3>
                      <p className="text-sm text-white/80 mt-1">{quest.description}</p>

                      {/* Progress */}
                      {quest.progress && (
                        <div className="mt-3 space-y-2">
                          {quest.progress.objectives?.map((obj, idx) => (
                            <div key={idx}>
                              <div className="flex justify-between text-xs text-white/70 mb-1">
                                <span>{obj.type}</span>
                                <span>{obj.current}/{obj.target}</span>
                              </div>
                              <div className="w-full bg-black/30 rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (obj.current / obj.target) * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reward */}
                      <div className="mt-3 flex gap-2">
                        {quest.reward?.money && (
                          <span className="text-xs font-bold text-yellow-300 bg-black/40 px-2 py-1 rounded">
                            ₱{quest.reward.money}
                          </span>
                        )}
                        {quest.reward?.xp && (
                          <span className="text-xs font-bold text-blue-300 bg-black/40 px-2 py-1 rounded">
                            {quest.reward.xp} XP
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      {selectedTab !== 'active' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onStartQuest(quest.id)
                          }}
                          className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-white font-bold text-sm"
                        >
                          Start
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedQuest === quest.id && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <div className="space-y-2">
                        <div>
                          <h4 className="font-bold text-white mb-2">Objectives:</h4>
                          <ul className="text-sm text-white/80 space-y-1">
                            {quest.objectives?.map((obj, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <span>•</span>
                                <span>{obj.type}: {obj.target}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {quest.prerequisites && quest.prerequisites.length > 0 && (
                          <div>
                            <h4 className="font-bold text-white mb-2">Prerequisites:</h4>
                            <p className="text-xs text-white/70">{quest.prerequisites.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

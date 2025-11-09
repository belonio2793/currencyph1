import React, { useState } from 'react'
import { EQUIPMENT_RARITY, EQUIPMENT_TYPES } from '../../lib/gameInventorySystem'

export default function InventoryUI({ inventory, onEquip, onUnequip, onClose }) {
  const [selectedTab, setSelectedTab] = useState('equipment')
  const [selectedSlot, setSelectedSlot] = useState(null)

  const tabs = [
    { id: 'equipment', label: 'Equipped' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'stats', label: 'Stats' }
  ]

  const equipmentSlots = [
    EQUIPMENT_TYPES.headgear,
    EQUIPMENT_TYPES.chest,
    EQUIPMENT_TYPES.legs,
    EQUIPMENT_TYPES.feet,
    EQUIPMENT_TYPES.hands,
    EQUIPMENT_TYPES.accessory
  ]

  const stats = inventory.getEquippedStats()

  const getRarityColor = (rarity) => {
    return EQUIPMENT_RARITY[rarity]?.color || '#94a3b8'
  }

  const getRarityName = (rarity) => {
    return EQUIPMENT_RARITY[rarity]?.name || 'Unknown'
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Inventory</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                selectedTab === tab.id
                  ? 'bg-yellow-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedTab === 'equipment' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Equipped Items</h3>
              <div className="grid grid-cols-2 gap-4">
                {equipmentSlots.map(slot => {
                  const item = inventory.equipment[slot]
                  return (
                    <div
                      key={slot}
                      className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 cursor-pointer"
                      onClick={() => setSelectedSlot(slot)}
                    >
                      <div className="text-xs text-slate-400 uppercase mb-2">{slot}</div>
                      {item ? (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <div
                                className="font-bold"
                                style={{ color: getRarityColor(item.rarity) }}
                              >
                                {item.name}
                              </div>
                              <div className="text-xs text-slate-400">
                                {getRarityName(item.rarity)}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onUnequip(slot)
                              }}
                              className="px-2 py-1 bg-red-600/50 hover:bg-red-600 rounded text-xs text-white"
                            >
                              Unequip
                            </button>
                          </div>
                          {item.stats && Object.keys(item.stats).length > 0 && (
                            <div className="mt-2 text-xs text-green-400 space-y-1">
                              {Object.entries(item.stats).map(([stat, value]) => (
                                <div key={stat}>
                                  +{value} {stat}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-slate-500 italic">Empty</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {selectedTab === 'inventory' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">
                Items ({inventory.getItemCount()}/{inventory.maxCapacity})
              </h3>
              {inventory.items.length === 0 ? (
                <div className="text-slate-400 text-center py-8">No items in inventory</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {inventory.items.map(item => (
                    <div
                      key={item.id}
                      className="bg-slate-800 border border-slate-700 rounded-lg p-3 hover:border-slate-600 cursor-pointer"
                      onClick={() => setSelectedSlot(item.id)}
                    >
                      <div
                        className="font-bold text-sm mb-1"
                        style={{ color: getRarityColor(item.rarity) }}
                      >
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        x{item.quantity}
                      </div>
                      {item.stats && Object.keys(item.stats).length > 0 && (
                        <div className="text-xs text-green-400">
                          {Object.entries(item.stats)
                            .map(([stat, value]) => `+${value} ${stat}`)
                            .join(', ')}
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onEquip(item.id)
                        }}
                        className="mt-2 w-full px-2 py-1 bg-blue-600/50 hover:bg-blue-600 rounded text-xs text-white"
                      >
                        Equip
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedTab === 'stats' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Equipment Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(stats).map(([stat, value]) => {
                  if (value === 0 && !['income_bonus', 'experience_bonus', 'defense', 'movespeed'].includes(stat)) {
                    return null
                  }
                  return (
                    <div key={stat} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                      <div className="text-sm text-slate-400 capitalize">{stat.replace('_', ' ')}</div>
                      <div className="text-2xl font-bold text-cyan-400">
                        {value > 0 && '+'}
                        {value}
                        {['bonus', 'defense', 'movespeed'].includes(stat) && '%'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

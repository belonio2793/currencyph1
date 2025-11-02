import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { gameAPI } from '../lib/gameAPI'
import { citySimulationTicker } from '../lib/citySimulationTicker'
import CharacterCreation from './game/CharacterCreation'
import GameWorld from './game/GameWorld'
import GameInventory from './game/GameInventory'
import GameMarketplace from './game/GameMarketplace'
import GameProperties from './game/GameProperties'
import GameCombat from './game/GameCombat'
import CityMap from './game/CityMap'
import CityManager from './game/CityManager'

export default function PlayCurrency({ userId }) {
  const [character, setCharacter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('world')
  const [inventory, setInventory] = useState([])
  const [equipment, setEquipment] = useState([])
  const [properties, setProperties] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [showCharacterCustomizer, setShowCharacterCustomizer] = useState(false)
  const [combatActive, setCombatActive] = useState(false)
  const [combatData, setCombatData] = useState(null)
  const [claimingReward, setClaimingReward] = useState(false)
  const [selectedCity, setSelectedCity] = useState(null)
  const [showCityManager, setShowCityManager] = useState(false)

  useEffect(() => {
    initializeGame()
  }, [userId])

  useEffect(() => {
    if (userId) {
      citySimulationTicker.setUser(userId)
      citySimulationTicker.start()

      const handleCityUpdate = (cities) => {
      }

      citySimulationTicker.addCallback(handleCityUpdate)

      return () => {
        citySimulationTicker.stop()
        citySimulationTicker.removeCallback(handleCityUpdate)
      }
    }
  }, [userId])

  const initializeGame = async () => {
    try {
      setLoading(true)
      const char = await gameAPI.getCharacter(userId)
      
      if (!char) {
        setCharacter(null)
      } else {
        setCharacter(char)
        await loadGameData(char.id)
      }
    } catch (err) {
      setError('Failed to load game: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadGameData = async (characterId) => {
    try {
      const [inv, equip, props, bank] = await Promise.all([
        gameAPI.getInventory(characterId),
        gameAPI.getEquipment(characterId),
        gameAPI.getProperties(characterId),
        gameAPI.getBankAccounts(characterId)
      ])
      setInventory(inv)
      setEquipment(equip)
      setProperties(props)
      setBankAccounts(bank)
    } catch (err) {
      console.error('Error loading game data:', err)
    }
  }

  const handleCreateCharacter = async (name, appearance, homeCity) => {
    try {
      setLoading(true)
      const char = await gameAPI.createCharacter(userId, name, appearance, homeCity)
      setCharacter(char)
      await loadGameData(char.id)
    } catch (err) {
      setError('Failed to create character: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCharacterCustomization = async (newAppearance) => {
    try {
      const updated = await gameAPI.updateCharacterAppearance(character.id, newAppearance)
      setCharacter(updated)
    } catch (err) {
      setError('Failed to update appearance: ' + err.message)
    }
  }

  const handleInventoryUpdate = async () => {
    if (character) {
      const inv = await gameAPI.getInventory(character.id)
      setInventory(inv)
    }
  }

  const handleDailyReward = async () => {
    if (!character) return
    try {
      setClaimingReward(true)
      await gameAPI.getOrCreateDailyReward(character.id)
      const updated = await gameAPI.getCharacter(userId)
      setCharacter(updated)
      setError('')
    } catch (err) {
      setError('Daily reward: ' + err.message)
    } finally {
      setClaimingReward(false)
    }
  }

  const handleCombat = async (enemyType, enemyLevel = 1) => {
    try {
      setCombatActive(true)
      const result = await gameAPI.startCombat(character.id, enemyType, enemyLevel)
      setCombatData(result)
      
      // Update character data
      const updated = await gameAPI.getCharacter(userId)
      setCharacter(updated)
    } catch (err) {
      setError('Combat failed: ' + err.message)
    } finally {
      setCombatActive(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-400 mb-4">��� Play Currency</div>
          <p className="text-slate-400">Loading your adventure...</p>
        </div>
      </div>
    )
  }

  if (!character) {
    return <CharacterCreation onCharacterCreated={handleCreateCharacter} userId={userId} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1
                onClick={() => setShowCharacterCustomizer(true)}
                className="text-3xl font-bold text-blue-400 cursor-pointer hover:text-blue-300 transition-colors"
                title="Click to customize"
              >
                {character.name}
              </h1>
              <p className="text-slate-400 text-sm">Level {character.level} • 📍 {character.current_location} {character.home_city && character.home_city !== character.current_location ? `(Home: ${character.home_city})` : ''}</p>
            </div>
            <div className="flex items-center gap-8">
              <button
                onClick={handleDailyReward}
                disabled={claimingReward}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded text-white font-medium"
              >
                {claimingReward ? 'Claiming…' : 'Claim Daily Reward'}
              </button>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Total Wealth</p>
                <p className="text-2xl font-bold text-yellow-400">₱{character.money?.toLocaleString() || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Experience</p>
                <p className="text-2xl font-bold text-green-400">{character.experience?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>

          {/* Experience Bar */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400">Progress to Next Level</span>
              <span className="text-xs text-slate-400">{character.experience % 1000} / 1000</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${(character.experience % 1000) / 10}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'world', label: '🌍 World', icon: '���️' },
            { id: 'cities', label: '🏙️ Cities', icon: '🌆' },
            { id: 'inventory', label: '🎒 Inventory', icon: '📦' },
            { id: 'equipment', label: '👕 Equipment', icon: '👗' },
            { id: 'marketplace', label: '🏪 Marketplace', icon: '💰' },
            { id: 'properties', label: '🏠 Properties', icon: '🏢' },
            { id: 'banking', label: '🏦 Banking', icon: '💳' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => setShowCharacterCustomizer(!showCharacterCustomizer)}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 whitespace-nowrap transition-colors"
          >
            👤 Customize
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'world' && (
            <GameWorld 
              character={character} 
              onCombat={handleCombat}
              combatActive={combatActive}
              onPositionUpdate={(x, y, location) => {
                setCharacter(prev => ({ ...prev, position_x: x, position_y: y, current_location: location }))
              }}
            />
          )}

          {activeTab === 'inventory' && (
            <GameInventory
              character={character}
              inventory={inventory}
              onInventoryUpdate={handleInventoryUpdate}
            />
          )}

          {activeTab === 'cities' && character && (
            <div className="space-y-6">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">🌍 Philippines World Map</h2>
                <p className="text-slate-400 mb-4">Explore major cities across the Philippines. Click on cities to manage them or build new ones.</p>
                <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700" style={{ height: '600px' }}>
                  <CityMap userId={userId} onCitySelect={setSelectedCity} />
                </div>
              </div>
              {selectedCity && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-2">{selectedCity.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm">Population</p>
                      <p className="text-2xl font-bold text-blue-400">{(selectedCity.population || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Budget</p>
                      <p className="text-2xl font-bold text-emerald-400">₱{(selectedCity.budget || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Happiness</p>
                      <p className="text-2xl font-bold text-yellow-400">{Math.floor(selectedCity.happiness || 0)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Region</p>
                      <p className="text-2xl font-bold text-purple-400">{selectedCity.region || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'equipment' && character && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Equipment</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {['head', 'body', 'legs', 'feet', 'right_hand', 'left_hand', 'necklace', 'backpack'].map(slot => {
                  const equipped = equipment.find(e => e.equipment_slot === slot)
                  return (
                    <div key={slot} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                      <p className="text-xs text-slate-400 uppercase mb-2">{slot.replace('_', ' ')}</p>
                      {equipped ? (
                        <div>
                          <p className="font-bold text-sm">{equipped.game_items?.name}</p>
                          <p className="text-xs text-slate-400">{equipped.game_items?.brand}</p>
                        </div>
                      ) : (
                        <p className="text-slate-500 text-sm">Empty</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'marketplace' && (
            <GameMarketplace character={character} onInventoryUpdate={handleInventoryUpdate} />
          )}

          {activeTab === 'properties' && (
            <GameProperties character={character} properties={properties} />
          )}

          {activeTab === 'banking' && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Banking System</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bankAccounts.map(account => (
                  <div key={account.id} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <p className="text-slate-400 text-sm uppercase">{account.account_type} Account</p>
                    <p className="text-2xl font-bold mt-2">{account.currency_code} {account.balance?.toLocaleString() || 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Interest Rate: {(account.interest_rate * 100).toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Character Customizer Modal */}
        {showCharacterCustomizer && character && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-xl font-bold">Customize Character</h3>
                <button 
                  onClick={() => setShowCharacterCustomizer(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <CharacterCustomizer 
                  character={character}
                  onUpdate={handleCharacterCustomization}
                  onClose={() => setShowCharacterCustomizer(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CharacterCustomizer({ character, onUpdate, onClose }) {
  const [appearance, setAppearance] = useState(character.appearance || {})

  const handleChange = (key, value) => {
    setAppearance(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    await onUpdate(appearance)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Gender</label>
        <select 
          value={appearance.gender || 'male'}
          onChange={(e) => handleChange('gender', e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100"
        >
          <option>male</option>
          <option>female</option>
          <option>other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Skin Tone</label>
        <div className="flex gap-2">
          {['light', 'medium', 'dark', 'olive'].map(tone => (
            <button
              key={tone}
              onClick={() => handleChange('skin_tone', tone)}
              className={`w-12 h-12 rounded-lg border-2 ${appearance.skin_tone === tone ? 'border-blue-500' : 'border-slate-600'}`}
              style={{
                backgroundColor: {
                  light: '#fdbcb4',
                  medium: '#d4a574',
                  dark: '#8b5a3c',
                  olive: '#9a7c5c'
                }[tone]
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Hair Style</label>
        <select 
          value={appearance.hair_style || 'short'}
          onChange={(e) => handleChange('hair_style', e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100"
        >
          <option>short</option>
          <option>medium</option>
          <option>long</option>
          <option>curly</option>
          <option>wavy</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Hair Color</label>
        <input 
          type="color" 
          value={appearance.hair_color || '#000000'}
          onChange={(e) => handleChange('hair_color', e.target.value)}
          className="w-full h-10 rounded cursor-pointer"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Height: {appearance.height || 175}cm</label>
        <input 
          type="range" 
          min="150" 
          max="210" 
          value={appearance.height || 175}
          onChange={(e) => handleChange('height', parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Build</label>
        <select 
          value={appearance.build || 'average'}
          onChange={(e) => handleChange('build', e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100"
        >
          <option>slim</option>
          <option>average</option>
          <option>athletic</option>
          <option>stocky</option>
        </select>
      </div>

      <div className="flex gap-2 mt-6">
        <button 
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-slate-700 text-slate-100 rounded hover:bg-slate-600"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </div>
  )
}

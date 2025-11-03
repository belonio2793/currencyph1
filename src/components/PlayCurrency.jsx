import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { gameAPI } from '../lib/gameAPI'
import { citySimulationTicker } from '../lib/citySimulationTicker'
import { useTheme } from '../lib/ThemeContext'
import CharacterCreation from './game/CharacterCreation'
import GameWorld from './game/GameWorld'
import World3DRenderer from './game/World3DRenderer'
import IsometricGameMap from './game/IsometricGameMap'
import GameSettings from './game/GameSettings'
import AvatarCreatorRPM from './game/AvatarCreatorRPM'
import CharactersPanel from './CharactersPanel'
import GameInventory from './game/GameInventory'
import GameMarketplace from './game/GameMarketplace'
import GameProperties from './game/GameProperties'
import GameCombat from './game/GameCombat'
import CityMap from './game/CityMap'
import CityManager from './game/CityManager'
import CurrencyGameUI from './game/CurrencyGameUI'
import CurrencyMarketplace from './game/CurrencyMarketplace'
import GameWork from './game/GameWork'
import PropertyInteractionModal from './game/PropertyInteractionModal'

function ThemeToggleButton({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.293 2.293a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zm2.828 2.828a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 7a3 3 0 100 6 3 3 0 000-6zm-7 8a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm.293-2.293a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414L3.414 12.5a1 1 0 010-1.414zM3 10a1 1 0 01-1-1V8a1 1 0 012 0v1a1 1 0 01-1 1zm10.657-5.657a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM10 15a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  )
}

export default function PlayCurrency({ userId, userEmail, onShowAuth }) {
  // Check if user is logged in
  if (!userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 md:p-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-blue-400 mb-4">Play Currency</h1>
            <p className="text-slate-300 text-lg mb-8">Create Your Adventure in the Philippines Economy Game</p>

            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-6 mb-8">
              <p className="text-slate-300 mb-6">
                Experience an immersive 3D world where you can customize your character, trade, build businesses, and compete in the economy.
                Login or register to begin your journey.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (typeof onShowAuth === 'function') {
                      onShowAuth('login')
                    }
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    if (typeof onShowAuth === 'function') {
                      onShowAuth('register')
                    }
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all"
                >
                  Register
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-400 mb-8">
              <div className="p-3 bg-slate-700/30 rounded border border-slate-700/50">
                <div className="text-2xl mb-2"></div>
                <div className="font-semibold text-slate-300">Create Avatar</div>
                <div className="text-xs mt-1">Design your 3D character with ReadyPlayer.me</div>
              </div>
              <div className="p-3 bg-slate-700/30 rounded border border-slate-700/50">
                <div className="text-2xl mb-2"></div>
                <div className="font-semibold text-slate-300">Explore World</div>
                <div className="text-xs mt-1">Walk around Philippine cities and meet NPCs</div>
              </div>
              <div className="p-3 bg-slate-700/30 rounded border border-slate-700/50">
                <div className="text-2xl mb-2"></div>
                <div className="font-semibold text-slate-300">Build Wealth</div>
                <div className="text-xs mt-1">Trade, invest, and manage your empire</div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              By logging in, you agree to our terms of service. Your data is secure and private.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const [character, setCharacter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('world')
  const [inventory, setInventory] = useState([])
  const [equipment, setEquipment] = useState([])
  const [properties, setProperties] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [combatActive, setCombatActive] = useState(false)
  const [combatData, setCombatData] = useState(null)
  const [claimingReward, setClaimingReward] = useState(false)
  const [selectedCity, setSelectedCity] = useState(null)
  const [showRPM, setShowRPM] = useState(false)
  const [showCityManager, setShowCityManager] = useState(false)
  const [showCharactersPanel, setShowCharactersPanel] = useState(false)
  const [openModal, setOpenModal] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showCurrencyGame, setShowCurrencyGame] = useState(false)
  const [selectedPropertyForModal, setSelectedPropertyForModal] = useState(null)
  const [mapSettings, setMapSettings] = useState({ avatarSpeed: 2, cameraSpeed: 1, zoomLevel: 1 })
  const [characterPosition, setCharacterPosition] = useState({ x: 150, y: 175, city: 'Manila' })
  const [gameThemeIsDark, setGameThemeIsDark] = useState(true)
  const world3DRef = useRef(null)

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
        // Ensure appearance data is loaded
        if (!char.appearance) {
          const appearance = await gameAPI.getCharacterAppearance(char.id)
          if (appearance) {
            char.appearance = appearance
          }
        }
        setCharacter(char)
        await loadGameData(char.id)
      }
    } catch (err) {
      console.error('Game initialization error:', err)
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

  const handleBuyProperty = async (propertyId, price) => {
    try {
      await gameAPI.buyProperty(character.id, propertyId, price)
      await loadGameData(character.id)
      const updated = await gameAPI.getCharacter(character.id)
      setCharacter(updated)
      setOpenModal(null)
    } catch (err) {
      setError('Failed to buy property: ' + err.message)
    }
  }

  const handleSellProperty = async (propertyId, salePrice) => {
    try {
      await gameAPI.sellProperty(character.id, propertyId, salePrice)
      await loadGameData(character.id)
      const updated = await gameAPI.getCharacter(character.id)
      setCharacter(updated)
      setOpenModal(null)
    } catch (err) {
      setError('Failed to sell property: ' + err.message)
    }
  }

  const handleUpgradeProperty = async (propertyId, upgradeCost) => {
    try {
      await gameAPI.upgradeProperty(propertyId, upgradeCost)
      await loadGameData(character.id)
      const updated = await gameAPI.getCharacter(character.id)
      setCharacter(updated)
    } catch (err) {
      setError('Failed to upgrade property: ' + err.message)
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

  const handleCharacterMove = (position) => {
    setCharacterPosition(position)
    if (character) {
      character.current_location = position.city
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-400 mb-4">Play Currency</div>
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
            <div className="flex items-center gap-4">
              <div>
                <h1
                  onClick={() => setShowCharactersPanel(true)}
                  className="text-3xl font-bold text-blue-400 cursor-pointer hover:text-blue-300 transition-colors"
                  title="Click to open characters panel"
                >
                  {character.name}
                </h1>
                <p className="text-slate-400 text-sm">Level {character.level} • {character.current_location} {character.home_city && character.home_city !== character.current_location ? `(Home: ${character.home_city})` : ''}</p>
              </div>
              <button
                onClick={() => setShowRPM(true)}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm font-medium whitespace-nowrap"
                title="Edit your character avatar"
              >
                Edit Avatar
              </button>
            </div>
            <div className="flex items-center gap-8">
              <button
                onClick={handleDailyReward}
                disabled={claimingReward}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded text-white font-medium"
              >
                {claimingReward ? 'Claiming...' : 'Claim Daily Reward'}
              </button>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Total Wealth</p>
                <p className="text-2xl font-bold text-yellow-400">P{character.money?.toLocaleString() || 0}</p>
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

      {/* Characters Panel */}
      {showCharactersPanel && (
        <CharactersPanel userId={userId} currentCharacter={character} onSelectCharacter={(c) => { setCharacter(c); setShowCharactersPanel(false); loadGameData(c.id) }} onClose={() => setShowCharactersPanel(false)} />
      )}

      {/* Main Content */}
      <div className={`${gameThemeIsDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
        {/* World View - Default Main Display */}
        {character && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden mb-6">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-100">Game World</h2>
                <p className="text-xs text-slate-400 mt-1">Interactive isometric map view. Click on properties to manage your investments.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpenModal('properties')}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm font-medium whitespace-nowrap"
                  title="View your properties"
                >
                  My Properties
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium whitespace-nowrap"
                  title="Open camera and game settings"
                >
                  Settings
                </button>
                <ThemeToggleButton isDark={gameThemeIsDark} onToggle={() => setGameThemeIsDark(!gameThemeIsDark)} />
              </div>
            </div>
            <div style={{ height: '600px' }}>
              <IsometricGameMap
                properties={properties}
                character={character}
                city={character.current_location || character.home_city || 'Manila'}
                onPropertyClick={(property) => {
                  setSelectedPropertyForModal(property)
                  setOpenModal('property-detail')
                }}
                mapSettings={mapSettings}
                onCharacterMove={handleCharacterMove}
              />
            </div>
          </div>
        )}

        {/* Navigation Tabs for Modals */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setShowCurrencyGame(!showCurrencyGame)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors font-bold ${
              showCurrencyGame
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Currency Game
          </button>
          {[
            { id: 'cities', label: 'Cities' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'equipment', label: 'Equipment' },
            { id: 'marketplace', label: 'Marketplace' },
            { id: 'properties', label: 'Properties' },
            { id: 'banking', label: 'Banking' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setOpenModal(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                openModal === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Currency Game Panel */}
        {showCurrencyGame && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden mb-6 max-h-[600px] overflow-y-auto">
            <CurrencyGameUI
              character={character}
              world3D={world3DRef.current}
              onCharacterUpdate={(updated) => setCharacter(updated)}
            />
          </div>
        )}

        {/* Property Detail Modal from Map */}
        {openModal === 'property-detail' && selectedPropertyForModal && (
          <PropertyInteractionModal
            property={selectedPropertyForModal}
            character={character}
            isOpen={true}
            onClose={() => {
              setOpenModal(null)
              setSelectedPropertyForModal(null)
            }}
            onBuy={handleBuyProperty}
            onSell={handleSellProperty}
            onUpgrade={handleUpgradeProperty}
          />
        )}

        {/* Modal for tabs */}
        {openModal && openModal !== 'property-detail' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-2xl font-bold">
                  {openModal === 'cities' && 'Cities'}
                  {openModal === 'inventory' && 'Inventory'}
                  {openModal === 'equipment' && 'Equipment'}
                  {openModal === 'marketplace' && 'Marketplace'}
                  {openModal === 'properties' && 'Properties'}
                  {openModal === 'banking' && 'Banking'}
                </h3>
                <button onClick={() => setOpenModal(null)} className="text-slate-400 hover:text-slate-200">X</button>
              </div>
              <div className="p-6">
                {openModal === 'inventory' && (
                  <GameInventory character={character} inventory={inventory} onInventoryUpdate={handleInventoryUpdate} />
                )}

                {openModal === 'cities' && (
                  <div className="space-y-6">
                    <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700" style={{ height: '600px' }}>
                      <CityMap userId={userId} onCitySelect={setSelectedCity} />
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
                            <p className="text-2xl font-bold text-emerald-400">P{(selectedCity.budget || 0).toLocaleString()}</p>
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

                {openModal === 'equipment' && (
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

                {openModal === 'marketplace' && (
                  <CurrencyMarketplace
                    character={character}
                    onInventoryUpdate={handleInventoryUpdate}
                    onListingCreated={() => loadGameData(character.id)}
                    onPurchaseComplete={() => setCharacter({...character, money: character.money})}
                  />
                )}

                {openModal === 'properties' && (
                  <GameProperties character={character} properties={properties} />
                )}

                {openModal === 'banking' && (
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

                <div className="mt-6 flex gap-2 justify-end">
                  <button onClick={() => setOpenModal(null)} className="px-4 py-2 bg-slate-700 text-slate-100 rounded hover:bg-slate-600">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>
    {showRPM && (
      <AvatarCreatorRPM
        open={true}
        onClose={()=>setShowRPM(false)}
        characterId={character.id}
        userId={userId}
        userEmail={userEmail}
        onSaved={async (updatedChar) => {
          try {
            // Make sure we have the full character data with appearance
            if (updatedChar && updatedChar.appearance) {
              setCharacter(updatedChar)
            } else {
              // Fallback: reload character from database to ensure avatar is persisted
              const reloadedChar = await gameAPI.getCharacter(userId)
              if (reloadedChar) {
                setCharacter(reloadedChar)
              }
            }
            setShowRPM(false)
          } catch(e) {
            console.warn('Avatar save handler error', e)
          }
        }}
      />
    )}

    {/* Game Settings Modal */}
    {showSettings && (
      <GameSettings
        world3D={world3DRef.current}
        onClose={() => setShowSettings(false)}
        mapSettings={mapSettings}
        onMapSettingsChange={setMapSettings}
      />
    )}
    </div>
  )
}

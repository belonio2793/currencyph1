import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { CurrencyGameEngine } from '../../lib/currencyGameEngine'
import PropertyInteractionModal from './PropertyInteractionModal'
import GameWork from './GameWork'

export default function CurrencyGameUI({ character, world3D, onCharacterUpdate }) {
  const [gameEngine, setGameEngine] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [properties, setProperties] = useState([])
  const [totalDailyIncome, setTotalDailyIncome] = useState(0)
  const [loading, setLoading] = useState(true)
  const [characterData, setCharacterData] = useState(character)

  const engineRef = useRef(null)

  useEffect(() => {
    if (!character) return

    const engine = new CurrencyGameEngine(character.id)
    engineRef.current = engine
    setGameEngine(engine)

    const loadData = async () => {
      try {
        setLoading(true)
        const props = await engine.loadProperties(character.id)
        setProperties(props)
        setTotalDailyIncome(engine.getTotalDailyIncome())

        engine.startIncomeGeneration(character.id)
      } catch (err) {
        console.error('Failed to load game data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    return () => {
      if (engineRef.current) {
        engineRef.current.destroy()
      }
    }
  }, [character])

  useEffect(() => {
    if (!world3D) return
    world3D.setPropertyClickHandler((property) => {
      setSelectedProperty(property)
      setActiveTab('property')
    })
  }, [world3D])

  const handleBuyProperty = async (propertyId, price) => {
    try {
      const updatedChar = await gameEngine.loadCharacter(character.id)
      if (!updatedChar) throw new Error('Failed to load character')

      if ((updatedChar.money || 0) < price) {
        throw new Error('Insufficient funds')
      }

      const newProperty = await gameEngine.purchaseProperty(character.id, {
        property_type: selectedProperty.property_type || 'shop',
        location_x: selectedProperty.location_x || 0,
        location_y: selectedProperty.location_y || 0,
        province: selectedProperty.province || 'Manila',
        city: selectedProperty.city || 'Manila',
        name: selectedProperty.name || 'New Property',
        description: selectedProperty.description || '',
        purchase_price: price,
        revenue_per_day: selectedProperty.revenue_per_day || 100
      })

      const props = await gameEngine.loadProperties(character.id)
      setProperties(props)
      setTotalDailyIncome(gameEngine.getTotalDailyIncome())
      setSelectedProperty(null)

      if (onCharacterUpdate) {
        const updatedCharData = await gameEngine.loadCharacter(character.id)
        setCharacterData(updatedCharData)
        onCharacterUpdate(updatedCharData)
      }
    } catch (err) {
      console.error('Purchase failed:', err)
      throw err
    }
  }

  const handleSellProperty = async (propertyId, salePrice) => {
    try {
      await gameEngine.sellProperty(character.id, propertyId, salePrice)

      const props = await gameEngine.loadProperties(character.id)
      setProperties(props)
      setTotalDailyIncome(gameEngine.getTotalDailyIncome())
      setSelectedProperty(null)

      if (onCharacterUpdate) {
        const updatedCharData = await gameEngine.loadCharacter(character.id)
        setCharacterData(updatedCharData)
        onCharacterUpdate(updatedCharData)
      }
    } catch (err) {
      console.error('Sale failed:', err)
      throw err
    }
  }

  const handleUpgradeProperty = async (propertyId, upgradeCost) => {
    try {
      const updatedChar = await gameEngine.loadCharacter(character.id)
      if ((updatedChar.money || 0) < upgradeCost) {
        throw new Error('Insufficient funds for upgrade')
      }

      await supabase
        .from('game_characters')
        .update({ money: (updatedChar.money || 0) - upgradeCost })
        .eq('id', character.id)

      const upgraded = await gameEngine.upgradeProperty(propertyId, upgradeCost)

      const props = await gameEngine.loadProperties(character.id)
      setProperties(props)
      setTotalDailyIncome(gameEngine.getTotalDailyIncome())

      if (selectedProperty && selectedProperty.id === propertyId) {
        setSelectedProperty(upgraded)
      }

      if (onCharacterUpdate) {
        const updatedCharData = await gameEngine.loadCharacter(character.id)
        setCharacterData(updatedCharData)
        onCharacterUpdate(updatedCharData)
      }
    } catch (err) {
      console.error('Upgrade failed:', err)
      throw err
    }
  }

  const handleEarnings = async (amount) => {
    if (onCharacterUpdate) {
      const updatedCharData = await gameEngine.loadCharacter(character.id)
      setCharacterData(updatedCharData)
      onCharacterUpdate(updatedCharData)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        <div className="text-center">
          <p className="text-xl mb-4">Loading Currency Game...</p>
          <div className="animate-spin text-4xl">💰</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header with balance */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">💰 Currency Game</h1>
            <p className="text-blue-100 text-sm">{characterData?.character_name || 'Player'}</p>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm">Balance</p>
            <p className="text-3xl font-bold text-yellow-300">₱{(characterData?.money || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700 bg-slate-800 overflow-x-auto flex">
        {['overview', 'properties', 'work', 'property'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'overview' && '📊 Overview'}
            {tab === 'properties' && '🏠 Properties'}
            {tab === 'work' && '💼 Work'}
            {tab === 'property' && '📍 Property Details'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Income Summary */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4">���� Income Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700 rounded p-4">
                  <p className="text-slate-400 text-sm mb-2">Daily Income</p>
                  <p className="text-3xl font-bold text-green-400">₱{Math.floor(totalDailyIncome).toLocaleString()}</p>
                </div>
                <div className="bg-slate-700 rounded p-4">
                  <p className="text-slate-400 text-sm mb-2">Monthly Income</p>
                  <p className="text-3xl font-bold text-green-400">₱{Math.floor(totalDailyIncome * 30).toLocaleString()}</p>
                </div>
                <div className="bg-slate-700 rounded p-4">
                  <p className="text-slate-400 text-sm mb-2">Annual Income</p>
                  <p className="text-3xl font-bold text-green-400">₱{Math.floor(totalDailyIncome * 365).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Properties Summary */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4">🏘️ Properties Portfolio</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700 rounded p-4">
                  <p className="text-slate-400 text-sm mb-2">Total Properties</p>
                  <p className="text-3xl font-bold text-blue-400">{properties.length}</p>
                </div>
                <div className="bg-slate-700 rounded p-4">
                  <p className="text-slate-400 text-sm mb-2">Total Value</p>
                  <p className="text-3xl font-bold text-yellow-400">
                    ₱{properties.reduce((sum, p) => sum + (p.current_value || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-700 rounded p-4">
                  <p className="text-slate-400 text-sm mb-2">Average ROI</p>
                  <p className="text-3xl font-bold text-purple-400">
                    {(properties.length > 0
                      ? properties.reduce((sum, p) => sum + (((p.revenue_per_day * 365) / (p.current_value || 1)) * 100), 0) / properties.length
                      : 0
                    ).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4">📈 Game Stats</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-700 rounded p-4 text-center">
                  <p className="text-slate-400 text-xs mb-1">Level</p>
                  <p className="text-2xl font-bold text-blue-400">{characterData?.level || 1}</p>
                </div>
                <div className="bg-slate-700 rounded p-4 text-center">
                  <p className="text-slate-400 text-xs mb-1">Experience</p>
                  <p className="text-2xl font-bold text-purple-400">{characterData?.experience || 0}</p>
                </div>
                <div className="bg-slate-700 rounded p-4 text-center">
                  <p className="text-slate-400 text-xs mb-1">Energy</p>
                  <p className="text-2xl font-bold text-green-400">{characterData?.energy || 100}/100</p>
                </div>
                <div className="bg-slate-700 rounded p-4 text-center">
                  <p className="text-slate-400 text-xs mb-1">Location</p>
                  <p className="text-sm font-bold text-yellow-400">{characterData?.current_location || 'Manila'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">🏠 Your Properties</h2>
            {properties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map(prop => (
                  <div
                    key={prop.id}
                    className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedProperty(prop)
                      setActiveTab('property')
                    }}
                  >
                    <p className="text-3xl mb-2">🏘️</p>
                    <h3 className="font-bold text-white mb-2">{prop.name}</h3>
                    <p className="text-slate-400 text-sm mb-3">{prop.city}, {prop.province}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Value</span>
                        <span className="text-yellow-400 font-bold">₱{(prop.current_value || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Daily Revenue</span>
                        <span className="text-green-400 font-bold">₱{(prop.revenue_per_day || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
                <p className="text-slate-400 text-lg">No properties yet. Go work and earn money to buy properties!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'work' && (
          <GameWork character={characterData} onEarnings={handleEarnings} />
        )}

        {activeTab === 'property' && selectedProperty && (
          <PropertyInteractionModal
            property={selectedProperty}
            character={characterData}
            isOpen={true}
            onClose={() => {
              setSelectedProperty(null)
              setActiveTab('overview')
            }}
            onBuy={handleBuyProperty}
            onSell={handleSellProperty}
            onUpgrade={handleUpgradeProperty}
          />
        )}
      </div>
    </div>
  )
}

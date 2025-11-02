import React, { useState, useEffect } from 'react'
import { CitySimulation, saveCityToDatabase } from '../../lib/citySimulation'
import CityStreetView from './CityStreetView'

export default function CityManager({ city, onUpdate, onClose }) {
  const [cityState, setCityState] = useState(city)
  const [simulation, setSimulation] = useState(new CitySimulation(city))
  const [activeTab, setActiveTab] = useState('overview')
  const [simulationRunning, setSimulationRunning] = useState(false)
  const [monthsPassed, setMonthsPassed] = useState(0)

  useEffect(() => {
    const sim = new CitySimulation(city)
    setSimulation(sim)
    setCityState(city)
  }, [city])

  const runSimulation = () => {
    if (simulationRunning) return

    setSimulationRunning(true)
    let months = 0

    const interval = setInterval(() => {
      months++
      const updated = simulation.tick()
      setCityState({ ...updated })

      if (months >= 12) {
        clearInterval(interval)
        setSimulationRunning(false)
        setMonthsPassed(0)
        onUpdate && onUpdate(updated)
      } else {
        setMonthsPassed(months)
      }
    }, 100)

    return () => clearInterval(interval)
  }

  const buildZone = (type) => {
    const success = simulation.addZone(type)
    if (success) {
      setCityState({ ...simulation.city })
      onUpdate && onUpdate(simulation.city)
    } else {
      alert(`Insufficient funds to build ${type}`)
    }
  }

  const buildRoads = () => {
    const success = simulation.buildRoads(1)
    if (success) {
      setCityState({ ...simulation.city })
      onUpdate && onUpdate(simulation.city)
    } else {
      alert('Insufficient funds to build roads')
    }
  }

  const setTaxRate = (rate) => {
    simulation.setTaxRate(rate)
    setCityState({ ...simulation.city })
    onUpdate && onUpdate(simulation.city)
  }

  const StatBar = ({ label, value, max = 100, color = 'blue' }) => {
    const percentage = (value / max) * 100
    let barColor = 'bg-blue-500'
    
    if (color === 'happiness') {
      if (value >= 75) barColor = 'bg-green-500'
      else if (value >= 50) barColor = 'bg-yellow-500'
      else barColor = 'bg-red-500'
    } else if (color === 'budget') {
      if (value >= 1000000) barColor = 'bg-green-500'
      else if (value >= 100000) barColor = 'bg-blue-500'
      else barColor = 'bg-red-500'
    } else if (color === 'pollution') {
      if (value <= 30) barColor = 'bg-green-500'
      else if (value <= 70) barColor = 'bg-yellow-500'
      else barColor = 'bg-red-500'
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">{label}</span>
          <span className="text-slate-400 font-mono">{Math.floor(value)}{max !== 100 ? '' : '%'}</span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, percentage)}%` }}></div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">{cityState.name}</h2>
            <p className="text-sm text-slate-400">City Manager</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runSimulation}
              disabled={simulationRunning}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded text-sm"
            >
              {simulationRunning ? `Running... ${monthsPassed}/12` : 'Simulate Year'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-700 px-4">
          {['overview', 'zones', 'budget', 'stats'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700 p-4 rounded">
                  <div className="text-sm text-slate-400">Population</div>
                  <div className="text-2xl font-bold text-slate-100">{cityState.population.toLocaleString()}</div>
                </div>
                <div className="bg-slate-700 p-4 rounded">
                  <div className="text-sm text-slate-400">Budget</div>
                  <div className="text-2xl font-bold text-slate-100">₱{(cityState.budget / 1000000).toFixed(1)}M</div>
                </div>
                <div className="bg-slate-700 p-4 rounded">
                  <div className="text-sm text-slate-400">Monthly Revenue</div>
                  <div className="text-xl font-bold text-green-400">+₱{cityState.monthlyRevenue.toLocaleString()}</div>
                </div>
                <div className="bg-slate-700 p-4 rounded">
                  <div className="text-sm text-slate-400">Monthly Expense</div>
                  <div className="text-xl font-bold text-red-400">-₱{cityState.monthlyExpense.toLocaleString()}</div>
                </div>
              </div>

              <div className="space-y-3">
                <StatBar label="Happiness" value={cityState.happiness} color="happiness" />
                <StatBar label="Employment" value={cityState.employment} color="blue" />
                <StatBar label="Pollution" value={cityState.pollution} color="pollution" />
                <StatBar label="Crime Rate" value={cityState.crime} color="blue" />
              </div>
            </div>
          )}

          {activeTab === 'zones' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700 p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Residential Zones</span>
                    <span className="text-sm font-bold text-slate-100">{cityState.residentialZones}</span>
                  </div>
                  <button
                    onClick={() => buildZone('residential')}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                  >
                    Build (₱100K)
                  </button>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Commercial Zones</span>
                    <span className="text-sm font-bold text-slate-100">{cityState.commercialZones}</span>
                  </div>
                  <button
                    onClick={() => buildZone('commercial')}
                    className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm"
                  >
                    Build (₱150K)
                  </button>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Industrial Zones</span>
                    <span className="text-sm font-bold text-slate-100">{cityState.industrialZones}</span>
                  </div>
                  <button
                    onClick={() => buildZone('industrial')}
                    className="w-full px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                  >
                    Build (₱200K)
                  </button>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Parks</span>
                    <span className="text-sm font-bold text-slate-100">{cityState.parks}</span>
                  </div>
                  <button
                    onClick={() => buildZone('park')}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                  >
                    Build (₱50K)
                  </button>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Hospitals</span>
                    <span className="text-sm font-bold text-slate-100">{cityState.hospitals}</span>
                  </div>
                  <button
                    onClick={() => buildZone('hospital')}
                    className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                  >
                    Build (₱500K)
                  </button>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Schools</span>
                    <span className="text-sm font-bold text-slate-100">{cityState.schools}</span>
                  </div>
                  <button
                    onClick={() => buildZone('school')}
                    className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                  >
                    Build (₱300K)
                  </button>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Power Plants</span>
                    <span className="text-sm font-bold text-slate-100">{cityState.powerPlants}</span>
                  </div>
                  <button
                    onClick={() => buildZone('powerplant')}
                    className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
                  >
                    Build (₱1M)
                  </button>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Roads</span>
                    <span className="text-sm font-bold text-slate-100">{cityState.roads}</span>
                  </div>
                  <button
                    onClick={buildRoads}
                    className="w-full px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
                  >
                    Build (₱10K)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'budget' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Tax Rate: {Math.round(cityState.taxRate * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={Math.round(cityState.taxRate * 100)}
                    onChange={(e) => setTaxRate(parseInt(e.target.value) / 100)}
                    className="w-full"
                  />
                  <div className="text-xs text-slate-400 mt-1">Adjust tax rate (0% - 20%)</div>
                </div>
              </div>

              <div className="bg-slate-700 p-4 rounded space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Income Sources</span>
                  <span className="text-green-400 font-mono">₱{cityState.monthlyRevenue.toLocaleString()}/mo</span>
                </div>
                <div className="text-xs text-slate-400">Tax from {cityState.population.toLocaleString()} residents</div>
              </div>

              <div className="bg-slate-700 p-4 rounded space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Operating Costs</span>
                  <span className="text-red-400 font-mono">₱{cityState.monthlyExpense.toLocaleString()}/mo</span>
                </div>
                <div className="text-xs text-slate-400">Infrastructure maintenance + services</div>
              </div>

              <div className="bg-slate-700 p-4 rounded space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-100">Net Balance</span>
                  <span className={cityState.monthlyRevenue - cityState.monthlyExpense >= 0 ? 'text-green-400' : 'text-red-400'}>
                    ₱{(cityState.monthlyRevenue - cityState.monthlyExpense).toLocaleString()}/mo
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700 p-4 rounded">
                  <div className="text-sm text-slate-400 mb-2">Education Level</div>
                  <div className="text-2xl font-bold text-slate-100">{Math.floor(cityState.education)}%</div>
                  <div className="text-xs text-slate-400 mt-1">Schools: {cityState.schools}</div>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="text-sm text-slate-400 mb-2">Health Quality</div>
                  <div className="text-2xl font-bold text-slate-100">{Math.floor(cityState.health)}%</div>
                  <div className="text-xs text-slate-400 mt-1">Hospitals: {cityState.hospitals}</div>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="text-sm text-slate-400 mb-2">Electricity</div>
                  <div className="text-2xl font-bold text-slate-100">{Math.floor(cityState.electricity)}%</div>
                  <div className="text-xs text-slate-400 mt-1">Power Plants: {cityState.powerPlants}</div>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="text-sm text-slate-400 mb-2">Water System</div>
                  <div className="text-2xl font-bold text-slate-100">{Math.floor(cityState.water)}%</div>
                  <div className="text-xs text-slate-400 mt-1">Capacity: {cityState.residentialZones * 3}%</div>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="text-sm text-slate-400 mb-2">Infrastructure</div>
                  <div className="text-2xl font-bold text-slate-100">{Math.floor(cityState.infrastructure)}%</div>
                  <div className="text-xs text-slate-400 mt-1">Roads: {cityState.roads} units</div>
                </div>

                <div className="bg-slate-700 p-4 rounded">
                  <div className="text-sm text-slate-400 mb-2">Sewage System</div>
                  <div className="text-2xl font-bold text-slate-100">{Math.floor(cityState.sewage)}%</div>
                  <div className="text-xs text-slate-400 mt-1">Coverage: {Math.floor((cityState.residentialZones / 20) * 100)}%</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

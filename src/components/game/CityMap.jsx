import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CitySimulation, saveCityToDatabase, loadCitiesForUser } from '../../lib/citySimulation'
import CityIsometric from './CityIsometric'

const PHILIPPINES_CENTER = [12.8797, 121.7740]
const PHILIPPINES_BOUNDS = [[4.6724, 116.1196], [20.6300, 128.3154]]

const MAJOR_CITIES = {
  'Manila': { lat: 14.5994, lng: 120.9842, region: 'NCR', population: 1780148 },
  'Quezon City': { lat: 14.6349, lng: 121.0388, region: 'NCR', population: 2932771 },
  'Cebu': { lat: 10.3157, lng: 123.8854, region: 'Cebu', population: 866171 },
  'Davao': { lat: 7.1315, lng: 125.6521, region: 'Davao', population: 1632991 },
  'Cagayan de Oro': { lat: 8.4865, lng: 124.6467, region: 'Misamis', population: 675817 },
  'Makati': { lat: 14.5547, lng: 121.0244, region: 'NCR', population: 592846 },
  'Iloilo': { lat: 10.6918, lng: 122.5637, region: 'Panay', population: 446413 },
  'Baguio': { lat: 16.4023, lng: 120.5960, region: 'Cordillera', population: 345366 },
  'Bacolod': { lat: 10.3906, lng: 122.9806, region: 'Negros', population: 451822 },
  'Cavite': { lat: 14.3568, lng: 120.8853, region: 'Cavite', population: 1447547 },
  'Tagaytay': { lat: 14.0504, lng: 121.2120, region: 'Cavite', population: 273959 },
  'Batangas': { lat: 13.7568, lng: 121.1858, region: 'Calabarzon', population: 305380 }
}

export default function CityMap({ userId, onCitySelect }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newCityName, setNewCityName] = useState('')
  const [newCityLocation, setNewCityLocation] = useState('Manila')
  const [mapMode, setMapMode] = useState('2d') // 2d or 3d
  const markersRef = useRef({})
  const citiesDataRef = useRef(new Map())

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return

    // Create map
    map.current = L.map(mapContainer.current).setView(PHILIPPINES_CENTER, 6)

    // Add tiles (MapTiler with OSM fallback)
    const MAPTILER_KEY = 'Epg2ZBCTb2mrWoiUKQRL'
    const mtUrl = `https://api.maptiler.com/tiles/streets/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
    let tileLayer = L.tileLayer(mtUrl, { maxZoom: 19, attribution: '© MapTiler © OpenStreetMap contributors' })

    tileLayer.addTo(map.current)

    // Fallback to OSM if tiles fail
    tileLayer.on('tileerror', () => {
      try {
        map.current.removeLayer(tileLayer)
      } catch (e) {}
      tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      })
      tileLayer.addTo(map.current)
    })

    // When tiles load, mark loading false
    tileLayer.on('load', () => setLoading(false))

    // Set max bounds
    map.current.setMaxBounds(PHILIPPINES_BOUNDS)

    // Load cities
    loadUserCities()

    return () => {
      if (map.current) map.current.remove()
    }
  }, [])

  const loadUserCities = async () => {
    try {
      const userCities = await loadCitiesForUser(userId)
      setCities(userCities)
      userCities.forEach(city => {
        citiesDataRef.current.set(city.city_id, city)
      })
      drawCities(userCities)
    } catch (err) {
      console.error('Failed to load cities:', err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const drawCities = (citiesToDraw) => {
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove())
    markersRef.current = {}

    citiesToDraw.forEach(city => {
      const cityInfo = MAJOR_CITIES[city.name]
      if (!cityInfo) return

      const color = getHealthColor(city.happiness)
      const popSize = Math.max(15, Math.min(40, (city.population / 100000) * 15))

      const marker = L.circleMarker([cityInfo.lat, cityInfo.lng], {
        radius: popSize,
        fillColor: color,
        color: '#000',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.7
      })
        .bindPopup(`
          <div class="p-2 text-sm">
            <strong>${city.name}</strong>
            <div>Population: ${(city.population || 0).toLocaleString()}</div>
            <div>Budget: ₱${(city.budget || 0).toLocaleString()}</div>
            <div>Happiness: ${Math.floor(city.happiness || 0)}%</div>
            <button onclick="window.selectCity('${city.city_id}')" class="mt-2 px-2 py-1 bg-blue-500 text-white rounded text-xs">Manage</button>
          </div>
        `)
        .addTo(map.current)

      markersRef.current[city.city_id] = marker

      marker.on('click', () => {
        setSelectedCity(city)
        if (onCitySelect) onCitySelect(city)
      })
    })

    // Add location pins for potential cities
    Object.entries(MAJOR_CITIES).forEach(([name, info]) => {
      const exists = citiesToDraw.find(c => c.name === name)
      if (!exists) {
        L.marker([info.lat, info.lng], {
          icon: L.icon({
            iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBmaWxsPSIjOTlhIi8+PC9zdmc+',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        })
          .bindPopup(`<div class="text-sm"><strong>${name}</strong><br/>Region: ${info.region}<br/><button onclick="window.createCityHere('${name}')" class="mt-1 px-2 py-1 bg-green-500 text-white rounded text-xs">Build Here</button></div>`)
          .addTo(map.current)
      }
    })
  }

  const getHealthColor = (happiness) => {
    if (happiness >= 80) return '#22c55e'
    if (happiness >= 60) return '#84cc16'
    if (happiness >= 40) return '#f59e0b'
    if (happiness >= 20) return '#ef4444'
    return '#dc2626'
  }

  const createCity = async (name, location) => {
    try {
      const cityInfo = MAJOR_CITIES[location]
      if (!cityInfo) {
        alert('Invalid location')
        return
      }

      const newCity = {
        ...CitySimulation.DEFAULT_CITY,
        id: `city_${Date.now()}`,
        name: name,
        x: cityInfo.lat,
        y: cityInfo.lng,
        population: 50000
      }

      await saveCityToDatabase(userId, newCity)
      
      setCities([...cities, newCity])
      citiesDataRef.current.set(newCity.id, newCity)
      drawCities([...cities, newCity])
      
      setShowCreate(false)
      setNewCityName('')
      setNewCityLocation('Manila')
    } catch (err) {
      console.error('Failed to create city:', err)
      alert('Failed to create city')
    }
  }

  // Make functions available globally for popup buttons
  useEffect(() => {
    window.selectCity = (cityId) => {
      const city = cities.find(c => c.city_id === cityId)
      if (city) {
        setSelectedCity(city)
        if (onCitySelect) onCitySelect(city)
      }
    }

    window.createCityHere = (location) => {
      setNewCityLocation(location)
      setShowCreate(true)
    }

    return () => {
      delete window.selectCity
      delete window.createCityHere
    }
  }, [cities])

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center">Loading map...</div>
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-900">
      {/* Map Controls */}
      <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMapMode('2d')}
            className={`px-3 py-1 rounded text-sm ${mapMode === '2d' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            2D Map
          </button>
          <button
            onClick={() => setMapMode('3d')}
            className={`px-3 py-1 rounded text-sm ${mapMode === '3d' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            3D View
          </button>
        </div>

        <div className="text-sm text-slate-300">
          <span className="text-green-400">● Active: {cities.length}</span>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
        >
          + New City
        </button>
      </div>

      {/* Map Container */}
      {mapMode === '2d' ? (
        <div ref={mapContainer} className="flex-1" style={{ height: 'calc(100% - 60px)' }} />
      ) : (
        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-900">
          {selectedCity ? (
            <CityIsometric city={selectedCity} />
          ) : (
            <div className="text-slate-400 text-center">
              <p className="text-lg mb-2">Select a city to view in 3D</p>
              <p className="text-sm">Click on a city marker to see its isometric view</p>
            </div>
          )}
        </div>
      )}

      {/* Create City Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Create New City</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">City Name</label>
                <input
                  type="text"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  placeholder="My City"
                  className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Location</label>
                <select
                  value={newCityLocation}
                  onChange={(e) => setNewCityLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-slate-100"
                >
                  {Object.keys(MAJOR_CITIES).map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  onClick={() => createCity(newCityName || 'My City', newCityLocation)}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState } from 'react'

export default function CharacterCreation({ onCharacterCreated, userId }) {
  const [name, setName] = useState('')
  const [homeCity, setHomeCity] = useState('Manila')
  const [avatarAppearance, setAvatarAppearance] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showAvatarCreator, setShowAvatarCreator] = useState(false)

  const PHILIPPINES_CITIES = [
    { name: 'Manila', region: 'NCR', description: 'Capital city - Economic hub' },
    { name: 'Quezon City', region: 'NCR', description: 'Business district & tech hub' },
    { name: 'Cebu', region: 'Visayas', description: 'Beach paradise & commerce' },
    { name: 'Davao', region: 'Mindanao', description: 'Tropical metropolis' },
    { name: 'Cagayan de Oro', region: 'Mindanao', description: 'Adventure capital' },
    { name: 'Makati', region: 'NCR', description: 'Financial district' },
    { name: 'Iloilo', region: 'Visayas', description: 'Heritage & culture' },
    { name: 'Baguio', region: 'Cordillera', description: 'Cool highland city' },
    { name: 'Bacolod', region: 'Visayas', description: 'Sugar city & beaches' },
    { name: 'Cagayan', region: 'Cagayan', description: 'Northern frontier' }
  ]

  function handlePrepareCreate(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a character name')
      return
    }
    // Avatar optional now
    setError('')
    setError('')
    doCreate()
  }

  async function doCreate() {
    try {
      setCreating(true)
      setError('')
      await onCharacterCreated(name, avatarAppearance, homeCity)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setCreating(false)
    }
  }

  function handleAvatarExport(appearance) {
    setAvatarAppearance(appearance)
    setShowAvatarCreator(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-start justify-center p-3">
      <div className="w-full max-w-4xl mt-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 md:p-8">
          <h1 className="text-3xl md:text-4xl font-bold text-center text-blue-400 mb-2">Play Currency</h1>
          <p className="text-center text-slate-400 mb-8">Create Your Adventure — with ReadyPlayer.me</p>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handlePrepareCreate} className="space-y-6">
            {/* Character Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Character Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your character name..."
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                disabled={creating}
              />
            </div>

            {/* Home City Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Home City</label>
              <p className="text-xs text-slate-400 mb-4">Choose your home city to start your economic adventure</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {PHILIPPINES_CITIES.map(city => (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => setHomeCity(city.name)}
                    className={`text-left p-3 rounded-lg border-2 transition-colors ${
                      homeCity === city.name
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-600 bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    <p className="font-semibold text-slate-100">{city.name}</p>
                    <p className="text-xs text-slate-400">{city.region}</p>
                    <p className="text-xs text-slate-500">{city.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar Creation */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Your Avatar</label>
              <p className="text-xs text-slate-400 mb-3">
                {avatarAppearance
                  ? 'Avatar created. Click below to modify.'
                  : 'Create or customize your 3D avatar using ReadyPlayer.me'}
              </p>
              <button
                type="button"
                onClick={() => setShowAvatarCreator(true)}
                disabled={creating}
                className={`w-full px-6 py-4 rounded-lg border-2 transition-colors ${
                  avatarAppearance
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    : 'border-blue-500 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                } disabled:opacity-50 font-medium`}
              >
                {avatarAppearance ? 'Avatar Ready — Click to Modify' : 'Design Your Avatar'}
              </button>
            </div>

            {/* Create Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={creating || !avatarAppearance}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all"
              >
                {creating ? 'Creating Adventure...' : 'Begin Adventure'}
              </button>
            </div>
          </form>

          {/* Info Note */}
          <div className="mt-8 p-4 bg-yellow-600/8 border border-yellow-600/20 rounded text-yellow-100 text-sm">
            <strong className="block text-yellow-200 mb-1">Welcome to Play Currency</strong>
            <p className="text-xs text-yellow-100">
              Design your unique 3D avatar, choose your home city, and begin your economic adventure. You can always customize your appearance later!
            </p>
          </div>
        </div>
      </div>

      {/* Avatar Creator Modal */}
      <AvatarCreatorRPM
        open={showAvatarCreator}
        onClose={() => setShowAvatarCreator(false)}
        onExport={handleAvatarExport}
        userId={userId}
        showCloseButton={true}
      />
    </div>
  )
}

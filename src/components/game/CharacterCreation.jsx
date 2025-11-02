import React, { useState } from 'react'

export default function CharacterCreation({ onCharacterCreated, userId }) {
  const [name, setName] = useState('')
  const [appearance, setAppearance] = useState({
    gender: 'male',
    skin_tone: 'medium',
    hair_style: 'short',
    hair_color: '#000000',
    height: 175,
    build: 'average'
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a character name')
      return
    }

    try {
      setCreating(true)
      await onCharacterCreated(name, appearance)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleAppearanceChange = (key, value) => {
    setAppearance(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <h1 className="text-4xl font-bold text-center text-blue-400 mb-2">⚔️ Play Currency</h1>
          <p className="text-center text-slate-400 mb-8">Create Your Adventure</p>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-6">
            {/* Character Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Character Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your character name..."
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                disabled={creating}
              />
            </div>

            {/* Appearance Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-200">Customize Appearance</h3>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Gender</label>
                <div className="flex gap-3">
                  {['male', 'female', 'other'].map(gender => (
                    <button
                      key={gender}
                      type="button"
                      onClick={() => handleAppearanceChange('gender', gender)}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                        appearance.gender === gender
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {gender.charAt(0).toUpperCase() + gender.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skin Tone */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Skin Tone</label>
                <div className="flex gap-3">
                  {[
                    { name: 'light', color: '#fdbcb4' },
                    { name: 'medium', color: '#d4a574' },
                    { name: 'dark', color: '#8b5a3c' },
                    { name: 'olive', color: '#9a7c5c' }
                  ].map(tone => (
                    <button
                      key={tone.name}
                      type="button"
                      onClick={() => handleAppearanceChange('skin_tone', tone.name)}
                      className={`w-12 h-12 rounded-lg border-2 transition-all ${
                        appearance.skin_tone === tone.name
                          ? 'border-blue-500 ring-2 ring-blue-500'
                          : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: tone.color }}
                      title={tone.name}
                    />
                  ))}
                </div>
              </div>

              {/* Hair Style */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Hair Style</label>
                <select
                  value={appearance.hair_style}
                  onChange={(e) => handleAppearanceChange('hair_style', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                  <option value="curly">Curly</option>
                  <option value="wavy">Wavy</option>
                </select>
              </div>

              {/* Hair Color */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Hair Color</label>
                <input
                  type="color"
                  value={appearance.hair_color}
                  onChange={(e) => handleAppearanceChange('hair_color', e.target.value)}
                  className="w-full h-12 rounded-lg cursor-pointer border border-slate-600"
                />
              </div>

              {/* Height */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Height: {appearance.height}cm
                </label>
                <input
                  type="range"
                  min="150"
                  max="210"
                  value={appearance.height}
                  onChange={(e) => handleAppearanceChange('height', parseInt(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              {/* Build */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Build</label>
                <select
                  value={appearance.build}
                  onChange={(e) => handleAppearanceChange('build', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="slim">Slim</option>
                  <option value="average">Average</option>
                  <option value="athletic">Athletic</option>
                  <option value="stocky">Stocky</option>
                </select>
              </div>
            </div>

            {/* Create Button */}
            <button
              type="submit"
              disabled={creating}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {creating ? '⏳ Creating Adventure...' : '🎮 Begin Adventure'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

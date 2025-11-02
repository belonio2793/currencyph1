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
  const [showConfirm, setShowConfirm] = useState(false)

  const handlePrepareCreate = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a character name')
      return
    }

    // Show confirmation view with preview and Delete/Confirm options
    setError('')
    setShowConfirm(true)
  }

  const doCreate = async () => {
    try {
      setCreating(true)
      await onCharacterCreated(name, appearance)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setCreating(false)
      setShowConfirm(false)
    }
  }

  const cancelPending = () => {
    // Delete / Cancel the pending character creation
    setShowConfirm(false)
    setName('')
    setAppearance({
      gender: 'male',
      skin_tone: 'medium',
      hair_style: 'short',
      hair_color: '#000000',
      height: 175,
      build: 'average'
    })
    setError('')
  }

  const handleAppearanceChange = (key, value) => {
    // Only allow male or female for gender
    if (key === 'gender' && value !== 'male' && value !== 'female') return
    setAppearance(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 md:p-8">
          <h1 className="text-3xl md:text-4xl font-bold text-center text-blue-400 mb-2">⚔️ Play Currency</h1>
          <p className="text-center text-slate-400 mb-6 md:mb-8">Create Your Adventure</p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: Form */}
            <div className="flex-1">
              <form onSubmit={handlePrepareCreate} className="space-y-4">
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
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-200">Customize Appearance</h3>

                  {/* Gender - only male/female */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Gender</label>
                    <div className="flex gap-3">
                      {['male', 'female'].map(gender => (
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
                          className={`w-10 h-10 md:w-12 md:h-12 rounded-lg border-2 transition-all flex-shrink-0 ${
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
                      className="w-full h-10 md:h-12 rounded-lg cursor-pointer border border-slate-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Height */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Height: {appearance.height}cm</label>
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
                </div>

                {/* Create Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {creating ? '⏳ Creating Adventure...' : '🎮 Begin Adventure'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Avatar Preview */}
            <div className="w-full md:w-80 flex-shrink-0">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-col items-center">
                <AvatarPreview appearance={appearance} name={name} />
                <p className="text-slate-400 text-sm mt-3 text-center px-2">Preview updates live as you customize. Rotate your device or resize to fit.</p>
              </div>
            </div>
          </div>

          {/* Confirmation Modal/Panel */}
          {showConfirm && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-xl w-full p-6">
                <h3 className="text-xl font-bold text-slate-100 mb-3">Confirm Your Character</h3>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="bg-slate-900 p-4 rounded border border-slate-700 flex items-center justify-center">
                      <AvatarPreview appearance={appearance} name={name} large />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-300 mb-2"><span className="font-semibold">Name:</span> {name}</p>
                    <p className="text-slate-300 mb-2"><span className="font-semibold">Gender:</span> {appearance.gender}</p>
                    <p className="text-slate-300 mb-2"><span className="font-semibold">Height:</span> {appearance.height}cm</p>
                    <p className="text-slate-300 mb-2"><span className="font-semibold">Build:</span> {appearance.build}</p>

                    <div className="mt-4 flex gap-2">
                      <button onClick={doCreate} disabled={creating} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded">{creating ? 'Creating…' : 'Confirm & Create'}</button>
                      <button onClick={cancelPending} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AvatarPreview({ appearance, name = '', large = false }) {
  // Simple SVG-based avatar preview derived from appearance settings
  const size = large ? 160 : 110
  const headRadius = Math.round(size * 0.28)
  const hairHeight = appearance.hair_style === 'long' ? headRadius * 1.2 : headRadius * 0.6
  const faceColor = {
    light: '#fdbcb4',
    medium: '#d4a574',
    dark: '#8b5a3c',
    olive: '#9a7c5c'
  }[appearance.skin_tone] || '#d4a574'

  const bodyScale = appearance.build === 'slim' ? 0.85 : appearance.build === 'athletic' ? 1.05 : appearance.build === 'stocky' ? 1.2 : 1
  const heightScale = (appearance.height - 150) / 60 // 0..1

  const avatarStyle = {
    width: size,
    height: Math.round(size * (1 + heightScale * 0.25) * bodyScale)
  }

  return (
    <div className="flex flex-col items-center text-center px-2">
      <svg width={avatarStyle.width} height={avatarStyle.height} viewBox={`0 0 ${avatarStyle.width} ${avatarStyle.height}`}>
        {/* body */}
        <g transform={`translate(${avatarStyle.width / 2}, ${avatarStyle.height * 0.58}) scale(${bodyScale})`}>
          <rect x={-avatarStyle.width * 0.18} y={-avatarStyle.height * 0.12} width={avatarStyle.width * 0.36} height={avatarStyle.height * 0.36} rx="14" fill="#2b3948" />
        </g>

        {/* head */}
        <g transform={`translate(${avatarStyle.width / 2}, ${avatarStyle.height * 0.28})`}>
          <circle r={headRadius} fill={faceColor} />

          {/* hair */}
          <rect x={-headRadius - 2} y={-headRadius - hairHeight * 0.6} width={headRadius * 2 + 4} height={hairHeight} rx={hairHeight * 0.4} fill={appearance.hair_color} />

          {/* eyes */}
          <circle cx={-Math.round(headRadius * 0.35)} cy={-Math.round(headRadius * 0.1)} r={Math.max(1, Math.round(headRadius * 0.12))} fill="#111827" />
          <circle cx={Math.round(headRadius * 0.35)} cy={-Math.round(headRadius * 0.1)} r={Math.max(1, Math.round(headRadius * 0.12))} fill="#111827" />

          {/* mouth */}
          <path d={`M ${-headRadius * 0.35} ${Math.round(headRadius * 0.45)} q ${headRadius * 0.35} ${headRadius * 0.25} ${headRadius * 0.7} 0`} stroke="#7f1d1d" strokeWidth={Math.max(1, Math.round(headRadius * 0.06))} fill="none" strokeLinecap="round" />
        </g>
      </svg>

      <div className="mt-3">
        <p className="text-sm font-semibold text-slate-100 truncate max-w-[160px]">{name || 'Unnamed'}</p>
        <p className="text-xs text-slate-400">{appearance.gender === 'male' ? 'Male' : 'Female'} • {appearance.hair_style}</p>
      </div>
    </div>
  )
}

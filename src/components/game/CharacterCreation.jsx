// Extensive hairstyle definitions (real-world names)
const MALE_HAIRSTYLES = [
  'buzz_cut','crew_cut','fade','undercut','quiff','pompadour','slick_back','man_bun','top_knot','mullet','long_layers','curly_male','shag_male','comb_over','side_part'
]
const FEMALE_HAIRSTYLES = [
  'pixie','bob','lob','blunt_bob','asym_bob','long_flow','layered_long','curly_female','beach_waves','ponytail','high_ponytail','low_bun','braid','french_braid','fishtail','afro','twists'
]

import React, { useState, useMemo, useEffect } from 'react'

export default function CharacterCreation({ onCharacterCreated, userId }) {
  const [name, setName] = useState('')
  const [appearance, setAppearance] = useState({
    gender: 'male',
    skin_tone: 'medium',
    skin_color: '#d4a574',
    hair_style: 'buzz_cut',
    hair_color: '#4b2e2e',
    height: 175,
    build: 'average'
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [search, setSearch] = useState('')
  const [rgb, setRgb] = useState(() => hexToRgb(appearance.hair_color))
  const [rgbSkin, setRgbSkin] = useState(() => hexToRgb(appearance.skin_color))
  const [photoMode, setPhotoMode] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [promptText, setPromptText] = useState('')

  const hairstyles = useMemo(() => (appearance.gender === 'male' ? MALE_HAIRSTYLES : FEMALE_HAIRSTYLES), [appearance.gender])

  function handlePrepareCreate(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a character name')
      return
    }
    setError('')
    setShowConfirm(true)
  }

  async function doCreate() {
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

  function cancelPending() {
    setShowConfirm(false)
    setName('')
    const defaultAppearance = {
      gender: 'male',
      skin_tone: 'medium',
      skin_color: '#d4a574',
      hair_style: 'buzz_cut',
      hair_color: '#4b2e2e',
      height: 175,
      build: 'average'
    }
    setAppearance(defaultAppearance)
    setRgb(hexToRgb(defaultAppearance.hair_color))
    setError('')
  }

  function handleAppearanceChange(key, value) {
    if (key === 'gender' && value !== 'male' && value !== 'female') return
    // handle skin tone presets
    if (key === 'skin_tone') {
      const mapping = { light: '#fdbcb4', medium: '#d4a574', dark: '#8b5a3c', olive: '#9a7c5c' }
      const color = mapping[value] || '#d4a574'
      setAppearance(prev => ({ ...prev, skin_tone: value, skin_color: color }))
      setRgbSkin(hexToRgb(color))
      return
    }
    if (key === 'skin_color') {
      setAppearance(prev => ({ ...prev, skin_color: value }))
      setRgbSkin(hexToRgb(value))
      return
    }
    if (key === 'hair_color') {
      setAppearance(prev => ({ ...prev, hair_color: value }))
      setRgb(hexToRgb(value))
      return
    }
    setAppearance(prev => ({ ...prev, [key]: value }))
  }

  function handleRgbChange(part, val) {
    const next = { ...rgb, [part]: clamp(parseInt(val || 0), 0, 255) }
    setRgb(next)
    const hex = rgbToHex(next)
    setAppearance(prev => ({ ...prev, hair_color: hex }))
  }

  // gallery list (filtered)
  const galleryList = hairstyles.filter(s => s.includes(search.toLowerCase()))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-start justify-center p-3">
      <div className="w-full max-w-6xl mt-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 md:p-6 lg:p-8">
          <h1 className="text-3xl md:text-4xl font-bold text-center text-blue-400 mb-2">⚔️ Play Currency</h1>
          <p className="text-center text-slate-400 mb-4 md:mb-6">Create Your Adventure — pro customization</p>


          {error && (<div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>)}

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <form onSubmit={handlePrepareCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Character Name</label>
                  <input type="text" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Enter your character name..." className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" disabled={creating} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Gender</label>
                    <div className="flex gap-2">
                      {['male','female'].map(g => (
                        <button key={g} type="button" onClick={()=>handleAppearanceChange('gender', g)} className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm ${appearance.gender===g ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-slate-600 text-slate-300'}`}>{g.charAt(0).toUpperCase()+g.slice(1)}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Skin Tone</label>
                    <div className="flex gap-2 items-center mb-2">
                      {[{n:'light',c:'#fdbcb4'},{n:'medium',c:'#d4a574'},{n:'dark',c:'#8b5a3c'},{n:'olive',c:'#9a7c5c'}].map(t=> (
                        <button key={t.n} type="button" onClick={()=>handleAppearanceChange('skin_tone', t.n)} className={`w-10 h-10 rounded border-2 ${appearance.skin_tone===t.n ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-600'}`} style={{backgroundColor:t.c}} title={t.n} />
                      ))}

                      <div className="flex items-center gap-2 ml-3">
                        <input type="color" value={appearance.skin_color || '#d4a574'} onChange={(e)=>handleAppearanceChange('skin_color', e.target.value)} className="w-10 h-8 p-0 border-2 border-slate-600 rounded-md" />
                        <div className="text-xs text-slate-400">Custom</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-400">R</label>
                        <input type="number" min="0" max="255" value={rgbSkin.r} onChange={(e)=>{ const v = clamp(parseInt(e.target.value||0),0,255); setRgbSkin(prev=>({ ...prev, r: v })); handleAppearanceChange('skin_color', rgbToHex({ ...rgbSkin, r: v })) }} className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-100" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">G</label>
                        <input type="number" min="0" max="255" value={rgbSkin.g} onChange={(e)=>{ const v = clamp(parseInt(e.target.value||0),0,255); setRgbSkin(prev=>({ ...prev, g: v })); handleAppearanceChange('skin_color', rgbToHex({ ...rgbSkin, g: v })) }} className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-100" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">B</label>
                        <input type="number" min="0" max="255" value={rgbSkin.b} onChange={(e)=>{ const v = clamp(parseInt(e.target.value||0),0,255); setRgbSkin(prev=>({ ...prev, b: v })); handleAppearanceChange('skin_color', rgbToHex({ ...rgbSkin, b: v })) }} className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-100" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hair row: gallery open, suggest popular quick picks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-300">Hairstyle</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={()=>setShowGallery(true)} className="px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200">Open Hairstyle Gallery</button>
                      <button type="button" onClick={()=>{ const idx = hairstyles.indexOf(appearance.hair_style); const next = hairstyles[(idx+1)%hairstyles.length]; handleAppearanceChange('hair_style', next)}} className="px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200">Cycle</button>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center flex-wrap">
                    <div className="w-12 h-12 bg-slate-900 border border-slate-700 rounded flex items-center justify-center">
                      <HairIcon styleId={appearance.hair_style} color={appearance.hair_color} gender={appearance.gender} largeIcon />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-300 font-medium truncate">{appearance.hair_style.replace('_',' ')}</div>
                      <div className="text-xs text-slate-400">Tap "Open Hairstyle Gallery" for many options</div>
                    </div>
                  </div>
                </div>

                {/* Color picks + RGB */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Hair Color</label>
                  <div className="flex gap-2 items-center mb-2">
                    {['#1b1b1b','#4b2e2e','#6b3a2a','#c09c6b','#f1c27d','#f9e0c7','#2e4b6b','#5a2f5a','#ffffff','#ff0000','#b8860b','#8b5a2b'].map(c => (
                      <button key={c} type="button" onClick={()=>handleAppearanceChange('hair_color', c)} className={`w-8 h-8 rounded-full border-2 ${appearance.hair_color===c ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-600'}`} style={{backgroundColor:c}} />
                    ))}
                    <input type="color" value={appearance.hair_color} onChange={(e)=>handleAppearanceChange('hair_color', e.target.value)} className="w-10 h-8 p-0 border-2 border-slate-600 rounded-md" />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-slate-400">R</label>
                      <input type="number" min="0" max="255" value={rgb.r} onChange={(e)=>handleRgbChange('r', e.target.value)} className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-100" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">G</label>
                      <input type="number" min="0" max="255" value={rgb.g} onChange={(e)=>handleRgbChange('g', e.target.value)} className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-100" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">B</label>
                      <input type="number" min="0" max="255" value={rgb.b} onChange={(e)=>handleRgbChange('b', e.target.value)} className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-100" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Height: {appearance.height}cm</label>
                    <input type="range" min="140" max="230" value={appearance.height} onChange={(e)=>handleAppearanceChange('height', parseInt(e.target.value))} className="w-full" />
                    <div className="flex items-center gap-2 mt-2">
                      <FeetInchesDisplay cm={appearance.height} onChange={(ft, inch) => {
                        const cm = feetInchesToCm(ft, inch)
                        handleAppearanceChange('height', cm)
                      }} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Build</label>
                    <select value={appearance.build} onChange={(e)=>handleAppearanceChange('build', e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100">
                      <option value="very_slim">Very Slim</option>
                      <option value="slim">Slim</option>
                      <option value="average">Average</option>
                      <option value="athletic">Athletic</option>
                      <option value="heavy">Heavy</option>
                      <option value="obese">Obese</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-2">Body proportions update live in preview (waist, limbs, torso).</p>
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={creating} className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50">{creating ? '⏳ Creating Adventure...' : '🎮 Begin Adventure'}</button>
                </div>
              </form>
            </div>

            <div className="w-full lg:w-96 flex-shrink-0">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-col items-center w-full">
                <div className="w-full flex items-center justify-between mb-3">
                  <div className="text-sm text-slate-200">Preview</div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">SVG</label>
                    <input type="checkbox" checked={photoMode} onChange={(e)=>setPhotoMode(e.target.checked)} className="accent-blue-500" />
                    <label className="text-xs text-slate-400">Photo</label>
                  </div>
                </div>

                <div className="w-full flex items-center justify-center mb-3">
                  {photoMode ? (
                    <div className="w-full flex flex-col items-center">
                      {photoUrl ? (
                        <img src={photoUrl} alt="avatar" className="w-full rounded-lg border border-slate-700 object-cover max-h-72" />
                      ) : (
                        <div className="w-full h-48 bg-slate-800 rounded border border-dashed border-slate-700 flex items-center justify-center text-slate-400">No photoreal image yet</div>
                      )}
                    </div>
                  ) : (
                    <AvatarPreview appearance={appearance} name={name} />
                  )}
                </div>

                <div className="w-full">
                  <label className="block text-xs text-slate-400 mb-2">Prompt (optional) — describe photoreal look, style, lighting, clothing, expression</label>
                  <textarea value={promptText} onChange={(e)=>setPromptText(e.target.value)} placeholder="e.g. studio portrait, soft window light, smiling, wearing a navy jacket" className="w-full h-20 p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 mb-3" />
                </div>

                <div className="w-full flex gap-2">
                  <button onClick={async ()=>{
                    if (!photoMode) return
                    setGenerating(true)
                    setError('')
                    try {
                      const { generatePhotorealAvatar } = await import('../../lib/imageGen.js')
                      const url = await generatePhotorealAvatar(appearance, userId || 'guest', promptText)
                      setPhotoUrl(url)
                    } catch (err) {
                      console.error(err)
                      setError('Photo generation failed: ' + (err.message || err))
                    } finally {
                      setGenerating(false)
                    }
                  }} className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50" disabled={!photoMode || generating}>
                    {generating ? 'Generating…' : 'Generate Photo'}
                  </button>
                  <button onClick={()=>{ setPhotoUrl(''); setPhotoMode(false); setPromptText('') }} className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded">Reset</button>
                </div>

                <p className="text-slate-400 text-sm mt-3 text-center px-3">Toggle between SVG preview and photorealistic composite. Use Generate Photo to create and store an image.</p>
              </div>
            </div>
          </div>

          {/* Confirm modal */}
          {showConfirm && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-xl w-full p-4 md:p-6">
                <h3 className="text-xl font-bold text-slate-100 mb-3">Confirm Your Character</h3>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <div className="bg-slate-900 p-3 rounded border border-slate-700 flex items-center justify-center"><AvatarPreview appearance={appearance} name={name} large /></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-300 mb-1"><span className="font-semibold">Name:</span> {name}</p>
                    <p className="text-slate-300 mb-1"><span className="font-semibold">Gender:</span> {appearance.gender}</p>
                    <p className="text-slate-300 mb-1"><span className="font-semibold">Height:</span> {appearance.height}cm</p>
                    <p className="text-slate-300 mb-1"><span className="font-semibold">Build:</span> {appearance.build}</p>
                    <div className="mt-3 flex gap-2">
                      <button onClick={doCreate} disabled={creating} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded">{creating ? 'Creating…' : 'Confirm & Create'}</button>
                      <button onClick={cancelPending} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gallery modal */}
          {showGallery && (
            <div className="fixed inset-0 z-60 bg-black/60 flex items-start md:items-center justify-center p-4 overflow-auto">
              <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full p-4 md:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-slate-100">Hairstyle Gallery</h4>
                  <div className="flex items-center gap-2">
                    <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search styles (e.g. bob, afro, mullet)" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
                    <button onClick={()=>setShowGallery(false)} className="px-3 py-2 bg-rose-600 text-white rounded">Close</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {galleryList.map(styleId => (
                    <button key={styleId} onClick={()=>{ handleAppearanceChange('hair_style', styleId); setShowGallery(false) }} className={`p-3 rounded-lg border ${appearance.hair_style===styleId ? 'border-blue-500 bg-slate-800' : 'border-slate-700 bg-slate-900'}`}>
                      <div className="flex items-center justify-center mb-2 h-20 w-full">
                        <HairIcon styleId={styleId} color={appearance.hair_color} gender={appearance.gender} />
                      </div>
                      <div className="text-xs text-slate-300 text-center truncate">{styleId.replace('_',' ')}</div>
                    </button>
                  ))}
                </div>

              </div>
            </div>
          )}

          {/* Disclaimer: users can always reset or change appearance later (moved to bottom) */}
          <div className="mt-6 p-3 bg-yellow-600/8 border-t border-yellow-600/20 rounded text-yellow-100 text-sm">
            <div className="max-w-7xl mx-auto px-2 py-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <strong className="block text-yellow-200">Note:</strong>
                <p className="text-xs text-yellow-100 mt-1">You can always reset or change your character's style, outfit, hairstyle, or appearance later. If a hairstyle or placement doesn't look right, use the Reset button or revisit the character editor — your character can be updated anytime.</p>
              </div>
              <div className="flex-shrink-0">
                <button onClick={cancelPending} className="px-3 py-1 bg-yellow-600 text-slate-900 rounded font-semibold">Reset Now</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function HairIcon({ styleId, color = '#333', gender, largeIcon = false }) {
  const size = largeIcon ? 44 : 28
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${size/2}, ${size/2})`}>
        {renderHairSVG(styleId, color, size/2)}
      </g>
    </svg>
  )
}

function renderHairSVG(style, color, r) {
  const h = r
  // clip so hair wraps to head circle
  const clipId = `clip_${style}`

  // helper to create a smooth back hair shape
  const backPath = (wFactor = 1.0, downOffset = 0) => `M ${-h*wFactor} ${-h*0.6+downOffset} q ${h*wFactor*0.6} ${-h*0.9} ${h*wFactor*1.6} ${-h*0.25} q ${-h*wFactor*0.2} ${h*0.6} ${-h*wFactor*1.6} ${h*0.4} v ${h*1.5} q ${-h*0.3} ${h*0.4} ${-h*wFactor*1.6} ${0} z`

  // bangs/front path
  const bangsPath = (depth = 0.35) => `M ${-h*0.9} ${-h*0.1} q ${h*0.45} ${-h*depth} ${h*0.9} ${-h*0.05} q ${-h*0.25} ${h*0.25} ${-h*0.9} ${h*0.05} z`

  switch (style) {
    case 'buzz_cut':
    case 'crew_cut':
    case 'fade':
      return (
        <g>
          <defs>
            <clipPath id={clipId}><circle r={h*0.98} cx="0" cy="0" /></clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect x={-h*0.95} y={-h*0.6} width={h*1.9} height={h*1.05} rx={h*0.18} fill={color} />
          </g>
        </g>
      )

    case 'pompadour':
    case 'quiff':
    case 'comb_over':
      return (
        <g>
          <defs><clipPath id={clipId}><circle r={h*1.02} cx="0" cy="0" /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
            <path d={backPath(1.05, -h*0.12)} fill={color} opacity={1} />
            <path d={bangsPath(0.6)} fill={shade(color, -12)} opacity={1} />
          </g>
        </g>
      )

    case 'slick_back':
    case 'undercut':
      return (
        <g>
          <defs><clipPath id={clipId}><circle r={h*1.02} cx="0" cy="0" /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
            <path d={backPath(1.0, -h*0.06)} fill={color} />
            <path d={bangsPath(0.25)} fill={shade(color, -8)} opacity={0.95} />
          </g>
        </g>
      )

    case 'man_bun':
    case 'top_knot':
      return (
        <g>
          <defs><clipPath id={clipId}><circle r={h*1.05} cx="0" cy="0" /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
            <path d={backPath(1.05, 0)} fill={color} />
            <circle cx={h*0.45} cy={-h*1.08} r={h*0.36} fill={color} />
          </g>
        </g>
      )

    case 'long_layers':
    case 'long_flow':
    case 'layered_long':
      return (
        <g>
          <defs><clipPath id={clipId}><circle r={h*1.1} cx="0" cy="0" /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
            <path d={`M ${-h*1.4} ${-h*0.5} q ${h*1.8} ${-h*0.8} ${h*3.0} ${0} v ${h*2.1} q ${-h*0.4} ${h*0.5} ${-h*3.0} ${0} z`} fill={color} />
            <path d={bangsPath(0.5)} fill={shade(color, -10)} opacity={0.95} />
          </g>
        </g>
      )

    case 'curly_male':
    case 'curly_female':
    case 'afro':
      return (
        <g>
          <defs><clipPath id={clipId}><circle r={h*1.12} cx="0" cy="0" /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
            {Array.from({length:9}).map((_,i)=>(<circle key={i} cx={Math.cos(i/9*Math.PI*2)*h*0.55} cy={Math.sin(i/9*Math.PI*2)*h*0.35 - h*0.45} r={h*0.32} fill={color} />))}
          </g>
        </g>
      )

    case 'braid':
    case 'french_braid':
    case 'fishtail':
      return (
        <g>
          <defs><clipPath id={clipId}><circle r={h*1.05} cx="0" cy="0" /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
            <path d={backPath(0.95, 0.08)} fill={color} />
            {Array.from({length:4}).map((_,i)=>(<ellipse key={i} cx={h*(0.9 - i*0.18)} cy={-h*0.0 + i*7} rx={h*0.19} ry={h*0.11} fill={shade(color, i%2? -6:6)} />))}
          </g>
        </g>
      )

    default:
      return (
        <g>
          <defs><clipPath id={clipId}><circle r={h*1.02} cx="0" cy="0" /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
            <rect x={-h} y={-h*0.6} width={h*2} height={h*1.05} rx={h*0.2} fill={color} />
          </g>
        </g>
      )
  }
}

function AvatarPreview({ appearance, name = '', large = false }) {
  const size = large ? 260 : 160
  const headRadius = Math.round(size * 0.26)
  const faceColor = appearance.skin_color || { light: '#fdbcb4', medium: '#d4a574', dark: '#8b5a3c', olive: '#9a7c5c' }[appearance.skin_tone] || '#d4a574'

  // Build mapping influences body width and belly
  const buildMap = {
    very_slim: { bodyScale: 0.8, waist: 0.55, limb: 0.6 },
    slim: { bodyScale: 0.9, waist: 0.7, limb: 0.75 },
    average: { bodyScale: 1, waist: 0.9, limb: 0.9 },
    athletic: { bodyScale: 1.02, waist: 0.85, limb: 1.0 },
    heavy: { bodyScale: 1.18, waist: 1.2, limb: 1.2 },
    obese: { bodyScale: 1.35, waist: 1.45, limb: 1.35 }
  }

  const b = buildMap[appearance.build] || buildMap['average']
  const heightScale = (appearance.height - 140) / 90 // 140..230
  const avatarHeight = Math.round(size * (1 + heightScale * 0.25))
  const avatarStyle = { width: size, height: avatarHeight }

  // torso dims
  const torsoW = avatarStyle.width * 0.36 * b.bodyScale
  const torsoH = avatarStyle.height * 0.34 * b.bodyScale

  // limb widths influenced by build
  const armW = Math.max(6, Math.round(avatarStyle.width * 0.06 * b.limb))
  const legW = Math.max(8, Math.round(avatarStyle.width * 0.08 * b.limb))

  return (
    <div className="flex flex-col items-center text-center px-2">
      <svg width={avatarStyle.width} height={avatarStyle.height} viewBox={`0 0 ${avatarStyle.width} ${avatarStyle.height}`}>
        {/* legs */}
        <g transform={`translate(${avatarStyle.width/2}, ${avatarStyle.height*0.9})`}>
          <rect x={-torsoW*0.45 - legW} y={-0} width={legW} height={avatarStyle.height*0.4} rx={legW/2} fill="#24303b" />
          <rect x={torsoW*0.45} y={-0} width={legW} height={avatarStyle.height*0.4} rx={legW/2} fill="#24303b" />
        </g>

        {/* torso */}
        <g transform={`translate(${avatarStyle.width / 2}, ${avatarStyle.height * 0.62})`}>
          <rect x={-torsoW/2} y={-torsoH/2} width={torsoW} height={torsoH} rx="14" fill="#293241" />

          {/* belly overlay for heavy/obese */}
          {appearance.build === 'heavy' && <ellipse cx={0} cy={torsoH*0.12} rx={torsoW*0.55} ry={torsoH*0.25} fill="#2f3337" />}
          {appearance.build === 'obese' && <ellipse cx={0} cy={torsoH*0.2} rx={torsoW*0.68} ry={torsoH*0.33} fill="#2f3337" />}

          {/* arms */}
          <rect x={-torsoW/2 - armW - 6} y={-torsoH*0.35} width={armW} height={torsoH*0.9} rx={armW/2} fill="#293241" />
          <rect x={torsoW/2 + 6} y={-torsoH*0.35} width={armW} height={torsoH*0.9} rx={armW/2} fill="#293241" />
        </g>

        {/* head group */}
        <g transform={`translate(${avatarStyle.width / 2}, ${avatarStyle.height * 0.24})`}>
          <circle r={headRadius} fill={faceColor} />
          <g>{renderHairSVG(appearance.hair_style, appearance.hair_color, headRadius)}</g>

          <circle cx={-Math.round(headRadius * 0.35)} cy={-Math.round(headRadius * 0.12)} r={Math.max(1, Math.round(headRadius * 0.12))} fill="#0b1220" />
          <circle cx={Math.round(headRadius * 0.35)} cy={-Math.round(headRadius * 0.12)} r={Math.max(1, Math.round(headRadius * 0.12))} fill="#0b1220" />
          <path d={`M ${-headRadius * 0.28} ${Math.round(headRadius * 0.45)} q ${headRadius * 0.28} ${headRadius * 0.18} ${headRadius * 0.56} 0`} stroke="#7f1d1d" strokeWidth={Math.max(1, Math.round(headRadius * 0.05))} fill="none" strokeLinecap="round" />
        </g>
      </svg>

      <div className="mt-3">
        <p className="text-sm md:text-base font-semibold text-slate-100 truncate max-w-[220px]">{name || 'Unnamed'}</p>
        <p className="text-xs text-slate-400">{appearance.gender === 'male' ? 'Male' : 'Female'} • {appearance.hair_style.replace('_',' ')}</p>
      </div>
    </div>
  )
}

// shading helper
function shade(hex, percent) {
  const h = hex.replace('#','')
  const num = parseInt(h,16)
  let r = (num >> 16) + percent
  let g = ((num >> 8) & 0x00FF) + percent
  let b = (num & 0x0000FF) + percent
  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

// Helpers
function cmToFeetInches(cm) {
  const totalInches = Math.round(cm / 2.54)
  const feet = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  return { feet, inches }
}
function feetInchesToCm(feet, inches) {
  const totalInches = (Number(feet) || 0) * 12 + (Number(inches) || 0)
  return Math.round(totalInches * 2.54)
}

function FeetInchesDisplay({ cm, onChange }) {
  const fi = cmToFeetInches(cm)
  const [feet, setFeet] = useState(fi.feet)
  const [inches, setInches] = useState(fi.inches)

  // Keep local feet/inches in sync when cm prop changes (e.g., slider updates)
  React.useEffect(() => {
    const updated = cmToFeetInches(cm)
    setFeet(updated.feet)
    setInches(updated.inches)
  }, [cm])

  function updateFeet(f) {
    const fv = Number.isNaN(Number(f)) ? 0 : Number(f)
    setFeet(fv)
    const cmVal = feetInchesToCm(fv, inches)
    onChange(fv, inches)
  }
  function updateInches(i) {
    let iv = Number(i)
    if (isNaN(iv) || iv < 0) iv = 0
    if (iv > 11) iv = 11
    setInches(iv)
    onChange(feet, iv)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <input value={feet} onChange={(e)=>{ const v = parseInt(e.target.value||0); setFeet(isNaN(v)?0:v)}} onBlur={(e)=>updateFeet(parseInt(e.target.value||0))} className="w-12 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-100" />
        <span className="text-xs text-slate-400">ft</span>
      </div>
      <div className="flex items-center gap-1">
        <input value={inches} onChange={(e)=>{ const v = parseInt(e.target.value||0); setInches(isNaN(v)?0:v)}} onBlur={(e)=>updateInches(parseInt(e.target.value||0))} className="w-12 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-100" />
        <span className="text-xs text-slate-400">in</span>
      </div>
    </div>
  )
}

function hexToRgb(hex) {
  const h = hex.replace('#','')
  const bigint = parseInt(h,16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}
function rgbToHex({r,g,b}){ return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('') }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)) }

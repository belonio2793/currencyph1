import React, { useState, useMemo } from 'react'

// Extensive hairstyle definitions (real-world names)
const MALE_HAIRSTYLES = [
  'buzz_cut','crew_cut','fade','undercut','quiff','pompadour','slick_back','man_bun','top_knot','mullet','long_layers','curly_male','shag_male','comb_over','side_part'
]
const FEMALE_HAIRSTYLES = [
  'pixie','bob','lob','blunt_bob','asym_bob','long_flow','layered_long','curly_female','beach_waves','ponytail','high_ponytail','low_bun','braid','french_braid','fishtail','afro','twists'
]

export default function CharacterCreation({ onCharacterCreated, userId }) {
  const [name, setName] = useState('')
  const [appearance, setAppearance] = useState({
    gender: 'male',
    skin_tone: 'medium',
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
    setAppearance(prev => ({ ...prev, [key]: value }))
    if (key === 'hair_color') setRgb(hexToRgb(value))
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
                    <div className="flex gap-2">
                      {[{n:'light',c:'#fdbcb4'},{n:'medium',c:'#d4a574'},{n:'dark',c:'#8b5a3c'},{n:'olive',c:'#9a7c5c'}].map(t=> (
                        <button key={t.n} type="button" onClick={()=>handleAppearanceChange('skin_tone', t.n)} className={`w-10 h-10 rounded border-2 ${appearance.skin_tone===t.n ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-600'}`} style={{backgroundColor:t.c}} title={t.n} />
                      ))}
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
                    <input type="range" min="150" max="210" value={appearance.height} onChange={(e)=>handleAppearanceChange('height', parseInt(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Build</label>
                    <select value={appearance.build} onChange={(e)=>handleAppearanceChange('build', e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100">
                      <option value="slim">Slim</option>
                      <option value="average">Average</option>
                      <option value="athletic">Athletic</option>
                      <option value="stocky">Stocky</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={creating} className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50">{creating ? '⏳ Creating Adventure...' : '🎮 Begin Adventure'}</button>
                </div>
              </form>
            </div>

            <div className="w-full lg:w-96 flex-shrink-0">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-col items-center">
                <AvatarPreview appearance={appearance} name={name} />
                <p className="text-slate-400 text-sm mt-3 text-center px-3">Preview updates live. Open the gallery for dozens more real styles.</p>
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
  const common = { fill: color }
  // Many simple illustrative shapes to represent styles
  switch (style) {
    case 'buzz_cut':
    case 'crew_cut':
    case 'fade':
      return <rect x={-h} y={-h*0.6} width={h*2} height={h*1.05} rx={h*0.2} fill={color} />
    case 'undercut':
    case 'comb_over':
      return <g><rect x={-h} y={-h*0.5} width={h*2} height={h*0.6} rx={h*0.22} fill={color} /><path d={`M ${-h} ${-h*0.02} q ${h*1.0} ${-h*0.6} ${h*2.0} ${0}`} fill={color} /></g>
    case 'quiff':
    case 'pompadour':
      return <path d={`M ${-h} ${-h*0.35} q ${h*0.6} ${-h*0.9} ${h*1.6} ${-h*0.25} q ${-h*0.2} ${h*0.6} ${-h*1.6} ${h*0.4}`} fill={color} />
    case 'slick_back':
      return <path d={`M ${-h} ${-h*0.6} q ${h*0.9} ${-h*0.6} ${h*1.6} ${-h*0.2} v ${h*0.6} h ${-h*1.6} z`} fill={color} />
    case 'man_bun':
    case 'top_knot':
      return <g><circle cx={h*0.35} cy={-h*1.05} r={h*0.35} fill={color} /><path d={`M ${-h} ${-h*0.05} q ${h*0.8} ${-h*0.6} ${h*1.8} ${-h*0.1} v ${h*0.8} h ${-h*1.8} z`} fill={color} /></g>
    case 'mullet':
      return <path d={`M ${-h*1.2} ${-h*0.35} q ${h*1.6} ${-h*0.6} ${h*2.4} ${0} v ${h*1.6} q ${-h*0.3} ${h*0.4} ${-h*2.4} ${0} z`} fill={color} />
    case 'long_layers':
    case 'long_flow':
    case 'layered_long':
      return <path d={`M ${-h*1.2} ${-h*0.6} q ${h*1.8} ${-h*0.8} ${h*2.8} ${0} v ${h*1.8} q ${-h*0.3} ${h*0.4} ${-h*2.8} ${0} z`} fill={color} />
    case 'curly_male':
    case 'curly_female':
      return <g>{[-0.6,-0.2,0.2,0.6].map((cx,i)=><circle key={i} cx={h*cx} cy={-h*0.7 + (i%2)*6} r={h*0.28} fill={color} />)}</g>
    case 'shag_male':
    case 'shaggy':
      return <path d={`M ${-h*1.1} ${-h*0.2} q ${h*1.2} ${-h*0.7} ${h*2.2} ${-h*0.2} v ${h*1.0} q ${-h*0.3} ${h*0.4} ${-h*2.2} ${0} z`} fill={color} />
    case 'pixie':
      return <path d={`M ${-h} ${-h*0.35} q ${h*0.7} ${-h*0.6} ${h*1.6} ${-h*0.1} v ${h*0.5} h ${-h*1.6} z`} fill={color} />
    case 'bob':
    case 'blunt_bob':
    case 'asym_bob':
      return <path d={`M ${-h*1.2} ${-h*0.1} q ${h*1.2} ${-h*0.8} ${h*2.4} ${-h*0.1} v ${h*0.9} q ${-h*0.3} ${h*0.4} ${-h*2.4} ${0} z`} fill={color} />
    case 'lob':
      return <path d={`M ${-h*1.3} ${-h*0.35} q ${h*1.6} ${-h*0.6} ${h*2.6} ${0} v ${h*1.2} q ${-h*0.3} ${h*0.4} ${-h*2.6} ${0} z`} fill={color} />
    case 'ponytail':
    case 'high_ponytail':
    case 'low_bun':
      return <g><path d={`M ${-h} ${-h*0.1} q ${h*0.8} ${-h*0.6} ${h*1.6} ${-h*0.1} v ${h*0.6} h ${-h*1.6} z`} fill={color} /><path d={`M ${h*0.9} ${-h*0.1} q ${h*0.8} ${h*0.6} ${h*1.0} ${h*1.6}`} stroke={color} strokeWidth={Math.max(2, h*0.08)} fill="none" strokeLinecap="round" /></g>
    case 'braid':
    case 'french_braid':
    case 'fishtail':
      return <g>{[0,1,2,3].map(i=> <ellipse key={i} cx={h*0.8 + i* -h*0.18} cy={-h*0.0 + i*8} rx={h*0.22} ry={h*0.12} fill={color} />)}</g>
    case 'afro':
      return <g>{Array.from({length:8}).map((_,i)=><circle key={i} cx={Math.cos(i/8*Math.PI*2)*h*0.5} cy={Math.sin(i/8*Math.PI*2)*h*0.25 - h*0.4} r={h*0.28} fill={color} />)}</g>
    case 'twists':
      return <g>{[ -0.6,-0.2,0.2,0.6 ].map((cx,i)=><path key={i} d={`M ${h*cx} ${-h*0.6} q ${h*0.05} ${h*0.25} ${h*0.2} ${h*0.5}`} stroke={color} strokeWidth={Math.max(2,h*0.06)} fill="none" strokeLinecap="round" />)}</g>
    default:
      return <rect x={-h} y={-h*0.6} width={h*2} height={h*1.05} rx={h*0.2} fill={color} />
  }
}

function AvatarPreview({ appearance, name = '', large = false }) {
  const size = large ? 220 : 140
  const headRadius = Math.round(size * 0.28)
  const faceColor = { light: '#fdbcb4', medium: '#d4a574', dark: '#8b5a3c', olive: '#9a7c5c' }[appearance.skin_tone] || '#d4a574'
  const bodyScale = appearance.build === 'slim' ? 0.86 : appearance.build === 'athletic' ? 1.05 : appearance.build === 'stocky' ? 1.18 : 1
  const heightScale = (appearance.height - 150) / 60
  const avatarStyle = { width: size, height: Math.round(size * (1 + heightScale * 0.25) * bodyScale) }

  return (
    <div className="flex flex-col items-center text-center px-2">
      <svg width={avatarStyle.width} height={avatarStyle.height} viewBox={`0 0 ${avatarStyle.width} ${avatarStyle.height}`}>
        <g transform={`translate(${avatarStyle.width / 2}, ${avatarStyle.height * 0.62}) scale(${bodyScale})`}>
          <rect x={-avatarStyle.width * 0.18} y={-avatarStyle.height * 0.12} width={avatarStyle.width * 0.36} height={avatarStyle.height * 0.36} rx="14" fill="#293241" />
        </g>

        <g transform={`translate(${avatarStyle.width / 2}, ${avatarStyle.height * 0.28})`}>
          <circle r={headRadius} fill={faceColor} />
          <g>
            {renderHairSVG(appearance.hair_style, appearance.hair_color, headRadius)}
          </g>

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

// Helpers
function hexToRgb(hex) {
  const h = hex.replace('#','')
  const bigint = parseInt(h,16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}
function rgbToHex({r,g,b}){ return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('') }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)) }

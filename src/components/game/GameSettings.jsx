import React, { useState, useEffect } from 'react'

export default function GameSettings({ world3D, onClose, mapSettings = {}, onMapSettingsChange = null }) {
  const [cameraMode, setCameraMode] = useState(world3D?.cameraConfig?.mode || 'isometric')
  const [height, setHeight] = useState(world3D?.cameraConfig?.height || 600)
  const [distance, setDistance] = useState(world3D?.cameraConfig?.distance || 400)
  const [angle, setAngle] = useState(world3D?.cameraConfig?.angle || 45)
  const [zoom, setZoom] = useState(world3D?.cameraConfig?.zoom || 1.2)
  const [fov, setFov] = useState(world3D?.cameraConfig?.fov || 75)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [enableShadows, setEnableShadows] = useState(world3D?.cameraConfig?.enableShadows ?? true)
  const [enableFog, setEnableFog] = useState(world3D?.cameraConfig?.enableFog ?? true)
  const [showNameplates, setShowNameplates] = useState(world3D?.cameraConfig?.showNameplates ?? true)
  const [avatarSpeed, setAvatarSpeed] = useState(mapSettings?.avatarSpeed || 2)
  const [cameraSpeed, setCameraSpeed] = useState(mapSettings?.cameraSpeed || 1)
  const [showAvatarTrail, setShowAvatarTrail] = useState(mapSettings?.showAvatarTrail ?? true)

  useEffect(() => {
    // Sync settings with 3D world if it changes
    if (!world3D) return

    world3D.setCameraMode(cameraMode, {
      height,
      distance,
      angle,
      fov,
      zoom,
      enableShadows,
      enableFog,
      showNameplates
    })
  }, [cameraMode, height, distance, angle, fov, zoom, enableShadows, enableFog, showNameplates, world3D])

  const applyPreset = (preset) => {
    switch (preset) {
      case 'wide':
        setCameraMode('topdown')
        setHeight(1000)
        setZoom(1.0)
        break
      case 'cinematic':
        setCameraMode('isometric')
        setHeight(600)
        setDistance(400)
        setAngle(45)
        setZoom(1.2)
        setFov(75)
        break
      case 'closeup':
        setCameraMode('thirdperson')
        setHeight(200)
        setDistance(150)
        setZoom(1.5)
        break
      case 'tactical':
        setCameraMode('isometric')
        setHeight(800)
        setDistance(600)
        setAngle(35)
        setZoom(0.8)
        break
      default:
        break
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-3xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-700 p-4 md:p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Game Settings</h2>
            <p className="text-xs text-slate-400 mt-1">Customize your view and gameplay experience</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-6">
          {/* Quick Presets */}
          <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase">Quick Presets</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: 'wide', label: 'Wide View' },
                { id: 'cinematic', label: 'Cinematic' },
                { id: 'closeup', label: 'Close-up' },
                { id: 'tactical', label: 'Tactical' }
              ].map(({ id, label, emoji }) => (
                <button
                  key={id}
                  onClick={() => applyPreset(id)}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium text-slate-200 transition-colors border border-slate-600 hover:border-slate-500"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Mode Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Camera View Modes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { mode: 'topdown', label: 'Top-Down', desc: 'Bird\'s eye view from above' },
                { mode: 'isometric', label: 'Isometric', desc: 'Angled 3D perspective (Recommended)' },
                { mode: 'thirdperson', label: 'Third-Person', desc: 'Follow camera behind player' },
                { mode: 'freecam', label: 'Free Cam', desc: 'Unrestricted camera movement' }
              ].map(({ mode, label, desc }) => (
                <button
                  key={mode}
                  onClick={() => setCameraMode(mode)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    cameraMode === mode
                      ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50'
                      : 'border-slate-600 bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <p className="font-semibold text-slate-100">{label}</p>
                  <p className="text-xs text-slate-400 mt-1">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Camera Settings Section */}
          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Camera Settings</h3>

            <div className="space-y-4">
              {/* Zoom Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">Zoom Level</label>
                  <span className="text-sm font-bold text-blue-400">{zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Adjust overall scale of the view (1.0 = normal)</p>
              </div>

              {/* Field of View */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">Field of View</label>
                  <span className="text-sm font-bold text-blue-400">{fov}°</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="120"
                  step="5"
                  value={fov}
                  onChange={(e) => setFov(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Lower = zoomed in, higher = wider view</p>
              </div>

              {/* Advanced Settings Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 hover:bg-slate-700 transition-colors text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center justify-between"
              >
                <span>{showAdvanced ? '▼' : '▶'} Advanced Camera Settings</span>
              </button>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="bg-slate-700/50 rounded-lg p-4 space-y-4 border border-slate-600">
                  {/* Height */}
                  {(cameraMode === 'topdown' || cameraMode === 'isometric' || cameraMode === 'thirdperson') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-300">Camera Height</label>
                        <span className="text-sm font-bold text-slate-400">{height}px</span>
                      </div>
                      <input
                        type="range"
                        min="200"
                        max="1500"
                        step="50"
                        value={height}
                        onChange={(e) => setHeight(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  )}

                  {/* Distance */}
                  {(cameraMode === 'isometric' || cameraMode === 'thirdperson') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-300">Camera Distance</label>
                        <span className="text-sm font-bold text-slate-400">{distance}px</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="1000"
                        step="50"
                        value={distance}
                        onChange={(e) => setDistance(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  )}

                  {/* Angle */}
                  {cameraMode === 'isometric' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-300">Isometric Angle</label>
                        <span className="text-sm font-bold text-slate-400">{angle}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={angle}
                        onChange={(e) => setAngle(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Display Settings Section */}
          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Display & Graphics</h3>

            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 border border-slate-600 cursor-pointer hover:bg-slate-700/70 transition-colors">
                <input
                  type="checkbox"
                  checked={showNameplates}
                  onChange={(e) => setShowNameplates(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-sm text-slate-300">Show Nameplates</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 border border-slate-600 cursor-pointer hover:bg-slate-700/70 transition-colors">
                <input
                  type="checkbox"
                  checked={enableShadows}
                  onChange={(e) => setEnableShadows(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-sm text-slate-300">Enable Shadows</span>
                <span className="text-xs text-slate-500 ml-auto">(Better graphics, more performance impact)</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 border border-slate-600 cursor-pointer hover:bg-slate-700/70 transition-colors">
                <input
                  type="checkbox"
                  checked={enableFog}
                  onChange={(e) => setEnableFog(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-sm text-slate-300">Enable Fog</span>
                <span className="text-xs text-slate-500 ml-auto">(Atmospheric effect)</span>
              </label>
            </div>
          </div>

          {/* Info Section */}
          <div className="border-t border-slate-700 pt-6 bg-slate-700/30 rounded-lg p-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-300">💡 Tip:</strong> Camera settings are applied immediately. Try different camera modes and presets to find your preferred view! Zoom and FOV adjustments work across all modes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4 md:p-6 flex justify-end gap-2 bg-slate-700/20">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all shadow-lg"
          >
            ✓ Done
          </button>
        </div>
      </div>
    </div>
  )
}

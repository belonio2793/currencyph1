import React, { useState, useEffect } from 'react'

export default function GameSettings({ world3D, onClose }) {
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
            <h2 className="text-2xl font-bold text-slate-100">⚙️ Game Settings</h2>
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
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase">⚡ Quick Presets</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: 'wide', label: '📐 Wide View', emoji: '📐' },
                { id: 'cinematic', label: '🎬 Cinematic', emoji: '🎬' },
                { id: 'closeup', label: '🔍 Close-up', emoji: '🔍' },
                { id: 'tactical', label: '🎯 Tactical', emoji: '🎯' }
              ].map(({ id, label, emoji }) => (
                <button
                  key={id}
                  onClick={() => applyPreset(id)}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium text-slate-200 transition-colors border border-slate-600 hover:border-slate-500"
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Mode Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-100 mb-4">📷 Camera View Modes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { mode: 'topdown', label: '⬇️ Top-Down', desc: 'Bird\'s eye view from above' },
                { mode: 'isometric', label: '↗️ Isometric', desc: 'Angled 3D perspective (Recommended)' },
                { mode: 'thirdperson', label: '👤 Third-Person', desc: 'Follow camera behind player' },
                { mode: 'freecam', label: '🎬 Free Cam', desc: 'Unrestricted camera movement' }
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
            <h3 className="text-lg font-semibold text-slate-100 mb-4">🎥 Camera Settings</h3>
            
            <div className="space-y-4">
              {/* Zoom */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  🔍 Zoom Level: {zoom.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => handleZoomChange(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-slate-400 mt-1">1.0 = Normal, less = zoomed out, more = zoomed in</p>
              </div>

              {/* Field of View */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  📐 Field of View (FOV): {fov}°
                </label>
                <input
                  type="range"
                  min="30"
                  max="120"
                  step="5"
                  value={fov}
                  onChange={(e) => handleFOVChange(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-slate-400 mt-1">Lower = zoomed in, higher = wider view</p>
              </div>

              {/* Advanced Settings Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium"
              >
                {showAdvanced ? '▼' : '▶'} Advanced Camera Settings
              </button>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="bg-slate-700/50 rounded p-4 space-y-4 border border-slate-600">
                  {/* Height */}
                  {(cameraMode === 'topdown' || cameraMode === 'isometric' || cameraMode === 'thirdperson') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        ⬆️ Camera Height: {height}px
                      </label>
                      <input
                        type="range"
                        min="200"
                        max="1500"
                        step="50"
                        value={height}
                        onChange={(e) => handleHeightChange(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Distance */}
                  {(cameraMode === 'isometric' || cameraMode === 'thirdperson') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        📏 Camera Distance: {distance}px
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="1000"
                        step="50"
                        value={distance}
                        onChange={(e) => handleDistanceChange(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Angle */}
                  {cameraMode === 'isometric' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        ⭐ Isometric Angle: {angle}°
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={angle}
                        onChange={(e) => handleAngleChange(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Display Settings Section */}
          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">🎮 Display Settings</h3>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 border border-slate-600 cursor-pointer hover:bg-slate-700">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-300">Show Player Nameplates</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 border border-slate-600 cursor-pointer hover:bg-slate-700">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-300">Show NPC Nameplates</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 border border-slate-600 cursor-pointer hover:bg-slate-700">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-300">Enable Shadows</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 border border-slate-600 cursor-pointer hover:bg-slate-700">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-300">Enable Fog</span>
              </label>
            </div>
          </div>

          {/* Info Section */}
          <div className="border-t border-slate-700 pt-6 bg-slate-700/30 rounded p-4">
            <p className="text-xs text-slate-400">
              <strong>💡 Tip:</strong> Adjust camera settings to your preference. All settings are saved locally and applied immediately.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4 md:p-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

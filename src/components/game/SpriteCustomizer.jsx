import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function SpriteCustomizer({ open, onClose, characterId, userId, onExport }) {
  const [customization, setCustomization] = useState({
    skinTone: 'medium',
    hairStyle: 'short',
    hairColor: 'brown',
    outfit: 'casual',
    outfitColor: 'blue',
    accessory: 'none'
  })
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const skinTones = {
    light: '#fdbcb4',
    medium: '#d4a574',
    dark: '#9d7860',
    tan: '#e8b89c'
  }

  const hairStyles = ['short', 'long', 'curly', 'spiky', 'wavy']
  const hairColors = ['brown', 'black', 'blonde', 'red', 'grey']
  const outfits = ['casual', 'formal', 'adventurer', 'merchant', 'noble']
  const outfitColors = ['blue', 'red', 'green', 'purple', 'yellow', 'black']
  const accessories = ['none', 'hat', 'glasses', 'scarf', 'backpack']

  // Load saved customization
  useEffect(() => {
    if (!open || !characterId) return

    const loadCustomization = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('game_characters')
          .select('appearance')
          .eq('id', characterId)
          .single()

        if (fetchErr) throw fetchErr

        if (data?.appearance?.sprite) {
          setCustomization(data.appearance.sprite)
        }
      } catch (e) {
        console.warn('Failed to load customization:', e.message)
      }
    }

    loadCustomization()
  }, [open, characterId])

  // Generate canvas-based sprite preview
  useEffect(() => {
    if (!open) return

    const canvas = document.getElementById('sprite-preview-canvas')
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    canvas.width = 128
    canvas.height = 128

    // Clear canvas
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw simplified pixel sprite
    const centerX = 64
    const centerY = 64

    // Skin tone (head)
    ctx.fillStyle = skinTones[customization.skinTone]
    ctx.beginPath()
    ctx.arc(centerX, centerY - 20, 16, 0, Math.PI * 2)
    ctx.fill()

    // Hair
    ctx.fillStyle = customization.hairColor
    ctx.fillRect(centerX - 16, centerY - 36, 32, 16)

    // Body
    ctx.fillStyle = customization.outfitColor
    ctx.fillRect(centerX - 14, centerY - 4, 28, 24)

    // Arms
    ctx.fillRect(centerX - 20, centerY - 2, 6, 20)
    ctx.fillRect(centerX + 14, centerY - 2, 6, 20)

    // Legs
    ctx.fillRect(centerX - 10, centerY + 20, 8, 16)
    ctx.fillRect(centerX + 2, centerY + 20, 8, 16)

    // Convert to image
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      setPreview(url)
    })
  }, [customization, open])

  const handleSave = async () => {
    if (!characterId) return

    setSaving(true)
    setError('')

    try {
      const appearance = {
        sprite: customization,
        type: 'sprite'
      }

      const { error: updateErr } = await supabase
        .from('game_characters')
        .update({ appearance })
        .eq('id', characterId)

      if (updateErr) throw updateErr

      onExport?.(appearance)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg max-w-2xl w-full p-8 border border-slate-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-6">Create Your Character</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Preview */}
          <div className="flex flex-col items-center">
            <div className="bg-slate-700 rounded-lg p-4 mb-4">
              <canvas
                id="sprite-preview-canvas"
                className="w-32 h-32 image-rendering-pixelated"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            {preview && (
              <img
                src={preview}
                alt="Character Preview"
                className="w-32 h-32"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
          </div>

          {/* Customization Options */}
          <div className="space-y-6">
            {/* Skin Tone */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-3">Skin Tone</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(skinTones).map(([key, color]) => (
                  <button
                    key={key}
                    onClick={() => setCustomization({ ...customization, skinTone: key })}
                    className={`w-12 h-12 rounded-lg border-2 transition-all ${
                      customization.skinTone === key
                        ? 'border-yellow-400 shadow-lg'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Hair Style */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-3">Hair Style</label>
              <select
                value={customization.hairStyle}
                onChange={(e) => setCustomization({ ...customization, hairStyle: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {hairStyles.map(style => (
                  <option key={style} value={style}>{style.charAt(0).toUpperCase() + style.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Hair Color */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-3">Hair Color</label>
              <select
                value={customization.hairColor}
                onChange={(e) => setCustomization({ ...customization, hairColor: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {hairColors.map(color => (
                  <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Outfit */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-3">Outfit Style</label>
              <select
                value={customization.outfit}
                onChange={(e) => setCustomization({ ...customization, outfit: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {outfits.map(outfit => (
                  <option key={outfit} value={outfit}>{outfit.charAt(0).toUpperCase() + outfit.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Outfit Color */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-3">Outfit Color</label>
              <select
                value={customization.outfitColor}
                onChange={(e) => setCustomization({ ...customization, outfitColor: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {outfitColors.map(color => (
                  <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Accessory */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-3">Accessory</label>
              <select
                value={customization.accessory}
                onChange={(e) => setCustomization({ ...customization, accessory: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {accessories.map(acc => (
                  <option key={acc} value={acc}>{acc.charAt(0).toUpperCase() + acc.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 text-slate-100 rounded-lg hover:bg-slate-600 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? 'Saving...' : 'Save Character'}
          </button>
        </div>
      </div>
    </div>
  )
}

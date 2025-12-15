import React from 'react'
import { useDevice } from '../context/DeviceContext'
import { useLayoutOverride } from '../context/LayoutOverrideContext'

export default function LayoutSwitcher() {
  const { deviceType, width, height } = useDevice()
  const { layoutOverride, setLayout } = useLayoutOverride()

  const isOverridden = layoutOverride !== null

  return (
    <div className="bg-slate-900 text-white border-b border-slate-700 sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded">
            DEV
          </span>

          <div className="text-xs flex items-center gap-3">
            <span className="text-slate-300">
              Actual: <span className="font-semibold text-slate-100">{deviceType.toUpperCase()}</span>
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">
              {width} × {height}px
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 mr-2">Override Layout:</span>

          {/* Desktop Button */}
          <button
            onClick={() => setLayout(layoutOverride === 'desktop' ? null : 'desktop')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              layoutOverride === 'desktop'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            Desktop
          </button>

          {/* Mobile Button */}
          <button
            onClick={() => setLayout(layoutOverride === 'mobile' ? null : 'mobile')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              layoutOverride === 'mobile'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            Mobile
          </button>

          {/* Reset Button */}
          {isOverridden && (
            <button
              onClick={() => setLayout(null)}
              className="px-3 py-1 text-xs font-medium rounded bg-slate-600 text-slate-100 hover:bg-slate-500 transition-colors ml-1"
            >
              Reset
            </button>
          )}

        </div>
      </div>
    </div>
  )
}

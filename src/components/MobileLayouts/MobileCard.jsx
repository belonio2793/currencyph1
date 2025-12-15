import React from 'react'
import { useDevice } from '../../context/DeviceContext'

export function MobileCard({ children, className = '', onClick, hoverable = true }) {
  const { isMobile } = useDevice()

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-4 sm:p-6 transition-all ${
        hoverable && !isMobile ? 'hover:shadow-lg hover:scale-105' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function MobileCardHeader({ title, subtitle, icon }) {
  const { isMobile } = useDevice()

  return (
    <div className="flex items-start gap-3 sm:gap-4 mb-3">
      {icon && (
        <div className={`rounded-lg bg-slate-200 flex items-center justify-center font-bold text-slate-700 flex-shrink-0 ${
          isMobile ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base'
        }`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {title && <h3 className={`font-semibold text-slate-900 mb-1 ${isMobile ? 'text-sm' : 'text-base'}`}>{title}</h3>}
        {subtitle && <p className={`text-slate-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>{subtitle}</p>}
      </div>
    </div>
  )
}

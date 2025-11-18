import React from 'react'
import TradingDashboard from './Trading/TradingDashboard'

export default function Sunshine({ userId, onClose }) {
  return (
    <div>
      <TradingDashboard userId={userId} onClose={onClose} />
    </div>
  )
}

import React, { useMemo } from 'react'
import {
  calculateDistance,
  calculateEstimatedTime,
  calculateTotalFare,
  getTimeOfDayMultiplier,
  formatFare,
  formatDistance,
  formatTime,
  getVehicleIcon
} from '../lib/rideCalculations'

export default function FareEstimate({ startCoord, endCoord, vehicleType = 'car', activeDemand = 0, activeSupply = 0 }) {
  const fareBreakdown = useMemo(() => {
    if (!startCoord || !endCoord) {
      return null
    }

    const distance = calculateDistance(
      startCoord.latitude,
      startCoord.longitude,
      endCoord.latitude,
      endCoord.longitude
    )

    const time = calculateEstimatedTime(distance)
    const timeOfDayMultiplier = getTimeOfDayMultiplier()

    // Calculate surge multiplier
    let surgeMultiplier = 1.0
    if (activeSupply === 0) {
      surgeMultiplier = 3.0
    } else {
      const demandRatio = activeDemand / activeSupply
      if (demandRatio >= 3) surgeMultiplier = 2.0
      else if (demandRatio >= 2) surgeMultiplier = 1.75
      else if (demandRatio >= 1) surgeMultiplier = 1.5
      else if (demandRatio >= 0.5) surgeMultiplier = 1.25
    }

    const breakdown = calculateTotalFare(
      distance,
      time,
      vehicleType,
      surgeMultiplier,
      timeOfDayMultiplier
    )

    return {
      distance,
      time,
      timeOfDayMultiplier,
      surgeMultiplier,
      ...breakdown
    }
  }, [startCoord, endCoord, vehicleType, activeDemand, activeSupply])

  if (!fareBreakdown) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
        <p className="text-sm text-slate-600">Select both pickup and destination to see fare estimate</p>
      </div>
    )
  }

  const isPeakHour = fareBreakdown.timeOfDayMultiplier > 1
  const hasSurge = fareBreakdown.surgeMultiplier > 1

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 space-y-4">
      {/* Header with distance and time */}
      <div className="flex items-center justify-between pb-4 border-b border-blue-200">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{getVehicleIcon(vehicleType)}</span>
            <p className="text-sm font-medium text-slate-600 capitalize">{vehicleType}</p>
          </div>
          <p className="text-xs text-slate-600">
            {formatDistance(fareBreakdown.distance)} • {formatTime(fareBreakdown.time)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-blue-600">{formatFare(fareBreakdown.total)}</p>
          <p className="text-xs text-slate-600">Estimated total</p>
        </div>
      </div>

      {/* Breakdown items */}
      <div className="space-y-3">
        {/* Base fare */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-700">Base fare</span>
          <span className="text-sm font-medium text-slate-900">{formatFare(fareBreakdown.baseFare)}</span>
        </div>

        {/* Distance fare */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-700">
            Distance ({formatDistance(fareBreakdown.distance)})
          </span>
          <span className="text-sm font-medium text-slate-900">{formatFare(fareBreakdown.distanceFare)}</span>
        </div>

        {/* Time fare */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-700">
            Time ({formatTime(fareBreakdown.time)})
          </span>
          <span className="text-sm font-medium text-slate-900">{formatFare(fareBreakdown.timeFare)}</span>
        </div>

        {/* Subtotal */}
        <div className="flex justify-between items-center pt-2 border-t border-blue-200">
          <span className="text-sm font-medium text-slate-900">Subtotal</span>
          <span className="text-sm font-semibold text-slate-900">{formatFare(fareBreakdown.subtotal)}</span>
        </div>

        {/* Peak hour surcharge */}
        {isPeakHour && (
          <div className="flex justify-between items-center bg-orange-100 p-2 rounded">
            <div className="flex items-center gap-2">
              <span className="text-orange-600">⏰</span>
              <span className="text-sm text-orange-900 font-medium">Peak hour surcharge ({(fareBreakdown.timeOfDayMultiplier - 1) * 100}%)</span>
            </div>
            <span className="text-sm font-semibold text-orange-900">+{formatFare(fareBreakdown.timeAdjustment)}</span>
          </div>
        )}

        {/* Surge pricing */}
        {hasSurge && (
          <div className="flex justify-between items-center bg-red-100 p-2 rounded">
            <div className="flex items-center gap-2">
              <span className="text-red-600">📈</span>
              <span className="text-sm text-red-900 font-medium">
                High demand ({(fareBreakdown.surgeMultiplier).toFixed(1)}x)
              </span>
            </div>
            <span className="text-sm font-semibold text-red-900">+{formatFare(fareBreakdown.surgePrice)}</span>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="bg-blue-600 text-white rounded-lg p-4 text-center font-bold text-lg">
        Total: {formatFare(fareBreakdown.total)}
      </div>

      {/* Notes */}
      <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-blue-200">
        <p>💡 Final fare may vary based on actual route and traffic</p>
        {hasSurge && <p>⚠️ High demand - rates are increased by {(fareBreakdown.surgeMultiplier - 1) * 100}%</p>}
        {isPeakHour && <p>🕐 Peak hours in effect - additional surcharge applied</p>}
        <p>✓ Inclusive of all taxes and fees</p>
      </div>
    </div>
  )
}

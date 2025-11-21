import React, { useState } from 'react'
import { attendanceTimerService } from '../lib/attendanceTimerService'
import { supabase } from '../lib/supabaseClient'

export default function MyBusinessCard({ business, userId, onStatusChange }) {
  const [elapsedTime, setElapsedTime] = useState('00:00:00')
  const [currentCheckIn, setCurrentCheckIn] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const timerRef = React.useRef(null)

  React.useEffect(() => {
    loadCheckInStatus()
  }, [business.business_id])

  React.useEffect(() => {
    if (currentCheckIn && currentCheckIn.status === 'checked_in') {
      timerRef.current = setInterval(() => {
        const elapsed = attendanceTimerService.calculateElapsedSeconds(
          currentCheckIn.check_in,
          null
        )
        setElapsedTime(attendanceTimerService.formatElapsedTime(elapsed))
      }, 1000)

      return () => clearInterval(timerRef.current)
    }
  }, [currentCheckIn])

  const loadCheckInStatus = async () => {
    try {
      setLoading(true)
      const { data } = await attendanceTimerService.getCurrentCheckInStatus(
        business.business_id,
        userId
      )

      if (data) {
        setCurrentCheckIn(data)
        const elapsed = attendanceTimerService.calculateElapsedSeconds(
          data.check_in,
          null
        )
        setElapsedTime(attendanceTimerService.formatElapsedTime(elapsed))
      }
    } catch (error) {
      console.error('Error loading check-in status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckIn = async () => {
    try {
      setActionInProgress(true)

      // Get employee ID
      const { data: empData } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!empData) {
        alert('Employee record not found')
        return
      }

      const { data, error } = await attendanceTimerService.checkIn(
        business.business_id,
        empData.id,
        userId
      )

      if (error) throw error

      setCurrentCheckIn(data)
      setElapsedTime('00:00:00')
    } catch (error) {
      const errorMsg = error?.message || JSON.stringify(error)
      console.error('Error checking in:', errorMsg)
      alert(`Check-in failed: ${errorMsg}`)
    } finally {
      setActionInProgress(false)
    }
  }

  const handleCheckOut = async () => {
    if (!currentCheckIn) return

    try {
      setActionInProgress(true)
      const { error } = await attendanceTimerService.checkOut(
        currentCheckIn.id,
        userId
      )

      if (error) throw error

      setCurrentCheckIn(null)
      setElapsedTime('00:00:00')
    } catch (error) {
      const errorMsg = error?.message || JSON.stringify(error)
      console.error('Error checking out:', errorMsg)
      alert(`Check-out failed: ${errorMsg}`)
    } finally {
      setActionInProgress(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <p className="text-slate-500 text-center">Loading...</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow flex flex-col">
      {/* Header */}
      <div className="mb-4 pb-4 border-b border-slate-200">
        <h3 className="text-lg font-bold text-slate-900">{business.business?.business_name}</h3>
        <p className="text-sm text-slate-600 mt-1">{business.assigned_job_title}</p>
      </div>

      {/* Details Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-left mb-4"
      >
        <div className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-2 rounded -mx-2">
          <p className="text-sm font-semibold text-slate-700">Job Details</p>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </button>

      {/* Details */}
      {showDetails && (
        <div className="mb-4 space-y-3 text-sm bg-slate-50 p-3 rounded">
          <div>
            <p className="text-xs text-slate-600 font-semibold uppercase">Pay Rate</p>
            <p className="text-slate-900 font-medium">₱{business.pay_rate?.toFixed(2) || 'Negotiable'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 font-semibold uppercase">Employment Type</p>
            <p className="text-slate-900 font-medium capitalize">{business.employment_type || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 font-semibold uppercase">Start Date</p>
            <p className="text-slate-900 font-medium">
              {new Date(business.start_date).toLocaleDateString()}
            </p>
          </div>
          {business.end_date && (
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">End Date</p>
              <p className="text-slate-900 font-medium">
                {new Date(business.end_date).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Attendance Status */}
      {currentCheckIn ? (
        <div className="mb-4 bg-green-50 border border-green-200 rounded p-3">
          <p className="text-xs text-green-700 font-semibold uppercase mb-2">Currently Checked In</p>
          <p className="text-3xl font-bold text-green-600 font-mono">{elapsedTime}</p>
          <p className="text-xs text-green-700 mt-2">
            Since {new Date(currentCheckIn.check_in).toLocaleTimeString()}
          </p>
          <button
            onClick={handleCheckOut}
            disabled={actionInProgress}
            className="w-full mt-3 px-3 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:bg-slate-300 transition-colors"
          >
            {actionInProgress ? 'Processing...' : 'Check Out'}
          </button>
        </div>
      ) : (
        <div className="mb-4 bg-slate-50 border border-dashed border-slate-300 rounded p-3 text-center">
          <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Not Checked In</p>
          <button
            onClick={handleCheckIn}
            disabled={actionInProgress}
            className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:bg-slate-300 transition-colors"
          >
            {actionInProgress ? 'Processing...' : 'Check In'}
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-auto pt-4 border-t border-slate-200">
        <button className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm font-medium transition-colors">
          View Attendance
        </button>
        <button className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium transition-colors">
          Messages
        </button>
      </div>

      {/* Status Badge */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded font-medium">
          {business.status === 'active' ? '✓ Active' : 'Inactive'}
        </span>
        <span className={`px-2 py-1 rounded font-medium ${
          currentCheckIn
            ? 'bg-green-100 text-green-700'
            : 'bg-slate-100 text-slate-700'
        }`}>
          {currentCheckIn ? '◉ Online' : '◯ Offline'}
        </span>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { attendanceTimerService } from '../lib/attendanceTimerService'

export default function EmployeeAttendanceDashboard({ userId, employeeId }) {
  const [currentCheckIn, setCurrentCheckIn] = useState(null)
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')
  const [businessHours, setBusinessHours] = useState(null)
  const [actionInProgress, setActionInProgress] = useState(false)
  const timerIntervalRef = useRef(null)

  // Load data on mount
  useEffect(() => {
    loadBusinesses()
  }, [employeeId])

  // Load attendance data when business is selected
  useEffect(() => {
    if (selectedBusiness) {
      loadAttendanceData()
    }
  }, [selectedBusiness])

  // Timer interval
  useEffect(() => {
    if (currentCheckIn && currentCheckIn.status === 'checked_in') {
      timerIntervalRef.current = setInterval(() => {
        const elapsed = attendanceTimerService.calculateElapsedSeconds(
          currentCheckIn.check_in,
          null
        )
        setElapsedTime(attendanceTimerService.formatElapsedTime(elapsed))
      }, 1000)

      return () => clearInterval(timerIntervalRef.current)
    }
  }, [currentCheckIn])

  const loadBusinesses = async () => {
    try {
      setLoading(true)

      // Get employee record to find associated businesses
      const { data: empData } = await supabase
        .from('employees')
        .select('business_id')
        .eq('id', employeeId)
        .single()

      if (empData) {
        setSelectedBusiness(empData.business_id)
      }
    } catch (error) {
      const errorMsg = error?.message || JSON.stringify(error)
      console.error('Error loading businesses:', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const loadAttendanceData = async () => {
    if (!selectedBusiness) return

    try {
      setLoading(true)

      // Load business hours
      const { data: hoursData } = await attendanceTimerService.getBusinessHours(selectedBusiness)
      if (hoursData) {
        setBusinessHours(hoursData)
      }

      // Load current check-in status
      const { data: checkInData } = await attendanceTimerService.getCurrentCheckInStatus(
        selectedBusiness,
        employeeId
      )
      if (checkInData) {
        setCurrentCheckIn(checkInData)
        const elapsed = attendanceTimerService.calculateElapsedSeconds(
          checkInData.check_in,
          null
        )
        setElapsedTime(attendanceTimerService.formatElapsedTime(elapsed))
      } else {
        setCurrentCheckIn(null)
        setElapsedTime('00:00:00')
      }

      // Load attendance records
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 1)
      const { data: recordsData } = await attendanceTimerService.getAttendanceRecords(
        selectedBusiness,
        employeeId,
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      )
      setAttendanceRecords(recordsData || [])
    } catch (error) {
      const errorMsg = error?.message || JSON.stringify(error)
      console.error('Error loading attendance data:', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckIn = async () => {
    if (!selectedBusiness) return

    try {
      setActionInProgress(true)
      const { data, error } = await attendanceTimerService.checkIn(
        selectedBusiness,
        employeeId,
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
      const { data, error } = await attendanceTimerService.checkOut(
        currentCheckIn.id,
        userId
      )

      if (error) throw error

      setCurrentCheckIn(null)
      setElapsedTime('00:00:00')

      // Reload records
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 1)
      const { data: recordsData } = await attendanceTimerService.getAttendanceRecords(
        selectedBusiness,
        employeeId,
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      )
      setAttendanceRecords(recordsData || [])
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
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">My Attendance</h1>
          <p className="text-slate-600 mt-2">Track your check-in and check-out times</p>
        </div>

        {/* Business Hours Info */}
        {businessHours && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-slate-900 mb-2">Business Hours</h3>
            <p className="text-sm text-slate-700">
              {businessHours.opening_time} - {businessHours.closing_time}
            </p>
          </div>
        )}

        {/* Current Status with Running Timer */}
        {currentCheckIn ? (
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-slate-600 mb-2">Time Worked</p>
                <div className="text-6xl font-bold text-green-600 font-mono">{elapsedTime}</div>
              </div>
              {currentCheckIn.is_overtime && (
                <div className="bg-orange-100 border border-orange-300 rounded-lg p-4 text-right">
                  <p className="text-xs text-orange-700 font-medium">Overtime</p>
                  <p className="text-2xl font-bold text-orange-600">
                    +{currentCheckIn.is_overtime.toFixed(2)}h
                  </p>
                </div>
              )}
            </div>

            <div className="text-sm text-slate-600 mb-6">
              <p>
                <strong>Checked in at:</strong> {new Date(currentCheckIn.check_in).toLocaleTimeString()}
              </p>
            </div>

            <button
              onClick={handleCheckOut}
              disabled={actionInProgress}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-300 font-medium text-lg transition-colors"
            >
              {actionInProgress ? 'Processing...' : 'Check Out'}
            </button>
          </div>
        ) : (
          <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg p-8 mb-6 text-center">
            <svg className="w-16 h-16 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-600 mb-6 text-lg">You are not currently checked in</p>
            <button
              onClick={handleCheckIn}
              disabled={actionInProgress}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 font-medium text-lg transition-colors"
            >
              {actionInProgress ? 'Processing...' : 'Check In'}
            </button>
          </div>
        )}

        {/* Attendance History */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Attendance History</h2>

          {attendanceRecords.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center border border-slate-200">
              <p className="text-slate-500">No attendance records yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendanceRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-semibold text-slate-900 text-lg">
                        {new Date(record.attendance_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      record.status === 'checked_out'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {record.status === 'checked_out' ? 'Completed' : 'In Progress'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-50 p-3 rounded">
                      <p className="text-slate-600 text-xs font-medium mb-1">CHECK IN</p>
                      <p className="text-slate-900 font-semibold">
                        {new Date(record.check_in).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded">
                      <p className="text-slate-600 text-xs font-medium mb-1">CHECK OUT</p>
                      <p className="text-slate-900 font-semibold">
                        {record.check_out 
                          ? new Date(record.check_out).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })
                          : '-'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-600 mb-1">DURATION</p>
                      <p className="text-slate-900 font-semibold">
                        {attendanceTimerService.formatElapsedTime(record.elapsed_seconds)}
                      </p>
                    </div>
                    {record.is_overtime && (
                      <div className="text-right">
                        <p className="text-xs text-orange-600 font-medium mb-1">OVERTIME</p>
                        <p className="text-orange-600 font-semibold">
                          +{record.is_overtime.toFixed(2)}h
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

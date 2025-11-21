import React, { useState, useEffect, useRef } from 'react'
import { attendanceTimerService } from '../lib/attendanceTimerService'

export default function EmployeeAttendancePanel({
  businessId,
  employee,
  userId,
  isManager = true,
  businessDetails = null
}) {
  const [currentCheckIn, setCurrentCheckIn] = useState(null)
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')
  const [businessHours, setBusinessHours] = useState(null)
  const timerIntervalRef = useRef(null)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [showBusinessHoursForm, setShowBusinessHoursForm] = useState(false)
  const [hoursForm, setHoursForm] = useState({
    opening_time: '09:00',
    closing_time: '17:00',
    monday_enabled: true,
    tuesday_enabled: true,
    wednesday_enabled: true,
    thursday_enabled: true,
    friday_enabled: true,
    saturday_enabled: false,
    sunday_enabled: false
  })

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [businessId, employee.id])

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

  const loadData = async () => {
    try {
      setLoading(true)

      // Load business hours
      const { data: hoursData } = await attendanceTimerService.getBusinessHours(businessId)
      if (hoursData) {
        setBusinessHours(hoursData)
        setHoursForm({
          opening_time: hoursData.opening_time,
          closing_time: hoursData.closing_time,
          monday_enabled: hoursData.monday_enabled,
          tuesday_enabled: hoursData.tuesday_enabled,
          wednesday_enabled: hoursData.wednesday_enabled,
          thursday_enabled: hoursData.thursday_enabled,
          friday_enabled: hoursData.friday_enabled,
          saturday_enabled: hoursData.saturday_enabled,
          sunday_enabled: hoursData.sunday_enabled
        })
      }

      // Load current check-in status
      const { data: checkInData } = await attendanceTimerService.getCurrentCheckInStatus(
        businessId,
        employee.id
      )
      if (checkInData) {
        setCurrentCheckIn(checkInData)
        const elapsed = attendanceTimerService.calculateElapsedSeconds(
          checkInData.check_in,
          null
        )
        setElapsedTime(attendanceTimerService.formatElapsedTime(elapsed))
      }

      // Load attendance records
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 1)
      const { data: recordsData } = await attendanceTimerService.getAttendanceRecords(
        businessId,
        employee.id,
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
    if (!isManager) return

    try {
      setActionInProgress(true)
      const { data, error } = await attendanceTimerService.checkIn(
        businessId,
        employee.id,
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
        businessId,
        employee.id,
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

  const handleSaveBusinessHours = async () => {
    try {
      const { data, error } = await attendanceTimerService.saveBusinessHours(
        businessId,
        { ...hoursForm, id: businessHours?.id }
      )

      if (error) throw error

      setBusinessHours(data)
      setShowBusinessHoursForm(false)
    } catch (error) {
      const errorMsg = error?.message || JSON.stringify(error)
      console.error('Error saving business hours:', errorMsg)
      alert(`Failed to save business hours: ${errorMsg}`)
    }
  }

  const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div className="space-y-6">
      {/* Business Hours (Manager Only) */}
      {isManager && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-900">Business Hours</h4>
            <button
              onClick={() => setShowBusinessHoursForm(!showBusinessHoursForm)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {showBusinessHoursForm ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {showBusinessHoursForm ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Opening Time
                  </label>
                  <input
                    type="time"
                    value={hoursForm.opening_time}
                    onChange={(e) => setHoursForm({ ...hoursForm, opening_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Closing Time
                  </label>
                  <input
                    type="time"
                    value={hoursForm.closing_time}
                    onChange={(e) => setHoursForm({ ...hoursForm, closing_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">Working Days</p>
                <div className="grid grid-cols-2 gap-2">
                  {dayLabels.map((day, index) => (
                    <label key={index} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hoursForm[`${day.toLowerCase()}_enabled`]}
                        onChange={(e) => setHoursForm({
                          ...hoursForm,
                          [`${day.toLowerCase()}_enabled`]: e.target.checked
                        })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-700">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveBusinessHours}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Save Hours
              </button>
            </div>
          ) : (
            <div className="text-sm text-slate-700">
              <p>
                <strong>Hours:</strong> {businessHours?.opening_time || '09:00'} - {businessHours?.closing_time || '17:00'}
              </p>
              <p className="mt-2">
                <strong>Working Days:</strong> {
                  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                    .filter((day, idx) => {
                      const enabled = businessHours?.[`${day.toLowerCase()}_enabled`]
                      return enabled !== false
                    })
                    .join(', ')
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Current Status with Running Timer */}
      {currentCheckIn ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-600">Time Worked</p>
              <div className="text-5xl font-bold text-green-600 font-mono">{elapsedTime}</div>
            </div>
            {currentCheckIn.is_overtime && (
              <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 text-right">
                <p className="text-xs text-orange-700 font-medium">Overtime</p>
                <p className="text-lg font-bold text-orange-600">
                  +{currentCheckIn.is_overtime.toFixed(2)}h
                </p>
              </div>
            )}
          </div>

          <div className="text-sm text-slate-600 mb-4">
            <p>
              <strong>Checked in at:</strong> {new Date(currentCheckIn.check_in).toLocaleTimeString()}
            </p>
          </div>

          {isManager && (
            <button
              onClick={handleCheckOut}
              disabled={actionInProgress}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-300 font-medium"
            >
              {actionInProgress ? 'Processing...' : 'Check Out'}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
          <p className="text-slate-600 mb-4">Not currently checked in</p>
          {isManager && (
            <button
              onClick={handleCheckIn}
              disabled={actionInProgress}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 font-medium"
            >
              {actionInProgress ? 'Processing...' : 'Check In'}
            </button>
          )}
        </div>
      )}

      {/* Attendance History */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-4">Attendance History</h4>

        {loading ? (
          <p className="text-slate-500 text-center py-8">Loading...</p>
        ) : attendanceRecords.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No attendance records</p>
        ) : (
          <div className="space-y-2">
            {attendanceRecords.map((record) => (
              <div
                key={record.id}
                className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-900">
                    {new Date(record.attendance_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    record.status === 'checked_out'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {record.status === 'checked_out' ? 'Completed' : 'In Progress'}
                  </span>
                </div>

                <div className="text-sm text-slate-600 space-y-1">
                  <p>
                    <strong>Check In:</strong> {new Date(record.check_in).toLocaleTimeString()}
                  </p>
                  {record.check_out && (
                    <p>
                      <strong>Check Out:</strong> {new Date(record.check_out).toLocaleTimeString()}
                    </p>
                  )}
                  <p>
                    <strong>Duration:</strong> {attendanceTimerService.formatElapsedTime(record.elapsed_seconds)}
                  </p>
                  {record.is_overtime && (
                    <p className="text-orange-600">
                      <strong>Overtime:</strong> {record.is_overtime.toFixed(2)} hours
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

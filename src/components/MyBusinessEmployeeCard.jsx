import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { EmployeeManagementService } from '../lib/employeeManagementService'
import { formatFieldValue } from '../lib/formatters'
import AttendanceCheckInModal from './AttendanceCheckInModal'
import './MyBusinessEmployeeCard.css'

export default function MyBusinessEmployeeCard({ assignment, userId, onUpdate }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false)

  // Load today's attendance record
  useEffect(() => {
    loadTodayAttendance()
  }, [assignment.id, userId])

  const loadTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error: err } = await supabase
        .from('employee_attendance')
        .select('*')
        .eq('employee_id', assignment.employee_id)
        .eq('business_id', assignment.business_id)
        .eq('attendance_date', today)
        .maybeSingle()

      if (err) {
        console.error('Error loading attendance:', err)
      } else {
        setTodayAttendance(data)
      }
    } catch (err) {
      console.error('Error loading today attendance:', err)
    }
  }

  const handleCheckIn = async (checkInData) => {
    setIsLoading(true)
    setError('')

    try {
      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toISOString()

      // Check if attendance record exists for today
      const { data: existingAttendance } = await supabase
        .from('employee_attendance')
        .select('*')
        .eq('employee_id', assignment.employee_id)
        .eq('business_id', assignment.business_id)
        .eq('attendance_date', today)
        .maybeSingle()

      if (existingAttendance) {
        // Update existing record with check-in time
        const { error: updateError } = await supabase
          .from('employee_attendance')
          .update({
            check_in_time: checkInData.checkInTime || now,
            location: checkInData.location || null,
            notes: checkInData.notes || null,
            status: 'present'
          })
          .eq('id', existingAttendance.id)

        if (updateError) throw updateError
      } else {
        // Create new attendance record
        const { error: insertError } = await supabase
          .from('employee_attendance')
          .insert([{
            employee_id: assignment.employee_id,
            business_id: assignment.business_id,
            user_id: userId,
            attendance_date: today,
            check_in_time: checkInData.checkInTime || now,
            location: checkInData.location || null,
            notes: checkInData.notes || null,
            status: 'present'
          }])

        if (insertError) throw insertError
      }

      setShowCheckInModal(false)
      await loadTodayAttendance()
      setError('Attendance recorded successfully!')
      setTimeout(() => setError(''), 3000)
    } catch (err) {
      console.error('Error recording attendance:', err)
      setError('Failed to record attendance. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!todayAttendance) {
      setError('Please check in first before checking out')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const now = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('employee_attendance')
        .update({
          check_out_time: now,
          status: 'present'
        })
        .eq('id', todayAttendance.id)

      if (updateError) throw updateError

      await loadTodayAttendance()
      setError('Check-out recorded successfully!')
      setTimeout(() => setError(''), 3000)
    } catch (err) {
      console.error('Error recording check-out:', err)
      setError('Failed to record check-out. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTerminate = async () => {
    if (!showTerminateConfirm) {
      setShowTerminateConfirm(true)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { error: err } = await supabase
        .from('job_applications')
        .update({
          status: 'rejected'
        })
        .eq('id', assignment.id)

      if (err) throw err

      setShowTerminateConfirm(false)
      setError('Employment terminated')
      setTimeout(() => {
        onUpdate()
      }, 1000)
    } catch (err) {
      console.error('Error terminating employment:', err)
      setError('Failed to terminate employment. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return 'Not recorded'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const calculateHoursWorked = () => {
    if (!todayAttendance?.check_in_time || !todayAttendance?.check_out_time) {
      return null
    }

    const checkIn = new Date(todayAttendance.check_in_time)
    const checkOut = new Date(todayAttendance.check_out_time)
    const hoursWorked = (checkOut - checkIn) / (1000 * 60 * 60)

    return hoursWorked.toFixed(2)
  }

  return (
    <div className="my-business-employee-card">
      {error && (
        <div className={`card-error ${error.toLowerCase().includes('success') ? 'success' : ''}`}>
          {error}
        </div>
      )}

      <div className="business-header">
        <div className="business-info">
          <h3 className="business-name">{assignment.business?.business_name}</h3>
          <p className="job-title">{assignment.assigned_job_title}</p>
        </div>
        <div className="employment-status">
          <span className={`status-badge ${assignment.status}`}>
            {formatFieldValue(assignment.status)}
          </span>
        </div>
      </div>

      <div className="employment-details">
        <div className="detail-item">
          <span className="label">Position:</span>
          <span className="value">{assignment.assigned_job_title}</span>
        </div>
        {assignment.assigned_job_category && (
          <div className="detail-item">
            <span className="label">Category:</span>
            <span className="value">{assignment.assigned_job_category}</span>
          </div>
        )}
        <div className="detail-item">
          <span className="label">Pay Rate:</span>
          <span className="value">₱{assignment.pay_rate?.toFixed(2)} / {formatFieldValue(assignment.employment_type)}</span>
        </div>
        <div className="detail-item">
          <span className="label">Start Date:</span>
          <span className="value">{new Date(assignment.start_date).toLocaleDateString()}</span>
        </div>
        {assignment.end_date && (
          <div className="detail-item">
            <span className="label">End Date:</span>
            <span className="value">{new Date(assignment.end_date).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Attendance Section */}
      <div className="attendance-section">
        <h4>Today's Attendance</h4>

        {todayAttendance ? (
          <div className="attendance-status">
            <div className="attendance-item">
              <span className="label">Check In:</span>
              <span className="value">{formatTime(todayAttendance.check_in_time)}</span>
            </div>
            <div className="attendance-item">
              <span className="label">Check Out:</span>
              <span className="value">{formatTime(todayAttendance.check_out_time)}</span>
            </div>
            {calculateHoursWorked() && (
              <div className="attendance-item">
                <span className="label">Hours Worked:</span>
                <span className="value">{calculateHoursWorked()} hrs</span>
              </div>
            )}
          </div>
        ) : (
          <div className="no-attendance">
            <p>No attendance recorded for today</p>
          </div>
        )}

        <div className="attendance-actions">
          {!todayAttendance || !todayAttendance.check_in_time ? (
            <button
              className="btn-check-in"
              onClick={() => setShowCheckInModal(true)}
              disabled={isLoading}
            >
              Check In
            </button>
          ) : !todayAttendance.check_out_time ? (
            <button
              className="btn-check-out"
              onClick={handleCheckOut}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Check Out'}
            </button>
          ) : (
            <div className="checked-out-badge">
              ✓ Checked out for today
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="business-actions">
        <button
          className="btn-secondary"
          onClick={() => window.location.href = `/merchant/${assignment.business_id}`}
        >
          View Business
        </button>
        <button
          className="btn-danger"
          onClick={handleTerminate}
          disabled={isLoading}
        >
          {showTerminateConfirm ? 'Confirm Termination?' : 'Terminate Employment'}
        </button>
      </div>

      {/* Check In Modal */}
      {showCheckInModal && (
        <AttendanceCheckInModal
          onClose={() => setShowCheckInModal(false)}
          onSubmit={handleCheckIn}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}

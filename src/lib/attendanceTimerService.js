import { supabase } from './supabaseClient'

export const attendanceTimerService = {
  // Get or create business hours
  async getBusinessHours(businessId) {
    try {
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('business_id', businessId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[attendanceTimerService] getBusinessHours failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // Save or update business hours
  async saveBusinessHours(businessId, hours) {
    try {
      const { data, error } = await supabase
        .from('business_hours')
        .upsert([{
          id: hours.id || undefined,
          business_id: businessId,
          opening_time: hours.opening_time, // HH:MM format
          closing_time: hours.closing_time, // HH:MM format
          monday_enabled: hours.monday_enabled ?? true,
          tuesday_enabled: hours.tuesday_enabled ?? true,
          wednesday_enabled: hours.wednesday_enabled ?? true,
          thursday_enabled: hours.thursday_enabled ?? true,
          friday_enabled: hours.friday_enabled ?? true,
          saturday_enabled: hours.saturday_enabled ?? false,
          sunday_enabled: hours.sunday_enabled ?? false,
          updated_at: new Date().toISOString()
        }], { onConflict: 'business_id' })
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[attendanceTimerService] saveBusinessHours failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // Check in employee
  async checkIn(businessId, employeeId, userId) {
    try {
      const now = new Date()
      const today = now.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('employee_attendance')
        .insert([{
          id: crypto.randomUUID(),
          business_id: businessId,
          employee_id: employeeId,
          checked_in_by_user_id: userId,
          check_in: now.toISOString(),
          attendance_date: today,
          status: 'checked_in',
          created_at: now.toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[attendanceTimerService] checkIn failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // Check out employee
  async checkOut(attendanceId, userId) {
    try {
      const now = new Date()

      const { data, error } = await supabase
        .from('employee_attendance')
        .update({
          check_out: now.toISOString(),
          checked_out_by_user_id: userId,
          status: 'checked_out',
          updated_at: now.toISOString()
        })
        .eq('id', attendanceId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[attendanceTimerService] checkOut failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // Auto checkout if past closing time
  async autoCheckOutIfNeeded(businessId, employeeId, closingTime) {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Get current check-in record
      const { data: currentRecord } = await supabase
        .from('employee_attendance')
        .select('*')
        .eq('business_id', businessId)
        .eq('employee_id', employeeId)
        .eq('attendance_date', today)
        .eq('status', 'checked_in')
        .single()

      if (!currentRecord) return { data: null, error: null }

      // Parse closing time
      const [closingHour, closingMin] = closingTime.split(':').map(Number)
      const closingDate = new Date()
      closingDate.setHours(closingHour, closingMin, 0, 0)

      // If current time is past closing time, auto checkout
      if (new Date() > closingDate) {
        return this.checkOut(currentRecord.id, 'system_auto_checkout')
      }

      return { data: null, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[attendanceTimerService] autoCheckOutIfNeeded failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // Get current check-in status
  async getCurrentCheckInStatus(businessId, employeeId) {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('employee_attendance')
        .select('*')
        .eq('business_id', businessId)
        .eq('employee_id', employeeId)
        .eq('attendance_date', today)
        .eq('status', 'checked_in')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[attendanceTimerService] getCurrentCheckInStatus failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // Get attendance records with elapsed time calculation
  async getAttendanceRecords(businessId, employeeId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('employee_attendance')
        .select('*')
        .eq('business_id', businessId)
        .eq('employee_id', employeeId)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('attendance_date', { ascending: false })

      if (error) throw error

      // Calculate elapsed time for each record
      return {
        data: (data || []).map(record => ({
          ...record,
          elapsed_seconds: this.calculateElapsedSeconds(record.check_in, record.check_out),
          is_overtime: this.isOvertime(record.check_in, record.check_out)
        })),
        error: null
      }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[attendanceTimerService] getAttendanceRecords failed:', errorMsg)
      return { data: [], error: err }
    }
  },

  // Calculate elapsed seconds between check in and check out
  calculateElapsedSeconds(checkInTime, checkOutTime) {
    if (!checkInTime) return 0
    if (!checkOutTime) {
      // If still checked in, calculate from check-in to now
      return Math.floor((new Date() - new Date(checkInTime)) / 1000)
    }
    return Math.floor((new Date(checkOutTime) - new Date(checkInTime)) / 1000)
  },

  // Format elapsed time as HH:MM:SS
  formatElapsedTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  },

  // Check if overtime
  isOvertime(checkInTime, checkOutTime, standardHours = 8) {
    const elapsedSeconds = this.calculateElapsedSeconds(checkInTime, checkOutTime)
    const elapsedHours = elapsedSeconds / 3600
    return elapsedHours > standardHours
  },

  // Get overtime hours
  getOvertimeHours(checkInTime, checkOutTime, standardHours = 8) {
    const elapsedSeconds = this.calculateElapsedSeconds(checkInTime, checkOutTime)
    const elapsedHours = elapsedSeconds / 3600
    return Math.max(0, elapsedHours - standardHours)
  },

  // Subscribe to attendance changes
  subscribeToAttendance(businessId, employeeId, callback) {
    try {
      const channel = supabase
        .channel(`attendance:${businessId}:${employeeId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'employee_attendance',
          filter: `business_id=eq.${businessId},employee_id=eq.${employeeId}`
        }, (payload) => {
          callback(payload)
        })
        .subscribe()

      return {
        unsubscribe: () => {
          channel.unsubscribe()
        }
      }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[attendanceTimerService] subscribeToAttendance failed:', errorMsg)
      return { unsubscribe: () => {} }
    }
  }
}

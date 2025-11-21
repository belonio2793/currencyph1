# Attendance Timer System - Complete Implementation Guide

## Overview

A comprehensive attendance tracking system with running timers, business hours configuration, overtime tracking, and dual perspectives for both managers and employees.

## Features Implemented

### 1. **Running Timer System**
- Real-time HH:MM:SS format timer
- Tracks elapsed time from check-in to check-out
- Automatic updates without page reload
- Shows current session duration with live countdown

### 2. **Business Hours Configuration**
- Per-business opening and closing times (HH:MM format)
- Day-of-week work schedule configuration
- Configurable by business owners/managers
- Accessible in employee modal attendance panel

### 3. **Auto-Checkout Functionality**
- Automatic check-out at closing time if not manually checked out
- System tracks auto-checkouts vs manual checkouts
- Prevents unlimited work sessions
- Respects business closure hours

### 4. **Overtime Tracking**
- Automatic overtime calculation (default 8 hours/day standard)
- Visual indicators for overtime hours
- Overtime data stored separately for payroll processing
- Configurable standard hours

### 5. **Dual Interface Perspectives**

#### Manager/Employer View (in Employees & Payroll Modal)
- Set and manage business hours for the business
- Check employees in/out manually
- View running timer for checked-in employees
- See employee current status (checked in, checked out)
- Access attendance history with elapsed times
- View overtime hours per employee
- Add notes to attendance records

#### Employee Self-Service View (My Attendance Dashboard)
- Check themselves in/out via navbar link
- Real-time running timer while checked in
- View personal attendance history
- See own overtime tracking
- Transparent view of own working hours
- Access from "My Attendance" in navbar

### 6. **Permission-Based Controls**
- **Managers**: Full control over business hours and employee attendance
- **Employees**: Self-service check-in/out and view own records
- **View Permissions**: Employees see only their data; managers see their business employees
- **Edit Permissions**: Only owners can change business hours

### 7. **Transparency Features**
- Time worked calculated and displayed in HH:MM:SS format
- Check-in and check-out timestamps visible
- Overtime hours clearly marked
- Attendance history available to relevant users
- Date-based organization of records

## Components Created

### Services
**`src/lib/attendanceTimerService.js`** (257 lines)
- Check-in/check-out functionality
- Business hours management
- Timer calculations
- Status determination
- Real-time subscriptions
- Auto-checkout logic

### UI Components

**`src/components/EmployeeAttendancePanel.jsx`** (377 lines)
- Manager view for employee attendance
- Running timer display
- Check-in/out controls (manager only)
- Business hours configuration UI
- Attendance history table
- Overtime indicators

**`src/components/EmployeeAttendanceDashboard.jsx`** (329 lines)
- Employee self-service dashboard
- Personal check-in/out interface
- Running timer display (larger)
- Attendance history with formatting
- Business hours information display
- Overtime tracking visibility

### Integration Updates

**`src/App.jsx`**
- Added attendance route/tab
- Integrated EmployeeAttendanceDashboard
- Hooked into main app navigation

**`src/components/Navbar.jsx`**
- Added "My Attendance" link in navigation
- Makes dashboard accessible to employees

**`src/components/EmployeesModal.jsx`**
- Replaced old attendance UI with EmployeeAttendancePanel
- Removed deprecated check-in/out functions
- Cleaner manager interface

## Database Schema

### Tables Created

1. **business_hours**
   - Stores opening/closing times per business
   - Day-of-week availability flags
   - UNIQUE constraint on business_id

2. **employee_attendance** (Enhanced)
   - Check-in/check-out timestamps
   - Current status tracking
   - User IDs for who initiated check-in/out
   - Notes field for managers
   - Unique constraint on daily check-in

3. **employee_overtime** (Optional)
   - Overtime hours calculation
   - Status tracking (pending/approved/paid)
   - Linked to attendance records

4. **employee_attendance_summary**
   - Monthly summaries for quick stats
   - Total hours worked per month
   - Total overtime hours
   - Days worked count

### Indexes
- Optimized queries for daily attendance
- Fast lookups by date range
- Efficient status filtering
- Month-year summaries

### Views
- `v_current_checkin_status`: Shows employees currently checked in
- `v_daily_attendance_summary`: Daily aggregate data

### Functions
- `auto_checkout_past_closing_time()`: System function for auto-checkout
- `calc_elapsed_seconds()`: Calculate elapsed time safely

## Setup Instructions

### Step 1: Create Database Tables

1. Go to Supabase SQL Editor
2. Copy and paste the contents of `ATTENDANCE_SYSTEM_SETUP.sql`
3. Run the SQL script
4. Verify all tables are created:
   - `business_hours`
   - `employee_attendance`
   - `employee_overtime`
   - `employee_attendance_summary`

### Step 2: Verify Realtime is Enabled

In Supabase:
```sql
-- Check if realtime is enabled for attendance tables
SELECT * FROM pg_publication;

-- If needed, enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE employee_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE business_hours;
```

### Step 3: Test the System

1. **Manager Testing**:
   - Open "My Business" → "Employees & Payroll"
   - Select an employee
   - Go to "Attendance" tab
   - Set business hours
   - Click "Check In" button
   - Verify timer starts counting
   - Click "Check Out" to stop

2. **Employee Testing**:
   - Log in as an employee
   - Click "My Attendance" in navbar
   - Click "Check In"
   - Verify timer starts
   - Click "Check Out"
   - Check attendance history

### Step 4: Configure Business Hours

For each business:
1. Go to Employees & Payroll → Employee → Attendance
2. Click "Edit" next to Business Hours
3. Set opening and closing times
4. Select working days (Mon-Fri is default)
5. Click "Save Hours"

## API/Function Usage

### Check In
```javascript
const { data, error } = await attendanceTimerService.checkIn(
  businessId,
  employeeId,
  userId
)
```

### Check Out
```javascript
const { data, error } = await attendanceTimerService.checkOut(
  attendanceId,
  userId
)
```

### Get Current Status
```javascript
const { data, error } = await attendanceTimerService.getCurrentCheckInStatus(
  businessId,
  employeeId
)
```

### Get Business Hours
```javascript
const { data, error } = await attendanceTimerService.getBusinessHours(
  businessId
)
```

### Save Business Hours
```javascript
const { data, error } = await attendanceTimerService.saveBusinessHours(
  businessId,
  {
    opening_time: '09:00',
    closing_time: '17:00',
    monday_enabled: true,
    // ... other days
  }
)
```

### Format Elapsed Time
```javascript
const formatted = attendanceTimerService.formatElapsedTime(3661) // "01:01:01"
```

### Get Overtime Hours
```javascript
const overtime = attendanceTimerService.getOvertimeHours(
  checkInTime,
  checkOutTime,
  8 // standard hours
) // Returns number of overtime hours
```

## Time Calculations

- **Elapsed Time**: Calculated from check-in to check-out (or current time if checked in)
- **Overtime**: Hours worked beyond 8 hours (configurable)
- **Format**: HH:MM:SS (Hours:Minutes:Seconds)

## Status Indicators

- **Green (Online/Checked In)**: Employee is currently checked in
- **Yellow (Idle)**: Had recent activity in last 30 minutes
- **Slate (Offline/Checked Out)**: Not currently checked in

## Real-Time Features

- Timer updates every second without page reload
- Subscription to attendance changes
- Live updates when check-in/out happens
- Automatic UI refresh on record changes

## Row-Level Security (RLS)

- Employees see only their own attendance
- Managers see employees in their businesses
- Business owners control business hours
- Policies enforce proper data access

## Performance Optimizations

- Indexed queries for fast lookups
- Monthly summary table for year-to-date stats
- Efficient date-range queries
- Real-time subscriptions for minimal polling

## Common Issues & Solutions

### Issue: Timer not updating
**Solution**: Check browser console for errors. Ensure real-time is enabled in Supabase.

### Issue: Can't check out
**Solution**: Verify the employee is checked in (status='checked_in'). Check database directly if needed.

### Issue: Business hours not saving
**Solution**: Ensure you have proper permissions and the business_id is correct.

### Issue: Overtime not calculating
**Solution**: Verify check-out time is recorded. Overtime is calculated only after check-out.

## Troubleshooting

1. **Check Logs**: Open browser DevTools → Console for error messages
2. **Verify Tables**: 
   ```sql
   SELECT * FROM business_hours LIMIT 1;
   SELECT * FROM employee_attendance LIMIT 1;
   ```
3. **Check RLS Policies**: Ensure policies allow your operations
4. **Enable Debug Mode**: Add console.logs in attendanceTimerService.js

## Future Enhancements

- Break time tracking
- Location-based check-in
- Geofencing for automatic check-in
- Mobile app integration
- SMS notifications
- Payroll integration
- Export to CSV/PDF
- Custom overtime rules per employee
- Shift scheduling
- Approval workflow for overtime

## Support

For issues or questions:
1. Check the console for error messages
2. Verify database schema is correct
3. Check RLS policies
4. Enable real-time subscriptions
5. Review attendance records in Supabase dashboard

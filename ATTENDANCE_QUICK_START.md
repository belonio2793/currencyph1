# Attendance System - Quick Start Checklist

## ⚡ 5-Minute Setup

### Step 1: Run Database Schema (2 minutes)
- [ ] Go to Supabase → SQL Editor
- [ ] Create a new query
- [ ] Copy entire content of `ATTENDANCE_SYSTEM_SETUP.sql`
- [ ] Click "Run"
- [ ] Wait for completion (should see "Query successful")

### Step 2: Verify Tables Created (1 minute)
```sql
-- Run this query to verify all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%attendance%' 
OR table_name = 'business_hours';
```

You should see:
- business_hours ✓
- employee_attendance ✓
- employee_overtime ✓
- employee_attendance_summary ✓

### Step 3: Test the System (2 minutes)

**As a Manager:**
1. Go to "My Business" → Select a business
2. Click "Employees & Payroll"
3. Select an employee
4. Go to "Attendance" tab
5. Click "Edit" next to "Business Hours" (set your hours)
6. Click "Check In"
7. Watch the timer count up in HH:MM:SS format
8. Click "Check Out"
9. Verify record shows in history

**As an Employee:**
1. Click "My Attendance" in the navbar
2. Click "Check In"
3. Watch the big timer run
4. Click "Check Out"
5. See your record in history

## 🎯 What You Get

| Feature | Manager | Employee |
|---------|---------|----------|
| Check-in/out | ✓ (others) | ✓ (self) |
| Running timer | ✓ | ✓ |
| Set business hours | ✓ | - |
| View history | ✓ (team) | ✓ (self) |
| Overtime tracking | ✓ | ✓ |
| Export data | Planned | Planned |

## 📁 Files Created/Modified

### New Files
- `src/lib/attendanceTimerService.js` - Core logic
- `src/components/EmployeeAttendancePanel.jsx` - Manager view
- `src/components/EmployeeAttendanceDashboard.jsx` - Employee view
- `ATTENDANCE_SYSTEM_SETUP.sql` - Database schema
- `ATTENDANCE_SYSTEM_GUIDE.md` - Full documentation

### Modified Files
- `src/App.jsx` - Added attendance route
- `src/components/Navbar.jsx` - Added "My Attendance" button
- `src/components/EmployeesModal.jsx` - Updated attendance tab

## 🚀 Usage

### For Managers
1. Navigate to: My Business → Employees & Payroll
2. Select employee
3. Click "Attendance" tab
4. Manage business hours and employee check-in/out

### For Employees
1. Click "My Attendance" in navbar
2. Check yourself in/out
3. View your attendance history and overtime

## ⏱️ Timer Format

- **HH:MM:SS** - Hours:Minutes:Seconds
- Updates every 1 second
- Continues even if you navigate away (with real-time)

## 🔍 Testing Checklist

- [ ] Can set opening/closing times
- [ ] Can check employees in
- [ ] Timer counts up every second
- [ ] Can check employees out
- [ ] Elapsed time is calculated correctly
- [ ] Can view attendance history
- [ ] Employee dashboard is accessible
- [ ] Employee can check themselves in/out
- [ ] Overtime shows when hours > 8
- [ ] Real-time updates work (no page refresh needed)

## 🐛 Troubleshooting

**Timer not starting?**
- Check browser console for errors
- Verify employee is marked as "Registered" in the system
- Try refreshing the page

**Can't see "Check In" button?**
- Make sure you have manager permissions for the business
- Verify the employee exists and is linked to the business

**Attendance history empty?**
- Check that employee is checked in/out
- Verify database query: `SELECT * FROM employee_attendance LIMIT 5;`

**Timer not counting?**
- Clear browser cache
- Disable browser extensions
- Check console for JavaScript errors

## 📞 Support

For issues:
1. Check `ATTENDANCE_SYSTEM_GUIDE.md` for detailed help
2. Review database tables in Supabase SQL Editor
3. Check browser DevTools → Console for errors
4. Verify RLS policies allow your operations

## 🎉 You're Ready!

The attendance system is now fully integrated and ready to use. Start tracking employee hours!

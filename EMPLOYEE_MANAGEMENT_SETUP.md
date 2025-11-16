# Employee Management System - Database Schema

This document outlines the required Supabase tables for the comprehensive employee management system.

## Tables to Create in Supabase

### 1. employees
Stores employee records with personal and tax information.

```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  position TEXT NOT NULL,
  department TEXT,
  employment_status TEXT DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'terminated', 'on_leave')),
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  hire_date DATE NOT NULL,
  tin TEXT,
  sss_number TEXT,
  philhealth_number TEXT,
  pagibig_number TEXT,
  emergency_contact TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, email)
);
```

### 2. employee_attendance
Records daily attendance with check-in and check-out timestamps.

```sql
CREATE TABLE employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  hours_worked DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, attendance_date)
);
```

### 3. employee_medical_records
Stores medical records and health information.

```sql
CREATE TABLE employee_medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  description TEXT,
  date_recorded DATE,
  healthcare_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. employee_benefits
Stores benefits information for each employee.

```sql
CREATE TABLE employee_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  has_health_insurance BOOLEAN DEFAULT false,
  health_insurance_provider TEXT,
  has_life_insurance BOOLEAN DEFAULT false,
  life_insurance_provider TEXT,
  allowance_type TEXT,
  allowance_amount DECIMAL(12,2) DEFAULT 0,
  other_benefits TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id)
);
```

### 5. employee_performance
Stores performance reviews and ratings.

```sql
CREATE TABLE employee_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  reviewer_name TEXT NOT NULL,
  rating DECIMAL(3,2) CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  performance_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 6. payroll
Main payroll records per employee per pay period.

```sql
CREATE TABLE payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  base_salary DECIMAL(12,2) NOT NULL,
  gross_salary DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 7. payroll_deductions
Stores deductions for each payroll record.

```sql
CREATE TABLE payroll_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
  sss DECIMAL(12,2) DEFAULT 0,
  philhealth DECIMAL(12,2) DEFAULT 0,
  pagibig DECIMAL(12,2) DEFAULT 0,
  withholding_tax DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(payroll_id)
);
```

### 8. payroll_payments
Records payment transactions for payroll.

```sql
CREATE TABLE payroll_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  payment_date DATE NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL,
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Steps to Create Tables

1. Go to Supabase Dashboard
2. Open SQL Editor
3. Create a new query
4. Copy and paste each table creation SQL above
5. Run each query

## Notes

- All employee IDs use UUID format
- All timestamps are in UTC (TIMESTAMPTZ)
- Foreign keys enforce referential integrity
- Unique constraints prevent duplicate records where applicable
- The employment_status field uses CHECK constraints for valid values
- Performance ratings are from 1-5 scale
- Philippine tax deductions are supported (SSS, PhilHealth, PagIBIG, Withholding Tax)

## Required Indexes (Optional but Recommended)

```sql
CREATE INDEX idx_employees_business_id ON employees(business_id);
CREATE INDEX idx_attendance_employee_id ON employee_attendance(employee_id);
CREATE INDEX idx_attendance_date ON employee_attendance(attendance_date);
CREATE INDEX idx_payroll_business_employee ON payroll(business_id, employee_id);
CREATE INDEX idx_payroll_status ON payroll(status);
```

## RLS Policies (Row Level Security)

If using RLS, implement policies to:
- Only business owners can view/manage their employees
- Employees can only view their own records
- Payroll data is restricted to business owners only

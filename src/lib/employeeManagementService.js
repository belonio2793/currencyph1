import { supabase } from './supabaseClient'

// Philippine deduction rates
const PH_DEDUCTIONS = {
  SSS: 0.045,       // 4.5% employee contribution
  PHILHEALTH: 0.0175, // 1.75% employee contribution
  PAGIBIG: 0.01,     // 1% employee contribution
  WITHHOLDING_TAX_RATE: 0.12 // 12% tax rate
}

class EmployeeManagementService {
  // ===== EMPLOYEE MANAGEMENT =====
  
  static async createEmployee(businessId, employeeData) {
    const { data, error } = await supabase
      .from('employees')
      .insert([{
        id: crypto.randomUUID(),
        business_id: businessId,
        first_name: employeeData.firstName,
        last_name: employeeData.lastName,
        email: employeeData.email,
        phone: employeeData.phone,
        position: employeeData.position,
        department: employeeData.department,
        employment_status: employeeData.employmentStatus || 'active',
        base_salary: employeeData.baseSalary || 0,
        hire_date: employeeData.hireDate,
        tin: employeeData.tin || null,
        sss_number: employeeData.sssNumber || null,
        philhealth_number: employeeData.philhealthNumber || null,
        pagibig_number: employeeData.pagibigNumber || null,
        emergency_contact: employeeData.emergencyContact || null,
        emergency_contact_phone: employeeData.emergencyContactPhone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()

    if (error) throw error
    return data[0]
  }

  static async getEmployees(businessId) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async getEmployee(employeeId) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single()

    if (error) throw error
    return data
  }

  static async updateEmployee(employeeId, updates) {
    const { data, error } = await supabase
      .from('employees')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', employeeId)
      .select()

    if (error) throw error
    return data[0]
  }

  static async deleteEmployee(employeeId) {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId)

    if (error) throw error
  }

  // ===== ATTENDANCE MANAGEMENT =====

  static async recordAttendance(employeeId, type = 'check-in') {
    const timestamp = new Date().toISOString()
    
    if (type === 'check-in') {
      const { data, error } = await supabase
        .from('employee_attendance')
        .insert([{
          id: crypto.randomUUID(),
          employee_id: employeeId,
          check_in: timestamp,
          attendance_date: new Date().toISOString().split('T')[0],
          created_at: timestamp
        }])
        .select()

      if (error) throw error
      return data[0]
    } else if (type === 'check-out') {
      const today = new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('employee_attendance')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('attendance_date', today)
        .single()

      if (existing) {
        const { data, error } = await supabase
          .from('employee_attendance')
          .update({ check_out: timestamp, updated_at: timestamp })
          .eq('id', existing.id)
          .select()

        if (error) throw error
        return data[0]
      }
    }
  }

  static async getAttendanceRecords(employeeId, startDate, endDate) {
    const { data, error } = await supabase
      .from('employee_attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .order('attendance_date', { ascending: false })

    if (error) throw error
    return data || []
  }

  static calculateHoursWorked(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0
    const inTime = new Date(checkIn)
    const outTime = new Date(checkOut)
    return (outTime - inTime) / (1000 * 60 * 60) // Convert to hours
  }

  // ===== MEDICAL RECORDS =====

  static async saveMedicalRecord(employeeId, recordData) {
    const { data, error } = await supabase
      .from('employee_medical_records')
      .insert([{
        id: crypto.randomUUID(),
        employee_id: employeeId,
        record_type: recordData.recordType,
        description: recordData.description,
        date_recorded: recordData.dateRecorded,
        healthcare_provider: recordData.healthcareProvider || null,
        created_at: new Date().toISOString()
      }])
      .select()

    if (error) throw error
    return data[0]
  }

  static async getMedicalRecords(employeeId) {
    const { data, error } = await supabase
      .from('employee_medical_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('date_recorded', { ascending: false })

    if (error) throw error
    return data || []
  }

  // ===== BENEFITS MANAGEMENT =====

  static async saveBenefits(employeeId, benefitsData) {
    const { data, error } = await supabase
      .from('employee_benefits')
      .upsert([{
        id: benefitsData.id || crypto.randomUUID(),
        employee_id: employeeId,
        has_health_insurance: benefitsData.hasHealthInsurance || false,
        health_insurance_provider: benefitsData.healthInsuranceProvider || null,
        has_life_insurance: benefitsData.hasLifeInsurance || false,
        life_insurance_provider: benefitsData.lifeInsuranceProvider || null,
        allowance_type: benefitsData.allowanceType || null,
        allowance_amount: benefitsData.allowanceAmount || 0,
        other_benefits: benefitsData.otherBenefits || null,
        updated_at: new Date().toISOString()
      }], { onConflict: 'id' })
      .select()

    if (error) throw error
    return data[0]
  }

  static async getBenefits(employeeId) {
    const { data, error } = await supabase
      .from('employee_benefits')
      .select('*')
      .eq('employee_id', employeeId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  }

  // ===== PERFORMANCE MANAGEMENT =====

  static async savePerformanceReview(employeeId, reviewData) {
    const { data, error } = await supabase
      .from('employee_performance')
      .insert([{
        id: crypto.randomUUID(),
        employee_id: employeeId,
        review_date: reviewData.reviewDate,
        reviewer_name: reviewData.reviewerName,
        rating: reviewData.rating,
        comments: reviewData.comments,
        performance_metrics: reviewData.performanceMetrics,
        created_at: new Date().toISOString()
      }])
      .select()

    if (error) throw error
    return data[0]
  }

  static async getPerformanceReviews(employeeId) {
    const { data, error } = await supabase
      .from('employee_performance')
      .select('*')
      .eq('employee_id', employeeId)
      .order('review_date', { ascending: false })

    if (error) throw error
    return data || []
  }

  // ===== PAYROLL MANAGEMENT =====

  static async createPayroll(businessId, payrollData) {
    const { data, error } = await supabase
      .from('payroll')
      .insert([{
        id: crypto.randomUUID(),
        business_id: businessId,
        employee_id: payrollData.employeeId,
        pay_period_start: payrollData.payPeriodStart,
        pay_period_end: payrollData.payPeriodEnd,
        base_salary: payrollData.baseSalary,
        gross_salary: payrollData.grossSalary,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()

    if (error) throw error
    return data[0]
  }

  static async getPayrollRecords(businessId, employeeId) {
    const { data, error } = await supabase
      .from('payroll')
      .select('*')
      .eq('business_id', businessId)
      .eq('employee_id', employeeId)
      .order('pay_period_end', { ascending: false })

    if (error) throw error
    return data || []
  }

  // ===== PAYROLL DEDUCTIONS =====

  static async calculateDeductions(grossSalary) {
    return {
      sss: grossSalary * PH_DEDUCTIONS.SSS,
      philhealth: grossSalary * PH_DEDUCTIONS.PHILHEALTH,
      pagibig: grossSalary * PH_DEDUCTIONS.PAGIBIG,
      withholdingTax: this.calculateWithholdingTax(grossSalary)
    }
  }

  static calculateWithholdingTax(grossSalary) {
    // Simplified BIR withholding tax calculation
    // In production, use actual tax tables based on gross salary
    return grossSalary * PH_DEDUCTIONS.WITHHOLDING_TAX_RATE
  }

  static async saveDeductions(payrollId, deductionsData) {
    const { data, error } = await supabase
      .from('payroll_deductions')
      .insert([{
        id: crypto.randomUUID(),
        payroll_id: payrollId,
        sss: deductionsData.sss,
        philhealth: deductionsData.philhealth,
        pagibig: deductionsData.pagibig,
        withholding_tax: deductionsData.withholdingTax,
        other_deductions: deductionsData.otherDeductions || 0,
        total_deductions: deductionsData.sss + deductionsData.philhealth + deductionsData.pagibig + deductionsData.withholdingTax + (deductionsData.otherDeductions || 0),
        created_at: new Date().toISOString()
      }])
      .select()

    if (error) throw error
    return data[0]
  }

  static async getDeductions(payrollId) {
    const { data, error } = await supabase
      .from('payroll_deductions')
      .select('*')
      .eq('payroll_id', payrollId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  }

  // ===== PAYROLL PAYMENTS =====

  static async recordPayment(payrollId, paymentData) {
    const { data, error } = await supabase
      .from('payroll_payments')
      .insert([{
        id: crypto.randomUUID(),
        payroll_id: payrollId,
        payment_method: paymentData.paymentMethod,
        payment_date: paymentData.paymentDate,
        amount_paid: paymentData.amountPaid,
        reference_number: paymentData.referenceNumber || null,
        created_at: new Date().toISOString()
      }])
      .select()

    if (error) throw error
    return data[0]
  }

  static async getPaymentHistory(payrollId) {
    const { data, error } = await supabase
      .from('payroll_payments')
      .select('*')
      .eq('payroll_id', payrollId)
      .order('payment_date', { ascending: false })

    if (error) throw error
    return data || []
  }

  // ===== PAYSLIP GENERATION =====

  static async generatePayslip(payrollId) {
    const payroll = await this.getPayrollById(payrollId)
    const employee = await this.getEmployee(payroll.employee_id)
    const deductions = await this.getDeductions(payrollId)

    if (!payroll || !employee || !deductions) {
      throw new Error('Missing payroll data for payslip generation')
    }

    const netSalary = payroll.gross_salary - deductions.total_deductions

    return {
      payslipId: crypto.randomUUID(),
      employee,
      payroll,
      deductions,
      netSalary,
      generatedDate: new Date().toISOString()
    }
  }

  static async getPayrollById(payrollId) {
    const { data, error } = await supabase
      .from('payroll')
      .select('*')
      .eq('id', payrollId)
      .single()

    if (error) throw error
    return data
  }

  // ===== BATCH PAYROLL OPERATIONS =====

  static async processMonthlyPayroll(businessId, employees, baseSalaries, payPeriodStart, payPeriodEnd) {
    const payrollRecords = []

    for (const employee of employees) {
      const baseSalary = baseSalaries[employee.id] || employee.base_salary || 0
      const grossSalary = baseSalary // Can be extended with allowances
      
      const payroll = await this.createPayroll(businessId, {
        employeeId: employee.id,
        payPeriodStart,
        payPeriodEnd,
        baseSalary,
        grossSalary
      })

      const deductions = await this.calculateDeductions(grossSalary)
      await this.saveDeductions(payroll.id, deductions)

      payrollRecords.push(payroll)
    }

    return payrollRecords
  }
}

export { EmployeeManagementService, PH_DEDUCTIONS }

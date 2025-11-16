import { useState, useEffect } from 'react'
import { EmployeeManagementService } from '../lib/employeeManagementService'

export default function EmployeesModal({ businessId, userId, onClose }) {
  const [activeTab, setActiveTab] = useState('employees')
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [savingEmployee, setSavingEmployee] = useState(false)

  // Form states
  const [employeeForm, setEmployeeForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    employmentStatus: 'active',
    baseSalary: '',
    hireDate: '',
    tin: '',
    sssNumber: '',
    philhealthNumber: '',
    pagibigNumber: '',
    emergencyContact: '',
    emergencyContactPhone: ''
  })

  // Attendance states
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loadingAttendance, setLoadingAttendance] = useState(false)

  // Medical records
  const [medicalRecords, setMedicalRecords] = useState([])
  const [showMedicalForm, setShowMedicalForm] = useState(false)
  const [medicalForm, setMedicalForm] = useState({
    recordType: 'checkup',
    description: '',
    dateRecorded: new Date().toISOString().split('T')[0],
    healthcareProvider: ''
  })

  // Benefits
  const [benefits, setBenefits] = useState(null)
  const [showBenefitsForm, setShowBenefitsForm] = useState(false)
  const [benefitsForm, setBenefitsForm] = useState({
    hasHealthInsurance: false,
    healthInsuranceProvider: '',
    hasLifeInsurance: false,
    lifeInsuranceProvider: '',
    allowanceType: '',
    allowanceAmount: '',
    otherBenefits: ''
  })

  // Performance
  const [performanceRecords, setPerformanceRecords] = useState([])
  const [showPerformanceForm, setShowPerformanceForm] = useState(false)
  const [performanceForm, setPerformanceForm] = useState({
    reviewDate: new Date().toISOString().split('T')[0],
    reviewerName: '',
    rating: 5,
    comments: '',
    performanceMetrics: ''
  })

  // Payroll
  const [payrollRecords, setPayrollRecords] = useState([])
  const [showPayrollForm, setShowPayrollForm] = useState(false)
  const [payrollForm, setPayrollForm] = useState({
    payPeriodStart: '',
    payPeriodEnd: '',
    baseSalary: ''
  })

  // Load employees
  useEffect(() => {
    loadEmployees()
  }, [businessId])

  const loadEmployees = async () => {
    try {
      setLoading(true)
      const data = await EmployeeManagementService.getEmployees(businessId)
      setEmployees(data)
    } catch (error) {
      console.error('Error loading employees:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load employee details when selected
  useEffect(() => {
    if (selectedEmployee && activeTab === 'attendance') {
      loadAttendance()
    }
  }, [selectedEmployee, activeTab])

  useEffect(() => {
    if (selectedEmployee && activeTab === 'medical') {
      loadMedicalRecords()
    }
  }, [selectedEmployee, activeTab])

  useEffect(() => {
    if (selectedEmployee && activeTab === 'benefits') {
      loadBenefits()
    }
  }, [selectedEmployee, activeTab])

  useEffect(() => {
    if (selectedEmployee && activeTab === 'performance') {
      loadPerformance()
    }
  }, [selectedEmployee, activeTab])

  useEffect(() => {
    if (selectedEmployee && activeTab === 'payroll') {
      loadPayroll()
    }
  }, [selectedEmployee, activeTab])

  const loadAttendance = async () => {
    try {
      setLoadingAttendance(true)
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 1)
      const data = await EmployeeManagementService.getAttendanceRecords(
        selectedEmployee.id,
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      )
      setAttendanceRecords(data)
    } catch (error) {
      console.error('Error loading attendance:', error)
    } finally {
      setLoadingAttendance(false)
    }
  }

  const loadMedicalRecords = async () => {
    try {
      const data = await EmployeeManagementService.getMedicalRecords(selectedEmployee.id)
      setMedicalRecords(data)
    } catch (error) {
      console.error('Error loading medical records:', error)
    }
  }

  const loadBenefits = async () => {
    try {
      const data = await EmployeeManagementService.getBenefits(selectedEmployee.id)
      if (data) {
        setBenefits(data)
        setBenefitsForm({
          id: data.id,
          hasHealthInsurance: data.has_health_insurance,
          healthInsuranceProvider: data.health_insurance_provider || '',
          hasLifeInsurance: data.has_life_insurance,
          lifeInsuranceProvider: data.life_insurance_provider || '',
          allowanceType: data.allowance_type || '',
          allowanceAmount: data.allowance_amount || '',
          otherBenefits: data.other_benefits || ''
        })
      }
    } catch (error) {
      console.error('Error loading benefits:', error)
    }
  }

  const loadPerformance = async () => {
    try {
      const data = await EmployeeManagementService.getPerformanceReviews(selectedEmployee.id)
      setPerformanceRecords(data)
    } catch (error) {
      console.error('Error loading performance:', error)
    }
  }

  const loadPayroll = async () => {
    try {
      const data = await EmployeeManagementService.getPayrollRecords(businessId, selectedEmployee.id)
      setPayrollRecords(data)
    } catch (error) {
      console.error('Error loading payroll:', error)
    }
  }

  // Add/Update Employee
  const handleSaveEmployee = async () => {
    if (!employeeForm.firstName || !employeeForm.lastName || !employeeForm.email || !employeeForm.position) {
      alert('Please fill all required fields')
      return
    }

    try {
      setSavingEmployee(true)
      const employee = await EmployeeManagementService.createEmployee(businessId, employeeForm)
      setEmployees([employee, ...employees])
      setShowAddForm(false)
      setEmployeeForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        position: '',
        department: '',
        employmentStatus: 'active',
        baseSalary: '',
        hireDate: '',
        tin: '',
        sssNumber: '',
        philhealthNumber: '',
        pagibigNumber: '',
        emergencyContact: '',
        emergencyContactPhone: ''
      })
    } catch (error) {
      console.error('Error saving employee:', error)
      alert('Failed to save employee')
    } finally {
      setSavingEmployee(false)
    }
  }

  // Record Attendance
  const handleCheckIn = async () => {
    try {
      await EmployeeManagementService.recordAttendance(selectedEmployee.id, 'check-in')
      loadAttendance()
    } catch (error) {
      console.error('Error recording check-in:', error)
      alert('Failed to record check-in')
    }
  }

  const handleCheckOut = async () => {
    try {
      await EmployeeManagementService.recordAttendance(selectedEmployee.id, 'check-out')
      loadAttendance()
    } catch (error) {
      console.error('Error recording check-out:', error)
      alert('Failed to record check-out')
    }
  }

  // Save Medical Record
  const handleSaveMedical = async () => {
    try {
      await EmployeeManagementService.saveMedicalRecord(selectedEmployee.id, medicalForm)
      loadMedicalRecords()
      setShowMedicalForm(false)
      setMedicalForm({
        recordType: 'checkup',
        description: '',
        dateRecorded: new Date().toISOString().split('T')[0],
        healthcareProvider: ''
      })
    } catch (error) {
      console.error('Error saving medical record:', error)
      alert('Failed to save medical record')
    }
  }

  // Save Benefits
  const handleSaveBenefits = async () => {
    try {
      await EmployeeManagementService.saveBenefits(selectedEmployee.id, benefitsForm)
      loadBenefits()
      setShowBenefitsForm(false)
    } catch (error) {
      console.error('Error saving benefits:', error)
      alert('Failed to save benefits')
    }
  }

  // Save Performance Review
  const handleSavePerformance = async () => {
    try {
      await EmployeeManagementService.savePerformanceReview(selectedEmployee.id, performanceForm)
      loadPerformance()
      setShowPerformanceForm(false)
      setPerformanceForm({
        reviewDate: new Date().toISOString().split('T')[0],
        reviewerName: '',
        rating: 5,
        comments: '',
        performanceMetrics: ''
      })
    } catch (error) {
      console.error('Error saving performance review:', error)
      alert('Failed to save performance review')
    }
  }

  // Process Payroll
  const handleProcessPayroll = async () => {
    if (!payrollForm.payPeriodStart || !payrollForm.payPeriodEnd || !payrollForm.baseSalary) {
      alert('Please fill all payroll fields')
      return
    }

    try {
      await EmployeeManagementService.createPayroll(businessId, {
        employeeId: selectedEmployee.id,
        payPeriodStart: payrollForm.payPeriodStart,
        payPeriodEnd: payrollForm.payPeriodEnd,
        baseSalary: parseFloat(payrollForm.baseSalary),
        grossSalary: parseFloat(payrollForm.baseSalary)
      })
      loadPayroll()
      setShowPayrollForm(false)
      setPayrollForm({
        payPeriodStart: '',
        payPeriodEnd: '',
        baseSalary: ''
      })
    } catch (error) {
      console.error('Error processing payroll:', error)
      alert('Failed to process payroll')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10h.01M13 16h2v2h-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Employees & Payroll</h2>
              <p className="text-slate-600 text-sm">Manage employees, attendance, payroll, and benefits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="sticky top-16 bg-white border-b border-slate-200 px-6">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'employees', label: 'Employees' },
              { id: 'attendance', label: 'Attendance' },
              { id: 'medical', label: 'Medical' },
              { id: 'benefits', label: 'Benefits' },
              { id: 'performance', label: 'Performance' },
              { id: 'payroll', label: 'Payroll' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-purple-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Employees Tab */}
          {activeTab === 'employees' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Employee Directory</h3>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  + Add Employee
                </button>
              </div>

              {/* Add Employee Form */}
              {showAddForm && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 mb-8">
                  <h4 className="text-lg font-semibold text-slate-900 mb-4">Add New Employee</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={employeeForm.firstName}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, firstName: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={employeeForm.lastName}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, lastName: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={employeeForm.email}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={employeeForm.phone}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="text"
                      placeholder="Position"
                      value={employeeForm.position}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="text"
                      placeholder="Department"
                      value={employeeForm.department}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="date"
                      value={employeeForm.hireDate}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, hireDate: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="number"
                      placeholder="Base Salary"
                      value={employeeForm.baseSalary}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, baseSalary: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="text"
                      placeholder="TIN"
                      value={employeeForm.tin}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, tin: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="text"
                      placeholder="SSS Number"
                      value={employeeForm.sssNumber}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, sssNumber: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="text"
                      placeholder="PhilHealth Number"
                      value={employeeForm.philhealthNumber}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, philhealthNumber: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="text"
                      placeholder="PagIBIG Number"
                      value={employeeForm.pagibigNumber}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, pagibigNumber: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="text"
                      placeholder="Emergency Contact Name"
                      value={employeeForm.emergencyContact}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, emergencyContact: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                    <input
                      type="tel"
                      placeholder="Emergency Contact Phone"
                      value={employeeForm.emergencyContactPhone}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, emergencyContactPhone: e.target.value })}
                      className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-600"
                    />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleSaveEmployee}
                      disabled={savingEmployee}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 font-medium"
                    >
                      {savingEmployee ? 'Saving...' : 'Save Employee'}
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Employees List */}
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-slate-500">Loading employees...</p>
                </div>
              ) : employees.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                  <p className="text-slate-500">No employees yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employees.map(employee => (
                    <button
                      key={employee.id}
                      onClick={() => setSelectedEmployee(employee)}
                      className={`text-left p-4 rounded-lg border-2 transition-all ${
                        selectedEmployee?.id === employee.id
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-slate-200 bg-white hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center font-bold">
                          {employee.first_name[0]}{employee.last_name[0]}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{employee.first_name} {employee.last_name}</p>
                          <p className="text-sm text-slate-600">{employee.position}</p>
                        </div>
                      </div>
                      <div className="text-sm text-slate-600">
                        <p>{employee.email}</p>
                        {employee.department && <p>{employee.department}</p>}
                        <p className={`mt-2 font-medium ${employee.employment_status === 'active' ? 'text-green-600' : 'text-slate-600'}`}>
                          {employee.employment_status}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div>
              {selectedEmployee ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Attendance for {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </h3>
                    <div className="flex gap-3">
                      <button
                        onClick={handleCheckIn}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        Check In
                      </button>
                      <button
                        onClick={handleCheckOut}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                      >
                        Check Out
                      </button>
                    </div>
                  </div>

                  {loadingAttendance ? (
                    <div className="text-center py-12">
                      <p className="text-slate-500">Loading attendance records...</p>
                    </div>
                  ) : attendanceRecords.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                      <p className="text-slate-500">No attendance records yet</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-6 py-3 text-slate-700 font-semibold">Date</th>
                            <th className="text-left px-6 py-3 text-slate-700 font-semibold">Check In</th>
                            <th className="text-left px-6 py-3 text-slate-700 font-semibold">Check Out</th>
                            <th className="text-left px-6 py-3 text-slate-700 font-semibold">Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceRecords.map(record => {
                            const hours = record.check_in && record.check_out
                              ? EmployeeManagementService.calculateHoursWorked(record.check_in, record.check_out)
                              : 0
                            return (
                              <tr key={record.id} className="border-b border-slate-200 hover:bg-slate-50">
                                <td className="px-6 py-3 text-slate-600">{new Date(record.attendance_date).toLocaleDateString()}</td>
                                <td className="px-6 py-3 text-slate-700">
                                  {record.check_in ? new Date(record.check_in).toLocaleTimeString() : '-'}
                                </td>
                                <td className="px-6 py-3 text-slate-700">
                                  {record.check_out ? new Date(record.check_out).toLocaleTimeString() : '-'}
                                </td>
                                <td className="px-6 py-3 font-semibold text-slate-900">{hours.toFixed(2)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                  <p className="text-slate-500">Select an employee to view attendance</p>
                </div>
              )}
            </div>
          )}

          {/* Medical Tab */}
          {activeTab === 'medical' && (
            <div>
              {selectedEmployee ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Medical Records for {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </h3>
                    <button
                      onClick={() => setShowMedicalForm(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      + Add Record
                    </button>
                  </div>

                  {showMedicalForm && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Add Medical Record</h4>
                      <div className="space-y-4">
                        <select
                          value={medicalForm.recordType}
                          onChange={(e) => setMedicalForm({ ...medicalForm, recordType: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-600"
                        >
                          <option value="checkup">General Checkup</option>
                          <option value="vaccination">Vaccination</option>
                          <option value="emergency">Emergency</option>
                          <option value="dental">Dental</option>
                          <option value="eye">Eye Care</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Healthcare Provider"
                          value={medicalForm.healthcareProvider}
                          onChange={(e) => setMedicalForm({ ...medicalForm, healthcareProvider: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-600"
                        />
                        <input
                          type="date"
                          value={medicalForm.dateRecorded}
                          onChange={(e) => setMedicalForm({ ...medicalForm, dateRecorded: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-600"
                        />
                        <textarea
                          placeholder="Description/Notes"
                          value={medicalForm.description}
                          onChange={(e) => setMedicalForm({ ...medicalForm, description: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-600"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={handleSaveMedical}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                          Save Record
                        </button>
                        <button
                          onClick={() => setShowMedicalForm(false)}
                          className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {medicalRecords.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                      <p className="text-slate-500">No medical records yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medicalRecords.map(record => (
                        <div key={record.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-slate-900 capitalize">{record.record_type}</p>
                              <p className="text-sm text-slate-600 mt-1">{record.description}</p>
                              {record.healthcare_provider && (
                                <p className="text-sm text-slate-600 mt-1">🏥 {record.healthcare_provider}</p>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">{new Date(record.date_recorded).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                  <p className="text-slate-500">Select an employee to view medical records</p>
                </div>
              )}
            </div>
          )}

          {/* Benefits Tab */}
          {activeTab === 'benefits' && (
            <div>
              {selectedEmployee ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Benefits for {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </h3>
                    <button
                      onClick={() => setShowBenefitsForm(true)}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
                    >
                      Edit Benefits
                    </button>
                  </div>

                  {showBenefitsForm && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-6 mb-6">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Update Benefits</h4>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={benefitsForm.hasHealthInsurance}
                            onChange={(e) => setBenefitsForm({ ...benefitsForm, hasHealthInsurance: e.target.checked })}
                            className="w-5 h-5"
                          />
                          <label className="text-slate-700 font-medium">Health Insurance</label>
                        </div>
                        {benefitsForm.hasHealthInsurance && (
                          <input
                            type="text"
                            placeholder="Health Insurance Provider"
                            value={benefitsForm.healthInsuranceProvider}
                            onChange={(e) => setBenefitsForm({ ...benefitsForm, healthInsuranceProvider: e.target.value })}
                            className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-600"
                          />
                        )}

                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={benefitsForm.hasLifeInsurance}
                            onChange={(e) => setBenefitsForm({ ...benefitsForm, hasLifeInsurance: e.target.checked })}
                            className="w-5 h-5"
                          />
                          <label className="text-slate-700 font-medium">Life Insurance</label>
                        </div>
                        {benefitsForm.hasLifeInsurance && (
                          <input
                            type="text"
                            placeholder="Life Insurance Provider"
                            value={benefitsForm.lifeInsuranceProvider}
                            onChange={(e) => setBenefitsForm({ ...benefitsForm, lifeInsuranceProvider: e.target.value })}
                            className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-600"
                          />
                        )}

                        <input
                          type="text"
                          placeholder="Allowance Type (e.g., Housing, Transportation)"
                          value={benefitsForm.allowanceType}
                          onChange={(e) => setBenefitsForm({ ...benefitsForm, allowanceType: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-600"
                        />
                        <input
                          type="number"
                          placeholder="Allowance Amount"
                          value={benefitsForm.allowanceAmount}
                          onChange={(e) => setBenefitsForm({ ...benefitsForm, allowanceAmount: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-600"
                        />
                        <textarea
                          placeholder="Other Benefits"
                          value={benefitsForm.otherBenefits}
                          onChange={(e) => setBenefitsForm({ ...benefitsForm, otherBenefits: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-600"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={handleSaveBenefits}
                          className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
                        >
                          Save Benefits
                        </button>
                        <button
                          onClick={() => setShowBenefitsForm(false)}
                          className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {benefits ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
                        <h4 className="font-semibold text-slate-900 mb-4">Insurance Coverage</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Health Insurance</span>
                            <span className={`font-semibold ${benefits.has_health_insurance ? 'text-green-600' : 'text-slate-600'}`}>
                              {benefits.has_health_insurance ? '✓ Yes' : '✗ No'}
                            </span>
                          </div>
                          {benefits.has_health_insurance && benefits.health_insurance_provider && (
                            <p className="text-slate-600">Provider: {benefits.health_insurance_provider}</p>
                          )}
                          <div className="flex items-center justify-between border-t border-amber-200 pt-3">
                            <span className="text-slate-600">Life Insurance</span>
                            <span className={`font-semibold ${benefits.has_life_insurance ? 'text-green-600' : 'text-slate-600'}`}>
                              {benefits.has_life_insurance ? '✓ Yes' : '✗ No'}
                            </span>
                          </div>
                          {benefits.has_life_insurance && benefits.life_insurance_provider && (
                            <p className="text-slate-600">Provider: {benefits.life_insurance_provider}</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                        <h4 className="font-semibold text-slate-900 mb-4">Allowances & Other Benefits</h4>
                        <div className="space-y-3 text-sm">
                          {benefits.allowance_type && (
                            <div>
                              <p className="text-slate-600">{benefits.allowance_type}</p>
                              <p className="font-semibold text-green-600">₱{parseFloat(benefits.allowance_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                          )}
                          {benefits.other_benefits && (
                            <p className="text-slate-600 border-t border-green-200 pt-3">{benefits.other_benefits}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                      <p className="text-slate-500">No benefits configured yet</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                  <p className="text-slate-500">Select an employee to view benefits</p>
                </div>
              )}
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div>
              {selectedEmployee ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Performance Records for {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </h3>
                    <button
                      onClick={() => setShowPerformanceForm(true)}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
                    >
                      + Add Review
                    </button>
                  </div>

                  {showPerformanceForm && (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 mb-6">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Add Performance Review</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="date"
                            value={performanceForm.reviewDate}
                            onChange={(e) => setPerformanceForm({ ...performanceForm, reviewDate: e.target.value })}
                            className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-yellow-600"
                          />
                          <input
                            type="text"
                            placeholder="Reviewer Name"
                            value={performanceForm.reviewerName}
                            onChange={(e) => setPerformanceForm({ ...performanceForm, reviewerName: e.target.value })}
                            className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-yellow-600"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-2">Rating (1-5)</label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            step={0.1}
                            value={performanceForm.rating}
                            onChange={(e) => setPerformanceForm({ ...performanceForm, rating: parseFloat(e.target.value) })}
                            className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-yellow-600"
                          />
                        </div>
                        <textarea
                          placeholder="Comments/Feedback"
                          value={performanceForm.comments}
                          onChange={(e) => setPerformanceForm({ ...performanceForm, comments: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-yellow-600"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={handleSavePerformance}
                          className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
                        >
                          Save Review
                        </button>
                        <button
                          onClick={() => setShowPerformanceForm(false)}
                          className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {performanceRecords.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                      <p className="text-slate-500">No performance reviews yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {performanceRecords.map(record => (
                        <div key={record.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-slate-900">Rating: {record.rating}/5</p>
                              <p className="text-sm text-slate-600">Reviewed by {record.reviewer_name}</p>
                            </div>
                            <p className="text-sm text-slate-600">{new Date(record.review_date).toLocaleDateString()}</p>
                          </div>
                          {record.comments && (
                            <p className="text-slate-700 mt-2">{record.comments}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                  <p className="text-slate-500">Select an employee to view performance records</p>
                </div>
              )}
            </div>
          )}

          {/* Payroll Tab */}
          {activeTab === 'payroll' && (
            <div>
              {selectedEmployee ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Payroll for {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </h3>
                    <button
                      onClick={() => setShowPayrollForm(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      + Process Payroll
                    </button>
                  </div>

                  {showPayrollForm && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-6">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Process Payroll</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Pay Period Start</label>
                            <input
                              type="date"
                              value={payrollForm.payPeriodStart}
                              onChange={(e) => setPayrollForm({ ...payrollForm, payPeriodStart: e.target.value })}
                              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-green-600"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Pay Period End</label>
                            <input
                              type="date"
                              value={payrollForm.payPeriodEnd}
                              onChange={(e) => setPayrollForm({ ...payrollForm, payPeriodEnd: e.target.value })}
                              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-green-600"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-2">Salary Amount</label>
                          <input
                            type="number"
                            placeholder="Base Salary"
                            value={payrollForm.baseSalary}
                            onChange={(e) => setPayrollForm({ ...payrollForm, baseSalary: e.target.value })}
                            className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-green-600"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={handleProcessPayroll}
                          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                        >
                          Create Payroll
                        </button>
                        <button
                          onClick={() => setShowPayrollForm(false)}
                          className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {payrollRecords.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                      <p className="text-slate-500">No payroll records yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {payrollRecords.map(record => (
                        <div key={record.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-slate-600">Pay Period</p>
                              <p className="font-semibold text-slate-900">
                                {new Date(record.pay_period_start).toLocaleDateString()} - {new Date(record.pay_period_end).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-600">Gross Salary</p>
                              <p className="font-semibold text-green-600">₱{parseFloat(record.gross_salary).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-600">Status</p>
                              <p className={`font-semibold ${record.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                                {record.status.toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                  <p className="text-slate-500">Select an employee to view payroll</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6 flex gap-3 justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

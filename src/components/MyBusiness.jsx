import { useState, useEffect, useRef } from 'react'
import { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabaseClient'
import { PHILIPPINES_CITIES, searchCities } from '../data/philippinesCities'
import MerchantReceipts from './MerchantReceipts'
import SelectBusinessModal from './SelectBusinessModal'
import { miscellaneousCostsService } from '../lib/miscellaneousCostsService'
import { taxReportingService } from '../lib/taxReportingService'

// Generate PDF document with metadata
const generatePDFDocument = (documentType, business) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Set document metadata
  doc.setProperties({
    title: documentType === 'business-name' ? 'Business Name Registration Certificate' : 'Certificate of Incorporation',
    subject: `Official Document for ${business.business_name}`,
    author: 'Bureau of Internal Revenue',
    keywords: 'business, registration, certificate, philippines'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header - Blue background
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, pageWidth, 35, 'F')

  // Header text - White
  doc.setTextColor(255, 255, 255)
  doc.setFont('Arial', 'bold')
  doc.setFontSize(16)
  doc.text('REPUBLIC OF THE PHILIPPINES', pageWidth / 2, 12, { align: 'center' })

  doc.setFont('Arial', 'normal')
  doc.setFontSize(10)
  doc.text('Bureau of Internal Revenue', pageWidth / 2, 20, { align: 'center' })
  doc.text('Official Document', pageWidth / 2, 26, { align: 'center' })

  // Reset text color to black
  doc.setTextColor(0, 0, 0)
  doc.setFont('Arial', 'bold')
  doc.setFontSize(14)

  let yPos = 45

  if (documentType === 'business-name') {
    doc.text('BUSINESS NAME REGISTRATION CERTIFICATE', pageWidth / 2, yPos, { align: 'center' })
    yPos += 15

    doc.setFont('Arial', 'normal')
    doc.setFontSize(11)

    doc.text(`Business Name: ${business.business_name || 'N/A'}`, 20, yPos)
    yPos += 10
    doc.text(`Registration Type: ${(business.registration_type || 'N/A').toUpperCase()}`, 20, yPos)
    yPos += 10
    doc.text(`Certificate Number: ${business.certificate_of_incorporation || 'N/A'}`, 20, yPos)
    yPos += 10
    doc.text(`City of Registration: ${business.city_of_registration || 'N/A'}`, 20, yPos)
    yPos += 10
    const regDate = business.registration_date ? new Date(business.registration_date).toLocaleDateString('en-PH') : 'N/A'
    doc.text(`Registration Date: ${regDate}`, 20, yPos)
    yPos += 15

    doc.setFont('Arial', 'italic')
    doc.setFontSize(10)
    const certText = 'This certifies that the above business name is officially registered with the Bureau of Internal Revenue and is valid for commercial operations.'
    doc.text(certText, 20, yPos, { maxWidth: pageWidth - 40, align: 'left' })
    yPos += 20
  } else if (documentType === 'incorporation') {
    doc.text('CERTIFICATE OF INCORPORATION', pageWidth / 2, yPos, { align: 'center' })
    yPos += 15

    doc.setFont('Arial', 'normal')
    doc.setFontSize(11)

    doc.text(`Business Name: ${business.business_name || 'N/A'}`, 20, yPos)
    yPos += 10
    doc.text(`Tax Identification Number (TIN): ${business.tin || 'N/A'}`, 20, yPos)
    yPos += 10
    doc.text(`Registration Type: ${(business.registration_type || 'N/A').toUpperCase()}`, 20, yPos)
    yPos += 10
    doc.text(`City of Registration: ${business.city_of_registration || 'N/A'}`, 20, yPos)
    yPos += 10
    const regDate = business.registration_date ? new Date(business.registration_date).toLocaleDateString('en-PH') : 'N/A'
    doc.text(`Registration Date: ${regDate}`, 20, yPos)
    yPos += 10
    doc.text('Status: ACTIVE', 20, yPos)
    yPos += 15

    doc.setFont('Arial', 'italic')
    doc.setFontSize(10)
    const corpText = 'This officially certifies that the above entity is incorporated and authorized to conduct business operations in the Republic of the Philippines.'
    doc.text(corpText, 20, yPos, { maxWidth: pageWidth - 40, align: 'left' })
    yPos += 20
  }

  // Signature section
  yPos += 30
  doc.setFont('Arial', 'bold')
  doc.setFontSize(10)
  doc.text('Official Seal and Signature', 20, yPos)
  yPos += 8

  doc.setDrawColor(200, 200, 200)
  doc.rect(20, yPos, 80, 40)
  doc.setFont('Arial', 'normal')
  doc.setFontSize(8)
  doc.text('[Digital Signature]', 60, yPos + 20, { align: 'center' })

  // Footer
  yPos = pageHeight - 25
  doc.setFont('Arial', 'normal')
  doc.setFontSize(9)
  const issuedDate = new Date().toLocaleDateString('en-PH')
  const issuedTime = new Date().toLocaleTimeString('en-PH')
  doc.text(`Issued: ${issuedDate} ${issuedTime}`, 20, yPos)

  doc.setFont('Arial', 'normal')
  doc.setFontSize(8)
  doc.text(`Document ID: ${business.id.substring(0, 12).toUpperCase()}`, 20, yPos + 6)
  doc.text('This is an official document issued by the Bureau of Internal Revenue', 20, yPos + 12)

  return doc
}

// View PDF in new window
const generateAndViewPDF = (documentType, business) => {
  const doc = generatePDFDocument(documentType, business)
  const fileName = `${business.business_name.replace(/\s+/g, '_')}_${documentType}.pdf`
  doc.output('dataurlnewwindow', { filename: fileName })
}

// Download PDF
const generateAndDownloadPDF = (documentType, business) => {
  const doc = generatePDFDocument(documentType, business)
  const fileName = `${business.business_name.replace(/\s+/g, '_')}_${documentType}.pdf`
  doc.save(fileName)
}

export default function MyBusiness({ userId }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [merchantTab, setMerchantTab] = useState('main')
  const [businesses, setBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [showRegistrationForm, setShowRegistrationForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [citySearch, setCitySearch] = useState('')
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [businessNameAvailability, setBusinessNameAvailability] = useState(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [mainTab, setMainTab] = useState('businesses')
  const [formMode, setFormMode] = useState(null) // 'create' or 'existing'
  const [showBusinessSelectionModal, setShowBusinessSelectionModal] = useState(false)
  const tabContentRef = useRef(null)
  const [formData, setFormData] = useState({
    businessName: '',
    registrationType: 'sole',
    tin: '',
    certificateOfIncorporation: '',
    currencyRegistrationNumber: '',
    cityOfRegistration: '',
    registrationDate: ''
  })
  const [editMode, setEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState({
    tin: '',
    certificateOfIncorporation: '',
    currencyRegistrationNumber: ''
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [miscCosts, setMiscCosts] = useState([])
  const [receipts, setReceipts] = useState([])
  const [showAddCostModal, setShowAddCostModal] = useState(false)
  const [newCostData, setNewCostData] = useState({
    description: '',
    amount: '',
    category: 'other',
    cost_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    notes: ''
  })
  const [savingCost, setSavingCost] = useState(false)
  const [selectedFeatureModal, setSelectedFeatureModal] = useState(null)
  const [reportingPeriod, setReportingPeriod] = useState('annual')
  const [reportingYear, setReportingYear] = useState(new Date().getFullYear())
  const [quarterlyReports, setQuarterlyReports] = useState([])
  const [annualReport, setAnnualReport] = useState(null)
  const [currentPeriodReport, setCurrentPeriodReport] = useState(null)
  const [monthlyData, setMonthlyData] = useState([])
  const [filteredMonthlyData, setFilteredMonthlyData] = useState([])
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseFormData, setExpenseFormData] = useState({
    description: '',
    amount: '',
    category: 'other',
    receiptDate: new Date().toISOString().split('T')[0]
  })
  const [showTaxPaymentForm, setShowTaxPaymentForm] = useState(false)
  const [taxPaymentData, setTaxPaymentData] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'bank_transfer',
    referenceNumber: ''
  })
  const [taxPayments, setTaxPayments] = useState([])
  const [loadingReports, setLoadingReports] = useState(false)

  // Generate TIN (12-digit format like government)
  const loadSalesAndTaxData = async () => {
    if (!selectedBusiness) return
    try {
      const costs = await miscellaneousCostsService.getBusinessCosts(selectedBusiness.id)
      setMiscCosts(costs)

      const receiptsData = await supabase
        .from('business_receipts')
        .select('*')
        .eq('business_id', selectedBusiness.id)

      if (receiptsData.error) throw receiptsData.error
      setReceipts(receiptsData.data || [])
    } catch (error) {
      console.error('Error loading sales and tax data:', error)
    }
  }

  // Load detailed tax reporting data
  const loadReportingData = async () => {
    if (!selectedBusiness) return
    try {
      setLoadingReports(true)

      // Load all quarterly reports for the annual view and quarterly breakdown
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
      const qReports = await Promise.all(
        quarters.map(q => taxReportingService.calculateReportingPeriod(selectedBusiness.id, q, reportingYear))
      )
      setQuarterlyReports(qReports)

      // Load report based on selected period
      let selectedReport
      if (reportingPeriod === 'annual') {
        selectedReport = await taxReportingService.calculateReportingPeriod(selectedBusiness.id, 'annual', reportingYear)
        setAnnualReport(selectedReport)
      } else if (reportingPeriod.startsWith('Q')) {
        selectedReport = await taxReportingService.calculateReportingPeriod(selectedBusiness.id, reportingPeriod, reportingYear)
      } else if (reportingPeriod === 'ytd') {
        selectedReport = await taxReportingService.calculateReportingPeriod(selectedBusiness.id, 'ytd', reportingYear)
      }
      setCurrentPeriodReport(selectedReport)

      // Load full year monthly breakdown
      const monthly = await taxReportingService.getMonthlyBreakdown(selectedBusiness.id, reportingYear)
      setMonthlyData(monthly)

      // Filter monthly data based on selected period
      let filtered = monthly
      if (reportingPeriod.startsWith('Q')) {
        const quarter = parseInt(reportingPeriod.slice(1))
        const startMonth = (quarter - 1) * 3
        const endMonth = startMonth + 3
        filtered = monthly.slice(startMonth, endMonth)
      } else if (reportingPeriod === 'ytd') {
        const currentMonth = new Date().getMonth() + 1
        filtered = monthly.slice(0, currentMonth)
      }
      setFilteredMonthlyData(filtered)

      // Load tax payments
      const yearStart = new Date(reportingYear, 0, 1)
      const yearEnd = new Date(reportingYear, 11, 31)
      const { data: payments } = await supabase
        .from('tax_payments')
        .select('*')
        .eq('business_id', selectedBusiness.id)
        .gte('payment_date', yearStart.toISOString())
        .lte('payment_date', yearEnd.toISOString())
      setTaxPayments(payments || [])
    } catch (error) {
      console.error('Error loading reporting data:', error)
    } finally {
      setLoadingReports(false)
    }
  }

  // Add expense function
  const handleAddExpense = async () => {
    if (!selectedBusiness || !expenseFormData.description || !expenseFormData.amount) return
    try {
      setSavingCost(true)
      const cost = await taxReportingService.addBusinessExpense(
        selectedBusiness.id,
        expenseFormData.description,
        parseFloat(expenseFormData.amount),
        expenseFormData.category,
        expenseFormData.receiptDate
      )
      setMiscCosts([cost, ...miscCosts])
      setShowExpenseForm(false)
      setExpenseFormData({
        description: '',
        amount: '',
        category: 'other',
        receiptDate: new Date().toISOString().split('T')[0]
      })
      loadReportingData()
    } catch (error) {
      console.error('Error adding expense:', error)
    } finally {
      setSavingCost(false)
    }
  }

  // Save tax payment
  const handleSaveTaxPayment = async () => {
    if (!selectedBusiness || !taxPaymentData.amount || !taxPaymentData.paymentDate) return
    try {
      setSavingCost(true)
      await taxReportingService.saveTaxPayment(
        selectedBusiness.id,
        parseFloat(taxPaymentData.amount),
        taxPaymentData.paymentDate,
        taxPaymentData.paymentMethod,
        taxPaymentData.referenceNumber
      )
      setShowTaxPaymentForm(false)
      setTaxPaymentData({
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'bank_transfer',
        referenceNumber: ''
      })
      loadReportingData()
    } catch (error) {
      console.error('Error saving tax payment:', error)
    } finally {
      setSavingCost(false)
    }
  }

  // Export report to CSV
  const exportToCSV = () => {
    const reportData = currentPeriodReport || annualReport
    if (!reportData) return

    const headers = ['Metric', 'Value']
    const periodLabel = reportData.monthRange ? `${reportData.period} ${reportData.monthRange}` : reportData.period
    const rows = [
      ['Period', `${periodLabel} (${reportingYear})`],
      ['Total Sales', `₱${reportData.totalSales.toFixed(2)}`],
      ['Total Expenses', `₱${reportData.totalExpenses.toFixed(2)}`],
      ['Net Income', `₱${reportData.netIncome.toFixed(2)}`],
      ['Profit Margin', `${reportData.profitMargin}%`],
      ['Estimated Tax (12%)', `₱${reportData.estimatedTax.toFixed(2)}`],
      ['Tax Paid', `₱${reportData.taxPaid.toFixed(2)}`],
      ['Tax Due', `₱${reportData.taxDue.toFixed(2)}`],
      ['', ''],
      ['Monthly Breakdown', ''],
    ]

    filteredMonthlyData.forEach(month => {
      rows.push([
        month.month,
        `Sales: ₱${month.sales.toFixed(2)}, Expenses: ₱${month.expenses.toFixed(2)}, Net: ₱${month.netIncome.toFixed(2)}`
      ])
    })

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tax-report-${reportingPeriod}-${reportingYear}.csv`
    a.click()
  }

  const handleAddCost = async () => {
    if (!selectedBusiness || !userId) return
    if (!newCostData.description || !newCostData.amount) {
      alert('Please fill in required fields')
      return
    }

    try {
      setSavingCost(true)
      const cost = await miscellaneousCostsService.createCost(selectedBusiness.id, userId, newCostData)
      setMiscCosts([cost, ...miscCosts])
      setShowAddCostModal(false)
      setNewCostData({
        description: '',
        amount: '',
        category: 'other',
        cost_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        notes: ''
      })
    } catch (error) {
      console.error('Error adding cost:', error)
      alert('Failed to add cost')
    } finally {
      setSavingCost(false)
    }
  }

  const handleDeleteCost = async (costId) => {
    if (!confirm('Are you sure you want to delete this cost?')) return
    try {
      await miscellaneousCostsService.deleteCost(costId)
      setMiscCosts(miscCosts.filter(c => c.id !== costId))
    } catch (error) {
      console.error('Error deleting cost:', error)
      alert('Failed to delete cost')
    }
  }

  const totalSales = receipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
  const totalMiscCosts = miscellaneousCostsService.calculateTotalCosts(miscCosts)
  const totalCosts = totalMiscCosts
  const netIncome = totalSales - totalCosts
  const estimatedTax = netIncome > 0 ? netIncome * 0.12 : 0

  const generateTIN = () => {
    const randomTIN = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')
    return randomTIN.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1-$2-$3-$4')
  }

  // Generate Certificate number (government style)
  const generateCertificate = () => {
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const random = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
    return `BIR-${year}-${month}-${random}`
  }

  // Generate Currency Registration Number (random string of alphanumeric characters)
  const generateCurrencyRegistrationNumber = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = 'CRN-'
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // Get current date in Manila timezone
  const getCurrentManillaDate = () => {
    const now = new Date()
    const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const year = manilaTime.getFullYear()
    const month = String(manilaTime.getMonth() + 1).padStart(2, '0')
    const day = String(manilaTime.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    if (userId) {
      loadBusinesses()
    }
  }, [userId])

  // Show modal when user clicks a management feature without a business selected
  // Modal is shown only when user clicks a management feature button
  // without a business selected. This prevents unnecessary modal on tab change.

  // Scroll to tab content when activeTab changes
  useEffect(() => {
    if (tabContentRef.current && mainTab === 'businesses') {
      setTimeout(() => {
        tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [activeTab, mainTab])

  // Show business selection modal when no business is selected but businesses exist
  useEffect(() => {
    if (!loading && businesses.length > 0 && !selectedBusiness) {
      setShowBusinessSelectionModal(true)
    }
  }, [loading, businesses.length, selectedBusiness])

  // Load sales and tax data when Sales and Tax Reporting tab is accessed
  useEffect(() => {
    if (activeTab === 'salesTaxReporting' && selectedBusiness) {
      loadSalesAndTaxData()
      loadReportingData()
    }
  }, [activeTab, selectedBusiness?.id])

  // Reload reporting data when period or year changes
  useEffect(() => {
    if (activeTab === 'salesTaxReporting' && selectedBusiness) {
      loadReportingData()
    }
  }, [reportingPeriod, reportingYear, selectedBusiness?.id])

  const loadBusinesses = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })

      if (error) throw error

      const businessesData = data || []
      setBusinesses(businessesData)

      // Auto-select default business if it exists and no business is currently selected
      if (businessesData.length > 0 && !selectedBusiness) {
        const defaultBusiness = businessesData.find(b => b.is_default === true)
        if (defaultBusiness) {
          setSelectedBusiness(defaultBusiness)
          setShowRegistrationForm(false)
        }
      }
    } catch (err) {
      console.error('Failed to load businesses:', err)
    } finally {
      setLoading(false)
    }
  }

  // Check business name availability
  const checkBusinessNameAvailability = async (name) => {
    if (!name.trim()) {
      setBusinessNameAvailability(null)
      return
    }

    setCheckingAvailability(true)
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .ilike('business_name', name)
      
      if (error) throw error
      
      if (data && data.length > 0) {
        setBusinessNameAvailability({ available: false, message: 'This business name is already registered' })
      } else {
        setBusinessNameAvailability({ available: true, message: 'This business name is available' })
      }
    } catch (err) {
      console.error('Failed to check availability:', err)
      setBusinessNameAvailability(null)
    } finally {
      setCheckingAvailability(false)
    }
  }

  const handleBusinessNameChange = (value) => {
    setFormData({ ...formData, businessName: value })
    checkBusinessNameAvailability(value)
  }

  const handleRegistrationTypeChange = (value) => {
    setFormData({ ...formData, registrationType: value })
  }

  // Check for duplicate TIN or BIR Certification
  const checkForDuplicateCredentials = async () => {
    try {
      const conditions = []
      const values = []

      if (formData.tin) {
        conditions.push('tin')
        values.push(formData.tin)
      }

      if (formData.certificateOfIncorporation) {
        conditions.push('certificate_of_incorporation')
        values.push(formData.certificateOfIncorporation)
      }

      if (conditions.length === 0) {
        return { isDuplicate: false }
      }

      // Check TIN if provided
      if (formData.tin) {
        const { data: tinData, error: tinError } = await supabase
          .from('businesses')
          .select('id, business_name')
          .eq('tin', formData.tin)
          .limit(1)

        if (tinError) throw tinError
        if (tinData && tinData.length > 0) {
          return {
            isDuplicate: true,
            duplicateField: 'TIN',
            existingBusiness: tinData[0].business_name
          }
        }
      }

      // Check BIR Certification if provided
      if (formData.certificateOfIncorporation) {
        const { data: birData, error: birError } = await supabase
          .from('businesses')
          .select('id, business_name')
          .eq('certificate_of_incorporation', formData.certificateOfIncorporation)
          .limit(1)

        if (birError) throw birError
        if (birData && birData.length > 0) {
          return {
            isDuplicate: true,
            duplicateField: 'BIR Certification',
            existingBusiness: birData[0].business_name
          }
        }
      }

      return { isDuplicate: false }
    } catch (err) {
      console.error('Error checking for duplicates:', err)
      throw err
    }
  }

  const handleAddBusiness = async () => {
    // Validate common fields
    if (!formData.businessName || !formData.cityOfRegistration || !businessNameAvailability?.available) {
      alert('Please fill all required fields and ensure business name is available')
      return
    }

    // Additional validation for existing business mode
    if (formMode === 'existing') {
      if (!formData.tin || !formData.certificateOfIncorporation || !formData.registrationDate) {
        alert('Please fill all required fields: Business Name, Type, City, TIN, BIR Certification, and Registration Date')
        return
      }
    }

    try {
      // Check for duplicate TIN or BIR Certification
      const duplicateCheck = await checkForDuplicateCredentials()
      if (duplicateCheck.isDuplicate) {
        alert(`The ${duplicateCheck.duplicateField} you entered is already associated with "${duplicateCheck.existingBusiness}".\n\nIf you believe this is a mistake, please contact support@currency.ph`)
        return
      }

      const { data, error } = await supabase
        .from('businesses')
        .insert([{
          user_id: userId,
          business_name: formData.businessName,
          registration_type: formData.registrationType,
          tin: formData.tin || null,
          certificate_of_incorporation: formData.certificateOfIncorporation || null,
          currency_registration_number: formData.currencyRegistrationNumber,
          city_of_registration: formData.cityOfRegistration,
          registration_date: formData.registrationDate,
          status: 'active'
        }])
        .select()

      if (error) throw error
      
      setBusinesses([...businesses, data[0]])
      setSelectedBusiness(data[0])
      setShowRegistrationForm(false)
      setFormMode(null)
      setCitySearch('')
      setShowCityDropdown(false)
      setBusinessNameAvailability(null)
      setFormData({
        businessName: '',
        registrationType: 'sole',
        tin: '',
        certificateOfIncorporation: '',
        currencyRegistrationNumber: '',
        cityOfRegistration: '',
        registrationDate: ''
      })
    } catch (err) {
      console.error('Failed to add business:', err)
      alert('Failed to register business. Please try again.')
      setFormMode(null)
    }
  }

  const initializeForm = (mode) => {
    setFormMode(mode)
    setShowRegistrationForm(true)
    setFormData({
      businessName: '',
      registrationType: 'sole',
      tin: '',
      certificateOfIncorporation: '',
      currencyRegistrationNumber: generateCurrencyRegistrationNumber(),
      cityOfRegistration: '',
      registrationDate: mode === 'create' ? getCurrentManillaDate() : ''
    })
    setBusinessNameAvailability(null)
    setCitySearch('')
  }

  const openEditTaxInfo = () => {
    if (selectedBusiness) {
      setEditFormData({
        tin: selectedBusiness.tin || '',
        certificateOfIncorporation: selectedBusiness.certificate_of_incorporation || '',
        currencyRegistrationNumber: selectedBusiness.currency_registration_number || ''
      })
      setEditMode(true)
    }
  }

  const handleUpdateTaxInfo = async () => {
    try {
      setSavingEdit(true)
      const { error } = await supabase
        .from('businesses')
        .update({
          tin: editFormData.tin || null,
          certificate_of_incorporation: editFormData.certificateOfIncorporation || null,
          currency_registration_number: editFormData.currencyRegistrationNumber || null
        })
        .eq('id', selectedBusiness.id)

      if (error) throw error

      setSelectedBusiness({
        ...selectedBusiness,
        tin: editFormData.tin || null,
        certificate_of_incorporation: editFormData.certificateOfIncorporation || null,
        currency_registration_number: editFormData.currencyRegistrationNumber
      })

      setBusinesses(
        businesses.map(b =>
          b.id === selectedBusiness.id
            ? {
                ...b,
                tin: editFormData.tin || null,
                certificate_of_incorporation: editFormData.certificateOfIncorporation || null,
                currency_registration_number: editFormData.currencyRegistrationNumber
              }
            : b
        )
      )

      setEditMode(false)
      alert('Tax information updated successfully!')
    } catch (err) {
      console.error('Failed to update tax information:', err)
      alert('Failed to update tax information. Please try again.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleGenerateCurrencyRegistration = () => {
    setEditFormData({
      ...editFormData,
      currencyRegistrationNumber: generateCurrencyRegistrationNumber()
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-light text-slate-900 mb-2">Loading Your Businesses</div>
          <p className="text-slate-500 text-sm">Please wait...</p>
        </div>
      </div>
    )
  }

  // Show block layout if no businesses
  if (businesses.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-light text-slate-900 mb-2">My Business</h1>
            <p className="text-slate-600">Manage your businesses, employees, and integrations</p>
          </div>

          {!showRegistrationForm ? (
            <>
              {/* Registration CTA Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-8 mb-12">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900 mb-2">No Businesses Yet</h2>
                    <p className="text-slate-600 max-w-lg">Register your first business to access management tools, employee management, payment integrations, and more.</p>
                  </div>
                  <button
                    onClick={() => initializeForm('create')}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors whitespace-nowrap ml-4"
                  >
                    Register Business
                  </button>
                </div>
              </div>

              {/* Business Features Grid */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-6">Business Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  
                  {/* BIR Integration */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all group opacity-75">
                    <div className="flex justify-center mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 12a5 5 0 1110 0A5 5 0 017 12z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">BIR Integration</h3>
                    <p className="text-sm text-slate-600 mb-4">File taxes and access tax documents instantly</p>
                    <div className="text-sm font-medium text-blue-600 group-hover:text-blue-700">Register to access →</div>
                  </button>

                  {/* Employee Management */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-green-300 transition-all group opacity-75">
                    <div className="flex justify-center mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10h.01M13 16h2v2h-2z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Employees & Payroll</h3>
                    <p className="text-sm text-slate-600 mb-4">Manage employees, payroll, and compensation</p>
                    <div className="text-sm font-medium text-green-600 group-hover:text-green-700">Register to access →</div>
                  </button>

                  {/* Merchant Tools */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-orange-300 transition-all group opacity-75">
                    <div className="flex justify-center mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-orange-100 group-hover:bg-orange-200 transition-colors">
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Merchant Tools</h3>
                    <p className="text-sm text-slate-600 mb-4">Manage sales, inventory, and transactions</p>
                    <div className="text-sm font-medium text-orange-600 group-hover:text-orange-700">Register to access →</div>
                  </button>

                  {/* Digital Receipts */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-purple-300 transition-all group opacity-75">
                    <div className="flex justify-center mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Digital Receipts</h3>
                    <p className="text-sm text-slate-600 mb-4">Track and manage all digital receipts</p>
                    <div className="text-sm font-medium text-purple-600 group-hover:text-purple-700">Register to access →</div>
                  </button>

                  {/* Payments */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-pink-300 transition-all group opacity-75">
                    <div className="flex justify-center mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-pink-100 group-hover:bg-pink-200 transition-colors">
                        <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h10M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Payments</h3>
                    <p className="text-sm text-slate-600 mb-4">Connect GCash, PayMaya, and more</p>
                    <div className="text-sm font-medium text-pink-600 group-hover:text-pink-700">Register to access →</div>
                  </button>

                  {/* Shareholders */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-yellow-300 transition-all group opacity-75">
                    <div className="flex justify-center mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-yellow-100 group-hover:bg-yellow-200 transition-colors">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Shareholders</h3>
                    <p className="text-sm text-slate-600 mb-4">Manage ownership and shareholders</p>
                    <div className="text-sm font-medium text-yellow-600 group-hover:text-yellow-700">Register to access ����</div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Registration Form */
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
                <h2 className="text-2xl font-semibold text-white mb-1">
                  {formMode === 'create' ? 'Create New Business' : 'Add Existing Business'}
                </h2>
                <p className="text-blue-100 text-sm">
                  {formMode === 'create'
                    ? 'Register a new business with Bureau of Internal Revenue (BIR)'
                    : 'Link an existing business to your account'}
                </p>
              </div>

              <div className="p-8">
                {/* Business Name Field */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Business Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Enter your business name"
                    value={formData.businessName}
                    onChange={(e) => handleBusinessNameChange(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors"
                  />
                  
                  {formData.businessName && (
                    <div className={`mt-2 flex items-center gap-2 text-sm ${
                      businessNameAvailability?.available ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {checkingAvailability ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                          <span>Checking availability...</span>
                        </>
                      ) : businessNameAvailability ? (
                        <>
                          {businessNameAvailability.available ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span>{businessNameAvailability.message}</span>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Business Type & City */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Business Type <span className="text-red-500">*</span></label>
                    <select
                      value={formData.registrationType}
                      onChange={(e) => handleRegistrationTypeChange(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors"
                    >
                      <option value="sole">Sole Proprietorship</option>
                      <option value="partnership">Partnership</option>
                      <option value="corporation">Corporation</option>
                      <option value="llc">Limited Liability Company (LLC)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">City of Registration <span className="text-red-500">*</span></label>
                    <div className="relative" data-city-dropdown>
                      <input
                        type="text"
                        placeholder="Search or select..."
                        value={citySearch || formData.cityOfRegistration}
                        onChange={(e) => {
                          setCitySearch(e.target.value)
                          setShowCityDropdown(true)
                        }}
                        onFocus={() => setShowCityDropdown(true)}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors"
                      />
                      {showCityDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-xl z-10 max-h-56 overflow-y-auto">
                          {searchCities(citySearch).length > 0 ? (
                            searchCities(citySearch).map((city) => (
                              <button
                                key={city}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, cityOfRegistration: city })
                                  setCitySearch('')
                                  setShowCityDropdown(false)
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors font-medium text-slate-900"
                              >
                                {city}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">No cities found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* TIN & Certificate Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 rounded-lg border bg-white border-slate-300">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2 tracking-wide">
                      Tax Identification Number (TIN) {formMode === 'existing' && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder={formMode === 'existing' ? 'XXX-XXX-XXX-XXX' : 'Optional - Add manually if available'}
                      value={formData.tin}
                      onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg font-mono text-sm font-semibold transition-colors bg-white text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    {formMode === 'create' && (
                      <p className="text-xs text-slate-500 mt-2">Leave blank to add manually later. A Currency Registration Number will be auto-generated.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2 tracking-wide">
                      BIR Certification {formMode === 'existing' && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder={formMode === 'existing' ? 'Enter BIR certification number' : 'Optional - Add manually if available'}
                      value={formData.certificateOfIncorporation}
                      onChange={(e) => setFormData({ ...formData, certificateOfIncorporation: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg font-mono text-sm font-semibold transition-colors bg-white text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    {formMode === 'create' && (
                      <p className="text-xs text-slate-500 mt-2">BIR Certification must be manually inserted after registration.</p>
                    )}
                  </div>
                </div>

                {/* Currency Registration Number Field - Auto-generated, Read-only */}
                <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <label className="block text-xs font-semibold text-blue-900 uppercase mb-2 tracking-wide">
                    Currency Registration Number (Auto-Generated)
                  </label>
                  <input
                    type="text"
                    value={formData.currencyRegistrationNumber}
                    readOnly={true}
                    className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg font-mono text-sm font-semibold bg-white text-blue-900 cursor-not-allowed"
                  />
                  <p className="text-xs text-blue-700 mt-2">
                    Your unique Currency Registration Number. This cannot be changed and will be displayed on your currency.ph profile.
                  </p>
                </div>

                {/* Registration Date */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Registration Date {formMode === 'existing' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="date"
                    value={formData.registrationDate}
                    onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors"
                  />
                  {formData.registrationDate && (
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(formData.registrationDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-6 border-t border-slate-200">
                  <button
                    onClick={handleAddBusiness}
                    disabled={
                      formMode === 'create'
                        ? !formData.businessName || !formData.cityOfRegistration || !businessNameAvailability?.available || !formData.currencyRegistrationNumber
                        : !formData.businessName || !formData.cityOfRegistration || !formData.tin || !formData.certificateOfIncorporation || !formData.registrationDate || !formData.currencyRegistrationNumber || !businessNameAvailability?.available
                    }
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-semibold transition-colors"
                  >
                    {formMode === 'create' ? 'Create Business' : 'Add Business'}
                  </button>
                  <button
                    onClick={() => {
                      setShowRegistrationForm(false)
                      setFormMode(null)
                    }}
                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show existing business dashboard with tabs
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-light text-slate-900 tracking-wide mb-2">My Business</h1>
            <p className="text-slate-500">Manage your businesses, employees, and integrations</p>
          </div>

          {/* Business Selector Dropdown */}
          {businesses.length > 0 && (
            <div className="relative" style={{ width: '280px' }}>
              <div className="bg-white border border-slate-300 rounded-lg shadow-sm p-4">
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2 tracking-wide">Select Business</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {businesses.map(business => (
                    <button
                      key={business.id}
                      onClick={() => setSelectedBusiness(selectedBusiness?.id === business.id ? null : business)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors text-sm ${
                        selectedBusiness?.id === business.id
                          ? 'bg-blue-100 border-blue-400 text-blue-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-medium">{business.business_name}</div>
                      {selectedBusiness?.id === business.id && (
                        <div className="text-xs text-blue-600 mt-1">✓ Selected</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Tab Navigation */}
        <div className="bg-white border-b border-slate-200 mb-8">
          <div className="flex gap-1">
            <button
              onClick={() => setMainTab('businesses')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                mainTab === 'businesses'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              Your Businesses
            </button>
            <button
              onClick={() => setMainTab('management')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                mainTab === 'management'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              Business Management
            </button>
          </div>
        </div>

        {/* Businesses Tab */}
        {mainTab === 'businesses' && (
          <div>
            {/* Business Selector */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Your Businesses</h2>
                  <div className="flex flex-wrap gap-3">
                    {businesses.map(business => (
                      <button
                        key={business.id}
                        onClick={() => setSelectedBusiness(selectedBusiness?.id === business.id ? null : business)}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          selectedBusiness?.id === business.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {business.business_name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* No Business Selected View */}
            {!selectedBusiness && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-12 text-center">
                <div className="max-w-md mx-auto">
                  <svg className="w-16 h-16 text-blue-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-2xl font-semibold text-slate-900 mb-2">Select a Business</h3>
                  <p className="text-slate-600 mb-6">Choose a business from above to view its overview, documents, settings, and more.</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => initializeForm('create')}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Create New Business
                    </button>
                    <button
                      onClick={() => initializeForm('existing')}
                      className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium"
                    >
                      Add Existing Business
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedBusiness && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-8 text-center">
                <div className="max-w-2xl mx-auto">
                  <p className="text-slate-700 mb-4">Want to add another business?</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => initializeForm('create')}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Create New Business
                    </button>
                    <button
                      onClick={() => initializeForm('existing')}
                      className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium"
                    >
                      Add Existing Business
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Management Tab */}
        {mainTab === 'management' && (
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <div className="sticky top-0 z-10 pb-6 pt-0">
              <h3 className="text-lg font-semibold text-slate-900">Business Management</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* BIR Integration */}
              <button onClick={() => setSelectedFeatureModal('bir')} className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all group">
                <div className="flex justify-center mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 12a5 5 0 1110 0A5 5 0 017 12z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">BIR Integration</h3>
                <p className="text-sm text-slate-600 mb-4">File taxes and access tax documents instantly</p>
                <div className="text-sm font-medium text-blue-600 group-hover:text-blue-700">Access feature →</div>
              </button>

              {/* Digital Receipts */}
              <button onClick={() => setSelectedFeatureModal('receipts')} className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-purple-300 transition-all group">
                <div className="flex justify-center mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Digital Receipts</h3>
                <p className="text-sm text-slate-600 mb-4">Track and manage all digital receipts</p>
                <div className="text-sm font-medium text-purple-600 group-hover:text-purple-700">Access feature →</div>
              </button>

              {/* Payment Integrations */}
              <button onClick={() => setSelectedFeatureModal('payments')} className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-pink-300 transition-all group">
                <div className="flex justify-center mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-pink-100 group-hover:bg-pink-200 transition-colors">
                    <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h10M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Payments</h3>
                <p className="text-sm text-slate-600 mb-4">Connect GCash, PayMaya, and more</p>
                <div className="text-sm font-medium text-pink-600 group-hover:text-pink-700">Access feature →</div>
              </button>

              {/* Shareholders */}
              <button onClick={() => setSelectedFeatureModal('shareholders')} className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-yellow-300 transition-all group">
                <div className="flex justify-center mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-yellow-100 group-hover:bg-yellow-200 transition-colors">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Shareholders</h3>
                <p className="text-sm text-slate-600 mb-4">Manage ownership and shareholders</p>
                <div className="text-sm font-medium text-yellow-600 group-hover:text-yellow-700">Access feature →</div>
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation - Only show when on Business Management tab and business is selected */}
        {mainTab === 'management' && selectedBusiness && (
        <div className="bg-white border-b border-slate-200 rounded-t-lg mt-16">
          <div className="max-w-7xl mx-auto px-6 flex flex-wrap gap-1">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'salesTaxReporting', label: 'Sales and Tax Reporting' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Tab Content */}
        {mainTab === 'management' && selectedBusiness && (
        <div ref={tabContentRef} className="bg-white rounded-b-lg border border-t-0 border-slate-200 p-8">
          {activeTab === 'overview' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-light text-slate-900">Business Overview</h2>
                <button
                  onClick={openEditTaxInfo}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm"
                >
                  Edit Tax Information
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Business Name</p>
                  <p className="text-xl font-semibold text-slate-900">{selectedBusiness.business_name}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Registration Type</p>
                  <p className="text-xl font-semibold text-slate-900 capitalize">{selectedBusiness.registration_type}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Tax ID (TIN)</p>
                  <p className="text-xl font-mono font-semibold text-slate-900">{selectedBusiness.tin}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">BIR Certification Number</p>
                  <p className="text-xl font-mono font-semibold text-slate-900">{selectedBusiness.certificate_of_incorporation}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Currency Registration Number</p>
                  <p className="text-xl font-mono font-semibold text-slate-900">{selectedBusiness.currency_registration_number || 'Not assigned'}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">City of Registration</p>
                  <p className="text-xl font-semibold text-slate-900">{selectedBusiness.city_of_registration}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Status</p>
                  <p className={`text-xl font-semibold ${selectedBusiness.status === 'active' ? 'text-green-600' : 'text-slate-600'}`}>
                    {selectedBusiness.status ? selectedBusiness.status.charAt(0).toUpperCase() + selectedBusiness.status.slice(1) : 'Unknown'}
                  </p>
                </div>
              </div>

              {/* Supporting Documents Section */}
              <div className="mt-8 pt-8 border-t border-slate-200">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">Supporting Documents</h3>
                <p className="text-slate-600 mb-6">Official documents for {selectedBusiness.business_name}</p>
                <div className="space-y-4">
                  {/* Business Name Registration Certificate */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 mb-1">Business Name Registration</h4>
                        <p className="text-sm text-slate-600">Official registration certificate for business name and type</p>
                        <p className="text-xs text-slate-500 mt-2">Certificate #: {selectedBusiness.certificate_of_incorporation}</p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => generateAndViewPDF('business-name', selectedBusiness)}
                          className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium whitespace-nowrap"
                        >
                          View
                        </button>
                        <button
                          onClick={() => generateAndDownloadPDF('business-name', selectedBusiness)}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap"
                        >
                          Export PDF
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Certificate of Incorporation */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 mb-1">Certificate of Incorporation</h4>
                        <p className="text-sm text-slate-600">Official certificate of incorporation and business registration</p>
                        <p className="text-xs text-slate-500 mt-2">TIN: {selectedBusiness.tin}</p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => generateAndViewPDF('incorporation', selectedBusiness)}
                          className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium whitespace-nowrap"
                        >
                          View
                        </button>
                        <button
                          onClick={() => generateAndDownloadPDF('incorporation', selectedBusiness)}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap"
                        >
                          Export PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">📌 Document Information</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>✓ All documents are officially certified and BIR compliant</li>
                    <li>✓ PDFs can be printed, shared, or archived</li>
                    <li>✓ Digital signatures included for authenticity</li>
                    <li>✓ Generate new copies anytime needed</li>
                  </ul>
                </div>
              </div>

              {/* BIR Integration Section */}
              <div id="bir-integration-section" className="mt-8 pt-8 border-t border-slate-200">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">BIR Integration</h3>
                <p className="text-slate-600 mb-6">File taxes and access tax documents instantly</p>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                  <p className="text-slate-700 mb-4">Your business is registered with the Bureau of Internal Revenue. Tax compliance features are available through our integration.</p>
                  <div className="flex gap-3">
                    <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">View Tax Status</button>
                    <button className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium">File Annual Return</button>
                  </div>
                </div>
              </div>

              {/* Business Registration Section */}
              <div className="mt-8 pt-8 border-t border-slate-200">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">Business Registration</h3>
                <p className="text-slate-600 mb-6">Manage your business and tax information</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500 mb-2">Registration Status</p>
                    <p className="text-lg font-semibold text-green-600">Active</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500 mb-2">Last Updated</p>
                    <p className="text-lg font-semibold text-slate-900">{selectedBusiness.registration_date ? new Date(selectedBusiness.registration_date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={openEditTaxInfo}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Update Information
                  </button>
                </div>
              </div>

              {/* Shareholders Section */}
              <div id="shareholders-section" className="mt-8 pt-8 border-t border-slate-200">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">Shareholders</h3>
                <p className="text-slate-600 mb-6">Manage ownership and shareholders</p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <p className="text-slate-700 mb-4">Shareholder management features allow you to track ownership percentages and maintain shareholder information for regulatory compliance.</p>
                  <button className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium">Manage Shareholders</button>
                </div>
              </div>

              {/* Payments Section */}
              <div className="mt-8 pt-8 border-t border-slate-200">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">Payments</h3>
                <p className="text-slate-600 mb-6">Connect and manage payment methods</p>
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-6">
                  <p className="text-slate-700 mb-4">Connect your payment integrations like GCash, PayMaya, and other payment methods to streamline transactions and improve customer payment options.</p>
                  <button className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-medium">Manage Payment Methods</button>
                </div>
              </div>
            </div>
          )}


          {activeTab === 'salesTaxReporting' && selectedBusiness && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-semibold text-slate-900">Sales & Tax Reporting</h4>
                <div className="flex gap-2">
                  <button onClick={() => exportToCSV()} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm">Export CSV</button>
                  <button onClick={() => { loadSalesAndTaxData(); loadReportingData(); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium text-sm">Refresh</button>
                </div>
              </div>

              {/* Period Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Reporting Period</label>
                  <select value={reportingPeriod} onChange={(e) => setReportingPeriod(e.target.value)} className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-600">
                    <option value="annual">Annual</option>
                    <option value="Q1">Q1 (Jan - Mar)</option>
                    <option value="Q2">Q2 (Apr - Jun)</option>
                    <option value="Q3">Q3 (Jul - Sep)</option>
                    <option value="Q4">Q4 (Oct - Dec)</option>
                    <option value="ytd">Year-to-Date</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Year</label>
                  <select value={reportingYear} onChange={(e) => setReportingYear(parseInt(e.target.value))} className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-600">
                    {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Key Metrics for Selected Period */}
              {loadingReports ? (
                <div className="text-center py-12">
                  <p className="text-slate-500">Loading reporting data...</p>
                </div>
              ) : currentPeriodReport ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                    <p className="text-sm text-slate-600 font-medium mb-2">Total Sales</p>
                    <p className="text-3xl font-bold text-blue-600">₱{currentPeriodReport.totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-600 mt-2">{currentPeriodReport.receiptCount} receipts</p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
                    <p className="text-sm text-slate-600 font-medium mb-2">Total Expenses</p>
                    <p className="text-3xl font-bold text-orange-600">₱{currentPeriodReport.totalExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-600 mt-2">{currentPeriodReport.expenseCount} deductions</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                    <p className="text-sm text-slate-600 font-medium mb-2">Net Income</p>
                    <p className={`text-3xl font-bold ${currentPeriodReport.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>₱{currentPeriodReport.netIncome.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-600 mt-2">Profit Margin: {currentPeriodReport.profitMargin}%</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
                    <p className="text-sm text-slate-600 font-medium mb-2">Tax Liability</p>
                    <p className="text-3xl font-bold text-purple-600">₱{currentPeriodReport.estimatedTax.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-600 mt-2">Paid: ₱{currentPeriodReport.taxPaid.toFixed(2)}</p>
                  </div>
                </div>
              ) : null}

              {/* Monthly Breakdown */}
              {filteredMonthlyData.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
                  <h5 className="text-lg font-semibold text-slate-900 mb-6">Monthly Breakdown ({reportingYear})</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredMonthlyData.map((month, idx) => (
                      month.sales > 0 || month.expenses > 0 ? (
                        <div key={idx} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
                          <p className="font-semibold text-slate-900 mb-3">{month.month}</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Sales:</span>
                              <span className="font-medium text-blue-600">₱{month.sales.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Expenses:</span>
                              <span className="font-medium text-orange-600">₱{month.expenses.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-300">
                              <span className="font-semibold text-slate-900">Net:</span>
                              <span className={`font-bold ${month.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>₱{month.netIncome.toFixed(0)}</span>
                            </div>
                          </div>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 mb-8">
                <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium">+ Add Expense</button>
                <button onClick={() => setShowTaxPaymentForm(!showTaxPaymentForm)} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">+ Record Tax Payment</button>
              </div>

              {/* Expense Form */}
              {showExpenseForm && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6 mb-8">
                  <h5 className="text-lg font-semibold text-slate-900 mb-4">Add Business Expense</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Description" value={expenseFormData.description} onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })} className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-orange-600" />
                    <input type="number" placeholder="Amount" value={expenseFormData.amount} onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })} className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-orange-600" />
                    <select value={expenseFormData.category} onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })} className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-orange-600">
                      <option value="supplies">Office Supplies</option>
                      <option value="rent">Rent</option>
                      <option value="utilities">Utilities</option>
                      <option value="transport">Transportation</option>
                      <option value="meals">Meals & Entertainment</option>
                      <option value="equipment">Equipment</option>
                      <option value="other">Other</option>
                    </select>
                    <input type="date" value={expenseFormData.receiptDate} onChange={(e) => setExpenseFormData({ ...expenseFormData, receiptDate: e.target.value })} className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-orange-600" />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={handleAddExpense} disabled={savingCost} className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-300 font-medium">{savingCost ? 'Saving...' : 'Save Expense'}</button>
                    <button onClick={() => setShowExpenseForm(false)} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
                  </div>
                </div>
              )}

              {/* Tax Payment Form */}
              {showTaxPaymentForm && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-8">
                  <h5 className="text-lg font-semibold text-slate-900 mb-4">Record Tax Payment</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="number" placeholder="Payment Amount" value={taxPaymentData.amount} onChange={(e) => setTaxPaymentData({ ...taxPaymentData, amount: e.target.value })} className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-green-600" />
                    <input type="date" value={taxPaymentData.paymentDate} onChange={(e) => setTaxPaymentData({ ...taxPaymentData, paymentDate: e.target.value })} className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-green-600" />
                    <select value={taxPaymentData.paymentMethod} onChange={(e) => setTaxPaymentData({ ...taxPaymentData, paymentMethod: e.target.value })} className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-green-600">
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="check">Check</option>
                      <option value="cash">Cash</option>
                      <option value="credit_card">Credit Card</option>
                    </select>
                    <input type="text" placeholder="Reference Number (Optional)" value={taxPaymentData.referenceNumber} onChange={(e) => setTaxPaymentData({ ...taxPaymentData, referenceNumber: e.target.value })} className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-green-600" />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={handleSaveTaxPayment} disabled={savingCost} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 font-medium">{savingCost ? 'Saving...' : 'Record Payment'}</button>
                    <button onClick={() => setShowTaxPaymentForm(false)} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
                  </div>
                </div>
              )}

              {/* Recent Tax Payments */}
              {taxPayments.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
                  <h5 className="text-lg font-semibold text-slate-900 mb-4">Tax Payments History</h5>
                  <div className="space-y-3">
                    {taxPayments.map((payment, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-900">{new Date(payment.payment_date).toLocaleDateString()}</p>
                          <p className="text-sm text-slate-600">{payment.payment_method} {payment.reference_number && `- Ref: ${payment.reference_number}`}</p>
                        </div>
                        <p className="text-lg font-bold text-green-600">₱{parseFloat(payment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quarterly Breakdown */}
              {quarterlyReports.length > 0 && reportingPeriod === 'annual' && (
                <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
                  <h5 className="text-lg font-semibold text-slate-900 mb-6">Quarterly Breakdown ({reportingYear})</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {quarterlyReports.map((q, idx) => (
                      <div key={idx} className="border border-slate-300 rounded-lg p-4 bg-slate-50">
                        <div className="mb-3">
                          <h6 className="font-semibold text-slate-900">{q.period}</h6>
                          <p className="text-xs text-slate-500">{q.monthRange}</p>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Sales:</span>
                            <span className="font-medium">₱{q.totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Expenses:</span>
                            <span className="font-medium">₱{q.totalExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-300 pt-2">
                            <span className="font-semibold">Net Income:</span>
                            <span className={`font-bold ${q.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>₱{q.netIncome.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Est. Tax:</span>
                            <span className="font-medium">₱{q.estimatedTax.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Report */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sales Summary */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h5 className="text-lg font-semibold text-slate-900 mb-4">Sales Summary</h5>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-slate-600">Total Receipts</span>
                      <span className="font-semibold text-slate-900">{receipts.length}</span>
                    </div>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-slate-600">Total Sales Amount</span>
                      <span className="font-semibold text-slate-900">₱{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {receipts.length > 0 && (
                      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <span className="text-slate-600">Average Transaction</span>
                        <span className="font-semibold text-slate-900">₱{(totalSales / receipts.length).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="pt-4">
                      <p className="text-xs text-slate-500">Last Updated: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Expenses Summary */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h5 className="text-lg font-semibold text-slate-900 mb-4">Expenses & Deductions</h5>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-slate-600">Total Deductions</span>
                      <span className="font-semibold text-slate-900">{miscCosts.length}</span>
                    </div>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-slate-600">Total Expense Amount</span>
                      <span className="font-semibold text-slate-900">₱{totalCosts.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-slate-600">Net Profit Margin</span>
                      <span className="font-semibold text-slate-900">{totalSales > 0 ? ((netIncome / totalSales) * 100).toFixed(2) : 0}%</span>
                    </div>
                    <div className="pt-4">
                      <p className="text-xs text-slate-500">Manage deductions in the business details section</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tax Breakdown */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200 p-6 mt-8">
                <h5 className="text-lg font-semibold text-slate-900 mb-6">Tax Calculation Breakdown</h5>
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-purple-300">
                    <span className="text-slate-700">Gross Sales</span>
                    <span className="font-semibold text-slate-900">₱{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b border-purple-300">
                    <span className="text-slate-700">Less: Expenses & Deductions</span>
                    <span className="font-semibold text-slate-900">-₱{totalCosts.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b border-purple-300 bg-white bg-opacity-50 px-4 py-2 rounded">
                    <span className="text-slate-700 font-medium">Taxable Income</span>
                    <span className="font-bold text-slate-900">₱{netIncome.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-slate-700 font-medium">Tax Rate</span>
                    <span className="font-semibold text-slate-900">12%</span>
                  </div>
                  <div className="flex items-center justify-between bg-purple-600 text-white px-4 py-3 rounded-lg mt-4">
                    <span className="font-semibold">Estimated Tax Liability</span>
                    <span className="text-2xl font-bold">₱{estimatedTax.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Recent Receipts Preview */}
              {receipts.length > 0 && (
                <div className="mt-8">
                  <h5 className="text-lg font-semibold text-slate-900 mb-4">Recent Receipts (Last 5)</h5>
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-6 py-3 text-slate-700 font-semibold">Date</th>
                          <th className="text-left px-6 py-3 text-slate-700 font-semibold">Description</th>
                          <th className="text-right px-6 py-3 text-slate-700 font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receipts.slice(0, 5).map((receipt, index) => (
                          <tr key={receipt.id || index} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="px-6 py-3 text-slate-600">{new Date(receipt.created_at || receipt.receipt_date).toLocaleDateString()}</td>
                            <td className="px-6 py-3 text-slate-700 font-medium">{receipt.description || receipt.receipt_type || 'Transaction'}</td>
                            <td className="px-6 py-3 text-right font-semibold text-slate-900">₱{parseFloat(receipt.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* No Data State */}
              {receipts.length === 0 && miscCosts.length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 mt-8">
                  <p className="text-slate-500 text-lg">No sales or expense data yet</p>
                  <p className="text-slate-400 text-sm mt-2">Add receipts and expenses to see your tax reporting</p>
                </div>
              )}
            </div>
          )}


        </div>
        )}

        {showRegistrationForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
                <h2 className="text-2xl font-semibold text-white mb-1">{formMode === 'create' ? 'Create New Business' : 'Add Existing Business'}</h2>
                <p className="text-blue-100 text-sm">{formMode === 'create' ? 'Register a new business' : 'Link an existing business'}</p>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Business Name <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter your business name" value={formData.businessName} onChange={(e) => handleBusinessNameChange(e.target.value)} className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3">Registration Type <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-4">
                    {['sole', 'partnership', 'corporation', 'cooperative'].map(type => <button key={type} onClick={() => handleRegistrationTypeChange(type)} className={`px-4 py-3 rounded-lg border-2 font-medium capitalize ${formData.registrationType === type ? 'bg-blue-50 border-blue-600 text-blue-600' : 'border-slate-200'}`}>{type}</button>)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">City of Registration <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Search cities..." value={citySearch} onChange={(e) => { setCitySearch(e.target.value); setShowCityDropdown(true); }} onFocus={() => setShowCityDropdown(true)} className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-600" />
                  {formData.cityOfRegistration && <p className="mt-2 text-sm text-green-600">Selected: {formData.cityOfRegistration}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white border border-slate-300 rounded-lg">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">TIN {formMode === 'existing' && <span className="text-red-500">*</span>}</label>
                    <input type="text" placeholder={formMode === 'existing' ? 'XXX-XXX-XXX-XXX' : 'Optional - Add manually if available'} value={formData.tin} onChange={(e) => setFormData({ ...formData, tin: e.target.value })} className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600" />
                    {formMode === 'create' && <p className="text-xs text-slate-500 mt-1">BIR Certificate must be manually inserted later.</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">BIR Certification {formMode === 'existing' && <span className="text-red-500">*</span>}</label>
                    <input type="text" placeholder={formMode === 'existing' ? 'Enter BIR certification number' : 'Optional - Add manually if available'} value={formData.certificateOfIncorporation} onChange={(e) => setFormData({ ...formData, certificateOfIncorporation: e.target.value })} className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600" />
                  </div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="block text-xs font-semibold text-blue-900 uppercase mb-2">Currency Registration Number (Auto-Generated)</label>
                    <input type="text" value={formData.currencyRegistrationNumber} readOnly={true} className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg font-mono text-sm font-semibold bg-white text-blue-900 cursor-not-allowed" />
                    <p className="text-xs text-blue-700 mt-2">Your unique Currency Registration Number for currency.ph</p>
                  </div>
                {formMode === 'existing' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Registration Date <span className="text-red-500">*</span></label>
                    <input type="date" value={formData.registrationDate} onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })} className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg" />
                  </div>
                )}
                <div className="flex gap-3 pt-6 border-t border-slate-200">
                  <button onClick={handleAddBusiness} disabled={formMode === 'create' ? !formData.businessName || !formData.cityOfRegistration || !businessNameAvailability?.available || !formData.currencyRegistrationNumber : !formData.businessName || !formData.cityOfRegistration || !formData.tin || !formData.certificateOfIncorporation || !formData.registrationDate || !formData.currencyRegistrationNumber} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 font-semibold">{formMode === 'create' ? 'Create Business' : 'Add Business'}</button>
                  <button onClick={() => { setShowRegistrationForm(false); setFormMode(null); }} className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Tax Information Modal */}
        {editMode && selectedBusiness && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4">
              <div className="p-8">
                <h2 className="text-2xl font-light text-slate-900 mb-2">Edit Tax Information</h2>
                <p className="text-slate-600 mb-6">Update tax ID, BIR certification number, and currency registration number</p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Tax ID (TIN)</label>
                    <input
                      type="text"
                      placeholder="XXX-XXX-XXX-XXX (optional)"
                      value={editFormData.tin}
                      onChange={(e) => setEditFormData({ ...editFormData, tin: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                    <p className="text-xs text-slate-500 mt-1">Enter your Tax Identification Number (optional)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">BIR Certification Number</label>
                    <input
                      type="text"
                      placeholder="BIR-XXXX-XX-XXXXXX (optional)"
                      value={editFormData.certificateOfIncorporation}
                      onChange={(e) => setEditFormData({ ...editFormData, certificateOfIncorporation: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                    <p className="text-xs text-slate-500 mt-1">Enter your BIR certification number (optional)</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-900">Currency Registration Number</label>
                      {!editFormData.currencyRegistrationNumber && (
                        <button
                          onClick={handleGenerateCurrencyRegistration}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Generate One
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="CRN-XXXXXXXXXXXXXXXX"
                      value={editFormData.currencyRegistrationNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, currencyRegistrationNumber: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1">Your unique Currency Registration Number for currency.ph</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 border-t border-slate-200 mt-6">
                  <button
                    onClick={handleUpdateTaxInfo}
                    disabled={savingEdit}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 font-semibold transition-colors"
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    disabled={savingEdit}
                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature Modal */}
        {selectedFeatureModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 relative max-h-[90vh] overflow-y-auto">
              {/* Close Button */}
              <button
                onClick={() => setSelectedFeatureModal(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* BIR Integration Modal */}
              {selectedFeatureModal === 'bir' && (
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-blue-100">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 12a5 5 0 1110 0A5 5 0 017 12z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">BIR Integration</h2>
                      <p className="text-slate-600">File taxes and access tax documents</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <p className="text-slate-700">Manage your business tax filings and compliance with the Bureau of Internal Revenue (BIR).</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">Tax Filing</h3>
                        <p className="text-sm text-slate-600">File your annual income tax returns and quarterly tax payments with BIR compliance.</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">Tax Documents</h3>
                        <p className="text-sm text-slate-600">Access and download your tax documents, certificates, and compliance records.</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">Tax Status</h3>
                        <p className="text-sm text-slate-600">Monitor your tax payment status and receive notifications for deadlines.</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">Compliance</h3>
                        <p className="text-sm text-slate-600">Ensure your business remains compliant with all BIR requirements.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors">
                      View Tax Status
                    </button>
                    <button className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold transition-colors">
                      File Return
                    </button>
                  </div>
                </div>
              )}

              {/* Employees & Payroll Modal */}
              {/* Digital Receipts Modal */}
              {selectedFeatureModal === 'receipts' && selectedBusiness && (
                <MerchantReceipts business={selectedBusiness} userId={userId} />
              )}

              {/* Payments Modal */}
              {selectedFeatureModal === 'payments' && (
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-pink-100">
                      <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h10M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Payments</h2>
                      <p className="text-slate-600">Connect and manage payment methods</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <p className="text-slate-700">Integrate multiple payment gateways to streamline transactions and improve customer convenience.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">GCash Integration</h3>
                        <p className="text-sm text-slate-600">Connect your GCash account for seamless mobile payments.</p>
                      </div>
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">PayMaya Integration</h3>
                        <p className="text-sm text-slate-600">Accept payments through PayMaya's payment platform.</p>
                      </div>
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">Payment Tracking</h3>
                        <p className="text-sm text-slate-600">Monitor all payment transactions and reconciliations.</p>
                      </div>
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">Settlement Management</h3>
                        <p className="text-sm text-slate-600">Manage payouts and settlement schedules from your integrations.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button className="flex-1 px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-semibold transition-colors">
                      Add Payment Method
                    </button>
                    <button className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold transition-colors">
                      View Transactions
                    </button>
                  </div>
                </div>
              )}

              {/* Shareholders Modal */}
              {selectedFeatureModal === 'shareholders' && (
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-yellow-100">
                      <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Shareholders</h2>
                      <p className="text-slate-600">Manage ownership and shareholders</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <p className="text-slate-700">Track and manage shareholder information, ownership percentages, and corporate governance.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">Shareholder Registry</h3>
                        <p className="text-sm text-slate-600">Maintain a complete list of shareholders and their holdings.</p>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">Ownership Tracking</h3>
                        <p className="text-sm text-slate-600">Monitor ownership percentages and voting rights.</p>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">Dividend Management</h3>
                        <p className="text-sm text-slate-600">Calculate and distribute dividends to shareholders.</p>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-900 mb-2">Compliance Reports</h3>
                        <p className="text-sm text-slate-600">Generate regulatory reports for shareholder meetings and filings.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold transition-colors">
                      View Shareholders
                    </button>
                    <button className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold transition-colors">
                      Add Shareholder
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Select Business Modal */}
        {showBusinessSelectionModal && (
          <SelectBusinessModal
            businesses={businesses}
            onSelect={(business) => {
              setSelectedBusiness(business)
              setShowBusinessSelectionModal(false)
              setMainTab('management')
            }}
            onCreateNew={() => {
              setShowBusinessSelectionModal(false)
              initializeForm('create')
            }}
            onAddExisting={() => {
              setShowBusinessSelectionModal(false)
              initializeForm('existing')
            }}
            onClose={() => {
              setShowBusinessSelectionModal(false)
            }}
          />
        )}
      </div>
    </div>
  )
}

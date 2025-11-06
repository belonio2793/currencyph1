import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PHILIPPINES_CITIES } from '../data/philippinesCities'

export default function MyBusiness({ userId }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [businesses, setBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [showAddBusiness, setShowAddBusiness] = useState(false)
  const [loading, setLoading] = useState(true)
  const [citySearch, setCitySearch] = useState('')
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [formData, setFormData] = useState({
    businessName: '',
    registrationType: 'sole',
    tin: '',
    certificateOfIncorporation: '',
    cityOfRegistration: '',
    registrationDate: ''
  })

  // Auto-generate TIN (12-digit format)
  const generateTIN = () => {
    const randomTIN = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')
    return randomTIN.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1-$2-$3-$4')
  }

  // Auto-generate Certificate number
  const generateCertificate = () => {
    const year = new Date().getFullYear()
    const random = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')
    return `CERT-${year}-${random}`
  }

  // Get current date in Manila timezone (PHT = UTC+8)
  const getCurrentManillaDate = () => {
    const now = new Date()
    const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const year = manilaTime.getFullYear()
    const month = String(manilaTime.getMonth() + 1).padStart(2, '0')
    const day = String(manilaTime.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Filter cities based on search
  const filteredCities = citySearch.length > 0
    ? PHILIPPINES_CITIES.filter(city =>
        city.name.toLowerCase().includes(citySearch.toLowerCase())
      )
    : PHILIPPINES_CITIES

  useEffect(() => {
    if (userId) {
      loadBusinesses()
    }
  }, [userId])

  // Close city dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-city-dropdown]')) {
        setShowCityDropdown(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const loadBusinesses = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)
      
      if (error) throw error
      setBusinesses(data || [])
      if (data && data.length > 0) {
        setSelectedBusiness(data[0])
      }
    } catch (err) {
      console.error('Failed to load businesses:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddBusiness = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .insert([{
          user_id: userId,
          business_name: formData.businessName,
          registration_type: formData.registrationType,
          tin: formData.tin,
          certificate_of_incorporation: formData.certificateOfIncorporation,
          city_of_registration: formData.cityOfRegistration,
          registration_date: formData.registrationDate,
          status: 'active'
        }])
        .select()

      if (error) throw error
      
      setBusinesses([...businesses, data[0]])
      setSelectedBusiness(data[0])
      setShowAddBusiness(false)
      setFormData({
        businessName: '',
        registrationType: 'sole',
        tin: '',
        certificateOfIncorporation: '',
        cityOfRegistration: '',
        registrationDate: ''
      })
    } catch (err) {
      console.error('Failed to add business:', err)
    }
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-light text-slate-900 tracking-wide mb-2">My Business</h1>
          <p className="text-slate-500">Manage your businesses, employees, and integrations</p>
        </div>

        {/* Business Selector */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Your Businesses</h2>
          
          {businesses.length > 0 ? (
            <div className="flex flex-wrap gap-3 mb-4">
              {businesses.map(business => (
                <button
                  key={business.id}
                  onClick={() => setSelectedBusiness(business)}
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
          ) : (
            <p className="text-slate-500 text-sm mb-4">No businesses registered yet</p>
          )}
          
          <button
            onClick={() => {
              if (!showAddBusiness) {
                // Auto-generate values when opening the form
                setFormData({
                  businessName: '',
                  registrationType: 'sole',
                  tin: generateTIN(),
                  certificateOfIncorporation: generateCertificate(),
                  cityOfRegistration: '',
                  registrationDate: getCurrentManillaDate()
                })
                setCitySearch('')
              }
              setShowAddBusiness(!showAddBusiness)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            {showAddBusiness ? 'Cancel' : '+ Add New Business'}
          </button>

          {/* Add Business Form */}
          {showAddBusiness && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-md font-semibold text-slate-900 mb-4">Register New Business</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 font-medium mb-1">Business Name</label>
                  <input
                    type="text"
                    placeholder="Enter your business name"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 font-medium mb-1">Business Type</label>
                  <select
                    value={formData.registrationType}
                    onChange={(e) => setFormData({ ...formData, registrationType: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  >
                    <option value="sole">Sole Proprietorship</option>
                    <option value="partnership">Partnership</option>
                    <option value="corporation">Corporation</option>
                    <option value="llc">LLC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 font-medium mb-1">Tax Identification Number (TIN)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.tin}
                      readOnly
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tin: generateTIN() })}
                      className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium whitespace-nowrap"
                      title="Generate new TIN"
                    >
                      🔄 Regenerate
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Auto-generated. Click Regenerate for a new number.</p>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 font-medium mb-1">Certificate of Incorporation</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.certificateOfIncorporation}
                      readOnly
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, certificateOfIncorporation: generateCertificate() })}
                      className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium whitespace-nowrap"
                      title="Generate new certificate"
                    >
                      🔄 Regenerate
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Auto-generated. Click Regenerate for a new number.</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm text-slate-600 font-medium mb-1">City of Registration</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search or select a city..."
                      value={citySearch || formData.cityOfRegistration}
                      onChange={(e) => {
                        setCitySearch(e.target.value)
                        setShowCityDropdown(true)
                      }}
                      onFocus={() => setShowCityDropdown(true)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                    {showCityDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                        {filteredCities.length > 0 ? (
                          filteredCities.map((city) => (
                            <button
                              key={city.name}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, cityOfRegistration: city.name })
                                setCitySearch('')
                                setShowCityDropdown(false)
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
                            >
                              <div className="font-medium text-slate-900">{city.name}</div>
                              <div className="text-xs text-slate-500">{city.region} • Population: {city.population.toLocaleString()}</div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-slate-500 text-center">No cities found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 font-medium mb-1">Registration Date (Manila Time)</label>
                  <input
                    type="date"
                    value={formData.registrationDate}
                    onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                  <p className="text-xs text-slate-500 mt-1">Currently set to: {new Date(formData.registrationDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleAddBusiness}
                  disabled={!formData.businessName || !formData.cityOfRegistration}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  Save Business
                </button>
                <button
                  onClick={() => setShowAddBusiness(false)}
                  className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        {selectedBusiness && (
          <>
            {/* Tab Navigation */}
            <div className="bg-white border-b border-slate-200 rounded-t-lg">
              <div className="max-w-7xl mx-auto px-6 flex flex-wrap gap-1">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'bir', label: 'BIR Integration' },
                  { id: 'registration', label: 'Business Registration' },
                  { id: 'shareholders', label: 'Shareholders' },
                  { id: 'employees', label: 'Employees & Payroll' },
                  { id: 'merchant', label: 'Merchant Tools' },
                  { id: 'receipts', label: 'Receipts' },
                  { id: 'payments', label: 'Payment Integrations' }
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

            {/* Tab Content */}
            <div className="bg-white rounded-b-lg border border-t-0 border-slate-200 p-8">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div>
                  <h2 className="text-2xl font-light text-slate-900 mb-6">Business Overview</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      <p className="text-xl font-semibold text-slate-900">{selectedBusiness.tin || 'Not provided'}</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                      <p className="text-sm text-slate-500 mb-2">City of Registration</p>
                      <p className="text-xl font-semibold text-slate-900">{selectedBusiness.city_of_registration || 'Not provided'}</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                      <p className="text-sm text-slate-500 mb-2">Status</p>
                      <p className={`text-xl font-semibold ${selectedBusiness.status === 'active' ? 'text-green-600' : 'text-slate-600'}`}>
                        {selectedBusiness.status ? selectedBusiness.status.charAt(0).toUpperCase() + selectedBusiness.status.slice(1) : 'Unknown'}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                      <p className="text-sm text-slate-500 mb-2">Registration Date</p>
                      <p className="text-xl font-semibold text-slate-900">
                        {selectedBusiness.registration_date ? new Date(selectedBusiness.registration_date).toLocaleDateString() : 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* BIR Integration Tab */}
              {activeTab === 'bir' && (
                <div>
                  <h2 className="text-2xl font-light text-slate-900 mb-6">Bureau of Internal Revenue (BIR)</h2>
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-900 mb-2">Tax Filing & Reporting</h3>
                          <p className="text-slate-600 text-sm mb-4">Seamlessly file tax reports and generate tax deductible statements with a single click.</p>
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                            File Tax Report
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Available Documents</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">Income Statement</p>
                            <p className="text-sm text-slate-500">Tax year 2024</p>
                          </div>
                          <button className="px-3 py-1 text-blue-600 hover:text-blue-700 font-medium text-sm">Download</button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">Tax Deductible Statement</p>
                            <p className="text-sm text-slate-500">Tax year 2024</p>
                          </div>
                          <button className="px-3 py-1 text-blue-600 hover:text-blue-700 font-medium text-sm">Download</button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">Tax Payment Report</p>
                            <p className="text-sm text-slate-500">All time</p>
                          </div>
                          <button className="px-3 py-1 text-blue-600 hover:text-blue-700 font-medium text-sm">Download</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Business Registration Tab */}
              {activeTab === 'registration' && (
                <div>
                  <h2 className="text-2xl font-light text-slate-900 mb-6">Business Registration Details</h2>
                  <div className="space-y-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Registration Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-slate-600 font-medium">Business Name</label>
                          <p className="text-slate-900 mt-1">{selectedBusiness.business_name}</p>
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 font-medium">Registration Type</label>
                          <p className="text-slate-900 mt-1 capitalize">{selectedBusiness.registration_type}</p>
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 font-medium">Certificate of Incorporation</label>
                          <p className="text-slate-900 mt-1">{selectedBusiness.certificate_of_incorporation || 'Not provided'}</p>
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 font-medium">City of Registration</label>
                          <p className="text-slate-900 mt-1">{selectedBusiness.city_of_registration || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Supporting Documents</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">Passport/Driver's License</p>
                            <p className="text-sm text-slate-500">Owner Identification</p>
                          </div>
                          <button className="px-3 py-1 text-blue-600 hover:text-blue-700 font-medium text-sm">Upload</button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">Proof of Address</p>
                            <p className="text-sm text-slate-500">Business Location</p>
                          </div>
                          <button className="px-3 py-1 text-blue-600 hover:text-blue-700 font-medium text-sm">Upload</button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">Business Permit</p>
                            <p className="text-sm text-slate-500">Local Government Permit</p>
                          </div>
                          <button className="px-3 py-1 text-blue-600 hover:text-blue-700 font-medium text-sm">Upload</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Shareholders Tab */}
              {activeTab === 'shareholders' && (
                <div>
                  <h2 className="text-2xl font-light text-slate-900 mb-6">Shareholders & Management</h2>
                  <div className="space-y-6">
                    <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                      + Add Shareholder
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-semibold">S</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900">Shareholder 1</h3>
                            <p className="text-sm text-slate-500 mt-1">50% Ownership</p>
                            <div className="flex gap-2 mt-3">
                              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                              <button className="text-xs text-red-600 hover:text-red-700 font-medium">Remove</button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-green-600 font-semibold">S</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900">Shareholder 2</h3>
                            <p className="text-sm text-slate-500 mt-1">50% Ownership</p>
                            <div className="flex gap-2 mt-3">
                              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                              <button className="text-xs text-red-600 hover:text-red-700 font-medium">Remove</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <h3 className="font-semibold text-slate-900 mb-3">Business Bylaws</h3>
                      <p className="text-sm text-slate-600 mb-4">Upload and manage your business bylaws and governance documents.</p>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                        Upload Bylaws
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Employees & Payroll Tab */}
              {activeTab === 'employees' && (
                <div>
                  <h2 className="text-2xl font-light text-slate-900 mb-6">Employees & Payroll Management</h2>
                  <div className="space-y-6">
                    <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                      + Add Employee
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Total Employees</p>
                        <p className="text-3xl font-light text-slate-900">0</p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Monthly Payroll</p>
                        <p className="text-3xl font-light text-slate-900">₱0.00</p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Benefits Allocated</p>
                        <p className="text-3xl font-light text-slate-900">₱0.00</p>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                        <h3 className="font-semibold text-slate-900">Employee Directory</h3>
                      </div>
                      <div className="divide-y divide-slate-200">
                        <div className="px-6 py-4 text-sm text-slate-500 text-center">
                          No employees added yet. Click "Add Employee" to get started.
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <h3 className="font-semibold text-slate-900 mb-2">Compensation & Rewards</h3>
                      <p className="text-sm text-slate-600 mb-4">Manage employee salaries, bonuses, benefits, and performance rewards all in one place.</p>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                        Manage Compensation
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Merchant Tools Tab */}
              {activeTab === 'merchant' && (
                <div>
                  <h2 className="text-2xl font-light text-slate-900 mb-6">Merchant Tools</h2>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-2">Physical Sales</h3>
                            <p className="text-sm text-slate-600 mb-4">Track tangible products and manage inventory.</p>
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                              Manage Products
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-2">Digital Services</h3>
                            <p className="text-sm text-slate-600 mb-4">Manage intangible products and services.</p>
                            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                              Manage Services
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-2">Instant Photo Capture</h3>
                            <p className="text-sm text-slate-600 mb-4">Take photos directly during transactions.</p>
                            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                              Open Camera
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-2">Accounting</h3>
                            <p className="text-sm text-slate-600 mb-4">Track debits, credits, and expenses automatically.</p>
                            <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
                              View Ledger
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-2">Multiple Businesses</h3>
                            <p className="text-sm text-slate-600 mb-4">Manage multiple businesses with one account.</p>
                            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                              View Businesses
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Receipts Tab */}
              {activeTab === 'receipts' && (
                <div>
                  <h2 className="text-2xl font-light text-slate-900 mb-6">Digital Receipts</h2>
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <h3 className="font-semibold text-slate-900 mb-2">Paperless Society</h3>
                      <p className="text-sm text-slate-600 mb-4">Every sale is automatically recorded and digital receipts are sent to customers' profiles. Receipts are printable, shareable, and can be used for refunds or dispute resolution.</p>
                      <div className="flex gap-2">
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                          View Recent Receipts
                        </button>
                        <button className="px-4 py-2 bg-white text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 text-sm font-medium">
                          Settings
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900">Receipt History</h3>
                          <input
                            type="search"
                            placeholder="Search receipts..."
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600"
                          />
                        </div>
                      </div>
                      <div className="divide-y divide-slate-200">
                        <div className="px-6 py-4 text-sm text-slate-500 text-center">
                          No receipts yet. Complete your first sale to generate a receipt.
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Total Sales</p>
                        <p className="text-3xl font-light text-slate-900">0</p>
                        <p className="text-sm text-slate-500 mt-2">transactions</p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Total Revenue</p>
                        <p className="text-3xl font-light text-slate-900">₱0.00</p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Average Transaction</p>
                        <p className="text-3xl font-light text-slate-900">₱0.00</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Integrations Tab */}
              {activeTab === 'payments' && (
                <div>
                  <h2 className="text-2xl font-light text-slate-900 mb-6">Payment Provider Integrations</h2>
                  <div className="space-y-6">
                    <p className="text-slate-600">Connect your business to major payment providers. Seamlessly process transactions and receive unified receipt formats.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.944 17.97h4.08c2.539 0 4.94-1.158 6.499-3.154h3.279c-1.714 2.898-4.776 4.881-8.28 4.881H11.944v-1.727zm0-6.252h4.08c1.43 0 2.779-.455 3.904-1.294.89.784 1.477 1.852 1.477 3.059 0 2.26-1.834 4.094-4.094 4.094h-4.08v-5.859zm0-5.859h4.08c2.86 0 5.359 1.369 6.952 3.484l-4.08-3.484h-2.872v5.859h4.08c1.43 0 2.779.455 3.904 1.294.89-.784 1.477-1.852 1.477-3.059 0-2.26-1.834-4.094-4.094-4.094h-4.08V4.859z"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-2">GCash</h3>
                            <p className="text-sm text-slate-600 mb-4">Digital wallet and payment service.</p>
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                              Connect
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-2">PayMaya</h3>
                            <p className="text-sm text-slate-600 mb-4">Digital payment and financial services.</p>
                            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                              Connect
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54h2.63l2.96-3.83c.37-.48.37-1.24 0-1.72L13.5 8h-2.64l2.75 3.54c.37.48.37 1.25.01 1.75z"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-2">Retail Systems (POS)</h3>
                            <p className="text-sm text-slate-600 mb-4">Point of sale integration.</p>
                            <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
                              Connect
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-2">Additional Providers</h3>
                            <p className="text-sm text-slate-600 mb-4">And many more coming soon.</p>
                            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                              View All
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                      <h3 className="font-semibold text-slate-900 mb-4">Connected Providers</h3>
                      <div className="text-sm text-slate-500 text-center py-6">
                        No payment providers connected yet. Connect your first provider above.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!selectedBusiness && !showAddBusiness && (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-4">No businesses yet. Create one to get started.</p>
            <button
              onClick={() => setShowAddBusiness(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Register Your First Business
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

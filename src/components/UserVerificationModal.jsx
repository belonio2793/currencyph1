import React, { useState, useEffect } from 'react'
import { p2pLoanService } from '../lib/p2pLoanService'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function UserVerificationModal({ userId, onClose, onSuccess }) {
  const { isMobile } = useDevice()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState(null)
  
  const [formData, setFormData] = useState({
    idType: 'drivers_license',
    idNumber: '',
    idImageUrl: ''
  })
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    loadVerificationStatus()
  }, [userId])

  const loadVerificationStatus = async () => {
    try {
      const status = await p2pLoanService.getVerificationStatus(userId)
      setVerificationStatus(status)
    } catch (err) {
      console.error('Error loading verification status:', err)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // For demo, create a data URL preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setPreview(event.target.result)
        setFormData(prev => ({
          ...prev,
          idImageUrl: event.target.result
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!formData.idNumber.trim()) {
        throw new Error('Please enter your ID number')
      }
      if (!formData.idImageUrl) {
        throw new Error('Please upload a photo of your ID')
      }

      await p2pLoanService.submitVerification(
        userId,
        formData.idType,
        formData.idNumber,
        formData.idImageUrl
      )

      setSuccess(true)
      setFormData({ idType: 'drivers_license', idNumber: '', idImageUrl: '' })
      setPreview(null)
      
      setTimeout(() => {
        if (onSuccess) onSuccess()
        onClose()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to submit verification')
    } finally {
      setLoading(false)
    }
  }

  if (verificationStatus?.status === 'approved') {
    const footer = (
      <button
        onClick={onClose}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
      >
        Close
      </button>
    )
    return (
      <ExpandableModal
        isOpen={true}
        onClose={onClose}
        title="Verified"
        icon="✓"
        size="sm"
        footer={footer}
        defaultExpanded={!isMobile}
      >
        <div className="text-center py-4">
          <p className="text-slate-600">Your identity has been verified and approved by a community manager.</p>
        </div>
      </ExpandableModal>
    )
  }

  if (verificationStatus?.status === 'pending') {
    const footer = (
      <button
        onClick={onClose}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
      >
        Close
      </button>
    )
    return (
      <ExpandableModal
        isOpen={true}
        onClose={onClose}
        title="Pending Review"
        icon="⏳"
        size="sm"
        footer={footer}
        defaultExpanded={!isMobile}
      >
        <div className="text-center">
          <p className="text-slate-600 mb-4">Your verification is pending. A community manager will review and approve it shortly.</p>
          <div className="p-4 bg-slate-50 rounded text-sm text-slate-600 text-left">
            <p><strong>ID Type:</strong> {verificationStatus.id_type.replace('_', ' ')}</p>
            <p><strong>Submitted:</strong> {new Date(verificationStatus.submitted_at).toLocaleDateString()}</p>
          </div>
        </div>
      </ExpandableModal>
    )
  }

  const footer = (
    <button
      type="submit"
      form="user-verification-form"
      disabled={loading || !formData.idNumber || !formData.idImageUrl}
      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
    >
      {loading ? 'Submitting...' : 'Submit for Verification'}
    </button>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title="Identity Verification"
      icon="🆔"
      size="md"
      footer={footer}
      defaultExpanded={!isMobile}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          ✓ Verification submitted! A community manager will review shortly.
        </div>
      )}

      <form id="user-verification-form" onSubmit={handleSubmit} className="space-y-4">
        {/* ID Type Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            ID Type
          </label>
          <select
            value={formData.idType}
            onChange={(e) => setFormData(prev => ({ ...prev, idType: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="drivers_license">Driver's License</option>
            <option value="passport">Passport</option>
            <option value="national_id">National ID</option>
          </select>
        </div>

        {/* ID Number */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            ID Number
          </label>
          <input
            type="text"
            value={formData.idNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
            placeholder="e.g., 123456789"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        {/* ID Image Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            ID Photo
          </label>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
            {preview ? (
              <div className="space-y-2">
                <img src={preview} alt="ID Preview" className="w-full h-32 object-cover rounded" />
                <p className="text-xs text-slate-500">Click to change</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Upload a clear photo of your ID</p>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="id-upload"
              disabled={loading}
            />
            <label
              htmlFor="id-upload"
              className="block mt-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded text-sm font-medium cursor-pointer hover:bg-blue-100"
            >
              {preview ? 'Change Photo' : 'Select Photo'}
            </label>
          </div>
        </div>

        {/* Warning */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          Your ID information will be securely verified by a community manager and used only for the loan platform.
        </div>
      </form>
    </ExpandableModal>
  )
}

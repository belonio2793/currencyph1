import React from 'react'
import { jsPDF } from 'jspdf'

export default function ReceiptTemplate({ receipt, business }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getBusinessInfo = () => {
    // Get business info from receipt.businesses (joined data) or fall back to passed business prop
    const businessData = receipt?.businesses || business || {}

    return {
      name: businessData?.business_name || 'Business Name Not Provided',
      tin: businessData?.tin || '',
      bir: businessData?.certificate_of_incorporation || '',
      location: businessData?.city_of_registration || '',
      registration_type: businessData?.registration_type || '',
      registration_date: businessData?.registration_date || '',
      currency_reg: businessData?.metadata?.currency_registration_number || '',
      address: businessData?.metadata?.address || '',
      phone: businessData?.metadata?.phone || '',
      email: businessData?.metadata?.email || ''
    }
  }

  const generatePDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPos = 15

    // Get business info for use in PDF
    const businessInfo = getBusinessInfo()

    // Header
    doc.setFillColor(30, 64, 175)
    doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('Arial', 'bold')
    doc.setFontSize(18)
    doc.text('OFFICIAL RECEIPT', pageWidth / 2, 12, { align: 'center' })
    doc.setFontSize(10)
    doc.text(businessInfo.name, pageWidth / 2, 20, { align: 'center' })

    // Business Info Section
    doc.setTextColor(0, 0, 0)
    doc.setFont('Arial', 'bold')
    doc.setFontSize(12)
    doc.text(businessInfo.name, 20, yPos)
    yPos += 8

    doc.setFont('Arial', 'normal')
    doc.setFontSize(9)

    // Always show TIN with placeholder if empty
    doc.text(`TIN: ${businessInfo.tin || '___________________'}`, 20, yPos)
    yPos += 5

    // Always show BIR Certificate with placeholder if empty
    doc.text(`BIR Certificate: ${businessInfo.bir || '___________________'}`, 20, yPos)
    yPos += 5

    // Always show Currency Registration with placeholder if empty
    doc.text(`Currency Reg #: ${businessInfo.currency_reg || '___________________'}`, 20, yPos)
    yPos += 5

    if (businessInfo.registration_type) {
      doc.text(`Business Type: ${businessInfo.registration_type.charAt(0).toUpperCase() + businessInfo.registration_type.slice(1)}`, 20, yPos)
      yPos += 5
    }
    if (businessInfo.location) {
      doc.text(`Location: ${businessInfo.location}`, 20, yPos)
      yPos += 5
    }
    if (businessInfo.address) {
      doc.text(`Address: ${businessInfo.address}`, 20, yPos)
      yPos += 5
    }
    if (businessInfo.phone) {
      doc.text(`Phone: ${businessInfo.phone}`, 20, yPos)
      yPos += 5
    }
    if (businessInfo.email) {
      doc.text(`Email: ${businessInfo.email}`, 20, yPos)
      yPos += 5
    }
    yPos += 3

    // Receipt Details - Two columns (Receipt # left, Date right)
    doc.setFont('Arial', 'bold')
    doc.setFontSize(9)
    doc.text('RECEIPT NUMBER', 20, yPos)
    doc.setFont('Arial', 'normal')
    doc.setFontSize(9)
    doc.text(`#${receipt.receipt_number}`, 20, yPos + 5)

    doc.setFont('Arial', 'bold')
    doc.setFontSize(9)
    doc.text('DATE & TIME', pageWidth - 20, yPos, { align: 'right' })
    doc.setFont('Arial', 'normal')
    doc.setFontSize(9)
    doc.text(formatDate(receipt.created_at), pageWidth - 20, yPos + 5, { align: 'right' })
    yPos += 15

    // Customer Information
    yPos += 3
    doc.setFont('Arial', 'bold')
    doc.setFontSize(10)
    doc.text('CUSTOMER INFORMATION', 20, yPos)
    yPos += 6

    doc.setFont('Arial', 'normal')
    doc.setFontSize(9)
    if (receipt.customer_name) {
      doc.text(`Name: ${receipt.customer_name}`, 20, yPos)
      yPos += 5
    }
    if (receipt.customer_email) {
      doc.text(`Email: ${receipt.customer_email}`, 20, yPos)
      yPos += 5
    }
    if (receipt.customer_phone) {
      doc.text(`Phone: ${receipt.customer_phone}`, 20, yPos)
      yPos += 5
    }

    // Items Section
    yPos += 3
    doc.setFont('Arial', 'bold')
    doc.setFontSize(10)
    doc.text('ITEMS', 20, yPos)
    yPos += 6

    doc.setFont('Arial', 'normal')
    doc.setFontSize(9)

    if (receipt.items && Array.isArray(receipt.items) && receipt.items.length > 0) {
      const itemStartY = yPos
      receipt.items.forEach((item, index) => {
        const itemName = item.description || item.name || 'Item'
        const itemQty = item.quantity || 1
        const itemPrice = parseFloat(item.price || 0)
        const itemTotal = itemQty * itemPrice

        doc.text(`${index + 1}. ${itemName}`, 20, yPos)
        doc.text(`Qty: ${itemQty}`, 120, yPos, { align: 'right' })
        doc.text(`${formatCurrency(itemPrice)}`, 160, yPos, { align: 'right' })
        yPos += 5

        // Check if we need a new page
        if (yPos > pageHeight - 30) {
          doc.addPage()
          yPos = 15
        }
      })
    } else {
      doc.text('(No items listed)', 20, yPos)
      yPos += 5
    }

    // Total Section
    yPos += 5
    doc.setDrawColor(200, 200, 200)
    doc.line(20, yPos, pageWidth - 20, yPos)
    yPos += 5

    doc.setFont('Arial', 'bold')
    doc.setFontSize(12)
    doc.text('TOTAL', 20, yPos)
    doc.text(formatCurrency(receipt.amount), pageWidth - 20, yPos, { align: 'right' })
    yPos += 8

    // Payment Method
    if (receipt.payment_method) {
      doc.setFont('Arial', 'normal')
      doc.setFontSize(9)
      doc.text(`Payment Method: ${receipt.payment_method}`, 20, yPos)
      yPos += 5
    }

    // Notes
    if (receipt.notes) {
      yPos += 3
      doc.setFont('Arial', 'bold')
      doc.setFontSize(9)
      doc.text('NOTES:', 20, yPos)
      yPos += 4
      doc.setFont('Arial', 'normal')
      doc.setFontSize(8)
      doc.text(receipt.notes, 20, yPos, { maxWidth: pageWidth - 40 })
      yPos += 10
    }

    // Footer
    yPos = pageHeight - 15
    doc.setDrawColor(200, 200, 200)
    doc.line(20, yPos, pageWidth - 20, yPos)
    yPos += 5

    doc.setFont('Arial', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Thank you for your business! This receipt is valid proof of transaction.', pageWidth / 2, yPos, { align: 'center' })
    yPos += 4
    doc.text(`Issued digitally by ${businessInfo.name} - Paperless Transactions`, pageWidth / 2, yPos, { align: 'center' })

    return doc
  }

  const handleDownloadPDF = () => {
    const doc = generatePDF()
    doc.save(`receipt-${receipt.receipt_number || receipt.id}.pdf`)
  }

  const handlePrint = () => {
    const doc = generatePDF()
    window.open(doc.output('bloburi'), '_blank')
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Print View */}
      <div
        id="receipt-print-area"
        className="p-8 bg-white max-w-2xl mx-auto print:p-0 print:border-0"
        style={{
          fontFamily: 'Arial, sans-serif',
          color: '#000',
          lineHeight: '1.6'
        }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-lg text-center mb-6 print:rounded-none print:mb-4">
          <h1 className="text-3xl font-bold mb-1 print:text-2xl">OFFICIAL RECEIPT</h1>
          <p className="text-blue-100 print:text-gray-300">{getBusinessInfo().name}</p>
        </div>

        {/* Business Information */}
        <div className="mb-6 print:mb-4">
          <h2 className="text-xl font-bold mb-4 print:text-lg text-slate-900">{getBusinessInfo().name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-2 text-slate-700 print:text-black">
              <p>
                <strong>TIN:</strong>{' '}
                <span className={`font-mono ${getBusinessInfo().tin ? '' : 'text-slate-400 italic'}`}>
                  {getBusinessInfo().tin || '___________________'}
                </span>
              </p>
              <p>
                <strong>BIR Certificate:</strong>{' '}
                <span className={`font-mono text-xs ${getBusinessInfo().bir ? '' : 'text-slate-400 italic'}`}>
                  {getBusinessInfo().bir || '___________________'}
                </span>
              </p>
              <p>
                <strong>Currency Reg #:</strong>{' '}
                <span className={`font-mono ${getBusinessInfo().currency_reg ? '' : 'text-slate-400 italic'}`}>
                  {getBusinessInfo().currency_reg || '___________________'}
                </span>
              </p>
              {getBusinessInfo().registration_type && (
                <p><strong>Business Type:</strong> {getBusinessInfo().registration_type.charAt(0).toUpperCase() + getBusinessInfo().registration_type.slice(1)}</p>
              )}
            </div>
            <div className="space-y-2 text-slate-700 print:text-black text-sm">
              {getBusinessInfo().location && (
                <p><strong>Location:</strong> {getBusinessInfo().location}</p>
              )}
              {getBusinessInfo().address && (
                <p><strong>Address:</strong> {getBusinessInfo().address}</p>
              )}
              {getBusinessInfo().phone && (
                <p><strong>Phone:</strong> {getBusinessInfo().phone}</p>
              )}
              {getBusinessInfo().email && (
                <p><strong>Email:</strong> {getBusinessInfo().email}</p>
              )}
              {getBusinessInfo().registration_date && (
                <p><strong>Est. Date:</strong> {new Date(getBusinessInfo().registration_date).toLocaleDateString('en-PH')}</p>
              )}
            </div>
          </div>
          <div className="border-b-2 border-slate-300 my-4 print:border-gray-400"></div>
        </div>

        {/* Receipt Header */}
        <div className="grid grid-cols-2 gap-4 mb-6 print:mb-4 pb-6 print:pb-4 border-b print:border-gray-400">
          <div>
            <p className="text-xs font-semibold text-slate-600 print:text-black">Receipt Number</p>
            <p className="text-lg font-bold font-mono">#{receipt.receipt_number}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-600 print:text-black">Date & Time</p>
            <p className="text-sm">{formatDate(receipt.created_at)}</p>
          </div>
        </div>

        {/* Customer Information */}
        <div className="mb-6 print:mb-4">
          <h3 className="font-bold text-sm mb-3 print:mb-2 uppercase">Customer Information</h3>
          <div className="text-sm space-y-1 text-slate-700 print:text-black">
            {receipt.customer_name && <p><strong>Name:</strong> {receipt.customer_name}</p>}
            {receipt.customer_email && <p><strong>Email:</strong> {receipt.customer_email}</p>}
            {receipt.customer_phone && <p><strong>Phone:</strong> {receipt.customer_phone}</p>}
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-6 print:mb-4">
          <h3 className="font-bold text-sm mb-3 print:mb-2 uppercase">Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 print:border-gray-400">
                  <th className="text-left py-2 print:py-1">Description</th>
                  <th className="text-center py-2 print:py-1 w-16">Qty</th>
                  <th className="text-right py-2 print:py-1 w-24">Unit Price</th>
                  <th className="text-right py-2 print:py-1 w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items && Array.isArray(receipt.items) && receipt.items.length > 0 ? (
                  receipt.items.map((item, index) => (
                    <tr key={index} className="border-b print:border-gray-300">
                      <td className="py-2 print:py-1">{item.description || item.name || 'Item'}</td>
                      <td className="text-center py-2 print:py-1">{item.quantity || 1}</td>
                      <td className="text-right py-2 print:py-1 font-mono">{formatCurrency(item.price || 0)}</td>
                      <td className="text-right py-2 print:py-1 font-mono font-semibold">
                        {formatCurrency((item.quantity || 1) * (item.price || 0))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-4 text-center text-slate-500 print:text-gray-600">(No items listed)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total Section */}
        <div className="mb-6 print:mb-4 border-t-2 print:border-gray-400 pt-4 print:pt-2">
          <div className="flex justify-end mb-4">
            <div className="w-64">
              <div className="flex justify-between mb-2">
                <span className="font-semibold">Subtotal:</span>
                <span className="font-mono">{formatCurrency(receipt.amount)}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end bg-slate-100 print:bg-gray-200 p-4 print:p-2 rounded print:rounded-none">
            <div className="w-64">
              <div className="flex justify-between">
                <span className="text-lg font-bold">TOTAL:</span>
                <span className="text-2xl font-bold font-mono">{formatCurrency(receipt.amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        {receipt.payment_method && (
          <div className="mb-6 print:mb-4">
            <p className="text-sm">
              <strong>Payment Method:</strong> {receipt.payment_method}
            </p>
          </div>
        )}

        {/* Notes */}
        {receipt.notes && (
          <div className="mb-6 print:mb-4 p-4 print:p-2 bg-slate-50 print:bg-gray-100 rounded">
            <p className="text-xs font-semibold text-slate-600 print:text-black mb-2 uppercase">Notes</p>
            <p className="text-sm text-slate-700 print:text-black whitespace-pre-wrap">{receipt.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 print:mt-6 pt-6 print:pt-4 border-t print:border-gray-400 text-center text-xs text-slate-600 print:text-gray-700">
          <p className="mb-1">Thank you for your business! This receipt is valid proof of transaction.</p>
          <p className="text-slate-500 print:text-gray-600">Issued digitally by {getBusinessInfo().name} - Paperless Transactions</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-slate-50 px-8 py-4 print:hidden flex gap-3">
        <button
          onClick={handleDownloadPDF}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download PDF
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" />
          </svg>
          Print
        </button>
      </div>
    </div>
  )
}

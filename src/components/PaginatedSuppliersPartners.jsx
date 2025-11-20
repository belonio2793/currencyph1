import React, { useState } from 'react'

function toTitleCase(str) {
  if (!str) return ''
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export default function PaginatedSuppliersPartners({
  suppliers = [],
  partnerships = [],
  editMode = false,
  editData = { suppliers: [], partnerships: [] },
  onEditData = () => {},
  itemsPerPage = 3,
  formatUsd = (val) => `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
}) {
  const [supplierPage, setSupplierPage] = useState(1)
  const [partnerPage, setPartnerPage] = useState(1)

  // Pagination for suppliers
  const supplierTotal = editMode ? editData.suppliers.length : suppliers.length
  const supplierPages = Math.ceil(supplierTotal / itemsPerPage)
  const supplierStart = (supplierPage - 1) * itemsPerPage
  const supplierEnd = supplierStart + itemsPerPage
  const currentSuppliers = editMode
    ? editData.suppliers.slice(supplierStart, supplierEnd)
    : suppliers.slice(supplierStart, supplierEnd)

  // Pagination for partnerships
  const partnerTotal = editMode ? editData.partnerships.length : partnerships.length
  const partnerPages = Math.ceil(partnerTotal / itemsPerPage)
  const partnerStart = (partnerPage - 1) * itemsPerPage
  const partnerEnd = partnerStart + itemsPerPage
  const currentPartners = editMode
    ? editData.partnerships.slice(partnerStart, partnerEnd)
    : partnerships.slice(partnerStart, partnerEnd)

  const renderPaginationControls = (currentPage, totalPages, onPageChange) => {
    if (totalPages <= 1) return null
    return (
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
        <div className="text-sm text-slate-600">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>
    )
  }

  const renderSupplierCard = (sup, idx, isEditMode) => (
    <div key={sup.id || idx} className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 bg-white">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-semibold text-slate-900">{toTitleCase(sup.supplier_name) || sup.supplier_name}</div>
          {sup.supplier_type && <div className="text-xs font-medium text-slate-600 mt-1">{toTitleCase(sup.supplier_type) || sup.supplier_type}</div>}
        </div>
        {sup.is_primary && (
          <span className="px-2 py-1 bg-slate-700 text-white text-xs rounded font-semibold">Primary</span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        {sup.contact_person && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Contact Person</div>
            <div className="text-slate-700">{sup.contact_person}</div>
          </div>
        )}
        {sup.email && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Email</div>
            <div className="text-slate-700">{sup.email}</div>
          </div>
        )}
        {sup.phone && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Phone</div>
            <div className="text-slate-700">{sup.phone}</div>
          </div>
        )}
        {sup.city && sup.country && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Location</div>
            <div className="text-slate-700">{sup.city}, {sup.country}</div>
          </div>
        )}
        {sup.delivery_timeline_days && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Delivery Timeline</div>
            <div className="text-slate-700">{sup.delivery_timeline_days} days</div>
          </div>
        )}
        {sup.warranty_months && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Warranty</div>
            <div className="text-slate-700">{sup.warranty_months} months</div>
          </div>
        )}
        {sup.payment_terms && (
          <div className="md:col-span-2">
            <div className="text-xs text-slate-500 font-medium">Payment Terms</div>
            <div className="text-slate-700">{sup.payment_terms}</div>
          </div>
        )}
      </div>
      {sup.notes && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">Notes</div>
          <div className="text-sm text-slate-700 mt-1">{sup.notes}</div>
        </div>
      )}
    </div>
  )

  const renderPartnerCard = (partner, idx, isEditMode) => (
    <div key={partner.id || idx} className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 bg-white">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-semibold text-slate-900">{toTitleCase(partner.partner_name) || partner.partner_name}</div>
          {partner.partnership_type && <div className="text-xs font-medium text-slate-600 mt-1">{toTitleCase(partner.partnership_type) || partner.partnership_type}</div>}
        </div>
        <span className={`px-2 py-1 text-xs rounded font-semibold ${
          partner.partnership_status === 'active' ? 'bg-green-100 text-green-700' :
          partner.partnership_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
          partner.partnership_status === 'terminated' ? 'bg-red-100 text-red-700' :
          'bg-slate-100 text-slate-700'
        }`}>
          {toTitleCase(partner.partnership_status) || partner.partnership_status}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        {partner.contact_person && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Contact Person</div>
            <div className="text-slate-700">{partner.contact_person}</div>
          </div>
        )}
        {partner.email && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Email</div>
            <div className="text-slate-700">{partner.email}</div>
          </div>
        )}
        {partner.phone && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Phone</div>
            <div className="text-slate-700">{partner.phone}</div>
          </div>
        )}
        {partner.city && partner.country && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Location</div>
            <div className="text-slate-700">{partner.city}, {partner.country}</div>
          </div>
        )}
        {partner.start_date && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Start Date</div>
            <div className="text-slate-700">{partner.start_date}</div>
          </div>
        )}
        {partner.revenue_share_percentage && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Revenue Share</div>
            <div className="text-slate-700">{partner.revenue_share_percentage}%</div>
          </div>
        )}
        {partner.investment_amount_usd && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Investment</div>
            <div className="text-slate-700">{formatUsd(partner.investment_amount_usd)}</div>
          </div>
        )}
        {partner.contract_duration_months && (
          <div>
            <div className="text-xs text-slate-500 font-medium">Contract Duration</div>
            <div className="text-slate-700">{partner.contract_duration_months} months</div>
          </div>
        )}
        {partner.key_terms && (
          <div className="md:col-span-2">
            <div className="text-xs text-slate-500 font-medium">Key Terms</div>
            <div className="text-slate-700">{partner.key_terms}</div>
          </div>
        )}
      </div>
      {partner.notes && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">Notes</div>
          <div className="text-sm text-slate-700 mt-1">{partner.notes}</div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Suppliers Section */}
      {supplierTotal > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-4">Suppliers</h4>
          <div className="space-y-3">
            {currentSuppliers.map((sup, idx) => renderSupplierCard(sup, idx, editMode))}
          </div>
          {renderPaginationControls(supplierPage, supplierPages, setSupplierPage)}
        </div>
      )}

      {/* Partnerships Section */}
      {partnerTotal > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-4">Partnerships</h4>
          <div className="space-y-3">
            {currentPartners.map((partner, idx) => renderPartnerCard(partner, idx, editMode))}
          </div>
          {renderPaginationControls(partnerPage, partnerPages, setPartnerPage)}
        </div>
      )}

      {supplierTotal === 0 && partnerTotal === 0 && (
        <p className="text-slate-500">No suppliers or partnerships data available</p>
      )}
    </div>
  )
}

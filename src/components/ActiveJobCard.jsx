import React from 'react'
import { formatDateOnly } from '../lib/dateTimeUtils'

export default function ActiveJobCard({ job, userId }) {
  const isOverdue = job.deadline && new Date(job.deadline) < new Date()
  const daysRemaining = job.deadline
    ? Math.ceil((new Date(job.deadline) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow flex flex-col">
      {/* Header */}
      <div className="mb-4 pb-4 border-b border-slate-200">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-900 flex-1">
            {job.job_title || job.job?.job_title || 'Unnamed Job'}
          </h3>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ml-2 ${
            isOverdue
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {job.status === 'accepted' ? 'Active' : 'Pending'}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          {job.business?.business_name || 'Unknown Business'}
        </p>
      </div>

      {/* Job Details */}
      <div className="grid grid-cols-2 gap-4 mb-4 py-4 border-y border-slate-200">
        <div>
          <p className="text-xs text-slate-600 font-semibold uppercase">Job Type</p>
          <p className="text-sm font-medium text-slate-900 mt-1 capitalize">
            {job.job_type ? job.job_type.replace('_', ' ') : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-600 font-semibold uppercase">Pay Rate</p>
          <p className="text-sm font-medium text-slate-900 mt-1">
            ₱{job.pay_rate?.toFixed(2) || 'Negotiable'}
          </p>
        </div>
        {job.start_date && (
          <div>
            <p className="text-xs text-slate-600 font-semibold uppercase">Start Date</p>
            <p className="text-sm font-medium text-slate-900 mt-1">
              {new Date(job.start_date).toLocaleDateString()}
            </p>
          </div>
        )}
        {job.deadline && (
          <div>
            <p className="text-xs text-slate-600 font-semibold uppercase">Deadline</p>
            <p className="text-sm font-medium text-slate-900 mt-1">
              {new Date(job.deadline).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      {(job.offer_message || job.job?.job_description) && (
        <div className="mb-4">
          <p className="text-sm text-slate-700 line-clamp-2">
            {job.offer_message || job.job?.job_description}
          </p>
        </div>
      )}

      {/* Timeline Info */}
      {job.deadline && !isOverdue && daysRemaining !== null && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-xs text-blue-700 font-semibold">
            ⏱️ {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
          </p>
        </div>
      )}

      {isOverdue && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded p-3">
          <p className="text-xs text-red-700 font-semibold">
            [Warning] Deadline has passed
          </p>
        </div>
      )}

      {job.started_at && (
        <div className="mb-4 bg-slate-50 p-3 rounded">
          <p className="text-xs text-slate-600">
            <strong>Started:</strong> {new Date(job.started_at).toLocaleDateString()}
          </p>
        </div>
      )}

      {job.completed_at && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded p-3">
          <p className="text-xs text-green-700 font-semibold">
            ✓ Completed on {new Date(job.completed_at).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-auto pt-4 border-t border-slate-200">
        <button className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm font-medium transition-colors">
          View Details
        </button>
        <button className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 text-sm font-medium transition-colors">
          Message
        </button>
      </div>

      {/* Status Badge */}
      <div className="mt-3 text-xs text-slate-600 flex items-center gap-2">
        <span className="inline-block w-2 h-2 bg-slate-400 rounded-full"></span>
        Accepted on {job.accepted_at ? new Date(job.accepted_at).toLocaleDateString() : 'N/A'}
      </div>
    </div>
  )
}

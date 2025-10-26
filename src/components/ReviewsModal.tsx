import React, { useState } from 'react'
import StarRating from './StarRating'

interface Review {
  author: string
  rating: number
  text: string
  date: string
}

interface ReviewsModalProps {
  reviews: Review[]
  listingName: string
  isOpen: boolean
  onClose: () => void
}

const REVIEWS_PER_PAGE = 5

export default function ReviewsModal({ reviews, listingName, isOpen, onClose }: ReviewsModalProps) {
  const [currentPage, setCurrentPage] = useState(0)

  if (!isOpen) return null

  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE)
  const startIdx = currentPage * REVIEWS_PER_PAGE
  const endIdx = startIdx + REVIEWS_PER_PAGE
  const currentReviews = reviews.slice(startIdx, endIdx)

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">All Reviews</h2>
            <p className="text-sm text-slate-500 mt-1">{listingName} ({reviews.length} reviews)</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Reviews List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentReviews.map((review, idx) => (
            <div
              key={idx}
              className="bg-slate-50 rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                <div>
                  <h4 className="font-bold text-slate-900">{review.author}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(review.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div className="flex">
                  <StarRating value={review.rating} size="md" />
                </div>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed">{review.text}</p>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Page {currentPage + 1} of {totalPages} • Showing {currentReviews.length} of {reviews.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              ← Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages - 1}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

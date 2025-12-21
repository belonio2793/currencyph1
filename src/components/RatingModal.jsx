import React, { useState } from 'react'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function RatingModal({ ride, otherUserName, onClose, onSubmitRating, loading }) {
  const { isMobile } = useDevice()
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [categories, setCategories] = useState({
    cleanliness: 5,
    safety: 5,
    friendliness: 5
  })
  const [review, setReview] = useState('')
  const [selectedTags, setSelectedTags] = useState([])

  const issueTags = [
    'Driver was late',
    'Vehicle condition issue',
    'Poor driving',
    'Not friendly',
    'Route issue',
    'Payment issue'
  ]

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = () => {
    if (rating === 0) {
      alert('Please select a rating')
      return
    }

    onSubmitRating({
      ride_id: ride.id,
      rating_score: rating,
      review_text: review,
      cleanliness_rating: categories.cleanliness,
      safety_rating: categories.safety,
      friendliness_rating: categories.friendliness,
      tags: selectedTags
    })
  }

  const getRatingColor = (value) => {
    if (value <= 2) return 'text-red-500'
    if (value <= 3) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getRatingLabel = (value) => {
    if (value === 0) return 'Select rating'
    if (value === 1) return 'Poor'
    if (value === 2) return 'Fair'
    if (value === 3) return 'Good'
    if (value === 4) return 'Very Good'
    return 'Excellent'
  }

  const footer = (
    <div className="flex gap-2 w-full">
      <button
        onClick={onClose}
        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium transition-colors"
      >
        Skip for Now
      </button>
      <button
        onClick={handleSubmit}
        disabled={loading || rating === 0}
        className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold transition-colors disabled:bg-slate-400"
      >
        {loading ? 'Submitting...' : 'Submit Rating'}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title={`Rate ${otherUserName}`}
      icon="⭐"
      size="md"
      footer={footer}
      defaultExpanded={!isMobile}
    >
      <div className="space-y-6">
          {/* Overall Rating */}
          <div className="text-center space-y-3">
            <h3 className="font-semibold text-slate-900">Overall Experience</h3>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(value)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <svg
                    className={`w-10 h-10 ${
                      value <= (hoveredRating || rating) ? 'text-yellow-400 fill-current' : 'text-slate-300'
                    } transition-colors`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
            <p className={`font-semibold text-lg ${getRatingColor(rating)}`}>
              {getRatingLabel(rating)}
            </p>
          </div>

          {/* Category Ratings */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-4">
            <h3 className="font-semibold text-slate-900">Category Ratings</h3>

            {/* Cleanliness */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-900">Vehicle Cleanliness</label>
                <span className="text-sm font-semibold text-slate-600">{categories.cleanliness}/5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={categories.cleanliness}
                onChange={(e) => setCategories({ ...categories, cleanliness: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Safety */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-900">Safety</label>
                <span className="text-sm font-semibold text-slate-600">{categories.safety}/5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={categories.safety}
                onChange={(e) => setCategories({ ...categories, safety: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
            </div>

            {/* Friendliness */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-900">Friendliness</label>
                <span className="text-sm font-semibold text-slate-600">{categories.friendliness}/5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={categories.friendliness}
                onChange={(e) => setCategories({ ...categories, friendliness: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>
          </div>

          {/* Issue Tags */}
          {rating && rating <= 3 && (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200 space-y-3">
              <h3 className="font-semibold text-slate-900">What could be improved? (Optional)</h3>
              <div className="flex flex-wrap gap-2">
                {issueTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-red-600 text-white'
                        : 'bg-white border border-red-300 text-slate-700 hover:bg-red-100'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Review Text */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">Additional Comments (Optional)</label>
            <textarea
              placeholder="Share more details about your experience..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
              rows="4"
            />
            <p className="text-xs text-slate-600">{review.length}/500 characters</p>
          </div>

        {/* Anonymous Option */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded" />
          <span className="text-sm text-slate-700">Post review anonymously</span>
        </label>
      </div>
    </ExpandableModal>
  )
}

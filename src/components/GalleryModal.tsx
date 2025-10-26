import React, { useState } from 'react'

interface GalleryModalProps {
  images: string[]
  listingName: string
  isOpen: boolean
  onClose: () => void
}

export default function GalleryModal({ images, listingName, isOpen, onClose }: GalleryModalProps) {
  const [selectedIdx, setSelectedIdx] = useState(0)

  if (!isOpen) return null

  const handlePrev = () => {
    setSelectedIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setSelectedIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget as HTMLImageElement
    if ((img as any).dataset.fallbackApplied) return
    ;(img as any).dataset.fallbackApplied = '1'
    img.src = images[0] || ''
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">{listingName} - Photo Gallery</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Main Image Display */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          <div className="flex items-center justify-center h-full">
            <div className="relative max-w-2xl w-full">
              <img
                src={images[selectedIdx]}
                alt={`${listingName} - Photo ${selectedIdx + 1}`}
                className="w-full h-auto rounded-lg shadow-lg object-contain max-h-[500px]"
                onError={handleImageError}
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={handlePrev}
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-12 bg-white hover:bg-slate-100 rounded-full p-2 shadow-md transition-colors"
                    aria-label="Previous image"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleNext}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-12 bg-white hover:bg-slate-100 rounded-full p-2 shadow-md transition-colors"
                    aria-label="Next image"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Thumbnail Grid */}
        {images.length > 1 && (
          <div className="border-t border-slate-200 p-4 bg-white max-h-32 overflow-y-auto">
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    selectedIdx === idx ? 'border-blue-600' : 'border-slate-200 hover:border-slate-300'
                  }`}
                  aria-label={`View photo ${idx + 1}`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer with counter */}
        <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 text-center text-sm text-slate-600">
          Photo {selectedIdx + 1} of {images.length}
        </div>
      </div>
    </div>
  )
}

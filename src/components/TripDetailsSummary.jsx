import React from 'react'

/**
 * TripDetailsSummary Component
 * Displays a comprehensive summary of trip details including:
 * - Pickup and destination locations
 * - Distance and duration
 * - Estimated fare
 * - Service type and details
 * - Passenger and vehicle information
 */
export default function TripDetailsSummary({
  startCoord,
  endCoord,
  routeDetails,
  selectedRideType,
  selectedService,
  serviceFormData,
  rideClass = 'bg-white'
}) {
  if (!startCoord || !endCoord) {
    return null
  }

  // Get service label from service ID
  const getServiceLabel = (serviceId) => {
    const serviceMap = {
      'ride-share': 'Ride Share',
      'package': 'Package Delivery',
      'food': 'Food Pickup',
      'laundry': 'Laundry Service',
      'medical': 'Medical Supplies',
      'documents': 'Document Courier'
    }
    return serviceMap[serviceId] || serviceId
  }

  // Format distance and duration
  const distance = routeDetails?.distance ? routeDetails.distance.toFixed(1) : 'N/A'
  const duration = routeDetails?.duration || 'N/A'
  const fare = routeDetails?.fare?.total ? `₱${routeDetails.fare.total.toFixed(2)}` : 'N/A'

  // Get passenger count from service form data
  const passengerCount = serviceFormData?.passengerCount || 1

  return (
    <div className={`rounded-lg shadow-lg p-6 space-y-4 ${rideClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h3 className="text-lg font-bold text-slate-900">Trip Summary</h3>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-blue-600">Route Calculated</span>
        </div>
      </div>

      {/* Locations */}
      <div className="space-y-3">
        {/* Pickup Location */}
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pickup Location</p>
            <p className="text-sm font-medium text-slate-900 truncate">{startCoord.address || 'Pickup Point'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{startCoord.latitude.toFixed(4)}, {startCoord.longitude.toFixed(4)}</p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center py-1">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>

        {/* Destination Location */}
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destination</p>
            <p className="text-sm font-medium text-slate-900 truncate">{endCoord.address || 'Destination Point'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{endCoord.latitude.toFixed(4)}, {endCoord.longitude.toFixed(4)}</p>
          </div>
        </div>
      </div>

      {/* Route Details Grid */}
      <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
        {/* Distance */}
        <div className="text-center">
          <p className="text-xs text-slate-600 font-medium mb-1">Distance</p>
          <p className="text-lg font-bold text-slate-900">{distance} km</p>
        </div>

        {/* Duration */}
        <div className="text-center border-l border-r border-slate-200">
          <p className="text-xs text-slate-600 font-medium mb-1">Duration</p>
          <p className="text-lg font-bold text-slate-900">{duration} min</p>
        </div>

        {/* Fare */}
        <div className="text-center">
          <p className="text-xs text-slate-600 font-medium mb-1">Est. Fare</p>
          <p className="text-lg font-bold text-green-600">{fare}</p>
        </div>
      </div>

      {/* Service Details - if service is selected */}
      {selectedService && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold text-slate-900">Service Details</p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Service Type:</span>
              <span className="font-medium text-slate-900">{getServiceLabel(selectedService)}</span>
            </div>

            {/* Passengers */}
            {selectedService === 'ride-share' && (
              <div className="flex justify-between">
                <span className="text-slate-600">Passengers:</span>
                <span className="font-medium text-slate-900">{passengerCount} person{passengerCount > 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Package Weight */}
            {selectedService === 'package' && serviceFormData?.weight && (
              <div className="flex justify-between">
                <span className="text-slate-600">Package Weight:</span>
                <span className="font-medium text-slate-900">{serviceFormData.weight} kg</span>
              </div>
            )}

            {/* Food Type */}
            {selectedService === 'food' && serviceFormData?.restaurantName && (
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Restaurant:</span>
                  <span className="font-medium text-slate-900">{serviceFormData.restaurantName}</span>
                </div>
                {serviceFormData?.foodType && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Food Type:</span>
                    <span className="font-medium text-slate-900 capitalize">{serviceFormData.foodType}</span>
                  </div>
                )}
              </div>
            )}

            {/* Laundry Weight */}
            {selectedService === 'laundry' && serviceFormData?.estimatedWeight && (
              <div className="flex justify-between">
                <span className="text-slate-600">Laundry Weight:</span>
                <span className="font-medium text-slate-900">{serviceFormData.estimatedWeight} kg</span>
              </div>
            )}

            {/* Medical Details */}
            {selectedService === 'medical' && serviceFormData?.patientName && (
              <div className="flex justify-between">
                <span className="text-slate-600">Patient:</span>
                <span className="font-medium text-slate-900">{serviceFormData.patientName}</span>
              </div>
            )}

            {/* Document Count */}
            {selectedService === 'documents' && serviceFormData?.documentCount && (
              <div className="flex justify-between">
                <span className="text-slate-600">Documents:</span>
                <span className="font-medium text-slate-900">{serviceFormData.documentCount} item{serviceFormData.documentCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ride Type */}
      {selectedRideType && (
        <div className="flex items-center gap-2 text-sm bg-amber-50 rounded-lg p-3 border border-amber-200">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7.5-1.5a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-slate-600">Vehicle Type:</p>
            <p className="font-medium text-slate-900 capitalize">{selectedRideType}</p>
          </div>
        </div>
      )}

      {/* Important Notes */}
      <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 text-xs text-yellow-800">
        <p className="font-semibold mb-1">📝 Remember:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Confirm all details before requesting a ride</li>
          <li>Service charges may apply based on selections</li>
          <li>Keep your contact information updated</li>
        </ul>
      </div>
    </div>
  )
}

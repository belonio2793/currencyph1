import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function PortDetailsModal({ port, onClose }) {
  const { isMobile } = useDevice()

  if (!port) return null

  const footer = (
    <button
      onClick={onClose}
      className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors"
    >
      Close
    </button>
  )

  return (
    <ExpandableModal
      isOpen={!!port}
      onClose={onClose}
      title={port.name}
      icon="⚓"
      size={isMobile ? 'fullscreen' : 'lg'}
      footer={footer}
      defaultExpanded={!isMobile}
    >
      <div className="space-y-4">
        {/* Location Info */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-3">Location</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">City:</span>
              <span className="font-medium text-slate-900">{port.city}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Region:</span>
              <span className="font-medium text-slate-900">{port.region || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Province:</span>
              <span className="font-medium text-slate-900">{port.province || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Port Type:</span>
              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                {port.port_type || 'N/A'}
              </span>
            </div>
          </div>

          {port.address && (
            <div className="mt-3 pt-3 border-t border-slate-300">
              <p className="text-sm"><strong>Address:</strong></p>
              <p className="text-sm text-slate-700 mt-1">{port.address}</p>
            </div>
          )}

          {port.latitude && port.longitude && (
            <div className="mt-3 pt-3 border-t border-slate-300">
              <p className="text-sm"><strong>Coordinates:</strong></p>
              <p className="text-sm text-slate-700 mt-1">
                {port.latitude.toFixed(4)}, {port.longitude.toFixed(4)}
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        {port.description && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-2">About</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{port.description}</p>
          </div>
        )}

        {/* Port Specifications */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-3">Port Specifications</h3>
          <div className="grid grid-cols-2 gap-3">
            {port.berth_count && (
              <div className="text-sm">
                <p className="text-slate-600">Berths</p>
                <p className="font-semibold text-slate-900">{port.berth_count}</p>
              </div>
            )}
            {port.max_depth_meters && (
              <div className="text-sm">
                <p className="text-slate-600">Max Depth</p>
                <p className="font-semibold text-slate-900">{port.max_depth_meters}m</p>
              </div>
            )}
            {port.max_vessel_length_meters && (
              <div className="text-sm">
                <p className="text-slate-600">Max Vessel Length</p>
                <p className="font-semibold text-slate-900">{port.max_vessel_length_meters}m</p>
              </div>
            )}
            {port.annual_capacity_teu && (
              <div className="text-sm">
                <p className="text-slate-600">Annual Capacity</p>
                <p className="font-semibold text-slate-900">{port.annual_capacity_teu} TEU</p>
              </div>
            )}
            {port.number_of_warehouses && (
              <div className="text-sm">
                <p className="text-slate-600">Warehouses</p>
                <p className="font-semibold text-slate-900">{port.number_of_warehouses}</p>
              </div>
            )}
            {port.cargo_types && (
              <div className="text-sm col-span-2">
                <p className="text-slate-600">Cargo Types</p>
                <p className="font-semibold text-slate-900">{port.cargo_types}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contact Info */}
        {(port.phone || port.email || port.website) && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Contact Information</h3>
            <div className="space-y-2 text-sm">
              {port.phone && (
                <div>
                  <p className="text-slate-600">Phone:</p>
                  <p className="font-medium text-blue-600">{port.phone}</p>
                </div>
              )}
              {port.email && (
                <div>
                  <p className="text-slate-600">Email:</p>
                  <p className="font-medium text-blue-600 break-all">{port.email}</p>
                </div>
              )}
              {port.website && (
                <div>
                  <p className="text-slate-600">Website:</p>
                  <a href={port.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline break-all">
                    {port.website}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Operating Hours */}
        {port.operating_hours && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-2">Operating Hours</h3>
            <p className="text-sm text-slate-700">{port.operating_hours}</p>
          </div>
        )}
      </div>
    </ExpandableModal>
  )
}

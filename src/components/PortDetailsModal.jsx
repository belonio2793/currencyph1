import './PortDetailsModal.css'

export default function PortDetailsModal({ port, onClose }) {
  if (!port) return null

  return (
    <div className="port-modal-overlay" onClick={onClose}>
      <div className="port-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="port-modal-header">
          <h2>{port.name}</h2>
          <button className="port-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="port-modal-body">
          {/* Basic Info */}
          <div className="port-modal-section">
            <h3>Location</h3>
            <div className="port-modal-grid">
              <div className="port-modal-item">
                <span className="label">City</span>
                <span className="value">{port.city}</span>
              </div>
              <div className="port-modal-item">
                <span className="label">Region</span>
                <span className="value">{port.region || 'N/A'}</span>
              </div>
              <div className="port-modal-item">
                <span className="label">Province</span>
                <span className="value">{port.province || 'N/A'}</span>
              </div>
              <div className="port-modal-item">
                <span className="label">Port Type</span>
                <span className="value port-type-badge">{port.port_type || 'N/A'}</span>
              </div>
            </div>
            {port.address && (
              <div className="port-modal-address">
                <strong>Address:</strong> {port.address}
              </div>
            )}
            {(port.latitude && port.longitude) && (
              <div className="port-modal-address">
                <strong>Coordinates:</strong> {port.latitude.toFixed(4)}, {port.longitude.toFixed(4)}
              </div>
            )}
          </div>

          {/* Description */}
          {port.description && (
            <div className="port-modal-section">
              <h3>About</h3>
              <p className="port-modal-description">{port.description}</p>
            </div>
          )}

          {/* Port Specifications */}
          <div className="port-modal-section">
            <h3>Port Specifications</h3>
            <div className="port-modal-specs">
              {port.berth_count && (
                <div className="spec-item">
                  <span className="spec-label">Berths</span>
                  <span className="spec-value">{port.berth_count}</span>
                </div>
              )}
              {port.max_depth_meters && (
                <div className="spec-item">
                  <span className="spec-label">Max Depth</span>
                  <span className="spec-value">{port.max_depth_meters}m</span>
                </div>
              )}
              {port.max_vessel_length_meters && (
                <div className="spec-item">
                  <span className="spec-label">Max Vessel Length</span>
                  <span className="spec-value">{port.max_vessel_length_meters}m</span>
                </div>
              )}
              {port.annual_capacity_teu && (
                <div className="spec-item">
                  <span className="spec-label">Annual Capacity</span>
                  <span className="spec-value">{port.annual_capacity_teu.toLocaleString()} TEU</span>
                </div>
              )}
            </div>
          </div>

          {/* Services */}
          {(port.container_terminal || port.ro_ro_services || port.breakbulk_services || port.bulk_cargo || port.refrigerated_containers || port.dangerous_cargo) && (
            <div className="port-modal-section">
              <h3>Available Services</h3>
              <ul className="port-modal-services">
                {port.container_terminal && <li>✓ Container Terminal</li>}
                {port.ro_ro_services && <li>✓ RoRo Services</li>}
                {port.breakbulk_services && <li>✓ Breakbulk Services</li>}
                {port.bulk_cargo && <li>✓ Bulk Cargo</li>}
                {port.refrigerated_containers && <li>✓ Refrigerated Containers</li>}
                {port.dangerous_cargo && <li>✓ Dangerous Cargo Handling</li>}
              </ul>
            </div>
          )}

          {/* Contact Information */}
          {(port.contact_phone || port.contact_email || port.website) && (
            <div className="port-modal-section">
              <h3>Contact Information</h3>
              <div className="port-modal-contact">
                {port.contact_phone && (
                  <div className="contact-item">
                    <span className="contact-label">Phone:</span>
                    <a href={`tel:${port.contact_phone}`} className="contact-link">
                      {port.contact_phone}
                    </a>
                  </div>
                )}
                {port.contact_email && (
                  <div className="contact-item">
                    <span className="contact-label">Email:</span>
                    <a href={`mailto:${port.contact_email}`} className="contact-link">
                      {port.contact_email}
                    </a>
                  </div>
                )}
                {port.website && (
                  <div className="contact-item">
                    <span className="contact-label">Website:</span>
                    <a href={port.website} target="_blank" rel="noopener noreferrer" className="contact-link">
                      Visit Website →
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="port-modal-section">
            <span className={`port-status-badge ${port.status}`}>
              {port.status ? port.status.charAt(0).toUpperCase() + port.status.slice(1) : 'Unknown'}
            </span>
          </div>
        </div>

        <div className="port-modal-footer">
          <button className="port-modal-btn-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

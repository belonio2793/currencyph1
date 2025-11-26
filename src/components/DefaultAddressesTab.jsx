import { useState, useEffect } from 'react'
import PropertyMapper from './PropertyMapper'
import ShippingLabelGenerator from './ShippingLabelGenerator'
import BarcodeScanner from './BarcodeScanner'
import PackageTracker from './PackageTracker'
import PackageCheckpointMap from './PackageCheckpointMap'
import { supabase } from '../lib/supabaseClient'
import './DefaultAddressesTab.css'

export default function DefaultAddressesTab({ userId, onClose }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeSubTab, setActiveSubTab] = useState('properties')
  const [addresses, setAddresses] = useState([])
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [viewingMapForTrackingCode, setViewingMapForTrackingCode] = useState(null)

  const handlePropertyAdded = () => {
    setRefreshKey(prev => prev + 1)
    loadAddresses()
  }

  // Load addresses for shipping label form
  useEffect(() => {
    if (userId) {
      loadAddresses()
    }
  }, [userId])

  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true)
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .not('addresses_latitude', 'is', null)
        .not('addresses_longitude', 'is', null)

      if (!error) {
        setAddresses(data || [])
      }
    } catch (err) {
      console.error('Error loading addresses:', err)
    } finally {
      setLoadingAddresses(false)
    }
  }

  return (
    <div className="default-addresses-tab">
      {/* Page Title */}
      <div className="page-title">
        <h2>Default</h2>
      </div>


      {/* Sub-tabs for shipping and tracking features */}
      <div className="subtab-navigation">
        <button
          className={`subtab-btn ${activeSubTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('properties')}
          title="Manage Properties"
        >
          Properties
        </button>
        <button
          className={`subtab-btn ${activeSubTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('generate')}
          title="Generate Shipping Labels"
        >
          Generate Labels
        </button>
        <button
          className={`subtab-btn ${activeSubTab === 'scan' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('scan')}
          title="Scan Package Checkpoints"
        >
          Scan Barcode
        </button>
        <button
          className={`subtab-btn ${activeSubTab === 'track' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('track')}
          title="Track Packages"
        >
          Track Package
        </button>
      </div>

      {/* Sub-tab Content */}
      <div className="subtab-content">
        {/* Map modal overlay */}
        {viewingMapForTrackingCode && (
          <div className="modal-overlay">
            <PackageCheckpointMap
              trackingCode={viewingMapForTrackingCode}
              onClose={() => setViewingMapForTrackingCode(null)}
            />
          </div>
        )}

        {activeSubTab === 'properties' && (
          userId ? (
            <PropertyMapper
              key={refreshKey}
              userId={userId}
              onPropertyAdded={handlePropertyAdded}
              allowDelete={true}
              showShippingPorts={false}
            />
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', marginBottom: '12px' }}>Login to view properties</p>
              <p style={{ color: '#666', marginBottom: '20px' }}>Sign in to see and manage your properties</p>
              <a href="/login" style={{ display: 'inline-block', padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
                Sign In Now
              </a>
            </div>
          )
        )}

        {activeSubTab === 'generate' && (
          <ShippingLabelGenerator
            userId={userId}
            addresses={addresses}
          />
        )}

        {activeSubTab === 'scan' && (
          <BarcodeScanner
            userId={userId}
            onCheckpointAdded={() => {
              // Refresh tracking data
            }}
          />
        )}

        {activeSubTab === 'track' && (
          <PackageTracker
            userId={userId}
            onViewMap={(trackingCode) => setViewingMapForTrackingCode(trackingCode)}
          />
        )}
      </div>
    </div>
  )
}

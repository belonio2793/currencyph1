import { useState } from 'react'
import PropertyMapper from './PropertyMapper'

export default function DefaultAddressesTab({ userId, onClose }) {
  const [refreshKey, setRefreshKey] = useState(0)

  const handlePropertyAdded = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="default-addresses-tab">
      {/* Page Title */}
      <div className="page-title">
        <h2>Default</h2>
      </div>

      <PropertyMapper
        key={refreshKey}
        userId={userId}
        onPropertyAdded={handlePropertyAdded}
        allowDelete={true}
      />
    </div>
  )
}

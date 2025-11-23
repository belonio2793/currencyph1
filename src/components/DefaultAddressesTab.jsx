import { useState } from 'react'
import PropertyMapper from './PropertyMapper'

export default function DefaultAddressesTab({ userId, onClose }) {
  const [refreshKey, setRefreshKey] = useState(0)

  const handlePropertyAdded = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="default-addresses-tab">
      <PropertyMapper 
        key={refreshKey} 
        userId={userId} 
        onPropertyAdded={handlePropertyAdded}
        allowDelete={true}
      />
    </div>
  )
}

import { useState } from 'react'
import PropertyMapper from './PropertyMapper'
import './Addresses.css'

export default function Addresses({ userId, onClose }) {
  const [view, setView] = useState('map')

  return (
    <div className="addresses-container">
      {view === 'map' && <PropertyMapper userId={userId} />}
    </div>
  )
}

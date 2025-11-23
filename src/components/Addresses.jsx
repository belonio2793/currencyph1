import { useState } from 'react'
import MyAddressesTab from './MyAddressesTab'
import ShippingTrackingTab from './ShippingTrackingTab'
import RouteCalculatorTab from './RouteCalculatorTab'
import PartnersHandlersTab from './PartnersHandlersTab'
import './Addresses.css'

export default function Addresses({ userId, onClose }) {
  const [activeTab, setActiveTab] = useState('my-addresses')

  const tabs = [
    {
      id: 'my-addresses',
      label: 'My Addresses',
      icon: '📍',
      component: MyAddressesTab
    },
    {
      id: 'shipping-tracking',
      label: 'Shipping & Tracking',
      icon: '📦',
      component: ShippingTrackingTab
    },
    {
      id: 'route-calculator',
      label: 'Route Calculator',
      icon: '🛣️',
      component: RouteCalculatorTab
    },
    {
      id: 'partners-handlers',
      label: 'Partners & Handlers',
      icon: '🏢',
      component: PartnersHandlersTab
    }
  ]

  return (
    <div className="addresses-container">
      {/* Tab Navigation */}
      <div className="addresses-tabs-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`addresses-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="addresses-content">
        <div className="addresses-tab-content fade-in">
          {tabs.map(tab => {
            const Component = tab.component
            return activeTab === tab.id && (
              <Component key={tab.id} userId={userId} onClose={onClose} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

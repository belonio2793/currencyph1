import { useState } from 'react'
import DefaultAddressesTab from './DefaultAddressesTab'
import MyAddressesTab from './MyAddressesTab'
import ShippingTrackingTab from './ShippingTrackingTab'
import RouteCalculatorTab from './RouteCalculatorTab'
import PartnersHandlersTab from './PartnersHandlersTab'
import PublicShippingPorts from './PublicShippingPorts'
import './Addresses.css'

export default function Addresses({ userId, onClose, onShowAuth }) {
  const [activeTab, setActiveTab] = useState('shipping-tracking')

  const tabs = [
    {
      id: 'shipping-tracking',
      label: 'Shipping',
      component: ShippingTrackingTab
    },
    {
      id: 'my-addresses',
      label: 'My Addresses',
      component: MyAddressesTab
    },
    {
      id: 'route-calculator',
      label: 'Route Calculator',
      component: RouteCalculatorTab
    },
    {
      id: 'partners-handlers',
      label: 'Shipping Handlers',
      component: PartnersHandlersTab
    },
    {
      id: 'public-ports',
      label: 'Shipping Ports',
      component: PublicShippingPorts
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
              <Component key={tab.id} userId={userId} onClose={onClose} onShowAuth={onShowAuth} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

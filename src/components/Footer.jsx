import React from 'react'

function Footer({ onNavigate, userEmail }) {
  const footerSections = [
    {
      title: 'PRODUCT',
      links: [
        { label: 'Transfer Money', tab: 'send' },
        { label: 'Pay Bills', tab: 'bills' }
      ]
    },
    {
      title: 'MAPS',
      links: [
        { label: 'Addresses', tab: 'addresses' }
      ]
    },
    {
      title: 'GAMES',
      links: [
        { label: 'Poker', tab: 'poker' },
        { label: 'Chess', tab: 'chess' }
      ]
    }
  ]

  const footerLinks = [
    { label: 'About', tab: 'about' },
    { label: 'Network Balances', tab: 'network-balances' },
    { label: 'Planning', tab: 'planning' }
  ]

  const handleLinkClick = (tab) => {
    onNavigate?.(tab)
  }

  return (
    <footer className="mt-16 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="py-12 border-b border-gray-200">
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">currency.ph</h2>
            <p className="text-sm text-gray-600 max-w-md">
              An open source application that displays all transactions across the network.
            </p>
          </div>

          {/* Footer Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {footerSections.map((section, idx) => (
              <div key={idx}>
                <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">
                  {section.title}
                </h3>
                <ul className="space-y-3">
                  {section.links.map(link => (
                    <li key={link.tab}>
                      <button
                        onClick={() => handleLinkClick(link.tab)}
                        className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-500">
            © 2025 currency.ph. All rights reserved
          </p>
          <div className="flex gap-6">
            {footerLinks.map(link => (
              <button
                key={link.tab}
                onClick={() => handleLinkClick(link.tab)}
                className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default React.memo(Footer)

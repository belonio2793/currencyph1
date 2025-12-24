import React from 'react'

function Footer({ onNavigate, userEmail }) {
  const footerSections = [
    {
      title: 'ACCOUNT',
      links: [
        { label: 'Profile', tab: 'profile' },
        { label: 'Inbox', tab: 'inbox' },
        { label: 'My Business', tab: 'my-business' },
        { label: 'History', tab: 'transactions' },
        { label: 'Wallet', tab: 'wallet' },
        { label: 'Deposit Funds', tab: 'deposit' }
      ]
    },
    {
      title: 'MAIN',
      links: [
        { label: 'Nearby', tab: 'nearby' },
        { label: 'Rides', tab: 'rides' }
      ]
    },
    {
      title: 'FINANCIAL',
      links: [
        { label: 'Currency Rates', tab: 'rates' },
        { label: 'Payments', tab: 'payments-financial' },
        { label: 'Send Money', tab: 'send' },
        { label: 'Receive Money', tab: 'receive' }
      ]
    },
    {
      title: 'MARKETPLACE',
      links: [
        { label: 'Jobs', tab: 'jobs' },
        { label: 'Loans', tab: 'p2p-loans' }
      ]
    },
    {
      title: 'COMMUNITY',
      links: [
        { label: 'Online Users', tab: 'online-users' },
        { label: 'Messages', tab: 'messages' },
        { label: 'Market Opportunities', tab: 'investments' }
      ]
    },
    {
      title: 'PERSONAL',
      links: [
        { label: 'Bills', tab: 'bills' }
      ]
    },
    {
      title: 'GAMES',
      links: [
        { label: 'Poker', tab: 'poker' },
        { label: 'Chess', tab: 'chess' }
      ]
    },
    {
      title: 'MAPS',
      links: [
        { label: 'Shipping', tab: 'shipping' },
        { label: 'Addresses', tab: 'addresses' }
      ]
    },
    {
      title: 'NETWORK',
      links: [
        { label: 'Network Balances', tab: 'network-balances' }
      ]
    }
  ]

  const footerLinks = [
    { label: 'About', tab: 'about' },
    { label: 'Planning', tab: 'planning' },
    { label: 'Privacy Policy', url: '#' },
    { label: 'Terms of Service', url: '#' },
    { label: 'Contact', url: '#' }
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
          </div>

          {/* Footer Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
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
          <div className="flex flex-wrap gap-4 justify-center sm:justify-end">
            {footerLinks.map(link => (
              <div key={link.tab || link.url}>
                {link.tab ? (
                  <button
                    onClick={() => handleLinkClick(link.tab)}
                    className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {link.label}
                  </button>
                ) : (
                  <a
                    href={link.url}
                    className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {link.label}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default React.memo(Footer)

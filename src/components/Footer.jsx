import { useNavigate } from 'react-router-dom'

export default function Footer() {
  const navigate = useNavigate()

  const footerLinks = {
    Products: [
      { name: 'Currency Exchange', path: '/' },
      { name: 'Jobs', path: '/jobs' },
      { name: 'Loans', path: '/loans' },
      { name: 'Rides', path: '/rides' }
    ],
    Maps: [
      { name: 'Addresses', path: '/addresses' }
    ],
    Company: [
      { name: 'About', path: '#' },
      { name: 'Blog', path: '#' },
      { name: 'Contact', path: '#' }
    ],
    Legal: [
      { name: 'Privacy Policy', path: '#' },
      { name: 'Terms of Service', path: '#' },
      { name: 'Disclaimer', path: '#' }
    ]
  }

  return (
    <footer className="mt-16 py-12 bg-slate-50 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">{category}</h3>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.name}>
                    <button
                      onClick={() => navigate(link.path)}
                      className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      {link.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer Bottom */}
        <div className="border-t pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <p className="text-xs text-gray-500 mb-4 sm:mb-0">
              © {new Date().getFullYear()} currency.ph • All rights reserved
            </p>
            <p className="text-xs text-gray-400">
              Powered by Supabase • Real-time Data
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

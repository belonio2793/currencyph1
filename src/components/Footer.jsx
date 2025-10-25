export default function Footer() {
  return (
    <footer className="mt-12 py-8 text-center border-t border-gray-200">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          <strong>Currency.ph Staging Environment</strong>
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-600 max-w-2xl mx-auto">
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Features</h4>
            <ul className="space-y-1">
              <li>✓ Real-time balances</li>
              <li>✓ Community voting</li>
              <li>✓ Tokenized ownership</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Infrastructure</h4>
            <ul className="space-y-1">
              <li>• Supabase (Backend)</li>
              <li>• Polygon (Blockchain)</li>
              <li>• OANDA + AbstractAPI</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Region</h4>
            <ul className="space-y-1">
              <li>🌏 Asia-Only</li>
              <li>🇵🇭 Philippines</li>
              <li>Non-Profit Structure</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            © 2024 Currency.ph • Staging • Community-Driven • Transparent Ledger
          </p>
        </div>
      </div>
    </footer>
  )
}

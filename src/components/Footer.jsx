export default function Footer() {
  return (
    <footer className="mt-12 py-6 text-center border-t">
      <p className="text-xs text-gray-500 mb-2">
        Currency Exchange • Supabase Powered • Real-time Rates
      </p>
      <p className="text-xs text-gray-400">
        {new Date().getFullYear()} • All rights reserved
      </p>
    </footer>
  )
}

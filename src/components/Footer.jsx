export default function Footer() {
  return (
    <footer className="mt-12 py-6 text-center border-t">
      <p className="text-xs text-gray-500 mb-2">
        DOG Token • Supabase Powered • Simple Balance Management
      </p>
      <p className="text-xs text-gray-400">
        {new Date().getFullYear()} • All rights reserved
      </p>
    </footer>
  )
}

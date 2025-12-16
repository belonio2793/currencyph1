import React from 'react'

export default function PageLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        <h2 className="text-lg font-light text-slate-900 mb-2">Loading...</h2>
        <p className="text-sm text-slate-500">Please wait while we load this page</p>
      </div>
    </div>
  )
}

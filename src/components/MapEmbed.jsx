import React, { useState } from 'react'

export default function MapEmbed({ latitude, longitude }) {
  const [showMap, setShowMap] = useState(false)
  const src = `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`

  return (
    <div>
      {!showMap ? (
        <div className="border rounded p-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">Map is available for this location.</div>
          <button onClick={() => setShowMap(true)} className="px-3 py-1 bg-blue-600 text-white rounded">Show Map</button>
        </div>
      ) : (
        <iframe
          title="map"
          src={src}
          className="w-full h-64 border-0 rounded"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  )
}

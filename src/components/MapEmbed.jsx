import React, { useState } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Set default icon paths for Vite/Esm
let DEFAULT_LEAFLET_ICON = null
try {
  delete L.Icon.Default.prototype._getIconUrl
  const iconRetinaUrl = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href
  const iconUrl = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href
  const shadowUrl = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href
  L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })
  DEFAULT_LEAFLET_ICON = L.icon({ iconUrl, iconRetinaUrl, shadowUrl, iconSize: [25,41], iconAnchor: [12,41] })
} catch (e) {}

export default function MapEmbed({ latitude, longitude }) {
  const [showMap, setShowMap] = useState(false)
  const lat = Number(latitude)
  const lng = Number(longitude)
  const center = (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : [14.5995, 120.9842]

  return (
    <div>
      {!showMap ? (
        <div className="border rounded p-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">Map is available for this location.</div>
          <button onClick={() => setShowMap(true)} className="px-3 py-1 bg-blue-600 text-white rounded">Show Map</button>
        </div>
      ) : (
        <div className="w-full h-64 border rounded overflow-hidden">
          <MapContainer center={center} zoom={15} scrollWheelZoom={false} className="w-full h-full">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {(!isNaN(lat) && !isNaN(lng)) && (
              <Marker position={[lat, lng]} icon={DEFAULT_LEAFLET_ICON} />
            )}
          </MapContainer>
        </div>
      )}
    </div>
  )
}

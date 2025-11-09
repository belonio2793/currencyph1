import React, { useState, useRef, useEffect } from 'react'

const MANILA_DISTRICTS = [
  { id: 'intramuros', name: 'Intramuros', x: 150, y: 120, color: '#d4a574', emoji: '🏰' },
  { id: 'binondo', name: 'Binondo', x: 220, y: 140, color: '#8b7355', emoji: '🏮' },
  { id: 'ermita', name: 'Ermita', x: 180, y: 280, color: '#a8c5d6', emoji: '⛪' },
  { id: 'malate', name: 'Malate', x: 240, y: 320, color: '#b8d4e8', emoji: '🌊' },
  { id: 'tondo', name: 'Tondo', x: 100, y: 200, color: '#c9b8a3', emoji: '🏭' },
  { id: 'sta-cruz', name: 'Sta. Cruz', x: 200, y: 200, color: '#d4b5a0', emoji: '🛍️' },
  { id: 'quiapo', name: 'Quiapo', x: 160, y: 160, color: '#e8d4c0', emoji: '🙏' },
  { id: 'san-nicolas', name: 'San Nicolás', x: 220, y: 180, color: '#d9c4b0', emoji: '🏘️' },
  { id: 'sampaloc', name: 'Sampaloc', x: 180, y: 240, color: '#cdb8a8', emoji: '📚' },
  { id: 'paco', name: 'Paco', x: 200, y: 320, color: '#c4a894', emoji: '🌳' }
]

const LANDMARKS = [
  { id: 'rizal-monument', name: 'Rizal Monument', x: 320, y: 160, type: 'monument', emoji: '🗿' },
  { id: 'fort-santiago', name: 'Fort Santiago', x: 140, y: 110, type: 'fort', emoji: '🏯' },
  { id: 'san-agustin', name: 'San Agustin Church', x: 180, y: 130, type: 'church', emoji: '⛩️' },
  { id: 'manila-bay', name: 'Manila Bay', x: 80, y: 350, type: 'water', emoji: '🌊' },
  { id: 'quiapo-church', name: 'Quiapo Church', x: 140, y: 170, type: 'church', emoji: '⛪' },
  { id: 'binondo-church', name: 'Binondo Church', x: 240, y: 130, type: 'church', emoji: '⛪' },
]

const ROADS = [
  { type: 'main', points: [[80, 160], [340, 160]] },
  { type: 'main', points: [[180, 100], [180, 350]] },
  { type: 'main', points: [[100, 200], [300, 200]] },
  { type: 'secondary', points: [[140, 120], [240, 280]] },
  { type: 'secondary', points: [[220, 100], [220, 320]] },
]

export default function ManilaEnhancedMap({
  character,
  properties = [],
  onPropertyClick,
  onBuyProperty,
  onMapClick,
  isInteractive = true,
  zoom: externalZoom = 2.2,
  onPropertyDragEnd,
  canPlaceProperties = true
}) {
  const canvasRef = useRef(null)
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [hoveredItem, setHoveredItem] = useState(null)
  const [draggedProperty, setDraggedProperty] = useState(null)
  const [mapOffset, setMapOffset] = useState({ x: -200, y: -150 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(externalZoom || 2.2)

  const baseWidth = 800
  const baseHeight = 500

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const scale = zoom

    ctx.save()
    ctx.translate(mapOffset.x, mapOffset.y)
    ctx.scale(scale, scale)

    drawWater(ctx)
    drawRoads(ctx)
    drawDistricts(ctx)
    drawLandmarks(ctx)
    drawProperties(ctx)
    drawCharacter(ctx)
    drawGridLines(ctx)

    ctx.restore()
  }, [zoom, mapOffset, properties, character, selectedDistrict, hoveredItem, baseWidth, baseHeight])

  const drawWater = (ctx) => {
    ctx.fillStyle = '#4a90e2'
    ctx.fillRect(0, 330, baseWidth, 170)
    ctx.fillStyle = 'rgba(74, 144, 226, 0.3)'
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.arc(50 + i * 150, 370 + Math.sin(i) * 20, 30, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const drawRoads = (ctx) => {
    ROADS.forEach((road) => {
      ctx.strokeStyle = road.type === 'main' ? '#d4d4d4' : '#e8e8e8'
      ctx.lineWidth = road.type === 'main' ? 12 : 6
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      const firstPoint = road.points[0]
      ctx.moveTo(firstPoint[0], firstPoint[1])
      for (let i = 1; i < road.points.length; i++) {
        ctx.lineTo(road.points[i][0], road.points[i][1])
      }
      ctx.stroke()

      if (road.type === 'main') {
        ctx.strokeStyle = '#FFD700'
        ctx.lineWidth = 2
        ctx.setLineDash([10, 5])
        ctx.beginPath()
        ctx.moveTo(firstPoint[0], firstPoint[1])
        for (let i = 1; i < road.points.length; i++) {
          ctx.lineTo(road.points[i][0], road.points[i][1])
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
    })
  }

  const drawDistricts = (ctx) => {
    MANILA_DISTRICTS.forEach((district) => {
      const isSelected = selectedDistrict === district.id
      const isHovered = hoveredItem?.id === district.id

      const width = 90
      const height = 70

      ctx.fillStyle = isSelected ? '#4ade80' : (isHovered ? '#fbbf24' : district.color)
      ctx.globalAlpha = isSelected ? 0.75 : (isHovered ? 0.65 : 0.5)

      // Draw rounded rectangle
      ctx.beginPath()
      ctx.moveTo(district.x - width/2 + 8, district.y - height/2)
      ctx.lineTo(district.x + width/2 - 8, district.y - height/2)
      ctx.quadraticCurveTo(district.x + width/2, district.y - height/2, district.x + width/2, district.y - height/2 + 8)
      ctx.lineTo(district.x + width/2, district.y + height/2 - 8)
      ctx.quadraticCurveTo(district.x + width/2, district.y + height/2, district.x + width/2 - 8, district.y + height/2)
      ctx.lineTo(district.x - width/2 + 8, district.y + height/2)
      ctx.quadraticCurveTo(district.x - width/2, district.y + height/2, district.x - width/2, district.y + height/2 - 8)
      ctx.lineTo(district.x - width/2, district.y - height/2 + 8)
      ctx.quadraticCurveTo(district.x - width/2, district.y - height/2, district.x - width/2 + 8, district.y - height/2)
      ctx.closePath()
      ctx.fill()

      ctx.globalAlpha = 1
      ctx.strokeStyle = isSelected ? '#15803d' : (isHovered ? '#d97706' : '#1f2937')
      ctx.lineWidth = isSelected ? 3 : 2
      ctx.stroke()

      // Add subtle shadow
      ctx.globalAlpha = 0.1
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.moveTo(district.x - width/2 + 8, district.y - height/2 + 2)
      ctx.lineTo(district.x + width/2 - 8, district.y - height/2 + 2)
      ctx.quadraticCurveTo(district.x + width/2 + 2, district.y - height/2 + 2, district.x + width/2 + 2, district.y - height/2 + 8)
      ctx.lineTo(district.x + width/2 + 2, district.y + height/2 - 8)
      ctx.quadraticCurveTo(district.x + width/2 + 2, district.y + height/2 + 2, district.x + width/2 - 8, district.y + height/2 + 2)
      ctx.lineTo(district.x - width/2 + 8, district.y + height/2 + 2)
      ctx.quadraticCurveTo(district.x - width/2 - 2, district.y + height/2 + 2, district.x - width/2 - 2, district.y + height/2 - 8)
      ctx.lineTo(district.x - width/2 - 2, district.y - height/2 + 8)
      ctx.quadraticCurveTo(district.x - width/2 - 2, district.y - height/2 - 2, district.x - width/2 + 8, district.y - height/2 - 2)
      ctx.closePath()
      ctx.fill()

      ctx.globalAlpha = 1
      ctx.fillStyle = '#1f2937'
      ctx.font = 'bold 18px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(district.emoji, district.x, district.y - 8)

      ctx.font = 'bold 11px Arial'
      ctx.fillStyle = '#1f2937'
      ctx.fillText(district.name, district.x, district.y + 18)
    })
  }

  const drawLandmarks = (ctx) => {
    LANDMARKS.forEach((landmark) => {
      const isHovered = hoveredItem?.id === landmark.id
      const radius = isHovered ? 18 : 14

      // Outer glow
      ctx.fillStyle = isHovered ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.2)'
      ctx.beginPath()
      ctx.arc(landmark.x, landmark.y, radius + 4, 0, Math.PI * 2)
      ctx.fill()

      // Main circle
      ctx.fillStyle = isHovered ? '#fbbf24' : '#fcd34d'
      ctx.beginPath()
      ctx.arc(landmark.x, landmark.y, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = isHovered ? '#d97706' : '#f59e0b'
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.fillStyle = '#1f2937'
      ctx.font = 'bold 22px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(landmark.emoji, landmark.x, landmark.y)

      if (isHovered) {
        ctx.fillStyle = 'rgba(31, 41, 55, 0.95)'
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 2

        const textWidth = ctx.measureText(landmark.name).width
        const boxWidth = Math.max(textWidth + 16, 110)

        ctx.beginPath()
        ctx.moveTo(landmark.x - boxWidth/2 + 6, landmark.y - 35)
        ctx.lineTo(landmark.x + boxWidth/2 - 6, landmark.y - 35)
        ctx.quadraticCurveTo(landmark.x + boxWidth/2, landmark.y - 35, landmark.x + boxWidth/2, landmark.y - 29)
        ctx.lineTo(landmark.x + boxWidth/2, landmark.y - 15)
        ctx.quadraticCurveTo(landmark.x + boxWidth/2, landmark.y - 9, landmark.x + boxWidth/2 - 6, landmark.y - 9)
        ctx.lineTo(landmark.x - boxWidth/2 + 6, landmark.y - 9)
        ctx.quadraticCurveTo(landmark.x - boxWidth/2, landmark.y - 9, landmark.x - boxWidth/2, landmark.y - 15)
        ctx.lineTo(landmark.x - boxWidth/2, landmark.y - 29)
        ctx.quadraticCurveTo(landmark.x - boxWidth/2, landmark.y - 35, landmark.x - boxWidth/2 + 6, landmark.y - 35)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#fbbf24'
        ctx.font = 'bold 11px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(landmark.name, landmark.x, landmark.y - 22)
      }
    })
  }

  const drawProperties = (ctx) => {
    properties.forEach((prop, idx) => {
      const x = prop.location_x || (50 + idx * 60)
      const y = prop.location_y || (150 + (idx % 3) * 70)

      const size = 30
      const isHovered = hoveredItem?.id === prop.id && hoveredItem?.type === 'property'

      ctx.fillStyle = '#8B4513'
      ctx.globalAlpha = 0.8
      ctx.fillRect(x - size / 2, y - size / 2, size, size)

      ctx.fillStyle = isHovered ? '#FFD700' : '#D2691E'
      ctx.lineWidth = isHovered ? 3 : 2
      ctx.strokeStyle = isHovered ? '#FFA500' : '#8B4513'
      ctx.globalAlpha = 1
      ctx.strokeRect(x - size / 2, y - size / 2, size, size)

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 16px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🏠', x, y)

      if (isHovered) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
        ctx.fillRect(x - 60, y - 35, 120, 30)
        ctx.fillStyle = '#fff'
        ctx.font = '10px Arial'
        ctx.fillText(prop.name || 'Property', x, y - 20)
        ctx.fillText(`Lvl ${prop.upgrade_level || 0} | ₱${Number(prop.current_value || 0).toLocaleString()}`, x, y - 8)
      }

      if (prop.upgrade_level && prop.upgrade_level > 0) {
        ctx.fillStyle = '#FFD700'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`Lvl ${prop.upgrade_level}`, x + 15, y - 10)
      }
    })
  }

  const drawCharacter = (ctx) => {
    if (!character) return

    const x = character.position?.x || 200
    const y = character.position?.y || 200

    ctx.fillStyle = '#FF6B6B'
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#FF0000'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🧑', x, y)

    ctx.fillStyle = '#000'
    ctx.font = '11px Arial'
    ctx.fillText(character.name || 'Player', x, y + 20)
  }

  const drawGridLines = (ctx) => {
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.1)'
    ctx.lineWidth = 1
    for (let i = 0; i < baseWidth; i += 50) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, baseHeight)
      ctx.stroke()
    }
    for (let i = 0; i < baseHeight; i += 50) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(baseWidth, i)
      ctx.stroke()
    }
  }

  const handleCanvasMouseMove = (e) => {
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left - mapOffset.x) / zoom
    const canvasY = (e.clientY - rect.top - mapOffset.y) / zoom

    let hoveredItemFound = null

    for (const district of MANILA_DISTRICTS) {
      if (
        canvasX >= district.x - 40 && canvasX <= district.x + 40 &&
        canvasY >= district.y - 30 && canvasY <= district.y + 30
      ) {
        hoveredItemFound = { id: district.id, type: 'district' }
        break
      }
    }

    if (!hoveredItemFound) {
      for (const landmark of LANDMARKS) {
        const dist = Math.sqrt((canvasX - landmark.x) ** 2 + (canvasY - landmark.y) ** 2)
        if (dist < 20) {
          hoveredItemFound = { id: landmark.id, type: 'landmark' }
          break
        }
      }
    }

    if (!hoveredItemFound) {
      for (const prop of properties) {
        const x = prop.location_x || (50 + properties.indexOf(prop) * 60)
        const y = prop.location_y || (150 + (properties.indexOf(prop) % 3) * 70)
        if (canvasX >= x - 20 && canvasX <= x + 20 && canvasY >= y - 20 && canvasY <= y + 20) {
          hoveredItemFound = { id: prop.id, type: 'property' }
          break
        }
      }
    }

    setHoveredItem(hoveredItemFound)
    canvasRef.current.style.cursor = hoveredItemFound ? 'pointer' : 'default'
  }

  const handleCanvasMouseDown = (e) => {
    if (e.button === 2) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - mapOffset.x, y: e.clientY - mapOffset.y })
      return
    }

    if (!isInteractive) return

    const rect = canvasRef.current.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left - mapOffset.x) / zoom
    const canvasY = (e.clientY - rect.top - mapOffset.y) / zoom

    for (const prop of properties) {
      const propX = prop.location_x || (50 + properties.indexOf(prop) * 60)
      const propY = prop.location_y || (150 + (properties.indexOf(prop) % 3) * 70)
      if (canvasX >= propX - 20 && canvasX <= propX + 20 && canvasY >= propY - 20 && canvasY <= propY + 20) {
        setDraggedProperty(prop)
        return
      }
    }

    for (const district of MANILA_DISTRICTS) {
      if (
        canvasX >= district.x - 40 && canvasX <= district.x + 40 &&
        canvasY >= district.y - 30 && canvasY <= district.y + 30
      ) {
        setSelectedDistrict(district.id)
        if (onMapClick) onMapClick(district)
        return
      }
    }
  }

  const handleCanvasMouseMove_Pan = (e) => {
    handleCanvasMouseMove(e)

    if (!isPanning) return

    setMapOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    })
  }

  const handleCanvasMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (!draggedProperty) return

    const rect = canvasRef.current.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left - mapOffset.x) / zoom
    const canvasY = (e.clientY - rect.top - mapOffset.y) / zoom

    const updatedProperty = { ...draggedProperty, location_x: canvasX, location_y: canvasY }
    if (onPropertyDragEnd) onPropertyDragEnd(updatedProperty)
    setDraggedProperty(null)
  }

  const handleCanvasContextMenu = (e) => {
    e.preventDefault()
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5))
  }

  const handleCanvasWheel = (e) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      handleZoomIn()
    } else {
      handleZoomOut()
    }
  }

  const handleResetView = () => {
    setMapOffset({ x: 0, y: 0 })
    setZoom(1)
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 rounded-lg overflow-hidden">
      <div className="p-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-slate-100">Manila City Map</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-slate-200 font-medium"
              title="Zoom out (or scroll down)"
            >
              🔍−
            </button>
            <span className="text-xs text-slate-300 min-w-12 text-center font-semibold">{(zoom * 100).toFixed(0)}%</span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-slate-200 font-medium"
              title="Zoom in (or scroll up)"
            >
              🔍+
            </button>
            <button
              onClick={handleResetView}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-200"
              title="Reset zoom and pan"
            >
              Reset View
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          Left-click: Select district | Right-drag: Pan | Mouse wheel: Zoom | Drag properties to reposition
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={baseWidth}
        height={baseHeight}
        onMouseMove={handleCanvasMouseMove_Pan}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => setHoveredItem(null)}
        onContextMenu={handleCanvasContextMenu}
        onWheel={handleCanvasWheel}
        className="flex-1 bg-gradient-to-b from-green-100 to-green-50 cursor-grab active:cursor-grabbing"
      />

      {selectedDistrict && (
        <div className="p-3 bg-slate-800 border-t border-slate-700">
          <div className="text-sm text-slate-100 mb-2">
            📍 <strong>{MANILA_DISTRICTS.find(d => d.id === selectedDistrict)?.name}</strong>
          </div>
          <div className="text-xs text-slate-400">
            Properties in this district: {properties.filter(p => p.location_x && p.location_x > 0).length}
          </div>
        </div>
      )}

      <div className="p-2 bg-slate-800 border-t border-slate-700 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>Properties owned: {properties.length} | Pan position: ({mapOffset.x.toFixed(0)}, {mapOffset.y.toFixed(0)})</span>
          <span className="text-emerald-400">🔍 Zoom: {(zoom * 100).toFixed(0)}% (0.5x - 3x)</span>
        </div>
      </div>
    </div>
  )
}

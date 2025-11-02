import React, { useRef, useEffect } from 'react'

export default function CityIsometric({ city }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !city) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    drawIsometricCity(ctx, city, canvas.width, canvas.height)
  }, [city])

  const drawIsometricCity = (ctx, city, width, height) => {
    const centerX = width / 2
    const centerY = height / 2
    const tileSize = 40

    // Draw background
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, width, height)

    // Draw grid foundation
    drawIsometricGrid(ctx, centerX, centerY, tileSize, 12)

    // Draw buildings based on zones
    drawZoneBuildings(ctx, centerX, centerY, tileSize, city)

    // Draw water/terrain
    drawTerrain(ctx, centerX, centerY, tileSize, city.pollution)

    // Draw info overlay
    drawCityInfo(ctx, city, width, height)
  }

  const drawIsometricGrid = (ctx, centerX, centerY, tileSize, gridSize) => {
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)'
    ctx.lineWidth = 1

    for (let i = -gridSize; i <= gridSize; i++) {
      for (let j = -gridSize; j <= gridSize; j++) {
        const screenPos = isometricToScreen(i, j, tileSize)
        const x = centerX + screenPos.x
        const y = centerY + screenPos.y

        ctx.strokeRect(x, y, tileSize * 1.155, tileSize * 0.577)
      }
    }
  }

  const drawZoneBuildings = (ctx, centerX, centerY, tileSize, city) => {
    let gridIndex = 0

    // Residential zones
    for (let i = 0; i < city.residentialZones; i++) {
      const pos = getGridPosition(gridIndex++, 6)
      drawBuilding(ctx, centerX, centerY, tileSize, pos.i, pos.j, '#3b82f6', 'Residential', city.happiness)
    }

    // Commercial zones
    for (let i = 0; i < city.commercialZones; i++) {
      const pos = getGridPosition(gridIndex++, 6)
      drawBuilding(ctx, centerX, centerY, tileSize, pos.i, pos.j, '#f59e0b', 'Commercial', city.happiness)
    }

    // Industrial zones
    for (let i = 0; i < city.industrialZones; i++) {
      const pos = getGridPosition(gridIndex++, 6)
      drawBuilding(ctx, centerX, centerY, tileSize, pos.i, pos.j, '#6b7280', 'Industrial', city.happiness)
    }

    // Parks
    for (let i = 0; i < city.parks; i++) {
      const pos = getGridPosition(gridIndex++, 6)
      drawBuilding(ctx, centerX, centerY, tileSize, pos.i, pos.j, '#22c55e', 'Park', city.happiness)
    }

    // Hospitals
    for (let i = 0; i < city.hospitals; i++) {
      const pos = getGridPosition(gridIndex++, 6)
      drawBuilding(ctx, centerX, centerY, tileSize, pos.i, pos.j, '#ef4444', 'Hospital', city.happiness)
    }

    // Schools
    for (let i = 0; i < city.schools; i++) {
      const pos = getGridPosition(gridIndex++, 6)
      drawBuilding(ctx, centerX, centerY, tileSize, pos.i, pos.j, '#a855f7', 'School', city.happiness)
    }

    // Power Plants
    for (let i = 0; i < city.powerPlants; i++) {
      const pos = getGridPosition(gridIndex++, 6)
      drawBuilding(ctx, centerX, centerY, tileSize, pos.i, pos.j, '#eab308', 'Power', city.happiness)
    }
  }

  const getGridPosition = (index, gridWidth) => {
    return {
      i: (index % gridWidth) - gridWidth / 2,
      j: Math.floor(index / gridWidth) - gridWidth / 2
    }
  }

  const isometricToScreen = (i, j, tileSize) => {
    const x = (i - j) * (tileSize * 1.155) / 2
    const y = (i + j) * (tileSize * 0.577) / 2
    return { x, y }
  }

  const drawBuilding = (ctx, centerX, centerY, tileSize, i, j, color, type, happiness) => {
    const screenPos = isometricToScreen(i, j, tileSize)
    const x = centerX + screenPos.x
    const y = centerY + screenPos.y

    const heightMultiplier = 1 + (happiness / 100) * 0.5
    const buildingHeight = 30 * heightMultiplier

    // Draw base
    ctx.fillStyle = color
    ctx.globalAlpha = 0.8
    drawIsometricBuilding(ctx, x, y, tileSize * 0.9, buildingHeight)
    ctx.globalAlpha = 1

    // Draw roof
    ctx.fillStyle = darkenColor(color, 0.8)
    drawIsometricRoof(ctx, x, y, tileSize * 0.9)

    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    const shadowOffset = tileSize * 0.2
    ctx.beginPath()
    ctx.ellipse(x + shadowOffset, y + tileSize * 0.3, tileSize * 0.4, tileSize * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawIsometricBuilding = (ctx, x, y, width, height) => {
    // Front face
    ctx.fillRect(x - width / 2, y, width, height)

    // Left face (darker)
    ctx.fillStyle = ctx.fillStyle
    const leftColor = darkenColor(getComputedStyle(ctx.canvas).getPropertyValue('--building-color'), 0.9)
    ctx.fillStyle = leftColor
    ctx.beginPath()
    ctx.moveTo(x - width / 2, y)
    ctx.lineTo(x - width / 2 - width / 4, y - width / 8)
    ctx.lineTo(x - width / 2 - width / 4, y - width / 8 + height)
    ctx.lineTo(x - width / 2, y + height)
    ctx.fill()

    // Right face (even darker)
    const rightColor = darkenColor(getComputedStyle(ctx.canvas).getPropertyValue('--building-color'), 0.7)
    ctx.fillStyle = rightColor
    ctx.beginPath()
    ctx.moveTo(x + width / 2, y)
    ctx.lineTo(x + width / 2 + width / 4, y - width / 8)
    ctx.lineTo(x + width / 2 + width / 4, y - width / 8 + height)
    ctx.lineTo(x + width / 2, y + height)
    ctx.fill()
  }

  const drawIsometricRoof = (ctx, x, y, width) => {
    ctx.beginPath()
    ctx.moveTo(x - width / 2, y)
    ctx.lineTo(x, y - width / 4)
    ctx.lineTo(x + width / 2, y)
    ctx.fill()
  }

  const drawTerrain = (ctx, centerX, centerY, tileSize, pollution) => {
    ctx.fillStyle = `rgba(34, 197, 94, ${0.1 - pollution / 1000})`
    ctx.beginPath()
    ctx.arc(centerX, centerY + 50, 200, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawCityInfo = (ctx, city, width, height) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, height - 100, width, 100)

    ctx.fillStyle = '#e2e8f0'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(`Population: ${city.population.toLocaleString()}`, 20, height - 70)
    ctx.fillText(`Budget: ₱${(city.budget / 1000000).toFixed(1)}M`, 20, height - 45)
    ctx.fillText(`Happiness: ${Math.floor(city.happiness)}%`, 20, height - 20)
  }

  const darkenColor = (color, factor = 0.8) => {
    const hex = color.replace('#', '')
    const num = parseInt(hex, 16)
    const r = Math.floor((num >> 16) * factor)
    const g = Math.floor(((num >> 8) & 0x00FF) * factor)
    const b = Math.floor((num & 0x0000FF) * factor)
    return `rgb(${r}, ${g}, ${b})`
  }

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="w-full border border-slate-700 rounded bg-slate-800"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  )
}

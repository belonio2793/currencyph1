import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

export default function IsometricGameMap({
  properties = [],
  character = null,
  onPropertyClick = null,
  city = 'Manila'
}) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const tilesRef = useRef(new Map())
  const propertiesRef = useRef(new Map())
  const [hoveredProperty, setHoveredProperty] = useState(null)

  const TILE_SIZE = 60
  const GRID_WIDTH = 20
  const GRID_HEIGHT = 15
  const PROPERTY_SIZE = 3

  useEffect(() => {
    if (!containerRef.current) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x2a5a3a)
    sceneRef.current = scene

    const camera = new THREE.OrthographicCamera(
      width / -2,
      width / 2,
      height / 2,
      height / -2,
      1,
      1000
    )
    camera.position.z = 500
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    createGameMap(scene)
    renderProperties(scene)
    addLighting(scene)

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onMouseMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      const intersects = raycaster.intersectObjects(scene.children, true)
      let foundProperty = null

      for (const intersection of intersects) {
        if (intersection.object.userData && intersection.object.userData.propertyId) {
          foundProperty = intersection.object.userData.propertyId
          break
        }
      }

      setHoveredProperty(foundProperty)
    }

    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      const intersects = raycaster.intersectObjects(scene.children, true)

      for (const intersection of intersects) {
        if (intersection.object.userData && intersection.object.userData.propertyId) {
          const propId = intersection.object.userData.propertyId
          const prop = properties.find(p => p.id === propId)
          if (prop && onPropertyClick) {
            onPropertyClick(prop)
          }
          break
        }
      }
    }

    renderer.domElement.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('click', onClick)

    const animate = () => {
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    const handleResize = () => {
      const newWidth = containerRef.current?.clientWidth || width
      const newHeight = containerRef.current?.clientHeight || height

      camera.left = newWidth / -2
      camera.right = newWidth / 2
      camera.top = newHeight / 2
      camera.bottom = newHeight / -2
      camera.updateProjectionMatrix()

      renderer.setSize(newWidth, newHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.domElement.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('click', onClick)
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, [properties, onPropertyClick])

  const createGameMap = (scene) => {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.7,
      metalness: 0.1
    })

    const grassMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a7a3a,
      roughness: 0.9,
      metalness: 0
    })

    for (let x = 0; x < GRID_WIDTH; x++) {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const isRoad = x % 5 === 0 || y % 5 === 0
        const material = isRoad ? roadMaterial : grassMaterial

        const isometricPos = gridToIsometric(x, y)

        const geometry = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, 2)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(isometricPos.x, isometricPos.y, 0)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData = { gridX: x, gridY: y, isTile: true }

        scene.add(mesh)
        tilesRef.current.set(`${x}-${y}`, mesh)
      }
    }
  }

  const gridToIsometric = (gridX, gridY) => {
    const isoX = (gridX - gridY) * (TILE_SIZE / 2)
    const isoY = (gridX + gridY) * (TILE_SIZE / 4)
    return { x: isoX, y: isoY }
  }

  const renderProperties = (scene) => {
    properties.forEach(prop => {
      if (!prop.location_x || !prop.location_y) return

      const gridX = Math.floor((prop.location_x / 300) * GRID_WIDTH)
      const gridY = Math.floor((prop.location_y / 350) * GRID_HEIGHT)

      if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) return

      const isoPos = gridToIsometric(gridX, gridY)

      const building = createBuildingMesh(prop)
      building.position.set(isoPos.x, isoPos.y - 10, 10)
      building.userData = { propertyId: prop.id, ...prop }
      building.castShadow = true
      building.receiveShadow = true

      scene.add(building)
      propertiesRef.current.set(prop.id, building)
    })
  }

  const createBuildingMesh = (property) => {
    const group = new THREE.Group()

    const colors = {
      house: 0xff9800,
      business: 0x2196f3,
      farm: 0x4caf50,
      shop: 0xe91e63,
      factory: 0x9c27b0
    }

    const height = 30 + Math.log(property.current_value || 100000) * 5
    const color = colors[property.property_type] || 0x00bcd4
    const scale = property.owner_id ? 1.2 : 1.0

    const geometry = new THREE.BoxGeometry(PROPERTY_SIZE * 15 * scale, PROPERTY_SIZE * 15 * scale, height)
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.2,
      emissive: property.owner_id ? color : 0x000000,
      emissiveIntensity: property.owner_id ? 0.3 : 0
    })

    const building = new THREE.Mesh(geometry, material)
    building.castShadow = true
    building.receiveShadow = true
    group.add(building)

    const roofGeometry = new THREE.ConeGeometry(PROPERTY_SIZE * 10, 10, 4)
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.8
    })
    const roof = new THREE.Mesh(roofGeometry, roofMaterial)
    roof.castShadow = true
    roof.position.z = height / 2 + 5
    roof.rotation.z = Math.PI / 4
    group.add(roof)

    return group
  }

  const addLighting = (scene) => {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(100, 100, 100)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.left = -500
    directionalLight.shadow.camera.right = 500
    directionalLight.shadow.camera.top = 500
    directionalLight.shadow.camera.bottom = -500
    scene.add(directionalLight)
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-gradient-to-b from-green-300 to-green-100"
      style={{ overflow: 'hidden' }}
    >
      {hoveredProperty && (
        <div className="absolute top-4 left-4 bg-slate-800/80 text-white px-4 py-2 rounded-lg border border-slate-600 pointer-events-none">
          <p className="text-sm font-bold">{properties.find(p => p.id === hoveredProperty)?.name}</p>
          <p className="text-xs text-slate-300">Click to view details</p>
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-slate-800/80 text-slate-300 px-4 py-2 rounded-lg border border-slate-600 text-xs pointer-events-none">
        <p>🏠 {properties.length} Properties</p>
        <p>📍 {city}</p>
      </div>
    </div>
  )
}

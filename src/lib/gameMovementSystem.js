// Game movement and pathfinding system

export class PathfindingEngine {
  constructor(mapWidth = 300, mapHeight = 350) {
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
    this.gridSize = 20 // Each grid cell is 20x20 pixels
    this.gridWidth = Math.ceil(mapWidth / this.gridSize)
    this.gridHeight = Math.ceil(mapHeight / this.gridSize)
  }

  // Simple A* pathfinding
  findPath(startX, startY, endX, endY) {
    const startGrid = this.worldToGrid(startX, startY)
    const endGrid = this.worldToGrid(endX, endY)

    const openSet = [startGrid]
    const cameFrom = new Map()
    const gScore = new Map()
    const fScore = new Map()

    const key = (p) => `${p.x},${p.y}`
    const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

    gScore.set(key(startGrid), 0)
    fScore.set(key(startGrid), heuristic(startGrid, endGrid))

    while (openSet.length > 0) {
      let current = openSet[0]
      let currentIndex = 0

      for (let i = 1; i < openSet.length; i++) {
        if (fScore.get(key(openSet[i])) < fScore.get(key(current))) {
          current = openSet[i]
          currentIndex = i
        }
      }

      if (current.x === endGrid.x && current.y === endGrid.y) {
        return this.reconstructPath(cameFrom, current)
      }

      openSet.splice(currentIndex, 1)

      for (const neighbor of this.getNeighbors(current)) {
        const tentativeGScore = gScore.get(key(current)) + 1

        if (!gScore.has(key(neighbor)) || tentativeGScore < gScore.get(key(neighbor))) {
          cameFrom.set(key(neighbor), current)
          gScore.set(key(neighbor), tentativeGScore)
          fScore.set(key(neighbor), tentativeGScore + heuristic(neighbor, endGrid))

          if (!openSet.find(p => p.x === neighbor.x && p.y === neighbor.y)) {
            openSet.push(neighbor)
          }
        }
      }
    }

    return [] // No path found
  }

  worldToGrid(x, y) {
    return {
      x: Math.floor(x / this.gridSize),
      y: Math.floor(y / this.gridSize)
    }
  }

  gridToWorld(gridX, gridY) {
    return {
      x: gridX * this.gridSize + this.gridSize / 2,
      y: gridY * this.gridSize + this.gridSize / 2
    }
  }

  getNeighbors(point) {
    const neighbors = []
    const directions = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
      { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
    ]

    for (const dir of directions) {
      const newX = point.x + dir.x
      const newY = point.y + dir.y

      if (newX >= 0 && newX < this.gridWidth && newY >= 0 && newY < this.gridHeight) {
        neighbors.push({ x: newX, y: newY })
      }
    }

    return neighbors
  }

  reconstructPath(cameFrom, current) {
    const path = [{ x: current.x * this.gridSize, y: current.y * this.gridSize }]
    const key = (p) => `${p.x},${p.y}`

    while (cameFrom.has(key(current))) {
      current = cameFrom.get(key(current))
      path.unshift({ x: current.x * this.gridSize, y: current.y * this.gridSize })
    }

    return path
  }
}

export class CharacterMovement {
  constructor() {
    this.position = { x: 150, y: 175 }
    this.velocity = { x: 0, y: 0 }
    this.angle = 0
    this.speed = 6
    this.maxSpeed = 10
    this.acceleration = 0.8
    this.friction = 0.8
    this.rotationSpeed = 0.2
    this.facing = 1
    this.isMoving = false
    this.currentPath = []
    this.pathIndex = 0
    this.pathfinding = new PathfindingEngine()
  }

  setPosition(x, y) {
    this.position.x = Math.max(0, Math.min(300, x))
    this.position.y = Math.max(0, Math.min(350, y))
  }

  applyInput(inputVector) {
    // Apply acceleration based on input
    if (inputVector.x !== 0 || inputVector.y !== 0) {
      this.velocity.x += inputVector.x * this.acceleration
      this.velocity.y += inputVector.y * this.acceleration

      // Normalize diagonal movement
      const magnitude = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2)
      if (magnitude > this.maxSpeed) {
        this.velocity.x = (this.velocity.x / magnitude) * this.maxSpeed
        this.velocity.y = (this.velocity.y / magnitude) * this.maxSpeed
      }

      this.isMoving = true

      // Update rotation angle for 360-degree facing
      const targetAngle = Math.atan2(inputVector.y, inputVector.x)
      this.updateRotation(targetAngle)

      // Keep facing for backwards compatibility
      if (inputVector.x !== 0) {
        this.facing = inputVector.x > 0 ? 1 : -1
      }
    } else {
      // Apply friction
      this.velocity.x *= this.friction
      this.velocity.y *= this.friction

      if (Math.abs(this.velocity.x) < 0.1 && Math.abs(this.velocity.y) < 0.1) {
        this.velocity.x = 0
        this.velocity.y = 0
        this.isMoving = false
      }
    }
  }

  updateRotation(targetAngle) {
    // Smooth rotation to target angle
    let diff = targetAngle - this.angle
    if (diff > Math.PI) diff -= Math.PI * 2
    if (diff < -Math.PI) diff += Math.PI * 2
    this.angle += diff * this.rotationSpeed
  }

  followPath(deltaTime = 16) {
    if (this.currentPath.length === 0) {
      this.isMoving = false
      return
    }

    const target = this.currentPath[this.pathIndex]
    const dx = target.x - this.position.x
    const dy = target.y - this.position.y
    const distance = Math.sqrt(dx ** 2 + dy ** 2)

    if (distance < 10) {
      this.pathIndex++
      if (this.pathIndex >= this.currentPath.length) {
        this.currentPath = []
        this.pathIndex = 0
        this.isMoving = false
        return
      }
      return
    }

    const angle = Math.atan2(dy, dx)
    const moveX = Math.cos(angle) * this.speed
    const moveY = Math.sin(angle) * this.speed

    this.position.x += moveX
    this.position.y += moveY

    // 360-degree rotation
    this.updateRotation(angle)

    // Keep facing for backwards compatibility
    if (dx !== 0) {
      this.facing = dx > 0 ? 1 : -1
    }

    this.isMoving = true
  }

  moveTo(targetX, targetY) {
    const path = this.pathfinding.findPath(
      this.position.x,
      this.position.y,
      targetX,
      targetY
    )

    if (path.length > 0) {
      this.currentPath = path
      this.pathIndex = 0
    }
  }

  update(deltaTime = 16) {
    if (this.currentPath.length > 0) {
      this.followPath(deltaTime)
    }

    // Apply velocity
    this.position.x += this.velocity.x
    this.position.y += this.velocity.y

    // Clamp to bounds
    this.position.x = Math.max(0, Math.min(300, this.position.x))
    this.position.y = Math.max(0, Math.min(350, this.position.y))
  }

  getState() {
    return {
      position: { ...this.position },
      velocity: { ...this.velocity },
      facing: this.facing,
      isMoving: this.isMoving,
      speed: this.speed
    }
  }
}

// Smooth camera following
export class CameraController {
  constructor(mapWidth = 300, mapHeight = 350, viewportWidth = 800, viewportHeight = 520) {
    this.position = { x: 0, y: 0 }
    this.targetPosition = { x: 0, y: 0 }
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
    this.viewportWidth = viewportWidth
    this.viewportHeight = viewportHeight
    this.smoothness = 0.1
    this.zoom = 1
  }

  update(characterX, characterY, deltaTime = 16) {
    // Set target to character position
    this.targetPosition.x = characterX
    this.targetPosition.y = characterY

    // Smooth camera movement
    this.position.x += (this.targetPosition.x - this.position.x) * this.smoothness
    this.position.y += (this.targetPosition.y - this.position.y) * this.smoothness

    // Clamp to bounds
    const maxX = this.mapWidth - this.viewportWidth / (2 * this.zoom)
    const maxY = this.mapHeight - this.viewportHeight / (2 * this.zoom)

    this.position.x = Math.max(0, Math.min(maxX, this.position.x))
    this.position.y = Math.max(0, Math.min(maxY, this.position.y))
  }

  getViewportBounds() {
    const halfWidth = this.viewportWidth / (2 * this.zoom)
    const halfHeight = this.viewportHeight / (2 * this.zoom)

    return {
      left: this.position.x - halfWidth,
      right: this.position.x + halfWidth,
      top: this.position.y - halfHeight,
      bottom: this.position.y + halfHeight
    }
  }

  setZoom(zoomLevel) {
    this.zoom = Math.max(0.5, Math.min(2, zoomLevel))
  }
}

export const DEFAULT_TILE_SIZE = 48
export const DEFAULT_GRID_WIDTH = 64
export const DEFAULT_GRID_HEIGHT = 64

export function gridToIsometric(gridX, gridY, tileSize = DEFAULT_TILE_SIZE) {
  const a = tileSize / 2
  const b = tileSize / 4
  return { x: (gridX - gridY) * a, y: (gridX + gridY) * b }
}

export function isometricToGrid(isoX, isoY, tileSize = DEFAULT_TILE_SIZE) {
  const a = tileSize / 2
  const b = tileSize / 4
  const gx = (isoX / a + isoY / b) / 2
  const gy = (isoY / b - isoX / a) / 2
  return { x: gx, y: gy }
}

export function gameToIsometric(x, y, mapWidth, mapHeight, gridWidth = DEFAULT_GRID_WIDTH, gridHeight = DEFAULT_GRID_HEIGHT, tileSize = DEFAULT_TILE_SIZE) {
  // Map game/world coordinates to grid coordinates then to isometric screen position
  const gx = (x / mapWidth) * gridWidth
  const gy = (y / mapHeight) * gridHeight
  return gridToIsometric(gx, gy, tileSize)
}

export function isometricToGame(isoX, isoY, mapWidth, mapHeight, gridWidth = DEFAULT_GRID_WIDTH, gridHeight = DEFAULT_GRID_HEIGHT, tileSize = DEFAULT_TILE_SIZE) {
  const g = isometricToGrid(isoX, isoY, tileSize)
  const gx = g.x
  const gy = g.y
  return { x: (gx / gridWidth) * mapWidth, y: (gy / gridHeight) * mapHeight }
}

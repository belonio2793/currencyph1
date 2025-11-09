// Utility functions for isometric/grid/game coordinate transforms
export const DEFAULT_TILE_SIZE = 48
export const DEFAULT_GRID_WIDTH = 40
export const DEFAULT_GRID_HEIGHT = 30

export function gridToIsometric(gridX, gridY, tileSize = DEFAULT_TILE_SIZE) {
  const isoX = (gridX - gridY) * (tileSize / 2)
  const isoY = (gridX + gridY) * (tileSize / 4)
  return { x: isoX, y: isoY }
}

export function isometricToGrid(isoX, isoY, tileSize = DEFAULT_TILE_SIZE) {
  const col = isoX / (tileSize / 2)
  const row = isoY / (tileSize / 4)
  const gridX = (col + row) / 2
  const gridY = (row - col) / 2
  return { x: gridX, y: gridY }
}

export function gameToGrid(x, y, mapWidth, mapHeight, GRID_WIDTH = DEFAULT_GRID_WIDTH, GRID_HEIGHT = DEFAULT_GRID_HEIGHT) {
  const gridX = (x / mapWidth) * GRID_WIDTH
  const gridY = (y / mapHeight) * GRID_HEIGHT
  return { x: gridX, y: gridY }
}

export function gameToIsometric(x, y, mapWidth, mapHeight, GRID_WIDTH = DEFAULT_GRID_WIDTH, GRID_HEIGHT = DEFAULT_GRID_HEIGHT, tileSize = DEFAULT_TILE_SIZE) {
  const g = gameToGrid(x, y, mapWidth, mapHeight, GRID_WIDTH, GRID_HEIGHT)
  return gridToIsometric(g.x, g.y, tileSize)
}

export function isometricToGame(isoX, isoY, mapWidth, mapHeight, GRID_WIDTH = DEFAULT_GRID_WIDTH, GRID_HEIGHT = DEFAULT_GRID_HEIGHT, tileSize = DEFAULT_TILE_SIZE) {
  const g = isometricToGrid(isoX, isoY, tileSize)
  return { x: (g.x / GRID_WIDTH) * mapWidth, y: (g.y / GRID_HEIGHT) * mapHeight }
}

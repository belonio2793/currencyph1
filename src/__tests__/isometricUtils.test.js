import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TILE_SIZE,
  DEFAULT_GRID_WIDTH,
  DEFAULT_GRID_HEIGHT,
  gridToIsometric,
  isometricToGrid,
  gameToIsometric,
  isometricToGame
} from '../lib/isometricUtils'

const EPS = 1e-6

describe('isometric utils', () => {
  it('gridToIsometric basic vectors', () => {
    const t = DEFAULT_TILE_SIZE
    expect(gridToIsometric(0, 0, t)).toEqual({ x: 0, y: 0 })
    expect(gridToIsometric(1, 0, t)).toEqual({ x: t / 2, y: t / 4 })
    expect(gridToIsometric(0, 1, t)).toEqual({ x: -t / 2, y: t / 4 })
  })

  it('isometricToGrid inverse of gridToIsometric (float)', () => {
    const t = DEFAULT_TILE_SIZE
    for (let gx = 0; gx < 10; gx++) {
      for (let gy = 0; gy < 8; gy++) {
        const iso = gridToIsometric(gx + 0.3, gy + 0.6, t)
        const back = isometricToGrid(iso.x, iso.y, t)
        expect(Math.abs(back.x - (gx + 0.3))).toBeLessThan(1e-5)
        expect(Math.abs(back.y - (gy + 0.6))).toBeLessThan(1e-5)
      }
    }
  })

  it('game <-> isometric roundtrip uses grid scaling', () => {
    const tile = DEFAULT_TILE_SIZE
    const GW = DEFAULT_GRID_WIDTH
    const GH = DEFAULT_GRID_HEIGHT
    const MAPW = GW * tile
    const MAPH = GH * tile

    const samples = [
      { x: 0, y: 0 },
      { x: MAPW / 2, y: MAPH / 2 },
      { x: MAPW * 0.25, y: MAPH * 0.75 },
      { x: MAPW - 1, y: MAPH - 1 }
    ]

    for (const s of samples) {
      const iso = gameToIsometric(s.x, s.y, MAPW, MAPH, GW, GH, tile)
      const back = isometricToGame(iso.x, iso.y, MAPW, MAPH, GW, GH, tile)
      expect(Math.abs(back.x - s.x)).toBeLessThan(1)
      expect(Math.abs(back.y - s.y)).toBeLessThan(1)
    }
  })
})

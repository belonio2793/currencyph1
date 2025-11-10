import React, { useEffect, useRef, useState } from 'react'
import { World3D } from '../../lib/world3D'

export default function Player3DModal({ open = false, info = null, onClose = () => {} }) {
  const containerRef = useRef(null)
  const worldRef = useRef(null)
  const animRef = useRef(null)
  const armAnimRef = useRef(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!open) return
    if (!containerRef.current) return

    // instantiate World3D for the modal
    const world = new World3D(containerRef.current, { lat: 14.5995, lng: 120.9842 })
    world.cameraConfig.mode = 'freecam'
    world.camera.position.set(0, 120, 200)
    world.start()
    worldRef.current = world

    let playerEntry = null
    let start = performance.now()
    let duration = (info && info.duration) || 3000

    ;(async () => {
      try {
        playerEntry = await world.addPlayer('modal-player', (info && info.name) || 'Worker', null, 0, 0)
      } catch (e) {
        console.warn('Failed to add modal player', e)
      }

      start = performance.now()
      setProgress(0)

      // arm procedural animation loop
      const arms = playerEntry ? playerEntry.children || (playerEntry.model && playerEntry.model.children) : null
      let t = 0
      const armAnim = () => {
        t += 0.05
        if (playerEntry && playerEntry.children) {
          // attempt to find left and right arm by heuristic
          const leftArm = playerEntry.children.find(c => c.position && c.position.x < 0) || playerEntry.children[2]
          const rightArm = playerEntry.children.find(c => c.position && c.position.x > 0) || playerEntry.children[3]
          if (leftArm) leftArm.rotation.x = Math.sin(t) * 0.8
          if (rightArm) rightArm.rotation.x = -Math.sin(t) * 0.8
          // bob the body
          if (playerEntry.children[1]) playerEntry.children[1].position.y = 10 + Math.sin(t * 0.5) * 0.6
        }
        armAnimRef.current = requestAnimationFrame(armAnim)
      }
      armAnimRef.current = requestAnimationFrame(armAnim)

      // progress updater
      const update = () => {
        const now = performance.now()
        const pct = Math.min(1, (now - start) / duration)
        setProgress(Math.floor(pct * 100))
        if (pct >= 1) return
        animRef.current = requestAnimationFrame(update)
      }
      animRef.current = requestAnimationFrame(update)
    })()

    return () => {
      try {
        if (animRef.current) cancelAnimationFrame(animRef.current)
        if (armAnimRef.current) cancelAnimationFrame(armAnimRef.current)
      } catch (e) {}
      try { world.destroy() } catch (e) {}
      worldRef.current = null
    }
  }, [open, info])

  useEffect(() => {
    if (!open) return
    // auto-close after duration
    const duration = (info && info.duration) || 3000
    const timer = setTimeout(() => {
      onClose()
    }, duration + 300)
    return () => clearTimeout(timer)
  }, [open, info, onClose])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.6)' }} onClick={() => onClose()} />
      <div style={{ width: 640, maxWidth: '95%', height: 360, background: '#0b1220', borderRadius: 12, boxShadow: '0 10px 40px rgba(2,6,23,0.8)', overflow: 'hidden', position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', left: 12, bottom: 12, right: 12 }}>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#34d399,#60a5fa)', transition: 'width 120ms linear' }} />
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: 12 }}>
            <div>{(info && info.name) || 'Working...'}</div>
            <div>{progress}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}

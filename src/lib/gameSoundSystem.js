// Game sound effects system

export class SoundManager {
  constructor() {
    this.sounds = new Map()
    this.muted = false
    this.masterVolume = 0.5
    this.soundVolumes = {
      ui: 0.6,
      work: 0.5,
      reward: 0.7,
      levelup: 0.8,
      property: 0.6,
      achievement: 0.8,
      trading: 0.5
    }
    this.audioContext = null
    this.initAudioContext()
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext) {
        this.audioContext = new AudioContext()
      }
    } catch (e) {
      console.warn('Web Audio API not supported')
    }
  }

  // Generate simple chiptune sounds using Web Audio API
  generateSound(soundType) {
    if (!this.audioContext) return null

    const ctx = this.audioContext
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    const now = ctx.currentTime

    switch (soundType) {
      case 'reward':
        oscillator.frequency.setValueAtTime(800, now)
        oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.1)
        gainNode.gain.setValueAtTime(0.3, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
        oscillator.type = 'sine'
        oscillator.start(now)
        oscillator.stop(now + 0.1)
        break

      case 'levelup':
        const frequencies = [523.25, 659.25, 783.99] // C5, E5, G5
        oscillator.frequency.setValueAtTime(frequencies[0], now)
        oscillator.frequency.setValueAtTime(frequencies[1], now + 0.1)
        oscillator.frequency.setValueAtTime(frequencies[2], now + 0.2)
        gainNode.gain.setValueAtTime(0.4, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
        oscillator.type = 'square'
        oscillator.start(now)
        oscillator.stop(now + 0.3)
        break

      case 'work':
        oscillator.frequency.setValueAtTime(400, now)
        oscillator.frequency.setValueAtTime(350, now + 0.05)
        gainNode.gain.setValueAtTime(0.2, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
        oscillator.type = 'triangle'
        oscillator.start(now)
        oscillator.stop(now + 0.1)
        break

      case 'property':
        oscillator.frequency.setValueAtTime(600, now)
        oscillator.frequency.setValueAtTime(800, now + 0.05)
        oscillator.frequency.setValueAtTime(600, now + 0.1)
        gainNode.gain.setValueAtTime(0.3, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
        oscillator.type = 'sine'
        oscillator.start(now)
        oscillator.stop(now + 0.15)
        break

      case 'click':
        oscillator.frequency.setValueAtTime(800, now)
        gainNode.gain.setValueAtTime(0.15, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
        oscillator.type = 'sine'
        oscillator.start(now)
        oscillator.stop(now + 0.05)
        break

      case 'achievement':
        const achFrequencies = [784, 988, 1175]
        let timeOffset = now
        for (const freq of achFrequencies) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = freq
          osc.type = 'sine'
          gain.gain.setValueAtTime(0.4, timeOffset)
          gain.gain.exponentialRampToValueAtTime(0.01, timeOffset + 0.15)
          osc.start(timeOffset)
          osc.stop(timeOffset + 0.15)
          timeOffset += 0.15
        }
        return gainNode

      case 'trading':
        oscillator.frequency.setValueAtTime(440, now)
        oscillator.frequency.setValueAtTime(550, now + 0.05)
        oscillator.frequency.setValueAtTime(440, now + 0.1)
        gainNode.gain.setValueAtTime(0.25, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12)
        oscillator.type = 'triangle'
        oscillator.start(now)
        oscillator.stop(now + 0.12)
        break

      default:
        oscillator.frequency.setValueAtTime(440, now)
        gainNode.gain.setValueAtTime(0.1, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08)
        oscillator.type = 'sine'
        oscillator.start(now)
        oscillator.stop(now + 0.08)
    }

    return gainNode
  }

  playSound(soundType, volume = null) {
    if (this.muted || !this.audioContext) return

    const vol = volume || (this.soundVolumes[soundType] || 0.5)
    const finalVolume = vol * this.masterVolume

    try {
      this.generateSound(soundType)
    } catch (e) {
      console.warn('Could not play sound:', e)
    }
  }

  setMuted(muted) {
    this.muted = muted
  }

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume))
  }

  setSoundVolume(soundType, volume) {
    if (this.soundVolumes.hasOwnProperty(soundType)) {
      this.soundVolumes[soundType] = Math.max(0, Math.min(1, volume))
    }
  }
}

// Global sound manager instance
export const soundManager = new SoundManager()

// Sound effect shortcuts
export const playSounds = {
  reward: () => soundManager.playSound('reward'),
  levelup: () => soundManager.playSound('levelup'),
  work: () => soundManager.playSound('work'),
  property: () => soundManager.playSound('property'),
  click: () => soundManager.playSound('click'),
  achievement: () => soundManager.playSound('achievement'),
  trading: () => soundManager.playSound('trading')
}

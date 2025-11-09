// Job mini-games for earning rewards
export const JOB_MINIGAMES = {
  // Rapid clicking - Tourist Guide
  rapidClick: {
    id: 'rapidClick',
    name: 'Rapid Click Challenge',
    description: 'Click as fast as possible',
    duration: 5000, // 5 seconds
    difficulty: 'easy',
    generate: () => ({
      targetClicks: 25,
      clicks: 0,
      timeRemaining: 5,
      success: false
    }),
    update: (state, dt) => {
      state.timeRemaining = Math.max(0, state.timeRemaining - dt / 1000)
      return state
    },
    onClick: (state) => {
      if (state.timeRemaining > 0) {
        state.clicks++
      }
      return state
    },
    calculateReward: (state) => {
      const hitRate = state.clicks / state.targetClicks
      const reward = Math.floor(100 * hitRate)
      const xp = Math.floor(25 * hitRate)
      return { money: reward, xp, hitRate: (hitRate * 100).toFixed(0) }
    }
  },

  // Memory matching - Data Annotator
  memoryMatch: {
    id: 'memoryMatch',
    name: 'Memory Matching',
    description: 'Match pairs of cards',
    duration: 8000,
    difficulty: 'medium',
    generate: () => {
      const cards = []
      const pairs = 6
      for (let i = 0; i < pairs; i++) {
        cards.push({ id: i * 2, pair: i, revealed: false, matched: false })
        cards.push({ id: i * 2 + 1, pair: i, revealed: false, matched: false })
      }
      return {
        cards: cards.sort(() => Math.random() - 0.5),
        matches: 0,
        selected: [],
        mistakes: 0,
        timeRemaining: 8
      }
    },
    update: (state, dt) => {
      state.timeRemaining = Math.max(0, state.timeRemaining - dt / 1000)
      return state
    },
    onCardClick: (state, cardId) => {
      if (state.timeRemaining <= 0) return state
      const card = state.cards.find(c => c.id === cardId)
      if (!card || card.matched || card.revealed || state.selected.includes(cardId)) return state

      state.selected.push(cardId)
      card.revealed = true

      if (state.selected.length === 2) {
        const card1 = state.cards.find(c => c.id === state.selected[0])
        const card2 = state.cards.find(c => c.id === state.selected[1])

        if (card1.pair === card2.pair) {
          card1.matched = true
          card2.matched = true
          state.matches++
          state.selected = []
        } else {
          state.mistakes++
          setTimeout(() => {
            card1.revealed = false
            card2.revealed = false
            state.selected = []
          }, 500)
        }
      }
      return state
    },
    calculateReward: (state) => {
      const matchRate = state.matches / 6
      const accuracyBonus = Math.max(0, 100 - state.mistakes * 20)
      const reward = Math.floor(120 * matchRate * (accuracyBonus / 100))
      const xp = Math.floor(30 * matchRate)
      return { money: reward, xp, accuracy: accuracyBonus.toFixed(0) }
    }
  },

  // Fast typing - Content Creator
  fastTyping: {
    id: 'fastTyping',
    name: 'Speed Typing',
    description: 'Type as accurately as possible',
    duration: 10000,
    difficulty: 'hard',
    generate: () => {
      const phrases = [
        'The quick brown fox jumps over the lazy dog',
        'Currency.ph brings community together',
        'Earn, invest, and grow your wealth',
        'Play games and earn real rewards',
        'Democracy in every transaction'
      ]
      return {
        targetPhrase: phrases[Math.floor(Math.random() * phrases.length)],
        userInput: '',
        correctChars: 0,
        timeRemaining: 10,
        wpm: 0
      }
    },
    update: (state, dt) => {
      state.timeRemaining = Math.max(0, state.timeRemaining - dt / 1000)
      state.wpm = Math.floor((state.userInput.length / 5) / ((10 - state.timeRemaining) / 60))
      return state
    },
    onType: (state, char) => {
      if (state.timeRemaining <= 0) return state
      state.userInput += char
      if (char === state.targetPhrase[state.userInput.length - 1]) {
        state.correctChars++
      }
      return state
    },
    calculateReward: (state) => {
      const accuracy = (state.correctChars / state.userInput.length * 100) || 0
      const reward = Math.floor(150 * (accuracy / 100) * (state.wpm / 60))
      const xp = Math.floor(40 * (accuracy / 100))
      return { money: reward, xp, accuracy: accuracy.toFixed(0), wpm: state.wpm }
    }
  },

  // Rhythm clicking - Musician
  rhythmClick: {
    id: 'rhythmClick',
    name: 'Rhythm Master',
    description: 'Click in rhythm with the beat',
    duration: 6000,
    difficulty: 'medium',
    generate: () => {
      const beats = []
      for (let i = 0; i < 8; i++) {
        beats.push({ time: (i + 1) * 0.75, hit: false, accuracy: 0 })
      }
      return {
        beats,
        currentBeat: 0,
        score: 0,
        timeRemaining: 6,
        lastClickTime: 0
      }
    },
    update: (state, dt) => {
      state.timeRemaining = Math.max(0, state.timeRemaining - dt / 1000)
      return state
    },
    onClick: (state, time) => {
      const nextBeat = state.beats[state.currentBeat]
      if (!nextBeat || nextBeat.hit) return state

      const timeDiff = Math.abs(time - nextBeat.time)
      const accuracy = Math.max(0, 100 - timeDiff * 100)

      if (accuracy > 50) {
        nextBeat.hit = true
        nextBeat.accuracy = accuracy
        state.score += Math.floor(accuracy)
        state.currentBeat++
      }
      return state
    },
    calculateReward: (state) => {
      const hitsNeeded = state.beats.length
      const accuracy = (state.currentBeat / hitsNeeded * 100) || 0
      const reward = Math.floor(110 * (accuracy / 100))
      const xp = Math.floor(28 * (accuracy / 100))
      return { money: reward, xp, accuracy: accuracy.toFixed(0), hits: state.currentBeat }
    }
  }
}

export const JOBS = [
  {
    id: 'tourist-guide',
    name: 'Tourist Guide',
    difficulty: 1,
    reward: 90,
    xp: 20,
    duration: 5000,
    minigame: JOB_MINIGAMES.rapidClick,
    description: 'Guide tourists around the city',
    location: 'tourist-spot'
  },
  {
    id: 'data-annotator',
    name: 'Data Annotator',
    difficulty: 2,
    reward: 110,
    xp: 24,
    duration: 8000,
    minigame: JOB_MINIGAMES.memoryMatch,
    description: 'Label and categorize data',
    location: 'tech-center'
  },
  {
    id: 'content-creator',
    name: 'Content Creator',
    difficulty: 3,
    reward: 120,
    xp: 26,
    duration: 10000,
    minigame: JOB_MINIGAMES.fastTyping,
    description: 'Create engaging content',
    location: 'media-studio'
  },
  {
    id: 'musician',
    name: 'Musician',
    difficulty: 2,
    reward: 100,
    xp: 22,
    duration: 6000,
    minigame: JOB_MINIGAMES.rhythmClick,
    description: 'Perform music at venues',
    location: 'venue'
  },
  {
    id: 'translator',
    name: 'Translator',
    difficulty: 2,
    reward: 105,
    xp: 23,
    duration: 8000,
    minigame: JOB_MINIGAMES.memoryMatch,
    description: 'Translate between languages',
    location: 'office'
  },
  {
    id: 'delivery-driver',
    name: 'Delivery Driver',
    difficulty: 1,
    reward: 85,
    xp: 18,
    duration: 5000,
    minigame: JOB_MINIGAMES.rapidClick,
    description: 'Deliver packages quickly',
    location: 'warehouse'
  }
]

export function getJobById(jobId) {
  return JOBS.find(j => j.id === jobId)
}

export function getJobsByDifficulty(maxDifficulty) {
  return JOBS.filter(j => j.difficulty <= maxDifficulty)
}

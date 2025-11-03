import { createContext, useContext, useEffect, useState } from 'react'

const GameThemeContext = createContext(null)

export function GameThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gameTheme')
      if (saved) return saved === 'dark'
    }
    return true
  })

  useEffect(() => {
    try {
      localStorage.setItem('gameTheme', isDark ? 'dark' : 'light')
    } catch {}
  }, [isDark])

  const toggleTheme = () => setIsDark(prev => !prev)

  return (
    <GameThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </GameThemeContext.Provider>
  )
}

export function useGameTheme() {
  try {
    const ctx = useContext(GameThemeContext)
    return ctx || { isDark: true, toggleTheme: () => {} }
  } catch {
    return { isDark: true, toggleTheme: () => {} }
  }
}

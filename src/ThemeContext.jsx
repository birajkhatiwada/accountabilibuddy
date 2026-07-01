import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ dark: true, toggle: () => {}, uiTheme: 'default', setUiTheme: () => {} })

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })
  const [uiTheme, setUiThemeState] = useState(() => localStorage.getItem('uiTheme') || 'default')

  useEffect(() => {
    const isGaming = uiTheme === 'gaming'
    document.documentElement.classList.toggle('dark', dark || isGaming)
    document.documentElement.classList.toggle('gaming', isGaming)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark, uiTheme])

  const setUiTheme = (t) => {
    setUiThemeState(t)
    localStorage.setItem('uiTheme', t)
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d), uiTheme, setUiTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext) ?? { dark: true, toggle: () => {}, uiTheme: 'default', setUiTheme: () => {} }

import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'glob_theme'

const stored = (): Theme | null => {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null } catch { return null }
}
const system = (): Theme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
export const currentTheme = (): Theme => (document.documentElement.dataset.theme as Theme) || stored() || system()

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t
  window.dispatchEvent(new Event('glob-theme'))
}

/** Explicit choice is remembered; until then the OS preference decides. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(currentTheme)
  useEffect(() => {
    const sync = () => setThemeState(currentTheme())
    window.addEventListener('glob-theme', sync)
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onSys = () => { if (!stored()) applyTheme(system()) }
    mq?.addEventListener('change', onSys)
    return () => { window.removeEventListener('glob-theme', sync); mq?.removeEventListener('change', onSys) }
  }, [])
  const setTheme = (t: Theme) => {
    try { localStorage.setItem(KEY, t) } catch { /* private mode */ }
    applyTheme(t)
  }
  return { theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
}

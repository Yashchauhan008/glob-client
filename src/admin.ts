import { useCallback, useSyncExternalStore } from 'react'
import { useIsRoot } from './components/Avatar'

// The admin can flip this off to use Glob exactly like everyone else (and flip it back on for the admin tools).
// It only changes what is shown; the server still decides what the admin is allowed to do.
const KEY = 'glob_admin_mode'
const listeners = new Set<() => void>()
const read = () => { try { return localStorage.getItem(KEY) !== 'off' } catch { return true } }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

export function useAdmin() {
  const isRoot = useIsRoot()
  const on = useSyncExternalStore(subscribe, read, () => true)
  const setOn = useCallback((v: boolean) => {
    try { localStorage.setItem(KEY, v ? 'on' : 'off') } catch { /* private mode: lasts until reload */ }
    listeners.forEach((fn) => fn())
  }, [])
  // `active` is what the screens should use: an admin who has switched the tools off looks like any other member
  return { isRoot, on, setOn, active: isRoot && on }
}

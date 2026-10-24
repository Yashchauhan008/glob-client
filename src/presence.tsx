import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import { API_URL } from './api'
import { useAuth } from './auth'

export type RosterEntry = { user_id: string; name: string; route: string }
type Cursor = { user_id: string; name: string; x: number; y: number; ts: number }

export const CONTENT_ID = 'page-content'
const CURSOR_TTL = 3000

const hue = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h }
export const colorFor = (id: string) => `hsl(${hue(id)} 75% 76%)`
export const colorStrong = (id: string) => `hsl(${hue(id)} 70% 45%)`
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'

const Ctx = createContext<{ roster: RosterEntry[]; cursors: Cursor[]; socket: Socket | null }>({ roster: [], cursors: [], socket: null })
export const usePresence = () => useContext(Ctx)

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const { pathname } = useLocation()
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const pathRef = useRef(pathname)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [cursors, setCursors] = useState<Record<string, Cursor>>({})
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!token) return
    const socket = io(API_URL, { transports: ['websocket'], auth: { token: `Bearer ${token}` } })
    socketRef.current = socket
    setSocket(socket)
    socket.on('connect', () => socket.emit('presence:route', { route: pathRef.current }))
    socket.on('presence:roster', (r: RosterEntry[]) => setRoster(r))
    socket.on('presence:cursor', (c: Omit<Cursor, 'ts'>) =>
      setCursors((prev) => ({ ...prev, [c.user_id]: { ...c, ts: Date.now() } })))
    socket.on('presence:leave', ({ user_id }: { user_id: string }) =>
      setCursors((prev) => { const n = { ...prev }; delete n[user_id]; return n }))
    return () => { socket.disconnect(); socketRef.current = null; setSocket(null); setRoster([]); setCursors({}) }
  }, [token])

  useEffect(() => {
    pathRef.current = pathname
    setCursors({})
    socketRef.current?.emit('presence:route', { route: pathname })
  }, [pathname])

  // send pointer position as 0–1 of the page content, at most every 50ms
  useEffect(() => {
    if (!token) return
    let last = 0
    const onMove = (e: PointerEvent) => {
      const t = Date.now()
      if (t - last < 50) return
      const el = document.getElementById(CONTENT_ID)
      if (!el) return
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      last = t
      socketRef.current?.emit('presence:cursor', { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [token])

  useEffect(() => {
    const i = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setCursors((prev) => {
        const keep = Object.entries(prev).filter(([, c]) => t - c.ts < CURSOR_TTL + 600)
        return keep.length === Object.keys(prev).length ? prev : Object.fromEntries(keep)
      })
    }, 500)
    return () => clearInterval(i)
  }, [])

  const mine = user?.id
  const visible = Object.values(cursors).filter((c) => c.user_id !== mine && now - c.ts < CURSOR_TTL)
  return <Ctx.Provider value={{ roster: roster.filter((r) => r.user_id !== mine), cursors: visible, socket }}>{children}</Ctx.Provider>
}

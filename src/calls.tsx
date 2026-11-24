import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { usePresence } from './presence'
import { useVoice } from './voice'
import { browserPopup } from './messaging'

export type CallPerson = { user_id: string; name: string; avatar_url: string | null; state: 'ringing' | 'joined' | 'declined' | 'missed' | 'left' | 'busy' }
export type CallView = {
  id: string; team_id: string; kind: 'voice' | 'video'; scope: 'dm' | 'group'; initiator_id: string; room: string
  started_at: string; answered_at: string | null; ended_at: string | null; end_reason: string | null
  status: 'ringing' | 'active' | 'ended'; participants: CallPerson[]
}
export type Incoming = { call: CallView; from: { id: string; name: string; avatar_url: string | null } }
type Token = { url: string; token: string; room: string }
export type StartOptions = { scope: 'dm' | 'group'; kind: 'voice' | 'video'; to?: string; user_ids?: string[]; all?: boolean }

type Ctx = {
  calls: CallView[]
  mine: CallView | null
  incoming: Incoming | null
  error: string
  start: (o: StartOptions) => Promise<void>
  answer: () => Promise<void>
  decline: () => Promise<void>
  join: (c: CallView, video?: boolean) => Promise<void>
  hangUp: () => Promise<void>
}
const C = createContext<Ctx | null>(null)
export const useCalls = () => useContext(C)!

/** Who is on the call, who is being rung, how long it has lasted: everything the call UI needs, from the server. */
export function CallsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { socket } = usePresence()
  const voice = useVoice()
  const [calls, setCalls] = useState<CallView[]>([])
  const [incoming, setIncoming] = useState<Incoming | null>(null)
  const [mineId, setMineId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const mineRef = useRef<string | null>(null)
  mineRef.current = mineId
  const voiceRef = useRef(voice)
  voiceRef.current = voice
  const wasConnected = useRef(false)

  const fromOf = useCallback((c: CallView) => {
    const p = c.participants.find((x) => x.user_id === c.initiator_id)
    return { id: c.initiator_id, name: p?.name ?? 'Someone', avatar_url: p?.avatar_url ?? null }
  }, [])

  const load = useCallback(() => {
    api.get<{ items: CallView[] }>('/calls/active').then((r) => {
      setCalls(r.items)
      // a call that is ringing for me, whose live message I missed (the page was closed or reloading)
      const ringing = r.items.find((c) => c.status === 'ringing' && c.participants.some((p) => p.user_id === user?.id && p.state === 'ringing'))
      if (ringing && !mineRef.current) setIncoming((cur) => cur ?? { call: ringing, from: fromOf(ringing) })
    }).catch(() => {})
  }, [user?.id, fromOf])

  useEffect(() => {
    load()
    const i = setInterval(() => { if (!document.hidden) load() }, 15000)
    return () => clearInterval(i)
  }, [load])

  useEffect(() => {
    if (!socket) return
    const onIncoming = (p: Incoming) => {
      if (mineRef.current) return // already on a call: the server marks us busy
      setIncoming(p)
      if (document.hidden) browserPopup(p.from.name, `Incoming ${p.call.kind} call`, `glob-call-${p.call.id}`)
    }
    const onHandled = (p: { call_id: string }) => setIncoming((cur) => (cur?.call.id === p.call_id ? null : cur))
    const onState = (v: CallView) => {
      setCalls((cur) => (v.status === 'ended' ? cur.filter((c) => c.id !== v.id) : [...cur.filter((c) => c.id !== v.id), v]))
      if (v.status === 'ended') {
        setIncoming((cur) => (cur?.call.id === v.id ? null : cur))
        if (mineRef.current === v.id) { voiceRef.current.leave(); setMineId(null) }
      }
    }
    socket.on('call:incoming', onIncoming)
    socket.on('call:handled', onHandled)
    socket.on('call:state', onState)
    return () => { socket.off('call:incoming', onIncoming); socket.off('call:handled', onHandled); socket.off('call:state', onState) }
  }, [socket])

  // the connection dropped without anyone pressing hang up: tell the server
  useEffect(() => {
    if (voice.status === 'connected') wasConnected.current = true
    if (voice.status === 'idle' && wasConnected.current) {
      wasConnected.current = false
      const id = mineRef.current
      if (id) { setMineId(null); api.post(`/calls/${id}/leave`).catch(() => {}) }
    }
  }, [voice.status])

  const enter = useCallback(async (c: CallView, token: Token, video: boolean) => {
    setMineId(c.id)
    await voiceRef.current.joinWith({ url: token.url, token: token.token }, video)
  }, [])

  const start = useCallback(async (o: StartOptions) => {
    setError('')
    try {
      const r = await api.post<{ call: CallView; token: Token }>('/calls', o)
      await enter(r.call, r.token, o.kind === 'video')
    } catch (e) { setError((e as Error).message) }
  }, [enter])

  const answer = useCallback(async () => {
    const inc = incoming
    if (!inc) return
    setIncoming(null); setError('')
    try {
      const r = await api.post<{ call: CallView; token: Token }>(`/calls/${inc.call.id}/accept`)
      await enter(r.call, r.token, inc.call.kind === 'video')
    } catch (e) { setError((e as Error).message) }
  }, [incoming, enter])

  const decline = useCallback(async () => {
    const inc = incoming
    if (!inc) return
    setIncoming(null)
    await api.post(`/calls/${inc.call.id}/decline`).catch(() => {})
  }, [incoming])

  const join = useCallback(async (c: CallView, video = c.kind === 'video') => {
    setError('')
    try {
      const r = await api.post<{ call: CallView; token: Token }>(`/calls/${c.id}/join`)
      await enter(r.call, r.token, video)
    } catch (e) { setError((e as Error).message) }
  }, [enter])

  const hangUp = useCallback(async () => {
    const id = mineRef.current
    voiceRef.current.leave()
    setMineId(null)
    if (id) await api.post(`/calls/${id}/leave`).catch(() => {})
  }, [])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 6000)
    return () => clearTimeout(t)
  }, [error])

  const mine = calls.find((c) => c.id === mineId) ?? null
  const value = useMemo<Ctx>(() => ({ calls, mine, incoming, error, start, answer, decline, join, hangUp }), [calls, mine, incoming, error, start, answer, decline, join, hangUp])
  return <C.Provider value={value}>{children}</C.Provider>
}

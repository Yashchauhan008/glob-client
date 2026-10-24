import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Maximize2, Minimize2, Send } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { colorFor, initials, usePresence } from '../presence'

type Msg = { id: string; user_id: string; name: string; body: string; created_at: string }

const Dots = () => <span className="dots" aria-hidden><b /><b /><b /></span>

export default function ChatBox({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { user } = useAuth()
  const { socket, roster } = usePresence()
  const history = useQuery({ queryKey: ['chat'], queryFn: () => api.get<{ items: Msg[] }>('/chat'), staleTime: Infinity })
  const [big, setBig] = useState(false)
  const [live, setLive] = useState<Msg[]>([])
  const [unread, setUnread] = useState(0)
  const [typing, setTyping] = useState<Record<string, { name: string; until: number }>>({})
  const lastSent = useRef(0)
  const openRef = useRef(open)
  const endRef = useRef<HTMLDivElement>(null)
  openRef.current = open

  useEffect(() => {
    if (!socket) return
    const on = (m: Msg) => {
      setLive((p) => [...p, m])
      setTyping((t) => { const { [m.user_id]: _gone, ...rest } = t; return rest })
      if (!openRef.current && m.user_id !== user?.id) setUnread((n) => n + 1)
    }
    const onTyping = (p: { user_id: string; name: string }) => setTyping((t) => ({ ...t, [p.user_id]: { name: p.name, until: Date.now() + 3000 } }))
    socket.on('chat:message', on)
    socket.on('chat:typing', onTyping)
    return () => { socket.off('chat:message', on); socket.off('chat:typing', onTyping) }
  }, [socket, user?.id])

  // drop people who stopped typing
  useEffect(() => {
    if (!Object.keys(typing).length) return
    const t = setInterval(() => setTyping((cur) => {
      const now = Date.now()
      const next = Object.fromEntries(Object.entries(cur).filter(([, v]) => v.until > now))
      return Object.keys(next).length === Object.keys(cur).length ? cur : next
    }), 500)
    return () => clearInterval(t)
  }, [typing])
  const typers = Object.values(typing).map((v) => v.name)
  const typingText = typers.length === 1 ? `${typers[0]} is typing` : typers.length === 2 ? `${typers[0]} and ${typers[1]} are typing` : typers.length ? 'Several people are typing' : ''
  const notifyTyping = () => {
    const now = Date.now()
    if (now - lastSent.current > 1500) { lastSent.current = now; socket?.emit('chat:typing') }
  }

  const all = [...(history.data?.items ?? []), ...live].filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i)
  useEffect(() => { if (open) { setUnread(0); endRef.current?.scrollIntoView() } }, [open, all.length, typers.length])

  const online = [...new Map(roster.map((r) => [r.user_id, r])).values()]
  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = e.currentTarget
    const body = String(new FormData(f).get('body') || '').trim()
    if (body) { socket?.emit('chat:send', { body }); lastSent.current = 0 }
    f.reset()
  }

  if (!open)
    return (
      <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Team chat">
        <span className="fab-icon"><Send size={20} strokeWidth={2} />{unread > 0 && <b className="badge">{unread > 9 ? '9+' : unread}</b>}</span>
        <span className="fab-label">{typers.length ? <span className="fab-typing">{typers[0]}<Dots /></span> : 'Messages'}</span>
        <span className="avatars">{online.slice(0, 3).map((o) => <i key={o.user_id} style={{ background: colorFor(o.user_id) }}>{initials(o.name)}</i>)}</span>
      </button>
    )
  return (
    <div className={'chat' + (big ? ' big' : '')}>
      <div className="chat-head">
        <div><b>Team chat</b><small>{online.length + 1} online · {[user?.name, ...online.map((o) => o.name)].join(', ')}</small></div>
        <div className="chat-btns">
          <button onClick={() => setBig((v) => !v)} aria-label={big ? 'Restore size' : 'Maximise'} title={big ? 'Restore size' : 'Maximise'}>{big ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
          <button onClick={() => { setOpen(false); setBig(false) }} aria-label="Minimise" title="Minimise"><ChevronDown size={18} /></button>
        </div>
      </div>
      <div className="chat-msgs">
        {!all.length && <p className="muted">Say hi 👋 — everyone online sees this.</p>}
        {all.map((m) => (
          <div key={m.id} className={'msg' + (m.user_id === user?.id ? ' mine' : '')}>
            {m.user_id !== user?.id && <i style={{ background: colorFor(m.user_id) }}>{initials(m.name)}</i>}
            <div><small>{m.user_id === user?.id ? 'You' : m.name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small><p>{m.body}</p></div>
          </div>
        ))}
        {typers.length > 0 && (
          <div className="msg typing" aria-live="polite">
            <i style={{ background: colorFor(Object.keys(typing)[0]) }}>{initials(typers[0])}</i>
            <div><small>{typingText}…</small><p><Dots /></p></div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={send}>
        <input name="body" placeholder="Message everyone…" autoComplete="off" autoFocus onChange={notifyTyping} />
        <button aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  )
}

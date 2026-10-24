import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, MessageCircle, Send } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { colorFor, initials, usePresence } from '../presence'

type Msg = { id: string; user_id: string; name: string; body: string; created_at: string }

export default function ChatBox({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { user } = useAuth()
  const { socket, roster } = usePresence()
  const history = useQuery({ queryKey: ['chat'], queryFn: () => api.get<{ items: Msg[] }>('/chat'), staleTime: Infinity })
  const [live, setLive] = useState<Msg[]>([])
  const [unread, setUnread] = useState(0)
  const openRef = useRef(open)
  const endRef = useRef<HTMLDivElement>(null)
  openRef.current = open

  useEffect(() => {
    if (!socket) return
    const on = (m: Msg) => {
      setLive((p) => [...p, m])
      if (!openRef.current && m.user_id !== user?.id) setUnread((n) => n + 1)
    }
    socket.on('chat:message', on)
    return () => { socket.off('chat:message', on) }
  }, [socket, user?.id])

  const all = [...(history.data?.items ?? []), ...live].filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i)
  useEffect(() => { if (open) { setUnread(0); endRef.current?.scrollIntoView() } }, [open, all.length])

  const online = [...new Map(roster.map((r) => [r.user_id, r])).values()]
  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = e.currentTarget
    const body = String(new FormData(f).get('body') || '').trim()
    if (body) socket?.emit('chat:send', { body })
    f.reset()
  }

  if (!open)
    return (
      <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Team chat">
        <span className="fab-icon"><Send size={20} strokeWidth={2} />{unread > 0 && <b className="badge">{unread > 9 ? '9+' : unread}</b>}</span>
        <span className="fab-label">Messages</span>
        <span className="avatars">{online.slice(0, 3).map((o) => <i key={o.user_id} style={{ background: colorFor(o.user_id) }}>{initials(o.name)}</i>)}</span>
      </button>
    )
  return (
    <div className="chat">
      <div className="chat-head">
        <div><b>Team chat</b><small>{online.length + 1} online · {[user?.name, ...online.map((o) => o.name)].join(', ')}</small></div>
        <button onClick={() => setOpen(false)} aria-label="Minimise"><ChevronDown size={18} /></button>
      </div>
      <div className="chat-msgs">
        {!all.length && <p className="muted">Say hi 👋 — everyone online sees this.</p>}
        {all.map((m) => (
          <div key={m.id} className={'msg' + (m.user_id === user?.id ? ' mine' : '')}>
            {m.user_id !== user?.id && <i style={{ background: colorFor(m.user_id) }}>{initials(m.name)}</i>}
            <div><small>{m.user_id === user?.id ? 'You' : m.name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small><p>{m.body}</p></div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={send}>
        <input name="body" placeholder="Message everyone…" autoComplete="off" autoFocus />
        <button aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  )
}

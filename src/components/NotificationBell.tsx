import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellRing, CheckCheck, MessageCircle, HelpCircle, Trash2, Users } from 'lucide-react'
import { api, getTeamId, setTeamId } from '../api'
import { usePresence } from '../presence'
import { browserPopup } from '../messaging'

type Notice = {
  id: string; team_id: string | null; team_name: string | null; type: 'dm' | 'chat' | 'answer' | 'call' | 'general'
  label: string; title: string; body: string; data: { from_id?: string; team_id?: string; question_id?: string; count?: number }
  created_at: string; read_at: string | null
}

const ago = (d: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000))
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}
const iconOf = (t: Notice['type']) => (t === 'dm' || t === 'call' ? <MessageCircle size={16} /> : t === 'chat' ? <Users size={16} /> : <HelpCircle size={16} />)
const targetOf = (n: Notice) =>
  (n.type === 'dm' || n.type === 'call') && n.data.from_id ? `/messages/${n.data.from_id}` : n.type === 'chat' ? '/messages/workspace' : n.type === 'answer' ? '/qa' : '/home'

/** The bell in the top bar: everything that needs your attention, with a label saying where it came from. */
export default function NotificationBell() {
  const { socket } = usePresence()
  const qc = useQueryClient()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ items: Notice[]; unread: number }>('/notifications'), refetchInterval: 60000 })

  useEffect(() => {
    if (!socket) return
    const on = (n: Notice) => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      // no pop-up for something you are already looking at
      const here = n.team_id === getTeamId() && !document.hidden && pathRef.current === targetOf(n)
      if (!here) browserPopup(`${n.label}`, `${n.title}: ${n.body}`, `glob-n-${n.id}`, () => go(n))
    }
    socket.on('notification', on)
    return () => { socket.off('notification', on) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] })
  const go = (n: Notice) => {
    api.post('/notifications/read', { ids: [n.id] }).then(refresh).catch(() => {})
    setOpen(false)
    if (n.team_id && n.team_id !== getTeamId()) {
      setTeamId(n.team_id)
      window.location.assign(targetOf(n)) // another workspace: reload into it
    } else nav(targetOf(n))
  }
  const unread = q.data?.unread ?? 0
  const items = q.data?.items ?? []

  return (
    <div className="bell-wrap" ref={box}>
      <button className="theme-btn bell" onClick={() => setOpen((v) => !v)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} title="Notifications">
        {unread ? <BellRing size={18} /> : <Bell size={18} />}
        {unread > 0 && <b className="bell-badge">{unread > 9 ? '9+' : unread}</b>}
      </button>
      {open && (
        <div className="bell-panel">
          <div className="bell-head">
            <b>Notifications</b>
            <span>
              <button onClick={() => api.post('/notifications/read', {}).then(refresh)} title="Mark all as read"><CheckCheck size={15} /></button>
              <button onClick={() => { if (window.confirm('Clear all notifications?\n\nThis cannot be undone.')) api.del('/notifications').then(refresh) }} title="Clear all"><Trash2 size={15} /></button>
            </span>
          </div>
          {!items.length && <p className="muted bell-empty">You are all caught up.</p>}
          {items.map((n) => (
            <button key={n.id} className={'bell-item' + (n.read_at ? '' : ' unread')} onClick={() => go(n)}>
              <i className={'bell-ico ' + n.type}>{iconOf(n.type)}</i>
              <span>
                <small className="bell-label">{n.label}</small>
                <b>{n.title}{(n.data.count ?? 1) > 1 && <em> · {n.data.count} new</em>}</b>
                <span className="bell-body">{n.body}</span>
              </span>
              <time>{ago(n.created_at)}</time>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

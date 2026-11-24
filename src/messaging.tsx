import { AlertCircle, Check, CheckCheck, Clock, Download, FileText, PhoneMissed, Phone, Video } from 'lucide-react'
import { API_URL, authHeaders, ApiError } from './api'
import { colorFor, initials } from './presence'

export type MsgKind = 'text' | 'image' | 'video' | 'audio' | 'file' | 'call'
export type MsgStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

export type ChatMsg = {
  id: string
  client_id?: string | null
  user_id: string
  name: string
  avatar_url?: string | null
  body: string
  kind: MsgKind
  file_url?: string | null
  file_name?: string | null
  mime?: string | null
  duration_ms?: number | null
  created_at: string
  status?: MsgStatus
  to?: string
}

export type Person = { id: string; name: string; email?: string; avatar_url?: string | null }
export type LastMsg = { id: string; body: string; kind: MsgKind; file_name?: string | null; duration_ms?: number | null; created_at: string; sender_id?: string; user_id?: string; name?: string; status?: MsgStatus }
export type Inbox = {
  team: { id: string; name: string }
  workspace: { last_message: LastMsg | null; unread: number; members: number }
  dms: { user: Person; last_message: LastMsg; unread: number }[]
  members: Person[]
}

/** A personal message from the server, in the same shape as a workspace one. */
export const fromDm = (m: any): ChatMsg => ({
  id: m.id, client_id: m.client_id, user_id: m.sender_id, name: m.sender_name, avatar_url: m.sender_avatar,
  body: m.body, kind: m.kind, file_url: m.file_url, file_name: m.file_name, mime: m.mime, duration_ms: m.duration_ms,
  created_at: m.created_at, status: m.status, to: m.recipient_id,
})

export const clock = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
export const dayLabel = (d: string) => {
  const t = new Date(d), n = new Date()
  const days = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 864e5)
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : t.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
}
export const mmss = (ms?: number | null) => {
  const s = Math.round((ms ?? 0) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "missed:voice", "ended:video:125", "declined:voice", "group:video:300:4" -> a short sentence (same as the server). */
export function callText(body: string) {
  const [what, kind, a, b] = body.split(':')
  const word = kind === 'video' ? 'video' : 'voice'
  const dur = (sec?: string) => { const n = Number(sec ?? 0); return n > 0 ? ` · ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : '' }
  if (what === 'missed') return `Missed ${word} call`
  if (what === 'declined') return `${word[0]!.toUpperCase()}${word.slice(1)} call declined`
  if (what === 'group') return `Group ${word} call${dur(a)}${b ? ` · ${b} joined` : ''}`
  return `${word[0]!.toUpperCase()}${word.slice(1)} call${dur(a)}`
}

/** What a chat row shows as its last line. */
export function previewOf(m: Pick<LastMsg, 'kind' | 'body' | 'file_name' | 'duration_ms'> | null | undefined) {
  if (!m) return ''
  if (m.kind === 'call') return `📞 ${callText(m.body)}`
  if (m.kind === 'image') return '📷 Photo'
  if (m.kind === 'video') return '🎥 Video'
  if (m.kind === 'audio') return `🎤 Voice message ${mmss(m.duration_ms)}`
  if (m.kind === 'file') return `📎 ${m.file_name || 'Document'}`
  return m.body
}

export const newClientId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 60)

export type Uploaded = { file_id: string; url: string; name: string; mime: string; kind: MsgKind; size: number }

/** Pictures, voice notes, videos and documents all go through one upload. */
export async function uploadChatFile(file: Blob, name: string): Promise<Uploaded> {
  const body = new FormData()
  body.append('file', file, name)
  const res = await fetch(`${API_URL}/chat/upload`, { method: 'POST', body, headers: authHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data?.message || 'Upload failed', res.status)
  return data
}

export function Pic({ id, name, url, size = 36 }: { id: string; name: string; url?: string | null; size?: number }) {
  return (
    <i className="pic" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: colorFor(id) }}>
      {url ? <img src={url} alt="" draggable={false} /> : initials(name)}
    </i>
  )
}

/** WhatsApp-style delivery marks: clock, one tick, two grey ticks, two blue ticks, or a red failure mark. */
export function Ticks({ status, onRetry }: { status?: MsgStatus; onRetry?: () => void }) {
  if (!status) return null
  if (status === 'failed')
    return <button type="button" className="tick failed" onClick={onRetry} title="Not sent. Tap to try again"><AlertCircle size={14} /> Retry</button>
  if (status === 'sending') return <span className="tick" title="Sending"><Clock size={13} /></span>
  if (status === 'sent') return <span className="tick" title="Sent"><Check size={15} /></span>
  if (status === 'delivered') return <span className="tick" title="Delivered"><CheckCheck size={15} /></span>
  return <span className="tick read" title="Read"><CheckCheck size={15} /></span>
}

/** The inside of a bubble: text, a picture, a video, a voice note or a document. */
export function MessageBody({ m }: { m: ChatMsg }) {
  if (m.kind === 'call') {
    const missed = m.body.startsWith('missed') || m.body.startsWith('declined')
    return <span className={'m-call' + (missed ? ' missed' : '')}>{missed ? <PhoneMissed size={16} /> : m.body.includes(':video') ? <Video size={16} /> : <Phone size={16} />}{callText(m.body)}</span>
  }
  const url = m.file_url || ''
  if (m.kind === 'image' && url)
    return (
      <>
        <a href={url} target="_blank" rel="noreferrer" className="m-img"><img src={url} alt={m.file_name || 'Picture'} loading="lazy" /></a>
        {m.body && <span className="m-text">{m.body}</span>}
      </>
    )
  if (m.kind === 'video' && url)
    return <>{/* eslint-disable-next-line jsx-a11y/media-has-caption */}<video className="m-video" src={url} controls preload="metadata" />{m.body && <span className="m-text">{m.body}</span>}</>
  if (m.kind === 'audio' && url)
    return <span className="m-voice"><audio src={url} controls preload="metadata" /><small>{mmss(m.duration_ms)}</small></span>
  if (m.kind === 'file' && url)
    return (
      <a className="m-file" href={url} target="_blank" rel="noreferrer" download={m.file_name || undefined}>
        <FileText size={20} /><span><b>{m.file_name || 'Document'}</b><small>Tap to open</small></span><Download size={16} />
      </a>
    )
  return <span className="m-text">{m.body}</span>
}

/** Browser pop-up for when the tab is in the background. */
export function browserPopup(title: string, body: string, tag: string, onClick?: () => void) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body, icon: '/favicon-32.png', tag })
    n.onclick = () => { window.focus(); onClick?.(); n.close() }
  } catch { /* blocked */ }
}

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CornerUpLeft, Mic, Paperclip, Phone, Plus, Search, Send, Smile, Trash2, Users, Video, X } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { usePresence } from '../presence'
import { useCalls } from '../calls'
import { Modal } from '../components/ui'
import {
  MessageBody, Pic, ReactBar, ReactionChips, ReplyQuote, Ticks, clock, dayLabel, fromDm, mmss, newClientId, previewOf, uploadChatFile,
  type ChatMsg, type Inbox, type MsgKind, type Person, type Reaction,
} from '../messaging'

type Payload = { body?: string; kind: MsgKind; file_url?: string; file_name?: string; mime?: string; duration_ms?: number; client_id: string; reply_to_id?: string }
type Page = { items: any[]; has_more: boolean }

const when = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function Messages() {
  const { id } = useParams()
  const nav = useNavigate()
  const { socket, roster } = usePresence()
  const qc = useQueryClient()
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: () => api.get<Inbox>('/chat/inbox') })
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState('')
  const online = useMemo(() => new Set(roster.map((r) => r.user_id)), [roster])

  // a new personal message, a read receipt or a new workspace message changes the list
  useEffect(() => {
    if (!socket) return
    const refresh = () => { qc.invalidateQueries({ queryKey: ['inbox'] }); qc.invalidateQueries({ queryKey: ['alerts'] }) }
    socket.on('dm:message', refresh)
    socket.on('chat:message', refresh)
    socket.on('dm:status', refresh)
    return () => { socket.off('dm:message', refresh); socket.off('chat:message', refresh); socket.off('dm:status', refresh) }
  }, [socket, qc])

  const data = inbox.data
  const peer: Person | undefined = id && id !== 'workspace' ? data?.members.find((m) => m.id === id) : undefined
  const active = id === 'workspace' || !!peer
  const q = search.trim().toLowerCase()
  const dms = (data?.dms ?? []).filter((d) => !q || d.user.name.toLowerCase().includes(q))
  const others = (data?.members ?? []).filter((m) => !q || m.name.toLowerCase().includes(q))

  return (
    <div className={'msgr' + (active ? ' has-conv' : '')}>
      <aside className="msgr-list">
        <div className="msgr-top">
          <div><h1>Messages</h1><small className="muted">{data?.team.name ?? ''}</small></div>
          <button className="msgr-new" onClick={() => setPicking((v) => !v)} aria-label="New message" title="New message">{picking ? <X size={20} /> : <Plus size={20} />}</button>
        </div>
        <label className="msgr-search"><Search size={15} /><input placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} /></label>

        {data && (
          <div className="msgr-strip">
            {data.members.slice(0, 14).map((m) => (
              <Link key={m.id} to={`/messages/${m.id}`} className={'strip-item' + (online.has(m.id) ? ' on' : '')} title={m.name}>
                <Pic id={m.id} name={m.name} url={m.avatar_url} size={50} /><span>{m.name.split(' ')[0]}</span>
              </Link>
            ))}
          </div>
        )}

        {picking && (
          <div className="msgr-pick">
            <small>Start a conversation</small>
            {others.map((m) => (
              <button key={m.id} onClick={() => { setPicking(false); nav(`/messages/${m.id}`) }}><Pic id={m.id} name={m.name} url={m.avatar_url} size={34} />{m.name}</button>
            ))}
            {!others.length && <p className="muted">Nobody matches.</p>}
          </div>
        )}

        <div className="msgr-rows">
          <Link to="/messages/workspace" className={'msgr-row' + (id === 'workspace' ? ' sel' : '')}>
            <i className="pic ws"><Users size={20} /></i>
            <span className="msgr-text">
              <b>{data?.team.name ?? 'Workspace'} · everyone</b>
              <small>{data?.workspace.last_message ? `${data.workspace.last_message.name}: ${previewOf(data.workspace.last_message)}` : `${data?.workspace.members ?? ''} members`}</small>
            </span>
            <span className="msgr-meta"><time>{when(data?.workspace.last_message?.created_at)}</time>{!!data?.workspace.unread && <b className="unread">{data.workspace.unread}</b>}</span>
          </Link>
          {dms.map((d) => (
            <Link key={d.user.id} to={`/messages/${d.user.id}`} className={'msgr-row' + (id === d.user.id ? ' sel' : '')}>
              <span className={'msgr-pic' + (online.has(d.user.id) ? ' on' : '')}><Pic id={d.user.id} name={d.user.name} url={d.user.avatar_url} size={46} /></span>
              <span className="msgr-text"><b>{d.user.name}</b><small>{d.last_message.sender_id !== d.user.id ? 'You: ' : ''}{previewOf(d.last_message)}</small></span>
              <span className="msgr-meta"><time>{when(d.last_message.created_at)}</time>{d.unread > 0 && <b className="unread">{d.unread}</b>}</span>
            </Link>
          ))}
          {!dms.length && !inbox.isLoading && <p className="muted msgr-hint">No personal chats yet. Tap + or pick someone above.</p>}
        </div>
      </aside>

      <section className="msgr-conv">
        {active && data
          ? <Conversation key={id} peer={peer} workspaceName={data.team.name} onBack={() => nav('/messages')} />
          : <div className="msgr-empty"><Users size={34} /><h3>Pick a conversation</h3><p className="muted">The workspace chat is for everyone. Tap a person for a private chat. You can send pictures, videos, voice notes and documents.</p></div>}
      </section>
    </div>
  )
}

function GroupCallPicker({ members, onClose, onStart }: { members: Person[]; onClose: () => void; onStart: (kind: 'voice' | 'video', ids: string[], all: boolean) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const everyone = members.length > 0 && sel.size === members.length
  const toggle = (id: string) => setSel((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return (
    <Modal title="Start a group call" onClose={onClose}>
      <p className="muted">Choose who to ring. Anyone else in the workspace can still join from the call banner.</p>
      <label className="pick-row"><input type="checkbox" checked={everyone} onChange={() => setSel(everyone ? new Set() : new Set(members.map((m) => m.id)))} /><b>Select everyone</b></label>
      <div className="pick-list">
        {members.map((m) => (
          <label key={m.id} className="pick-row"><input type="checkbox" checked={sel.has(m.id)} onChange={() => toggle(m.id)} /><Pic id={m.id} name={m.name} url={m.avatar_url} size={30} />{m.name}</label>
        ))}
      </div>
      <div className="pick-actions">
        <button className="btn ghost" onClick={() => onStart('voice', [...sel], everyone)}><Phone size={16} /> Voice call{sel.size ? ` · ${sel.size}` : ''}</button>
        <button className="btn" onClick={() => onStart('video', [...sel], everyone)}><Video size={16} /> Video call{sel.size ? ` · ${sel.size}` : ''}</button>
      </div>
    </Modal>
  )
}

function Conversation({ peer, workspaceName, onBack }: { peer?: Person; workspaceName: string; onBack: () => void }) {
  const { user } = useAuth()
  const { socket, roster } = usePresence()
  const qc = useQueryClient()
  const dm = !!peer
  const path = dm ? `/chat/dm/${peer!.id}` : '/chat'
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [more, setMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [typing, setTyping] = useState(false)
  const [sendingFile, setSendingFile] = useState(false)
  const [err, setErr] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null)
  const [barFor, setBarFor] = useState<string | null>(null) // the message whose emoji bar is open
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const pending = useRef(new Map<string, Payload>()) // what to resend for a failed message
  const replySnap = useRef(new Map<string, NonNullable<ChatMsg['reply']>>()) // the quote shown on a message that is still sending
  const lastTyping = useRef(0)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const online = !!peer && roster.some((r) => r.user_id === peer.id)
  const calls = useCalls()
  const [picker, setPicker] = useState(false)
  const inboxQ = useQuery({ queryKey: ['inbox'], queryFn: () => api.get<Inbox>('/chat/inbox') })
  const busy = !!calls.mine
  const groupCall = calls.calls.find((c) => c.scope === 'group' && !c.ended_at && c.id !== calls.mine?.id)

  const norm = useCallback((m: any): ChatMsg => (dm ? fromDm(m) : { ...m, status: m.user_id === user?.id ? 'sent' : undefined }), [dm, user?.id])

  // history
  useEffect(() => {
    let off = false
    api.get<Page>(`${path}?limit=40`).then((r) => {
      if (off) return
      setMsgs(r.items.map(norm)); setMore(r.has_more); setLoaded(true)
    }).catch((e) => { setErr((e as Error).message); setLoaded(true) })
    return () => { off = true }
  }, [path, norm])

  const markRead = useCallback(() => {
    if (document.hidden) return
    if (dm) socket?.emit('dm:read', { with: peer!.id })
    else socket?.emit('chat:read')
    setTimeout(() => { qc.invalidateQueries({ queryKey: ['inbox'] }); qc.invalidateQueries({ queryKey: ['alerts'] }); qc.invalidateQueries({ queryKey: ['notifications'] }) }, 500)
  }, [dm, peer, socket, qc])

  // live updates
  useEffect(() => {
    if (!socket) return
    const merge = (m: ChatMsg) => setMsgs((cur) => {
      const i = cur.findIndex((x) => x.id === m.id || (m.client_id && x.client_id === m.client_id))
      if (i >= 0) { const next = cur.slice(); next[i] = { ...cur[i], ...m }; return next }
      return [...cur, m]
    })
    const onDm = (raw: any) => {
      if (!dm) return
      const m = fromDm(raw)
      if (m.user_id !== peer!.id && m.to !== peer!.id) return
      merge(m)
      if (m.user_id === peer!.id) { setTyping(false); markRead() }
    }
    const onChat = (m: ChatMsg) => {
      if (dm) return
      merge({ ...m, status: m.user_id === user?.id ? 'sent' : undefined })
      if (m.user_id !== user?.id) { setTyping(false); markRead() }
    }
    const onStatus = (p: { ids: string[]; status: 'delivered' | 'read' }) =>
      setMsgs((cur) => cur.map((m) => (p.ids.includes(m.id) && !(m.status === 'read') ? { ...m, status: p.status } : m)))
    const onTyping = (p: { from?: string; user_id?: string }) => {
      if ((dm && p.from !== peer!.id) || (!dm && p.user_id === user?.id)) return
      setTyping(true); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => setTyping(false), 3000)
    }
    const onReaction = (p: { id: string; reactions: Reaction[] }) =>
      setMsgs((cur) => cur.map((m) => (m.id === p.id ? { ...m, reactions: p.reactions } : m)))
    socket.on('dm:message', onDm); socket.on('chat:message', onChat); socket.on('dm:status', onStatus); socket.on('message:reaction', onReaction)
    socket.on(dm ? 'dm:typing' : 'chat:typing', onTyping)
    return () => {
      socket.off('dm:message', onDm); socket.off('chat:message', onChat); socket.off('dm:status', onStatus); socket.off('message:reaction', onReaction)
      socket.off(dm ? 'dm:typing' : 'chat:typing', onTyping)
    }
  }, [socket, dm, peer, user?.id, markRead])

  useEffect(() => { if (loaded) markRead() }, [loaded, markRead])
  useEffect(() => { window.addEventListener('focus', markRead); return () => window.removeEventListener('focus', markRead) }, [markRead])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, typing])

  const patch = (cid: string, change: Partial<ChatMsg>) => setMsgs((cur) => cur.map((m) => (m.client_id === cid ? { ...m, ...change } : m)))

  /** Show the message at once, then send it. The server's answer is the "sent" tick; no answer is a failure. */
  const deliver = useCallback((p: Payload, preShown = false) => {
    pending.current.set(p.client_id, p)
    if (!preShown)
      setMsgs((cur) => [...cur, {
        id: `local-${p.client_id}`, client_id: p.client_id, user_id: user!.id, name: user!.name, avatar_url: user!.avatar_url,
        body: p.body ?? '', kind: p.kind, file_url: p.file_url, file_name: p.file_name, mime: p.mime, duration_ms: p.duration_ms,
        created_at: new Date().toISOString(), status: 'sending',
        reply_to_id: p.reply_to_id ?? null, reply: p.reply_to_id ? replySnap.current.get(p.client_id) ?? null : null, reactions: [],
      }])
    else patch(p.client_id, { status: 'sending' })
    const ok = (m: any) => { pending.current.delete(p.client_id); patch(p.client_id, { ...norm(m), status: dm ? (m.status ?? 'sent') : 'sent' }) }
    const fail = () => patch(p.client_id, { status: 'failed' })
    const body = dm ? { ...p, to: peer!.id } : p
    if (socket?.connected) {
      socket.timeout(10000).emit(dm ? 'dm:send' : 'chat:send', body, (e: Error | null, r?: { ok: boolean; message?: any }) => {
        if (e || !r?.ok || !r.message) return fail()
        ok(r.message)
      })
    } else {
      api.post<any>(path, p).then(ok).catch(fail) // no live connection: send it the ordinary way
    }
  }, [socket, dm, peer, path, user, norm])

  const retry = (m: ChatMsg) => { const p = m.client_id ? pending.current.get(m.client_id) : null; if (p) deliver(p, true) }

  const sendText = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = e.currentTarget
    const body = String(new FormData(f).get('body') || '').trim()
    if (!body) return
    const cid = newClientId(); snap(cid)
    deliver({ body, kind: 'text', client_id: cid, ...replyFields() })
    f.reset(); lastTyping.current = 0; setReplyTo(null)
  }
  /** The reply the person is writing, for the next message they send (a picture or a voice note too). */
  const replyFields = () => {
    if (!replyTo || replyTo.id.startsWith('local-')) return {}
    return { reply_to_id: replyTo.id }
  }
  const snap = (cid: string) => {
    if (replyTo && !replyTo.id.startsWith('local-')) replySnap.current.set(cid, { id: replyTo.id, user_id: replyTo.user_id, name: replyTo.name, body: replyTo.body, kind: replyTo.kind, file_name: replyTo.file_name, duration_ms: replyTo.duration_ms })
  }
  const startReply = (m: ChatMsg) => {
    if (m.id.startsWith('local-')) return
    setReplyTo(m); setBarFor(null); inputRef.current?.focus()
  }
  const react = (m: ChatMsg, emoji: string) => {
    if (m.id.startsWith('local-')) return
    setBarFor(null)
    const mineNow = m.reactions?.find((r) => r.user_id === user?.id)?.emoji
    const next = mineNow === emoji ? null : emoji
    // show it at once; the server's answer (to everyone) is the truth
    setMsgs((cur) => cur.map((x) => (x.id === m.id
      ? { ...x, reactions: [...(x.reactions ?? []).filter((r) => r.user_id !== user?.id), ...(next ? [{ user_id: user!.id, emoji: next }] : [])] }
      : x)))
    const back = () => setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, reactions: m.reactions } : x)))
    if (socket?.connected) socket.timeout(8000).emit('message:react', { id: m.id, emoji: next }, (e: Error | null, r?: { ok: boolean }) => { if (e || !r?.ok) back() })
    else api.post('/chat/react', { message_id: m.id, emoji: next }).catch(back)
  }
  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400)
  }
  const typed = () => {
    const now = Date.now()
    if (now - lastTyping.current < 1500) return
    lastTyping.current = now
    socket?.emit(dm ? 'dm:typing' : 'chat:typing', dm ? { to: peer!.id } : undefined)
  }

  const sendFile = async (blob: Blob, name: string, duration?: number) => {
    setSendingFile(true); setErr('')
    try {
      const up = await uploadChatFile(blob, name)
      const cid = newClientId(); snap(cid)
      deliver({ kind: up.kind, file_url: up.url, file_name: up.name, mime: up.mime, duration_ms: duration, client_id: cid, ...replyFields() })
      setReplyTo(null)
    } catch (e) { setErr((e as Error).message) } finally { setSendingFile(false) }
  }

  // ---- voice notes
  const [rec, setRec] = useState<{ start: number; tick: number } | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const cancelled = useRef(false)
  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => setRec((r) => (r ? { ...r, tick: Date.now() } : r)), 250)
    return () => clearInterval(t)
  }, [rec])
  const startRec = async () => {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t))
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []; cancelled.current = false
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const started = rec?.start ?? Date.now()
        if (cancelled.current) return
        const type = r.mimeType || 'audio/webm'
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        void sendFile(new Blob(chunks.current, { type }), `voice-${Date.now()}.${ext}`, Date.now() - started)
      }
      recorder.current = r; r.start()
      setRec({ start: Date.now(), tick: Date.now() })
    } catch { setErr('Microphone is blocked or missing. Allow it in the browser address bar.') }
  }
  const stopRec = (send: boolean) => {
    cancelled.current = !send
    const r = recorder.current
    const started = rec?.start ?? Date.now()
    setRec(null)
    if (!r) return
    if (send) r.onstop = () => {
      r.stream.getTracks().forEach((t) => t.stop())
      const type = r.mimeType || 'audio/webm'
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
      void sendFile(new Blob(chunks.current, { type }), `voice-${Date.now()}.${ext}`, Date.now() - started)
    }
    if (r.state !== 'inactive') r.stop()
  }

  const loadOlder = () => {
    const first = msgs.find((m) => !m.id.startsWith('local-'))
    if (!first) return
    api.get<Page>(`${path}?limit=40&before=${encodeURIComponent(first.created_at)}`).then((r) => {
      setMsgs((cur) => [...r.items.map(norm), ...cur]); setMore(r.has_more)
    }).catch(() => {})
  }

  const title = dm ? peer!.name : `${workspaceName} · everyone`
  let lastDay = ''
  return (
    <div className="conv">
      <header className="conv-head">
        <button className="conv-back" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        {dm ? <span className={'msgr-pic' + (online ? ' on' : '')}><Pic id={peer!.id} name={peer!.name} url={peer!.avatar_url} size={42} /></span> : <i className="pic ws"><Users size={20} /></i>}
        <div><b>{title}</b><small>{typing ? 'typing…' : dm ? (online ? 'online' : 'offline') : `${roster.length ? new Set(roster.map((r) => r.user_id)).size + 1 : 1} online`}</small></div>
        <span className="conv-call">
          {dm ? (
            <>
              <button className="icon-btn" disabled={busy} title="Voice call" aria-label="Voice call" onClick={() => void calls.start({ scope: 'dm', kind: 'voice', to: peer!.id })}><Phone size={18} /></button>
              <button className="icon-btn" disabled={busy} title="Video call" aria-label="Video call" onClick={() => void calls.start({ scope: 'dm', kind: 'video', to: peer!.id })}><Video size={18} /></button>
            </>
          ) : (
            <button className="icon-btn" disabled={busy} title="Start a group call" aria-label="Start a group call" onClick={() => setPicker(true)}><Video size={18} /></button>
          )}
        </span>
      </header>
      {!dm && groupCall && !busy && (
        <div className="call-banner">
          <Phone size={16} /><span>Group {groupCall.kind} call in progress · {groupCall.participants.filter((p) => p.state === 'joined').length} in the call</span>
          <button className="btn small" onClick={() => void calls.join(groupCall, false)}>Join</button>
        </div>
      )}
      {picker && (
        <GroupCallPicker members={inboxQ.data?.members ?? []} onClose={() => setPicker(false)}
          onStart={(kind, ids, all) => { setPicker(false); void calls.start({ scope: 'group', kind, user_ids: all ? undefined : ids, all }) }} />
      )}

      <div className="conv-msgs">
        {more && <button className="conv-older" onClick={loadOlder}>Load earlier messages</button>}
        {loaded && !msgs.length && <p className="muted conv-hint">No messages yet. Say hi 👋</p>}
        {msgs.map((m) => {
          const mine = m.user_id === user?.id
          const d = new Date(m.created_at).toDateString()
          const sep = d !== lastDay ? dayLabel(m.created_at) : null
          lastDay = d
          return (
            <div key={m.client_id ?? m.id}>
              {sep && <div className="conv-day"><span>{sep}</span></div>}
              <div id={`msg-${m.id}`} className={'bubble-row' + (mine ? ' mine' : '') + (barFor === m.id ? ' open' : '') + (m.reactions?.length ? ' has-reacts' : '')}>
                {!mine && <Pic id={m.user_id} name={m.name} url={m.avatar_url} size={30} />}
                <div className={'bubble ' + m.kind} onClick={(e) => { if (m.kind !== 'call' && !(e.target as HTMLElement).closest('a,button,audio,video')) setBarFor(barFor === m.id ? null : m.id) }}
                  onDoubleClick={() => m.kind !== 'call' && react(m, '❤️')}>
                  {!dm && !mine && <b className="bubble-name">{m.name}</b>}
                  {m.reply && <ReplyQuote reply={m.reply} mine={mine} onJump={() => jumpTo(m.reply!.id)} />}
                  {!m.reply && m.reply_to_id && <span className="reply-quote gone">Original message unavailable</span>}
                  <MessageBody m={m} />
                  <span className="bubble-meta">{clock(m.created_at)}{mine && <Ticks status={m.status} onRetry={() => retry(m)} />}</span>
                  <ReactionChips list={m.reactions} me={user?.id} onToggle={(e) => react(m, e)} />
                </div>
                {m.kind !== 'call' && !m.id.startsWith('local-') && (
                  <span className="bubble-acts">
                    <button type="button" aria-label="Reply" title="Reply" onClick={() => startReply(m)}><CornerUpLeft size={15} /></button>
                    <button type="button" aria-label="React" title="React" onClick={() => setBarFor(barFor === m.id ? null : m.id)}><Smile size={15} /></button>
                  </span>
                )}
                {barFor === m.id && <ReactBar current={m.reactions?.find((r) => r.user_id === user?.id)?.emoji} onPick={(e) => react(m, e)} onReply={() => startReply(m)} />}
              </div>
            </div>
          )
        })}
        {typing && <div className="conv-typing"><span className="dots" aria-hidden><b /><b /><b /></span></div>}
        <div ref={endRef} />
      </div>

      {err && <div className="form-err conv-err">{err}</div>}
      {rec ? (
        <div className="conv-form recording">
          <button type="button" className="icon-btn" onClick={() => stopRec(false)} aria-label="Cancel recording"><Trash2 size={18} /></button>
          <span className="rec-dot" /> <b>{mmss(rec.tick - rec.start)}</b> <span className="muted">Recording…</span>
          <span className="grow" />
          <button type="button" className="send-btn" onClick={() => stopRec(true)} aria-label="Send voice note"><Send size={17} /></button>
        </div>
      ) : (
        <>
        {replyTo && (
          <div className="reply-bar">
            <span><b>Replying to {replyTo.user_id === user?.id ? 'yourself' : replyTo.name}</b><small>{previewOf(replyTo) || 'Message'}</small></span>
            <button type="button" className="icon-btn" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X size={16} /></button>
          </div>
        )}
        <form className="conv-form" onSubmit={sendText}>
          <label className="icon-btn" title="Send a picture, video or document" aria-label="Attach">
            <Paperclip size={18} />
            <input type="file" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rtf,.md,.json"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void sendFile(f, f.name) }} />
          </label>
          <input name="body" placeholder={sendingFile ? 'Uploading…' : dm ? `Message ${peer!.name.split(' ')[0]}…` : 'Message everyone…'} autoComplete="off" onChange={typed} disabled={sendingFile} ref={inputRef} onKeyDown={(e) => { if (e.key === 'Escape') setReplyTo(null) }} />
          <button type="button" className="icon-btn" onClick={startRec} aria-label="Record a voice note" title="Record a voice note"><Mic size={18} /></button>
          <button className="send-btn" aria-label="Send"><Send size={17} /></button>
        </form>
        </>
      )}
    </div>
  )
}


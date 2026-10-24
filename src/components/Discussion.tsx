import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, CheckCircle2, Lightbulb, MoreHorizontal, Send, Trash2, X } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { colorFor, initials } from '../presence'

export type Tag = 'problem' | 'solution' | 'conclusion'
export type Message = {
  id: string; idea_id: string; owner_id: string; owner_name: string; body: string; tag: Tag | null
  parent_id: string | null; marked_at: string | null; marked_by_name: string | null; created_at: string
}
type Tab = 'chat' | 'conclusions' | 'problems'

const clock = (s: string) => new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const stamp = (s: string) => new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dayLabel = (s: string) => {
  const d = new Date(s), t = new Date(), y = new Date(Date.now() - 864e5)
  if (d.toDateString() === t.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
const clip = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

function Add({ placeholder, onAdd, busy }: { placeholder: string; onAdd: (body: string) => void; busy?: boolean }) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = e.currentTarget
    const body = String(new FormData(f).get('body') || '').trim()
    if (body) onAdd(body)
    f.reset()
  }
  return <form className="disc-add" onSubmit={submit}><input name="body" placeholder={placeholder} autoComplete="off" disabled={busy} /><button className="btn small" disabled={busy}>Add</button></form>
}

/** The idea's whole discussion: chat, conclusions, and problems with their solutions. */
export default function Discussion({ ideaId }: { ideaId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = ['idea-messages', ideaId]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<{ items: Message[] }>(`/ideas/${ideaId}/messages`), refetchInterval: 3000 })
  const msgs = q.data?.items ?? []
  const problems = msgs.filter((m) => m.tag === 'problem')
  const conclusions = msgs.filter((m) => m.tag === 'conclusion')
  const loose = msgs.filter((m) => m.tag === 'solution' && !problems.some((p) => p.id === m.parent_id))
  const [tab, setTab] = useState<Tab>('chat')

  const refresh = () => { qc.invalidateQueries({ queryKey: key }); ['idea', 'ideas', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })) }
  const send = useMutation({ mutationFn: (b: { body: string; tag?: Tag; parent_id?: string }) => api.post(`/ideas/${ideaId}/messages`, b), onSuccess: refresh })
  const mark = useMutation({ mutationFn: ({ id, ...b }: { id: string; tag: Tag | null; parent_id?: string | null }) => api.patch(`/ideas/${ideaId}/messages/${id}`, b), onSuccess: refresh })
  const del = useMutation({ mutationFn: (id: string) => api.del(`/ideas/${ideaId}/messages/${id}`), onSuccess: refresh })

  // stay on the newest message unless the reader scrolled up
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight }, [msgs.length, tab])

  const [menu, setMenu] = useState<string | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [up, setUp] = useState(false)
  useEffect(() => {
    if (!menu) return
    const off = () => { setMenu(null); setPick(null) }
    const t = setTimeout(() => window.addEventListener('click', off), 0)
    return () => { clearTimeout(t); window.removeEventListener('click', off) }
  }, [menu])

  const compose = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = e.currentTarget
    const body = String(new FormData(f).get('body') || '').trim()
    if (body) { stick.current = true; send.mutate({ body }) }
    f.reset()
  }

  const tabs: [Tab, string, number | null][] = [['chat', 'Chat', msgs.length], ['conclusions', 'Conclusions', conclusions.length], ['problems', 'Problems', problems.length]]
  return (
    <div className="disc">
      <div className="disc-tabs" role="tablist">
        {tabs.map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}{!!n && <span>{n}</span>}</button>
        ))}
      </div>

      {tab === 'chat' && (
        <>
          <div className="disc-chat" ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
            {!msgs.length && !q.isLoading && <p className="disc-empty">Start the discussion. Mark any message as a <b>problem</b>, <b>solution</b> or <b>conclusion</b> from its ⋯ menu.</p>}
            {msgs.map((m, i) => {
              const prev = msgs[i - 1]
              const mine = m.owner_id === user?.id
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
              const grouped = !!prev && !newDay && prev.owner_id === m.owner_id && !m.tag && !prev.tag && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60000
              const parent = m.parent_id ? msgs.find((p) => p.id === m.parent_id) : null
              return (
                <div key={m.id}>
                  {newDay && <div className="day-sep"><span>{dayLabel(m.created_at)}</span></div>}
                  <div className={'bub-row' + (mine ? ' mine' : '') + (grouped ? ' grouped' : '')}>
                    {!mine && (grouped ? <span className="bub-av ghost" /> : <i className="bub-av" style={{ background: colorFor(m.owner_id) }}>{initials(m.owner_name)}</i>)}
                    <div className="bub-col">
                      {!grouped && !mine && <span className="bub-name">{m.owner_name}</span>}
                      <div className={'bub' + (m.tag ? ' t-' + m.tag : '')}>
                        {m.tag && (
                          <span className={'tagpill ' + m.tag}>
                            {m.tag === 'problem' ? <AlertTriangle size={11} /> : m.tag === 'solution' ? <Lightbulb size={11} /> : <CheckCircle2 size={11} />}
                            {m.tag}
                          </span>
                        )}
                        {parent && <span className="bub-ref">↳ {clip(parent.body, 42)}</span>}
                        <p>{m.body}</p>
                        <span className="bub-time">{clock(m.created_at)}</span>
                        <button className="bub-more" aria-label="Message options" onClick={(e) => { e.stopPropagation(); setPick(null); const r = e.currentTarget.getBoundingClientRect(); const c = box.current?.getBoundingClientRect(); setUp(!!c && c.bottom - r.bottom < 250 && r.top - c.top > 250); setMenu(menu === m.id ? null : m.id) }}><MoreHorizontal size={15} /></button>
                        {menu === m.id && (
                          <div className={'bub-menu' + (up ? ' up' : '')} onClick={(e) => e.stopPropagation()}>
                            {pick === m.id ? (
                              <>
                                <small>Solves which problem?</small>
                                {problems.map((p) => <button key={p.id} onClick={() => { mark.mutate({ id: m.id, tag: 'solution', parent_id: p.id }); setMenu(null); setPick(null) }}>{clip(p.body, 44)}</button>)}
                              </>
                            ) : (
                              <>
                                {m.tag !== 'problem' && <button onClick={() => { mark.mutate({ id: m.id, tag: 'problem' }); setMenu(null) }}><AlertTriangle size={14} /> Mark as problem</button>}
                                {m.tag !== 'conclusion' && <button onClick={() => { mark.mutate({ id: m.id, tag: 'conclusion' }); setMenu(null) }}><CheckCircle2 size={14} /> Mark as conclusion</button>}
                                {m.tag !== 'problem' && <button disabled={!problems.length} onClick={() => setPick(m.id)}><Lightbulb size={14} /> {problems.length ? 'Solution to…' : 'Solution (add a problem first)'}</button>}
                                {m.tag && <button onClick={() => { mark.mutate({ id: m.id, tag: null }); setMenu(null) }}><X size={14} /> Clear mark</button>}
                                {mine && <button className="danger" onClick={() => { if (confirm('Delete this message?')) del.mutate(m.id); setMenu(null) }}><Trash2 size={14} /> Delete</button>}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {m.tag && m.marked_by_name && m.marked_by_name !== m.owner_name && <span className="bub-by">marked by {m.marked_by_name}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <form className="disc-compose" onSubmit={compose}>
            <input name="body" placeholder="Message about this idea…" autoComplete="off" />
            <button aria-label="Send"><Send size={16} /></button>
          </form>
        </>
      )}

      {tab === 'conclusions' && (
        <div className="disc-pane">
          {conclusions.map((c) => (
            <div key={c.id} className="concl-item">
              <Check size={15} />
              <div><p>{c.body}</p><small>{c.marked_by_name ?? c.owner_name} · {stamp(c.marked_at ?? c.created_at)}</small></div>
              <button aria-label="Remove conclusion" onClick={() => mark.mutate({ id: c.id, tag: null })}><X size={13} /></button>
            </div>
          ))}
          {!conclusions.length && <p className="disc-empty">Nothing decided yet. Mark a chat message as a conclusion, or add one below.</p>}
          <Add placeholder="Add a conclusion…" onAdd={(body) => send.mutate({ body, tag: 'conclusion' })} busy={send.isPending} />
        </div>
      )}

      {tab === 'problems' && (
        <div className="disc-pane">
          {problems.map((p) => {
            const sols = msgs.filter((m) => m.tag === 'solution' && m.parent_id === p.id)
            return (
              <div key={p.id} className="pair">
                <div className="pair-problem"><AlertTriangle size={14} /><div><p>{p.body}</p><small>{p.owner_name}</small></div>
                  <button aria-label="Clear problem" onClick={() => mark.mutate({ id: p.id, tag: null })}><X size={13} /></button></div>
                <div className="pair-sols">
                  {sols.map((s) => (
                    <div key={s.id} className="pair-sol"><Lightbulb size={13} /><div><p>{s.body}</p><small>{s.owner_name}</small></div>
                      <button aria-label="Clear solution" onClick={() => mark.mutate({ id: s.id, tag: null })}><X size={13} /></button></div>
                  ))}
                  {!sols.length && <small className="muted">No solution yet.</small>}
                  <Add placeholder="Add a solution…" onAdd={(body) => send.mutate({ body, tag: 'solution', parent_id: p.id })} busy={send.isPending} />
                </div>
              </div>
            )
          })}
          {!!loose.length && (
            <div className="pair"><div className="pair-problem loose"><Lightbulb size={14} /><div><p>Solutions not linked to a problem</p></div></div>
              <div className="pair-sols">{loose.map((s) => <div key={s.id} className="pair-sol"><Lightbulb size={13} /><div><p>{s.body}</p><small>{s.owner_name}</small></div><button aria-label="Clear" onClick={() => mark.mutate({ id: s.id, tag: null })}><X size={13} /></button></div>)}</div></div>
          )}
          {!problems.length && !loose.length && <p className="disc-empty">Raise a problem, then add as many solutions to it as you like.</p>}
          <Add placeholder="Raise a problem…" onAdd={(body) => send.mutate({ body, tag: 'problem' })} busy={send.isPending} />
        </div>
      )}
    </div>
  )
}

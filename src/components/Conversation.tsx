import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, CheckCircle2, Lightbulb, Send, Trash2, X } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { colorFor, initials } from '../presence'

export type Tag = 'problem' | 'solution' | 'conclusion'
export type Message = {
  id: string; idea_id: string; owner_id: string; owner_name: string; body: string; tag: Tag | null
  parent_id: string | null; marked_at: string | null; marked_by_name: string | null; created_at: string
}

const time = (s: string) => new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

export default function Conversation({ ideaId }: { ideaId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = ['idea-messages', ideaId]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<{ items: Message[] }>(`/ideas/${ideaId}/messages`), refetchInterval: 3000 })
  const msgs = q.data?.items ?? []
  const problems = msgs.filter((m) => m.tag === 'problem')
  const conclusions = msgs.filter((m) => m.tag === 'conclusion')
  const loose = msgs.filter((m) => m.tag === 'solution' && !problems.some((p) => p.id === m.parent_id))

  const refresh = () => { qc.invalidateQueries({ queryKey: key }); ['idea', 'ideas', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })) }
  const send = useMutation({ mutationFn: (b: { body: string; tag?: Tag; parent_id?: string }) => api.post(`/ideas/${ideaId}/messages`, b), onSuccess: refresh })
  const mark = useMutation({ mutationFn: ({ id, ...b }: { id: string; tag: Tag | null; parent_id?: string | null }) => api.patch(`/ideas/${ideaId}/messages/${id}`, b), onSuccess: refresh })
  const del = useMutation({ mutationFn: (id: string) => api.del(`/ideas/${ideaId}/messages/${id}`), onSuccess: refresh })

  // keep the thread pinned to the newest message unless the reader scrolled up
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight }, [msgs.length])
  const [pick, setPick] = useState<string | null>(null) // message choosing which problem it solves

  const compose = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = e.currentTarget
    const body = String(new FormData(f).get('body') || '').trim()
    if (body) { stick.current = true; send.mutate({ body }) }
    f.reset()
  }

  return (
    <div className="discuss">
      <section className="panel conv">
        <h3>Conversation <em>{msgs.length} message{msgs.length === 1 ? '' : 's'}</em></h3>
        <div className="conv-list" ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
          {!msgs.length && !q.isLoading && <p className="muted conv-empty">Start the discussion — everything said here stays with this idea. Mark messages as problems, solutions or conclusions as you go.</p>}
          {msgs.map((m) => {
            const mine = m.owner_id === user?.id
            const parent = m.parent_id ? msgs.find((p) => p.id === m.parent_id) : null
            return (
              <div key={m.id} className={'cmsg' + (m.tag ? ' tag-' + m.tag : '') + (mine ? ' mine' : '')}>
                <i className="cmsg-av" style={{ background: colorFor(m.owner_id) }}>{initials(m.owner_name)}</i>
                <div className="cmsg-main">
                  <div className="cmsg-meta"><b>{mine ? 'You' : m.owner_name}</b><small>{time(m.created_at)}</small>
                    {m.tag === 'problem' && <span className="tagpill problem"><AlertTriangle size={11} /> Problem</span>}
                    {m.tag === 'solution' && <span className="tagpill solution"><Lightbulb size={11} /> Solution</span>}
                    {m.tag === 'conclusion' && <span className="tagpill conclusion"><CheckCircle2 size={11} /> Conclusion</span>}
                  </div>
                  <p>{m.body}</p>
                  {parent && <small className="cmsg-link">↳ for “{clip(parent.body, 48)}”</small>}
                  {m.tag && m.marked_by_name && m.marked_by_name !== m.owner_name && <small className="cmsg-link">marked by {m.marked_by_name}</small>}
                  <div className="cmsg-actions">
                    {m.tag !== 'problem' && <button onClick={() => mark.mutate({ id: m.id, tag: 'problem' })}><AlertTriangle size={12} /> Problem</button>}
                    {m.tag !== 'conclusion' && <button onClick={() => mark.mutate({ id: m.id, tag: 'conclusion' })}><CheckCircle2 size={12} /> Conclusion</button>}
                    {m.tag !== 'problem' && !!problems.length && <button onClick={() => setPick(pick === m.id ? null : m.id)}><Lightbulb size={12} /> Solution to…</button>}
                    {m.tag && <button onClick={() => mark.mutate({ id: m.id, tag: null })}><X size={12} /> Clear</button>}
                    {mine && <button className="danger" onClick={() => confirm('Delete this message?') && del.mutate(m.id)} aria-label="Delete"><Trash2 size={12} /></button>}
                  </div>
                  {pick === m.id && (
                    <div className="cmsg-pick">
                      <small>Which problem does this solve?</small>
                      {problems.map((p) => <button key={p.id} onClick={() => { mark.mutate({ id: m.id, tag: 'solution', parent_id: p.id }); setPick(null) }}>{clip(p.body, 70)}</button>)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <form className="conv-form" onSubmit={compose}>
          <input name="body" placeholder="Say something about this idea…" autoComplete="off" />
          <button aria-label="Send"><Send size={16} /></button>
        </form>
      </section>

      <div className="disc-side">
        <section className="panel concl">
          <h3><CheckCircle2 size={17} /> Conclusions <em>{conclusions.length}</em></h3>
          {conclusions.map((c) => (
            <div key={c.id} className="concl-item">
              <Check size={15} />
              <div><p>{c.body}</p><small>{c.marked_by_name ?? c.owner_name} · {time(c.marked_at ?? c.created_at)}</small></div>
              <button aria-label="Remove conclusion" onClick={() => mark.mutate({ id: c.id, tag: null })}><X size={13} /></button>
            </div>
          ))}
          {!conclusions.length && <p className="muted">Nothing decided yet. Mark a message as a conclusion, or add one here.</p>}
          <Add placeholder="Add a conclusion…" onAdd={(body) => send.mutate({ body, tag: 'conclusion' })} busy={send.isPending} />
        </section>

        <section className="panel pairs">
          <h3><AlertTriangle size={17} /> Problems &amp; solutions <em>{problems.length}</em></h3>
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
          {!problems.length && !loose.length && <p className="muted">Raise a problem, then add as many solutions to it as you like.</p>}
          <Add placeholder="Raise a problem…" onAdd={(body) => send.mutate({ body, tag: 'problem' })} busy={send.isPending} />
        </section>
      </div>
    </div>
  )
}

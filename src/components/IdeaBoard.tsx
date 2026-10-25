import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, CheckCircle2, CheckSquare, Lightbulb, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { api } from '../api'
import { colorFor, initials } from '../presence'
import type { Todo } from '../types'
import { useIdeaMessages, type Message } from './Discussion'

const when = (s: string) => new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const letter = (i: number) => String.fromCharCode(65 + (i % 26))

/** A pill that opens into a one-line input — keeps cards calm until someone wants to add. */
function InlineAdd({ label, placeholder, onAdd, tone = 'solution' }: { label: string; placeholder: string; onAdd: (body: string) => void; tone?: 'solution' | 'problem' | 'conclusion' }) {
  const [open, setOpen] = useState(false)
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const body = String(new FormData(e.currentTarget).get('body') || '').trim()
    if (body) { onAdd(body); setOpen(false) }
  }
  if (!open) return <button type="button" className={'ia-open ' + tone} onClick={() => setOpen(true)}><Plus size={14} /> {label}</button>
  return (
    <form className="ia-form" onSubmit={submit}>
      <input name="body" placeholder={placeholder} autoComplete="off" autoFocus onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }} />
      <button className="btn small">Add</button>
      <button type="button" className="ia-cancel" aria-label="Cancel" onClick={() => setOpen(false)}><X size={15} /></button>
    </form>
  )
}

function Who({ m }: { m: Message }) {
  return <span className="who-line"><i style={{ background: colorFor(m.owner_id) }}>{initials(m.owner_name)}</i>{m.owner_name} · {when(m.created_at)}</span>
}


type IdeaTodo = Todo & { owner_name?: string }
const dueLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** The idea's checklist: things somebody has to do to move this forward. */
function IdeaTodos({ ideaId }: { ideaId: string }) {
  const qc = useQueryClient()
  const key = ['todos', 'idea', ideaId]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<{ items: IdeaTodo[] }>(`/todos?filter=all&idea_id=${ideaId}`), refetchInterval: 5000 })
  const refresh = () => ['todos', 'agenda', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
  const add = useMutation({ mutationFn: (b: { title: string; due_date: string | null }) => api.post('/todos', { ...b, idea_id: ideaId }), onSuccess: refresh })
  const toggle = useMutation({ mutationFn: (t: IdeaTodo) => api.patch(`/todos/${t.id}`, { done: !t.done }), onSuccess: refresh })
  const del = useMutation({ mutationFn: (id: string) => api.del(`/todos/${id}`), onSuccess: refresh })
  const items = q.data?.items ?? []
  const done = items.filter((t) => t.done).length
  const today = new Date().toISOString().slice(0, 10)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = e.currentTarget
    const d = new FormData(f)
    const title = String(d.get('title') || '').trim()
    if (title) add.mutate({ title, due_date: String(d.get('due') || '') || null })
    f.reset()
  }
  return (
    <section className="panel tboard">
      <header className="board-head">
        <h3><CheckSquare size={18} /> To-dos</h3>
        {!!items.length && <span className="board-count"><b>{done}</b>/{items.length} done</span>}
      </header>
      {!!items.length && <div className="tprog" aria-hidden><i style={{ width: `${(done / items.length) * 100}%` }} /></div>}
      <ul className="tlist">
        {items.map((t) => (
          <li key={t.id} className={t.done ? 'done' : ''}>
            <button className="tcheck" aria-label={t.done ? 'Mark as not done' : 'Mark as done'} aria-pressed={t.done} onClick={() => toggle.mutate(t)}>{t.done && <Check size={13} strokeWidth={3} />}</button>
            <div className="tbody">
              <p>{t.title}</p>
              <small>
                {t.owner_name && <span>{t.owner_name}</span>}
                {t.due_date && <span className={!t.done && t.due_date < today ? 'late' : ''}>{t.due_date < today && !t.done ? 'Overdue · ' : ''}{dueLabel(t.due_date)}</span>}
              </small>
            </div>
            <button className="tdel" aria-label="Delete to-do" onClick={() => del.mutate(t.id)}><Trash2 size={13} /></button>
          </li>
        ))}
      </ul>
      {!items.length && !q.isLoading && <p className="cboard-empty"><CheckSquare size={16} /> Nothing to do yet. Add the steps that move this idea forward.</p>}
      <form className="tadd" onSubmit={submit}>
        <input name="title" placeholder="Add a to-do…" autoComplete="off" />
        <input name="due" type="date" aria-label="Due date" title="Due date (optional)" />
        <button className="btn small" disabled={add.isPending}>Add</button>
      </form>
    </section>
  )
}

/** Conclusions + problems with their solutions, under the idea's assets. */
export default function IdeaBoard({ ideaId }: { ideaId: string }) {
  const { msgs, send, mark, problems } = useIdeaMessages(ideaId)
  const conclusions = msgs.filter((m) => m.tag === 'conclusion')
  const loose = msgs.filter((m) => m.tag === 'solution' && !problems.some((p) => p.id === m.parent_id))
  const solved = problems.filter((p) => msgs.some((m) => m.tag === 'solution' && m.parent_id === p.id)).length

  return (
    <div className="board">
      <section className="panel pboard">
        <header className="board-head">
          <h3><AlertTriangle size={18} /> Problems &amp; solutions</h3>
          {!!problems.length && <span className="board-count"><b>{solved}</b>/{problems.length} have a solution</span>}
        </header>

        <div className="pgrid">
          {problems.map((p, i) => {
            const sols = msgs.filter((m) => m.tag === 'solution' && m.parent_id === p.id)
            return (
              <article key={p.id} className={'pcard ' + (sols.length ? 'has' : 'open')}>
                <div className="pcard-top">
                  <span className="pcard-n">Problem {i + 1}</span>
                  <span className="pcard-state">{sols.length ? `${sols.length} solution${sols.length > 1 ? 's' : ''}` : 'Needs a solution'}</span>
                  <button className="pcard-x" aria-label="Remove problem mark" title="Back to a plain message" onClick={() => mark.mutate({ id: p.id, tag: null })}><X size={14} /></button>
                </div>
                <p className="pcard-text">{p.body}</p>
                <Who m={p} />

                <ol className="opts">
                  {sols.map((s, j) => (
                    <li key={s.id} className="opt">
                      <span className="opt-l">{letter(j)}</span>
                      <div className="opt-body"><p>{s.body}</p><Who m={s} /></div>
                      <div className="opt-act">
                        <button title="Adopt as a conclusion" aria-label="Adopt as a conclusion" onClick={() => mark.mutate({ id: s.id, tag: 'conclusion' })}><Sparkles size={13} /></button>
                        <button title="Remove" aria-label="Remove solution" onClick={() => mark.mutate({ id: s.id, tag: null })}><X size={13} /></button>
                      </div>
                    </li>
                  ))}
                </ol>
                <InlineAdd label={sols.length ? 'Add another solution' : 'Add a solution'} placeholder="How could we solve this?" onAdd={(body) => send.mutate({ body, tag: 'solution', parent_id: p.id })} />
              </article>
            )
          })}

          {!!loose.length && (
            <article className="pcard loose">
              <div className="pcard-top"><span className="pcard-n">Unlinked</span><span className="pcard-state">solutions without a problem</span></div>
              <ol className="opts">
                {loose.map((s, j) => (
                  <li key={s.id} className="opt"><span className="opt-l">{letter(j)}</span><div className="opt-body"><p>{s.body}</p><Who m={s} /></div>
                    <div className="opt-act"><button aria-label="Remove solution" onClick={() => mark.mutate({ id: s.id, tag: null })}><X size={13} /></button></div></li>
                ))}
              </ol>
            </article>
          )}

          <div className="pnew">
            <Lightbulb size={20} />
            <p>{problems.length ? 'Another problem?' : 'What could go wrong, or what is unsolved?'}</p>
            <InlineAdd tone="problem" label="Raise a problem" placeholder="Describe the problem…" onAdd={(body) => send.mutate({ body, tag: 'problem' })} />
          </div>
        </div>
      </section>

      <div className="board-side">
      <section className="panel cboard">
        <header className="board-head"><h3><CheckCircle2 size={18} /> Conclusions</h3>{!!conclusions.length && <span className="board-count"><b>{conclusions.length}</b> decided</span>}</header>
        <ol className="clist">
          {conclusions.map((c, i) => (
            <li key={c.id}>
              <span className="clist-n">{i + 1}</span>
              <div className="clist-body"><p>{c.body}</p><small>{c.marked_by_name ?? c.owner_name} · {when(c.marked_at ?? c.created_at)}</small></div>
              <button aria-label="Remove conclusion" title="Back to a plain message" onClick={() => mark.mutate({ id: c.id, tag: null })}><X size={13} /></button>
            </li>
          ))}
        </ol>
        {!conclusions.length && <p className="cboard-empty"><Check size={16} /> Nothing decided yet. Mark a chat message as a conclusion, adopt a solution, or add one here.</p>}
        <InlineAdd tone="conclusion" label="Add a conclusion" placeholder="What did we decide?" onAdd={(body) => send.mutate({ body, tag: 'conclusion' })} />
      </section>
      <IdeaTodos ideaId={ideaId} />
      </div>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CheckSquare, HelpCircle, Pencil, Trash2 } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { IDEA_COLOR, IDEA_STATUSES, KIND_COLOR, type Idea, type Todo } from '../types'
import Avatars, { Meter } from '../components/Avatars'
import { Modal } from '../components/ui'
import { useQuick } from '../components/quick'
import Attachments from '../components/Attachments'
import Discussion from '../components/Discussion'
import IdeaBoard from '../components/IdeaBoard'
import { useMedia } from '../media'

type Detail = Omit<Idea, 'votes'> & { votes: { user_id: string; feasibility: number; name: string }[] }
type Q = { id: string; title: string; answers_count: number; accepted_answer_id: string | null; idea_id: string | null }
type Ev = { id: string; title: string; kind: string; starts_at: string; idea_id: string | null }

const SCALE = ['Not possible', 'Very hard', 'Doable', 'Easy', 'Trivial']

export default function IdeaDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const quick = useQuick()
  const [edit, setEdit] = useState(false)
  const wide = useMedia('(min-width: 1101px)') // on wide screens the discussion lives in the side panel
  const key = ['idea', id]
  const { data } = useQuery({ queryKey: key, queryFn: () => api.get<Detail>(`/ideas/${id}`) })
  const questions = useQuery({ queryKey: ['questions'], queryFn: () => api.get<{ items: Q[] }>('/questions') })
  const todos = useQuery({ queryKey: ['todos', 'all'], queryFn: () => api.get<{ items: Todo[] }>('/todos?filter=all') })
  const events = useQuery({
    queryKey: ['events', 'all'],
    queryFn: () => api.get<{ items: Ev[] }>(`/events?from=${new Date(Date.now() - 30 * 864e5).toISOString()}&to=${new Date(Date.now() + 365 * 864e5).toISOString()}`),
  })
  const refresh = () => { ['idea', 'ideas', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })) }
  const patch = useMutation({ mutationFn: (b: object) => api.patch(`/ideas/${id}`, b), onSuccess: () => { refresh(); setEdit(false) } })
  const vote = useMutation({ mutationFn: (feasibility: number) => api.put(`/ideas/${id}/vote`, { feasibility }), onSuccess: refresh })
  const del = useMutation({ mutationFn: () => api.del(`/ideas/${id}`), onSuccess: () => { refresh(); nav('/ideas') } })
  const toggle = useMutation({ mutationFn: (t: Todo) => api.patch(`/todos/${t.id}`, { done: !t.done }), onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }) })

  if (!data) return <p className="muted">Loading…</p>
  const mine = data.votes.find((v) => v.user_id === user?.id)?.feasibility
  const relQ = questions.data?.items.filter((q) => q.idea_id === id) ?? []
  const relT = todos.data?.items.filter((t) => t.idea_id === id) ?? []
  const relE = events.data?.items.filter((e) => e.idea_id === id) ?? []

  const saveEdit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    patch.mutate({ title: String(f.get('title')).trim(), description: String(f.get('description')).trim() })
  }

  return (
    <>
      <p className="crumb"><Link to="/ideas">← Team Ideas</Link></p>
      <section className="hero" style={{ background: IDEA_COLOR[data.status] === '#ffffff' ? '#eef0f5' : IDEA_COLOR[data.status] }}>
        <div className="hero-main">
          <h1>{data.title}</h1>
          <p>{data.description || 'No description yet — hit edit and say what this is.'}</p>
          <div className="hero-meta">
            <select value={data.status} onChange={(e) => patch.mutate({ status: e.target.value })}>{IDEA_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <span className="chip">started by {data.owner_name}</span>
            <span className="chip">💭 {data.thoughts} thoughts</span>
            <Avatars names={data.contributors} />
          </div>
        </div>
        <div className="hero-side">
          <div className="big-num"><b>{data.feasibility ?? '–'}</b><span>/5 feasibility</span></div>
          <Meter value={data.feasibility} votes={data.votes.length} />
          <div className="hero-actions">
            <button className="btn ghost small" onClick={() => setEdit(true)}><Pencil size={13} /> Edit</button>
            <button className="btn ghost small" onClick={() => confirm('Delete this idea and everything on it?') && del.mutate()}><Trash2 size={13} /> Delete</button>
          </div>
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel vote">
          <h3>How possible is this? <em>{mine ? `you said ${SCALE[mine - 1]}` : 'cast your vote'}</em></h3>
          <div className="scale">
            {SCALE.map((label, i) => (
              <button key={label} className={mine === i + 1 ? 'on' : ''} onClick={() => vote.mutate(i + 1)}><b>{i + 1}</b><span>{label}</span></button>
            ))}
          </div>
          {data.votes.length ? (
            <div className="voters">{data.votes.map((v) => <span key={v.user_id} className="chip"><Avatars names={[v.name]} />{v.name} · {v.feasibility}</span>)}</div>
          ) : <p className="muted">No votes yet — be the first.</p>}
        </section>

        <section className="panel linked">
          <h3>Around this idea</h3>
          <div className="linked-actions">
            <button style={{ background: KIND_COLOR.meeting }} onClick={() => quick('question', { idea_id: id })}><HelpCircle size={15} /> Ask</button>
            <button style={{ background: KIND_COLOR.task }} onClick={() => quick('todo', { idea_id: id })}><CheckSquare size={15} /> Task</button>
            <button style={{ background: KIND_COLOR.appointment }} onClick={() => quick('event', { idea_id: id })}><CalendarDays size={15} /> Event</button>
          </div>
          {relQ.map((q) => <Link key={q.id} to="/qa" className="row-link"><HelpCircle size={15} /><span>{q.title}</span><small>{q.accepted_answer_id ? '✅ answered' : `${q.answers_count} answers`}</small></Link>)}
          {relT.map((t) => (
            <label key={t.id} className="row-link">
              <input type="checkbox" className="check" checked={t.done} onChange={() => toggle.mutate(t)} />
              <span style={{ textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? .5 : 1 }}>{t.title}</span>
              {t.due_date && <small>{new Date(t.due_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small>}
            </label>
          ))}
          {relE.map((e) => <Link key={e.id} to="/calendar" className="row-link"><CalendarDays size={15} /><span>{e.title}</span><small>{new Date(e.starts_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></Link>)}
          {!relQ.length && !relT.length && !relE.length && <p className="muted">No questions, tasks or events linked yet.</p>}
        </section>
      </div>

      <section className="panel attach-panel">
        <h3>Links &amp; images</h3>
        <Attachments type="idea" id={data.id} />
      </section>

      <IdeaBoard ideaId={data.id} />

      {!wide && <section className="panel disc-inline"><h3>Chat</h3><Discussion ideaId={data.id} /></section>}

      {edit && (
        <Modal title="Edit idea" onClose={() => setEdit(false)}>
          <form onSubmit={saveEdit}>
            <input name="title" defaultValue={data.title} required autoFocus />
            <textarea name="description" rows={5} defaultValue={data.description} placeholder="Description" />
            <button className="btn" disabled={patch.isPending}>Save</button>
          </form>
        </Modal>
      )}
    </>
  )
}

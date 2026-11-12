import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Lightbulb, MapPin, Plus, Trash2 } from 'lucide-react'
import { api } from '../api'
import { IDEA_COLOR, IDEA_STATUSES } from '../types'
import PinsPanel from './Pins'
import { Pill } from './ui'

type PIdea = { id: string; title: string; description: string; status: (typeof IDEA_STATUSES)[number] }
type PTodo = { id: string; title: string; done: boolean; due_date: string | null }
export type PersonalCounts = { ideas: number; open_tasks: number; tasks_due: number; pins: number }

function useRefresh() {
  const qc = useQueryClient()
  return (key: string) => { qc.invalidateQueries({ queryKey: ['personal', key] }); qc.invalidateQueries({ queryKey: ['personal', 'overview'] }) }
}

function Ideas() {
  const refresh = useRefresh()
  const q = useQuery({ queryKey: ['personal', 'ideas'], queryFn: () => api.get<{ items: PIdea[] }>('/personal/ideas').then((r) => r.items) })
  const [title, setTitle] = useState('')
  const add = useMutation({ mutationFn: () => api.post('/personal/ideas', { title: title.trim() }), onSuccess: () => { setTitle(''); refresh('ideas') } })
  const patch = useMutation({ mutationFn: (v: { id: string; status: string }) => api.patch(`/personal/ideas/${v.id}`, { status: v.status }), onSuccess: () => refresh('ideas') })
  const del = useMutation({ mutationFn: (id: string) => api.del(`/personal/ideas/${id}`), onSuccess: () => refresh('ideas') })
  const submit = (e: FormEvent) => { e.preventDefault(); if (title.trim()) add.mutate() }
  return (
    <div>
      <form className="inv-add" onSubmit={submit}>
        <input value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} placeholder="A private idea, only you see it" aria-label="New idea" />
        <button className="btn small" disabled={add.isPending || !title.trim()}><Plus size={14} /> Add</button>
      </form>
      {!q.data?.length ? <p className="muted ps-empty">No personal ideas yet.</p> : (
        <ul className="ps-list">
          {q.data.map((i) => (
            <li key={i.id}>
              <span className="ps-main"><b>{i.title}</b></span>
              <select value={i.status} onChange={(e) => patch.mutate({ id: i.id, status: e.target.value })} aria-label="Status" style={{ background: IDEA_COLOR[i.status] }}>
                {IDEA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="icon-btn danger" aria-label={`Delete ${i.title}`} onClick={() => { if (confirm(`Delete “${i.title}”?`)) del.mutate(i.id) }}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Tasks() {
  const refresh = useRefresh()
  const q = useQuery({ queryKey: ['personal', 'todos'], queryFn: () => api.get<{ items: PTodo[] }>('/personal/todos').then((r) => r.items) })
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const add = useMutation({ mutationFn: () => api.post('/personal/todos', { title: title.trim(), due_date: due || null }), onSuccess: () => { setTitle(''); setDue(''); refresh('todos') } })
  const tick = useMutation({ mutationFn: (t: PTodo) => api.patch(`/personal/todos/${t.id}`, { done: !t.done }), onSuccess: () => refresh('todos') })
  const del = useMutation({ mutationFn: (id: string) => api.del(`/personal/todos/${id}`), onSuccess: () => refresh('todos') })
  const submit = (e: FormEvent) => { e.preventDefault(); if (title.trim()) add.mutate() }
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div>
      <form className="inv-add" onSubmit={submit}>
        <input value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} placeholder="A private task" aria-label="New task" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" style={{ flex: 'none' }} />
        <button className="btn small" disabled={add.isPending || !title.trim()}><Plus size={14} /> Add</button>
      </form>
      {!q.data?.length ? <p className="muted ps-empty">No personal tasks yet.</p> : (
        <ul className="ps-list">
          {q.data.map((t) => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <input type="checkbox" checked={t.done} onChange={() => tick.mutate(t)} aria-label={`Mark “${t.title}” ${t.done ? 'not done' : 'done'}`} />
              <span className="ps-main"><b>{t.title}</b></span>
              {t.due_date && <Pill color={!t.done && t.due_date.slice(0, 10) <= today ? '#f9d2d2' : '#ecece6'}>{t.due_date.slice(0, 10)}</Pill>}
              <button className="icon-btn danger" aria-label={`Delete ${t.title}`} onClick={() => del.mutate(t.id)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TABS = [
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'map', label: 'Map', icon: MapPin },
] as const

/** Your own space: private ideas, tasks and map pins that belong to no workspace. */
export default function PersonalSpace({ counts }: { counts?: PersonalCounts }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('ideas')
  const n = { ideas: counts?.ideas, tasks: counts?.open_tasks, map: counts?.pins }
  return (
    <section className="ps">
      <div className="ps-head">
        <div className="seg" role="tablist" aria-label="Personal space">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <Icon size={14} />&nbsp;{label}{n[id] ? ` · ${n[id]}` : ''}
            </button>
          ))}
        </div>
        <small className="muted">Only you can see this.</small>
      </div>
      {tab === 'ideas' ? <Ideas /> : tab === 'tasks' ? <Tasks /> : <PinsPanel base="/personal/pins" height={380} />}
    </section>
  )
}

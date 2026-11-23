import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Todo } from '../types'
import { Empty, Header, fmtDate, fmtDateTime } from '../components/ui'
import { useQuick } from '../components/quick'
import { Lightbulb, Package, Plus, User } from 'lucide-react'

type Res = { items: Todo[]; follow_ups: { lead_id: string; lead_name: string; next_follow_up_at: string }[] }

export default function Todos() {
  const qc = useQueryClient()
  const quick = useQuick()
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open')
  const { data } = useQuery({ queryKey: ['todos', filter], queryFn: () => api.get<Res>(`/todos?filter=${filter}`) })
  const done = () => { qc.invalidateQueries({ queryKey: ['todos'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['alerts'] }) }
  const patch = useMutation({ mutationFn: ({ id, ...b }: { id: string; done: boolean }) => api.patch(`/todos/${id}`, b), onSuccess: done })
  const del = useMutation({ mutationFn: (id: string) => api.del(`/todos/${id}`), onSuccess: done })

  const today = new Date().toISOString().slice(0, 10)
  const openCount = data?.items.filter((t) => !t.done).length
  const followCount = data?.follow_ups.length ?? 0

  return (
    <>
      <Header title="Tasks">
        <div className="seg">{(['open', 'done', 'all'] as const).map((f) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>
        <button className="btn" onClick={() => quick('todo')}><Plus size={15} /> Add task</button>
      </Header>

      {(filter === 'open' || filter === 'all') && (
        <p className="muted at-help">
          {openCount != null ? `${openCount} active task${openCount === 1 ? '' : 's'}` : '…'}
          {followCount ? ` · ${followCount} lead follow-up${followCount === 1 ? '' : 's'}` : ''}
        </p>
      )}

      {!!data?.follow_ups.length && (
        <section className="panel">
          <h3>Lead follow-ups</h3>
          {data.follow_ups.map((f) => (
            <div key={f.lead_id} className="todo"><span className="check ro" /><Link to={`/leads/${f.lead_id}`}>Follow up with {f.lead_name}</Link>
              <span className={'due' + (f.next_follow_up_at < new Date().toISOString() ? ' late' : '')}>{fmtDateTime(f.next_follow_up_at)}</span></div>
          ))}
        </section>
      )}

      {!data?.items.length && <Empty>No tasks here. Add one to get started.</Empty>}
      <div className="panel">
        {data?.items.map((t) => (
          <div key={t.id} className={'todo' + (t.done ? ' done' : '')}>
            <input type="checkbox" className="check" checked={t.done} onChange={(e) => patch.mutate({ id: t.id, done: e.target.checked })} />
            <div className="grow">
              <span>{t.title}</span>
              <small>
                {t.idea_title && <Link to={`/ideas/${t.idea_id}`}><Lightbulb size={13} className="ico" /> {t.idea_title}</Link>}
                {t.product_name && <span><Package size={13} className="ico" /> {t.product_name}</span>}
                {t.lead_name && <Link to={`/leads/${t.lead_id}`}><User size={13} className="ico" /> {t.lead_name}</Link>}
              </small>
            </div>
            {t.due_date && <span className={'due' + (!t.done && t.due_date < today ? ' late' : '')}>{fmtDate(t.due_date)}</span>}
            <button className="x" onClick={() => { if (confirm(`Delete “${t.title}”?`)) del.mutate(t.id) }} aria-label="Delete">×</button>
          </div>
        ))}
      </div>
    </>
  )
}

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Idea, Lead, Product, Todo } from '../types'
import { CsvTools, Empty, Header, fmtDate, fmtDateTime } from '../components/ui'

type Res = { items: Todo[]; follow_ups: { lead_id: string; lead_name: string; next_follow_up_at: string }[] }

export default function Todos() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open')
  const { data } = useQuery({ queryKey: ['todos', filter], queryFn: () => api.get<Res>(`/todos?filter=${filter}`) })
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: () => api.get<{ items: Idea[] }>('/ideas') })
  const products = useQuery({ queryKey: ['products'], queryFn: () => api.get<{ items: Product[] }>('/products') })
  const leads = useQuery({ queryKey: ['leads'], queryFn: () => api.get<{ items: Lead[] }>('/leads') })
  const done = () => { qc.invalidateQueries({ queryKey: ['todos'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) }
  const create = useMutation({ mutationFn: (b: object) => api.post('/todos', b), onSuccess: done })
  const patch = useMutation({ mutationFn: ({ id, ...b }: { id: string; done: boolean }) => api.patch(`/todos/${id}`, b), onSuccess: done })
  const del = useMutation({ mutationFn: (id: string) => api.del(`/todos/${id}`), onSuccess: done })

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    create.mutate({
      title: f.get('title'), due_date: f.get('due_date') || null,
      idea_id: f.get('idea_id') || null, product_id: f.get('product_id') || null, lead_id: f.get('lead_id') || null,
    })
    form.reset()
  }
  const today = new Date().toISOString().slice(0, 10)
  return (
    <>
      <Header title="Tasks">
        <CsvTools entity="todos" importable invalidate={['todos']} />
        <div className="seg">{(['open', 'done', 'all'] as const).map((f) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>
      </Header>

      <form className="panel row-form wrap" onSubmit={submit}>
        <input name="title" placeholder="New task…" required style={{ flex: 2, minWidth: 200 }} />
        <input name="due_date" type="date" />
        <select name="idea_id"><option value="">Idea…</option>{ideas.data?.items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select>
        <select name="product_id"><option value="">Product…</option>{products.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="lead_id"><option value="">Lead…</option>{leads.data?.items.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <button className="btn">Add</button>
      </form>

      {!!data?.follow_ups.length && (
        <section className="panel">
          <h3>Lead follow-ups</h3>
          {data.follow_ups.map((f) => (
            <div key={f.lead_id} className="todo"><span className="check ro" /><Link to={`/leads/${f.lead_id}`}>Follow up with {f.lead_name}</Link>
              <span className={'due' + (f.next_follow_up_at < new Date().toISOString() ? ' late' : '')}>{fmtDateTime(f.next_follow_up_at)}</span></div>
          ))}
        </section>
      )}

      {!data?.items.length && <Empty>Nothing here.</Empty>}
      <div className="panel">
        {data?.items.map((t) => (
          <div key={t.id} className={'todo' + (t.done ? ' done' : '')}>
            <input type="checkbox" className="check" checked={t.done} onChange={(e) => patch.mutate({ id: t.id, done: e.target.checked })} />
            <div className="grow">
              <span>{t.title}</span>
              <small>
                {t.idea_title && <Link to={`/ideas/${t.idea_id}`}>💡 {t.idea_title}</Link>}
                {t.product_name && <span>📦 {t.product_name}</span>}
                {t.lead_name && <Link to={`/leads/${t.lead_id}`}>👤 {t.lead_name}</Link>}
              </small>
            </div>
            {t.due_date && <span className={'due' + (!t.done && t.due_date < today ? ' late' : '')}>{fmtDate(t.due_date)}</span>}
            <button className="x" onClick={() => del.mutate(t.id)} aria-label="Delete">×</button>
          </div>
        ))}
      </div>
    </>
  )
}

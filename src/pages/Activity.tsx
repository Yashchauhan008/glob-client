import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { Empty, Header } from '../components/ui'
import { colorFor, initials } from '../presence'

type Item = { id: string; verb: string; entity_type: string; entity_id: string | null; title: string; detail: string | null; created_at: string; actor_id: string; actor_name: string }

const TYPES: { key: string; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'ideas', label: 'Ideas' }, { key: 'questions', label: 'Q&A' },
  { key: 'todos', label: 'Tasks' }, { key: 'events', label: 'Calendar' }, { key: 'leads', label: 'CRM' }, { key: 'products', label: 'Products' }, { key: 'auth', label: 'Logins' },
]
const PATH: Record<string, string> = { questions: '/qa', todos: '/tasks', events: '/calendar', products: '/products' }
const target = (i: Item) => i.entity_type === 'ideas' ? (i.entity_id && !i.verb.startsWith('deleted') ? `/ideas/${i.entity_id}` : '/ideas')
  : i.entity_type === 'leads' ? (i.entity_id && !i.verb.startsWith('deleted') ? `/leads/${i.entity_id}` : '/leads') : PATH[i.entity_type] ?? '/home'

const ago = (s: string) => {
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
const dayLabel = (s: string) => {
  const d = new Date(s), t = new Date(), y = new Date(Date.now() - 864e5)
  if (d.toDateString() === t.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function Activity() {
  const [type, setType] = useState('all')
  const [who, setWho] = useState('all')
  const q = useQuery({ queryKey: ['activity'], queryFn: () => api.get<{ items: Item[] }>('/activity?limit=200'), refetchInterval: 15000 })
  const items = q.data?.items ?? []
  const people = useMemo(() => [...new Map(items.map((i) => [i.actor_id, i.actor_name])).entries()], [items])
  const shown = items.filter((i) => (type === 'all' || i.entity_type === type) && (who === 'all' || i.actor_id === who))
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of shown) { const k = dayLabel(i.created_at); m.set(k, [...(m.get(k) ?? []), i]) }
    return [...m.entries()]
  }, [shown])

  return (
    <>
      <Header title="Activity">
        <select value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">Everyone</option>
          {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </Header>
      <div className="seg act-filters">
        {TYPES.map((t) => <button key={t.key} className={type === t.key ? 'on' : ''} onClick={() => setType(t.key)}>{t.label}</button>)}
      </div>
      {q.isLoading ? null : !shown.length ? <Empty>Nothing here yet — activity from the whole team shows up as it happens.</Empty> : groups.map(([day, list]) => (
        <section key={day} className="act-day">
          <h3>{day}</h3>
          <div className="panel act-list">
            {list.map((i) => (
              <div key={i.id} className="act-row">
                <i className="act-av" style={{ background: colorFor(i.actor_id) }}>{initials(i.actor_name)}</i>
                <div className="act-main">
                  <p><b>{i.actor_name}</b> {i.verb} {i.title && <Link to={target(i)}>“{i.title}”</Link>}</p>
                  {i.detail && <small className="act-detail">{i.detail}</small>}
                </div>
                <time title={new Date(i.created_at).toLocaleString()}>{ago(i.created_at)}</time>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CalendarClock, CalendarDays, CheckCircle2, Pencil, Users } from 'lucide-react'
import { api } from '../api'
import { addDays, fmtDay, fmtTime, startOfDay, useAgenda, type AgendaItem } from '../agenda'
import { KIND_COLOR } from '../types'
import { useQuick } from './quick'
import EventForm from './EventForm'

const ICON: Record<string, typeof Bell> = { meeting: Users, appointment: CalendarClock, task: CheckCircle2, reminder: Bell, followup: Users }
const LABEL: Record<string, string> = { followup: 'Follow-up' }

export function AgendaCard({ it, onDelete }: { it: AgendaItem; onDelete?: () => void }) {
  const [editing, setEditing] = useState(false)
  const Icon = ICON[it.kind] ?? Bell
  const canEdit = it.type === 'event'
  const inner = (
    <>
      <div className="ev-head"><Icon size={16} /><b>{LABEL[it.kind] ?? it.kind}</b><span>{fmtDay(it.when)}</span></div>
      <div className="ev-body"><strong>{it.title}</strong>{it.notes && <p>{it.notes}</p>}{it.who && <small>by {it.who}</small>}</div>
      {it.hasTime && <div className="ev-time">Start at {fmtTime(it.when)}{it.end ? ` – ${fmtTime(it.end)}` : ''}</div>}
    </>
  )
  return (
    <div className="ev" style={{ background: KIND_COLOR[it.kind] }}>
      {canEdit ? (
        <button type="button" className="ev-link ev-edit" onClick={() => setEditing(true)} aria-label={`Edit ${it.title}`}>
          {inner}
          <span className="ev-edit-hint"><Pencil size={12} /> Edit</span>
        </button>
      ) : it.link ? (
        <Link to={it.link} className="ev-link">{inner}</Link>
      ) : inner}
      {onDelete && <button className="ev-x" onClick={() => { if (confirm(`Delete “${it.title}”?`)) onDelete() }} aria-label="Delete event">×</button>}
      {editing && <EventForm event={it} onClose={() => setEditing(false)} />}
    </div>
  )
}

export default function EventsPanel() {
  const quick = useQuick()
  const qc = useQueryClient()
  const from = startOfDay(new Date())
  const { data } = useAgenda(from, addDays(from, 14))
  const del = useMutation({ mutationFn: (id: string) => api.del(`/events/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }) })
  return (
    <aside className="events-panel">
      <h2>My Events <span className="h-ico"><CalendarDays size={26} strokeWidth={2.2} /></span></h2>
      <div className="ev-list">
        {data?.map((it) => <AgendaCard key={it.key} it={it} onDelete={it.type === 'event' ? () => del.mutate(it.id) : undefined} />)}
        <button className="ev-add" onClick={() => quick('event')}>+ Add event or appointment</button>
      </div>
    </aside>
  )
}

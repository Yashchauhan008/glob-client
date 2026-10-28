import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { api } from '../api'
import { addDays, sameDay, useAgenda, weekStart } from '../agenda'
import { AgendaCard } from '../components/EventsPanel'
import { useQuick } from '../components/quick'

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export default function Calendar() {
  const quick = useQuick()
  const qc = useQueryClient()
  const [start, setStart] = useState(weekStart(new Date()))
  const end = addDays(start, 7)
  const { data } = useAgenda(start, end)
  const del = useMutation({ mutationFn: (id: string) => api.del(`/events/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }) })
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const range = `${start.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} – ${addDays(start, 6).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}`

  return (
    <>
      <div className="page-head">
        <h1>Timetable <span className="h-ico"><CalendarDays size={34} strokeWidth={2.2} /></span></h1>
        <div className="actions">
          <div className="seg">
            <button onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={16} /></button>
            <button className="on">{range}</button>
            <button onClick={() => setStart(addDays(start, 7))}><ChevronRight size={16} /></button>
          </div>
          <button className="btn ghost" onClick={() => setStart(weekStart(new Date()))}>Today</button>
          <button className="btn" onClick={() => quick('event')}>+ Add event</button>
        </div>
      </div>
      <p className="muted legend">Events, tasks with a due date and lead follow-ups all land here.</p>
      <div className="week">
        {days.map((d) => {
          const items = data?.filter((it) => sameDay(it.when, d)) ?? []
          const today = sameDay(d, new Date())
          return (
            <div key={d.toISOString()} className="day">
              <div className={'day-head' + (today ? ' today' : '')}>
                <span>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span><b>{d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</b>
                <button onClick={() => quick('event', { date: iso(d) })} aria-label="Add on this day"><Plus size={14} /></button>
              </div>
              {items.map((it) => <AgendaCard key={it.key} it={it} onDelete={it.type === 'event' ? () => del.mutate(it.id) : undefined} />)}
              {!items.length && <div className="day-empty">free</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}

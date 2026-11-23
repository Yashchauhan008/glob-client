import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { EVENT_KINDS, type Idea } from '../types'
import { Modal } from './ui'
import type { AgendaItem } from '../agenda'

const pad = (n: number) => String(n).padStart(2, '0')
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Edit an existing calendar event. */
export default function EventForm({ event, onClose }: { event: AgendaItem; onClose: () => void }) {
  const qc = useQueryClient()
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: () => api.get<{ items: Idea[] }>('/ideas') })
  const [err, setErr] = useState('')
  const save = useMutation({
    mutationFn: (body: object) => api.patch(`/events/${event.id}`, body),
    onSuccess: () => {
      ;['agenda', 'events', 'dashboard', 'alerts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      onClose()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const g = (k: string) => String(f.get(k) || '').trim()
    const start = new Date(`${g('date')}T${g('start') || '09:00'}`)
    const end = g('end') ? new Date(`${g('date')}T${g('end')}`) : null
    if (Number.isNaN(start.getTime())) return setErr('Pick a valid start time')
    setErr('')
    save.mutate({
      title: g('title'),
      kind: g('kind'),
      starts_at: start.toISOString(),
      ends_at: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
      notes: g('notes'),
      idea_id: g('idea_id') || null,
    })
  }

  return (
    <Modal title="Edit event" onClose={onClose}>
      <form onSubmit={submit}>
        <input name="title" defaultValue={event.title} placeholder="Title" required autoFocus />
        <select name="kind" defaultValue={event.kind}>
          {EVENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input name="date" type="date" defaultValue={localDate(event.when)} required />
        <div className="two">
          <input name="start" type="time" defaultValue={localTime(event.when)} required />
          <input name="end" type="time" defaultValue={event.end ? localTime(event.end) : ''} />
        </div>
        <textarea name="notes" defaultValue={event.notes || ''} placeholder="Notes" rows={3} />
        <select name="idea_id" defaultValue={event.idea_id ?? ''}>
          <option value="">Link to an idea…</option>
          {ideas.data?.items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
        {err && <div className="form-err">{err}</div>}
        <button className="btn" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</button>
      </form>
    </Modal>
  )
}

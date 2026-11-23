import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { PinMap, tagColor, type Pin } from './maps'
import PinForm from './PinForm'
import { askDelete, Empty } from './ui'

const NONE: Pin[] = []

/**
 * Saved places with tags. `base` is the API path: '/pins' for the team you are in (everyone in it sees them),
 * '/personal/pins' for your own (only you).
 */
export default function PinsPanel({ base, height = 440 }: { base: string; height?: number }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const pins = useQuery({ queryKey: [base], queryFn: () => api.get<{ items: Pin[] }>(base).then((r) => r.items) })
  const [filter, setFilter] = useState<string | null>(null)
  const [form, setForm] = useState<{ pin?: Pin | null; spot?: { lat: number; lng: number } | null } | null>(null)

  const all = pins.data ?? NONE
  const shown = useMemo(() => (filter ? all.filter((p) => p.tag === filter) : all), [all, filter])
  const used = useMemo(() => [...new Set(all.map((p) => p.tag))], [all])

  const refresh = () => { qc.invalidateQueries({ queryKey: [base] }); qc.invalidateQueries({ queryKey: ['personal', 'overview'] }) }
  const remove = useMutation({ mutationFn: (id: string) => api.del(`${base}/${id}`), onSuccess: refresh })

  return (
    <div className="pins">
      <div className="pins-bar">
        <div className="tag-row">
          <button className={'tag-chip' + (filter === null ? ' on' : '')} onClick={() => setFilter(null)}>All <b>{all.length}</b></button>
          {used.map((t) => (
            <button key={t} className={'tag-chip' + (filter === t ? ' on' : '')} onClick={() => setFilter(filter === t ? null : t)}>
              <i style={{ background: tagColor(t) }} />{t} <b>{all.filter((p) => p.tag === t).length}</b>
            </button>
          ))}
        </div>
        <button className="btn small" onClick={() => setForm({})}><Plus size={14} /> Pin a place</button>
      </div>

      {form && (
        <PinForm
          key={form.pin?.id ?? 'new'}
          base={base}
          pin={form.pin}
          initialSpot={form.spot}
          onClose={() => setForm(null)}
        />
      )}

      <PinMap
        pins={shown}
        height={height}
        free
        onSelect={(p) => setForm({ pin: p })}
        onPick={(lat, lng) => setForm({ spot: { lat, lng } })}
      />

      {pins.isLoading ? null : !shown.length ? <Empty>{all.length ? 'No pins with that tag.' : 'No places pinned yet. Pin the first one.'}</Empty> : (
        <ul className="pin-list">
          {shown.map((p) => (
            <li key={p.id}>
              <button type="button" className="pin-row" onClick={() => setForm({ pin: p })}>
                <i className="pin-dot" style={{ background: tagColor(p.tag) }} />
                <span className="pin-main"><b>{p.title}</b><small>{[p.address, p.note].filter(Boolean).join(' · ') || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}</small></span>
                <span className="chip">{p.tag}</span>
                {p.owner_name && <small className="muted">{p.owner_id === user?.id ? 'you' : p.owner_name}</small>}
              </button>
              <button className="icon-btn" title="Edit pin" aria-label={`Edit ${p.title}`} onClick={() => setForm({ pin: p })}><Pencil size={14} /></button>
              <button className="icon-btn danger" title="Delete pin" aria-label={`Delete ${p.title}`} disabled={remove.isPending}
                onClick={() => { if (askDelete(`Delete “${p.title}”?`)) remove.mutate(p.id) }}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

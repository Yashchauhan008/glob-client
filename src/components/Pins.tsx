import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LocateFixed, MapPin, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { AddressSearch, PinMap, tagColor, type Pin } from './maps'
import { Empty } from './ui'

const NONE: Pin[] = []

/**
 * Saved places with tags. `base` is the API path: '/pins' for the team you are in (everyone in it sees them),
 * '/personal/pins' for your own (only you).
 */
export default function PinsPanel({ base, height = 440 }: { base: string; height?: number }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const pins = useQuery({ queryKey: [base], queryFn: () => api.get<{ items: Pin[] }>(base).then((r) => r.items) })
  const tags = useQuery({ queryKey: [base, 'tags'], queryFn: () => api.get<{ items: string[] }>(`${base}/tags`).then((r) => r.items) })
  const [filter, setFilter] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ title: '', tag: 'visited', note: '', address: '' })
  const [spot, setSpot] = useState<{ lat: number; lng: number } | null>(null)
  const [err, setErr] = useState('')

  const all = pins.data ?? NONE
  const shown = useMemo(() => (filter ? all.filter((p) => p.tag === filter) : all), [all, filter])
  const used = useMemo(() => [...new Set(all.map((p) => p.tag))], [all])

  const refresh = () => { qc.invalidateQueries({ queryKey: [base] }); qc.invalidateQueries({ queryKey: ['personal', 'overview'] }) }
  const add = useMutation({
    mutationFn: () => api.post(base, { title: f.title, tag: f.tag, note: f.note, address: f.address, latitude: spot!.lat, longitude: spot!.lng }),
    onSuccess: () => { setF({ ...f, title: '', note: '', address: '' }); setSpot(null); setAdding(false); setErr(''); refresh() },
    onError: (e: Error) => setErr(e instanceof ApiError ? e.message : 'Could not save the pin'),
  })
  const remove = useMutation({ mutationFn: (id: string) => api.del(`${base}/${id}`), onSuccess: refresh })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.title.trim()) return setErr('Give the place a name')
    if (!spot) return setErr('Choose where it is: search an address, use your location, or Ctrl/⌘-click the map')
    setErr(''); add.mutate()
  }
  const here = () => navigator.geolocation?.getCurrentPosition(
    (p) => setSpot({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => setErr('Could not get your location. Search an address or click the map instead.'),
  )

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
        <button className="btn small" onClick={() => setAdding(!adding)}><Plus size={14} /> {adding ? 'Close' : 'Pin a place'}</button>
      </div>

      {adding && (
        <form className="pin-form" onSubmit={submit}>
          <input value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Name of the place" aria-label="Place name" autoFocus />
          <div className="pin-tag">
            <input value={f.tag} maxLength={40} list="pin-tags" onChange={(e) => setF({ ...f, tag: e.target.value })} placeholder="Tag, e.g. visited" aria-label="Tag" />
            <datalist id="pin-tags">{tags.data?.map((t) => <option key={t} value={t} />)}</datalist>
            <span className="tag-row">{tags.data?.slice(0, 6).map((t) => (
              <button type="button" key={t} className={'tag-chip' + (f.tag === t ? ' on' : '')} onClick={() => setF({ ...f, tag: t })}><i style={{ background: tagColor(t) }} />{t}</button>
            ))}</span>
          </div>
          <AddressSearch value={f.address} onChange={(v) => { setF((p) => ({ ...p, address: v.address })); if (v.latitude != null && v.longitude != null) setSpot({ lat: v.latitude, lng: v.longitude }) }} />
          <div className="pin-spot">
            <button type="button" className="btn small ghost" onClick={here}><LocateFixed size={14} /> Use my location</button>
            <small className="muted">{spot ? `Pinned at ${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}` : 'or hold Ctrl/⌘ and click the map'}</small>
          </div>
          <textarea value={f.note} maxLength={2000} rows={2} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Note (optional)" aria-label="Note" />
          {err && <p className="tc-err">{err}</p>}
          <button className="btn" disabled={add.isPending}><MapPin size={15} /> Save pin</button>
        </form>
      )}

      <PinMap pins={shown} height={height} draft={adding ? spot : null} onPick={adding ? (lat, lng) => setSpot({ lat, lng }) : undefined} />

      {pins.isLoading ? null : !shown.length ? <Empty>{all.length ? 'No pins with that tag.' : 'No places pinned yet. Pin the first one.'}</Empty> : (
        <ul className="pin-list">
          {shown.map((p) => (
            <li key={p.id}>
              <i className="pin-dot" style={{ background: tagColor(p.tag) }} />
              <span className="pin-main"><b>{p.title}</b><small>{[p.address, p.note].filter(Boolean).join(' · ') || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}</small></span>
              <span className="chip">{p.tag}</span>
              {p.owner_name && <small className="muted">{p.owner_id === user?.id ? 'you' : p.owner_name}</small>}
              <button className="icon-btn danger" title="Delete pin" aria-label={`Delete ${p.title}`} disabled={remove.isPending}
                onClick={() => { if (confirm(`Delete “${p.title}”?`)) remove.mutate(p.id) }}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

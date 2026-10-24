import { useState, type FormEvent } from 'react'
import { STAGES, type Lead } from '../types'
import { AddressSearch } from './maps'

const toLocal = (s: string | null) => {
  if (!s) return ''
  const d = new Date(s)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function LeadForm({ lead, onSubmit, busy, error }: { lead?: Lead; onSubmit: (b: object) => void; busy?: boolean; error?: string }) {
  const [stage, setStage] = useState(lead?.stage ?? 'new')
  const [loc, setLoc] = useState({ address: lead?.address ?? '', lat: lead?.latitude?.toString() ?? '', lng: lead?.longitude?.toString() ?? '' })

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const s = (k: string) => String(f.get(k) || '').trim() || null
    const follow = String(f.get('follow') || '')
    onSubmit({
      name: String(f.get('name')).trim(), email: s('email') ?? '', phone: s('phone'), company: s('company'), source: s('source'),
      stage, lost_reason: stage === 'lost' ? s('lost_reason') : null,
      next_follow_up_at: follow ? new Date(follow).toISOString() : null,
      address: loc.address || null,
      latitude: loc.lat && loc.lng ? Number(loc.lat) : null,
      longitude: loc.lat && loc.lng ? Number(loc.lng) : null,
    })
  }

  return (
    <form onSubmit={submit} className="stack">
      <input name="name" placeholder="Name" defaultValue={lead?.name} required autoFocus />
      <div className="two"><input name="email" type="email" placeholder="Email" defaultValue={lead?.email ?? ''} /><input name="phone" placeholder="Phone" defaultValue={lead?.phone ?? ''} /></div>
      <div className="two"><input name="company" placeholder="Company" defaultValue={lead?.company ?? ''} /><input name="source" placeholder="Source" defaultValue={lead?.source ?? ''} /></div>
      <div className="two">
        <select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        <input name="follow" type="datetime-local" defaultValue={toLocal(lead?.next_follow_up_at ?? null)} title="Next follow-up" />
      </div>
      {stage === 'lost' && <input name="lost_reason" placeholder="Lost reason" defaultValue={lead?.lost_reason ?? ''} />}
      <AddressSearch value={loc.address} onChange={(v) => setLoc((p) => ({ address: v.address, lat: v.latitude != null ? String(v.latitude) : p.lat, lng: v.longitude != null ? String(v.longitude) : p.lng }))} />
      <div className="two">
        <input placeholder="Latitude" value={loc.lat} onChange={(e) => setLoc({ ...loc, lat: e.target.value })} />
        <input placeholder="Longitude" value={loc.lng} onChange={(e) => setLoc({ ...loc, lng: e.target.value })} />
      </div>
      {error && <div className="form-err">{error}</div>}
      <button className="btn" disabled={busy}>{lead ? 'Save' : 'Create lead'}</button>
    </form>
  )
}

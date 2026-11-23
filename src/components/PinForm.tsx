import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LocateFixed, MapPin } from 'lucide-react'
import { api, ApiError } from '../api'
import { AddressSearch, tagColor, type Pin } from './maps'
import { Modal } from './ui'

type Draft = { lat: number; lng: number }

/** Create or edit a map pin in a popup. */
export default function PinForm({
  base,
  pin,
  initialSpot,
  onClose,
}: {
  base: string
  pin?: Pin | null
  initialSpot?: Draft | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const tags = useQuery({ queryKey: [base, 'tags'], queryFn: () => api.get<{ items: string[] }>(`${base}/tags`).then((r) => r.items) })
  const [title, setTitle] = useState(pin?.title ?? '')
  const [tag, setTag] = useState(pin?.tag ?? 'visited')
  const [note, setNote] = useState(pin?.note ?? '')
  const [address, setAddress] = useState(pin?.address ?? '')
  const [coords, setCoords] = useState({
    lat: pin ? String(pin.latitude) : initialSpot ? String(+initialSpot.lat.toFixed(6)) : '',
    lng: pin ? String(pin.longitude) : initialSpot ? String(+initialSpot.lng.toFixed(6)) : '',
  })
  const [err, setErr] = useState('')

  const num = (v: string, max: number) => {
    const n = Number(v.trim())
    return v.trim() !== '' && Number.isFinite(n) && Math.abs(n) <= max ? n : null
  }
  const la = num(coords.lat, 90), lo = num(coords.lng, 180)
  const spot = la !== null && lo !== null ? { lat: la, lng: lo } : null
  const setSpot = (s: Draft | null) => setCoords(s ? { lat: String(+s.lat.toFixed(6)), lng: String(+s.lng.toFixed(6)) } : { lat: '', lng: '' })
  const typeCoord = (which: 'lat' | 'lng', v: string) => {
    const pair = v.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/)
    setCoords(pair ? { lat: pair[1], lng: pair[2] } : { ...coords, [which]: v })
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: [base] })
    qc.invalidateQueries({ queryKey: [base, 'tags'] })
    qc.invalidateQueries({ queryKey: ['personal', 'overview'] })
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { title: title.trim(), tag: tag.trim(), note, address, latitude: spot!.lat, longitude: spot!.lng }
      return pin ? api.patch(`${base}/${pin.id}`, body) : api.post(base, body)
    },
    onSuccess: () => { refresh(); onClose() },
    onError: (e: Error) => setErr(e instanceof ApiError ? e.message : 'Could not save the pin'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setErr('Give the place a name')
    if (!tag.trim()) return setErr('Give it a tag, e.g. visited')
    if (!spot) {
      return setErr(
        coords.lat || coords.lng
          ? 'Latitude must be between -90 and 90, and longitude between -180 and 180'
          : 'Choose where it is: search an address, enter coordinates, or use your location',
      )
    }
    setErr('')
    save.mutate()
  }

  const here = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setSpot({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setErr('Could not get your location. Search an address or enter coordinates instead.'),
    )

  const tagTrim = tag.trim()

  return (
    <Modal title={pin ? 'Edit pin' : 'Pin a place'} onClose={onClose}>
      <form className="pin-form pin-form-modal" onSubmit={submit}>
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Name of the place" aria-label="Place name" autoFocus />
        <div className="pin-tag">
          <label className="pin-label" htmlFor="pin-tag-input">Tag <small>pick one below, or type your own</small></label>
          <input id="pin-tag-input" value={tag} maxLength={40} list="pin-tags-modal" onFocus={(e) => e.target.select()} onChange={(e) => setTag(e.target.value)} placeholder="e.g. visited, coffee spot, client site" />
          {tagTrim && !tags.data?.includes(tagTrim.toLowerCase()) && <small className="muted">New tag “{tagTrim.toLowerCase()}” will be created.</small>}
          <datalist id="pin-tags-modal">{tags.data?.map((t) => <option key={t} value={t} />)}</datalist>
          <span className="tag-row">{tags.data?.map((t) => (
            <button type="button" key={t} className={'tag-chip' + (tag === t ? ' on' : '')} onClick={() => setTag(t)}>
              <i style={{ background: tagColor(t) }} />{t}
            </button>
          ))}</span>
        </div>
        <label className="pin-label">Where <small>search an address, or enter the coordinates</small></label>
        <AddressSearch value={address} onChange={(v) => { setAddress(v.address); if (v.latitude != null && v.longitude != null) setSpot({ lat: v.latitude, lng: v.longitude }) }} />
        <div className="pin-coords">
          <input value={coords.lat} inputMode="decimal" onChange={(e) => typeCoord('lat', e.target.value)} placeholder="Latitude, e.g. 23.0225" aria-label="Latitude" aria-invalid={coords.lat !== '' && la === null} />
          <input value={coords.lng} inputMode="decimal" onChange={(e) => typeCoord('lng', e.target.value)} placeholder="Longitude, e.g. 72.5714" aria-label="Longitude" aria-invalid={coords.lng !== '' && lo === null} />
        </div>
        <div className="pin-spot">
          <button type="button" className="btn small ghost" onClick={here}><LocateFixed size={14} /> Use my location</button>
          {spot && <small className="muted">{spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}</small>}
        </div>
        <textarea value={note} maxLength={2000} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
        {err && <p className="tc-err">{err}</p>}
        <button className="btn" disabled={save.isPending}>
          <MapPin size={15} /> {save.isPending ? 'Saving…' : pin ? 'Save changes' : 'Save pin'}
        </button>
      </form>
    </Modal>
  )
}

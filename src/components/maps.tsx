import { useEffect, useRef, useState } from 'react'
import type { Lead } from '../types'
import { STAGE_COLOR } from '../types'

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
const HOME = String(import.meta.env.VITE_MAP_HOME || '23.0225,72.5714,11').split(',').map(Number)
const home = { lat: HOME[0] ?? 23.0225, lng: HOME[1] ?? 72.5714, zoom: HOME[2] ?? 11 }

let loader: Promise<void> | null = null
function loadMaps(): Promise<void> {
  if (!KEY) return Promise.reject(new Error('Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env to enable maps.'))
  if ((window as any).google?.maps?.places) return Promise.resolve()
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&v=weekly`
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { loader = null; reject(new Error('Google Maps failed to load')) }
    document.head.appendChild(s)
  })
  return loader
}

function useMaps() {
  const [state, setState] = useState<{ ready: boolean; error: string }>({ ready: false, error: '' })
  useEffect(() => {
    loadMaps().then(() => setState({ ready: true, error: '' })).catch((e) => setState({ ready: false, error: e.message }))
  }, [])
  return state
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function makeOverlayClass() {
  const g = (window as any).google
  return class LeadMarker extends g.maps.OverlayView {
    el = document.createElement('div')
    pos: any
    constructor(pos: any, lead: Lead, onClick: () => void) {
      super()
      this.pos = pos
      this.el.className = 'lead-pin'
      this.el.innerHTML =
        `<span class="dot" style="background:${STAGE_COLOR[lead.stage]}"></span>` +
        `<span class="lbl"><b>${esc(lead.name)}</b>${lead.company ? `<small>${esc(lead.company)}</small>` : ''}</span>`
      this.el.onclick = (e) => { e.stopPropagation(); onClick() }
    }
    onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.el) }
    draw() {
      const p = this.getProjection().fromLatLngToDivPixel(this.pos)
      if (p) { this.el.style.left = p.x + 'px'; this.el.style.top = p.y + 'px' }
    }
    onRemove() { this.el.remove() }
  }
}

const DARK_MAP = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d21' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9a9aa3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d21' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c32' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a42' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1a2a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3a3a42' }] },
]

export function LeadMap({ leads, height = 420 }: { leads: Lead[]; height?: number }) {
  const { ready, error } = useMaps()
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoRef = useRef<any>(null)

  useEffect(() => {
    if (!ready || !ref.current || mapRef.current) return
    const g = (window as any).google
    mapRef.current = new g.maps.Map(ref.current, {
      center: { lat: home.lat, lng: home.lng }, zoom: home.zoom, disableDefaultUI: true, zoomControl: true, clickableIcons: false,
    })
    infoRef.current = new g.maps.InfoWindow()
  }, [ready])

  // follow the app theme
  useEffect(() => {
    const apply = () => mapRef.current?.setOptions({ styles: document.documentElement.dataset.theme === 'dark' ? DARK_MAP : [] })
    apply()
    window.addEventListener('glob-theme', apply)
    return () => window.removeEventListener('glob-theme', apply)
  }, [ready])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const g = (window as any).google
    markersRef.current.forEach((m) => m.setMap(null))
    const Marker = makeOverlayClass()
    const located = leads.filter((l) => l.latitude != null && l.longitude != null)
    const bounds = new g.maps.LatLngBounds()
    markersRef.current = located.map((l) => {
      const pos = new g.maps.LatLng(l.latitude, l.longitude)
      bounds.extend(pos)
      const m = new Marker(pos, l, () => {
        const rows = [l.company, l.stage, l.address, l.phone, l.email].filter(Boolean).map((v) => `<div>${esc(String(v))}</div>`).join('')
        infoRef.current.setContent(`<div class="map-card"><b>${esc(l.name)}</b>${rows}<a href="/leads/${l.id}">Open lead →</a></div>`)
        infoRef.current.setPosition(pos)
        infoRef.current.open(map)
      })
      m.setMap(map)
      return m
    })
    if (located.length === 1) { map.setCenter(bounds.getCenter()); map.setZoom(14) }
    else if (located.length > 1) map.fitBounds(bounds, 60)
    else { map.setCenter({ lat: home.lat, lng: home.lng }); map.setZoom(home.zoom) }
  }, [ready, leads])

  // the map only reacts while Ctrl/Cmd is held, so scrolling the page never gets stuck on it
  const [ctrl, setCtrl] = useState(false)
  const [hover, setHover] = useState(false)
  useEffect(() => {
    const on = (e: KeyboardEvent) => setCtrl(e.ctrlKey || e.metaKey)
    const off = () => setCtrl(false)
    window.addEventListener('keydown', on)
    window.addEventListener('keyup', on)
    window.addEventListener('blur', off)
    return () => { window.removeEventListener('keydown', on); window.removeEventListener('keyup', on); window.removeEventListener('blur', off) }
  }, [])

  if (error) return <div className="map-box notice" style={{ height }}>{error}</div>
  return (
    <div className="map-box" style={{ height }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
      {!ready && <div className="notice abs">Loading map…</div>}
      {ready && !ctrl && <div className="map-lock">{hover && <span>Hold Ctrl (⌘ on Mac) to use the map</span>}</div>}
    </div>
  )
}

/** Address input with Places autocomplete; reports address + coordinates. */
export function AddressSearch({ value, onChange }: { value: string; onChange: (v: { address: string; latitude?: number; longitude?: number }) => void }) {
  const { ready } = useMaps()
  const input = useRef<HTMLInputElement>(null)
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    if (!ready || !input.current) return
    const g = (window as any).google
    const ac = new g.maps.places.Autocomplete(input.current, { fields: ['formatted_address', 'geometry', 'name'] })
    const l = ac.addListener('place_changed', () => {
      const p = ac.getPlace()
      if (!p?.geometry?.location) return
      cb.current({ address: p.formatted_address || p.name || '', latitude: p.geometry.location.lat(), longitude: p.geometry.location.lng() })
    })
    return () => g.maps.event.removeListener(l)
  }, [ready])

  return <input ref={input} defaultValue={value} placeholder="Search address (optional)" onChange={(e) => onChange({ address: e.target.value })} />
}

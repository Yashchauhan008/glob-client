import { memo, useEffect, useRef, useState } from 'react'
import { Hand, Maximize2, Minimize2, Minus, Mic, MicOff, MonitorOff, MonitorUp, Phone, PhoneOff, Video, VideoOff, X } from 'lucide-react'
import { Track, type Participant } from 'livekit-client'
import { useVoice } from '../voice'
import { useCalls } from '../calls'
import { useAuth } from '../auth'
import { Pic } from '../messaging'
import { colorFor } from '../presence'
import { Face } from './Avatar'

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const mm = String(m).padStart(2, '0'), sec = String(ss).padStart(2, '0')
  return h ? `${h}:${mm}:${sec}` : `${mm}:${sec}`
}

function useElapsed(since: number | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!since) return
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [since])
  return since ? clock(now - since) : '00:00'
}

function Person({ id, name, talking }: { id: string; name: string; talking: boolean }) {
  return (
    <span className={'cp-av' + (talking ? ' talking' : '')} title={name}>
      <i style={{ background: colorFor(id) }}><Face id={id} name={name} /></i>
      {talking && <em className="wave"><b /><b /><b /><b /></em>}
    </span>
  )
}

/** Bottom-left: only while a call is going on. Yours (with controls), or a group call you can join. */
function Pill() {
  const v = useVoice()
  const c = useCalls()
  const { user } = useAuth()
  const joined = v.status === 'connected'
  const connecting = v.status === 'connecting'
  const mine = c.mine
  const open = c.calls.filter((x) => x.scope === 'group' && x.id !== mine?.id && x.participants.some((p) => p.state === 'joined'))
  const other = open[0]
  const dialling = !!mine && mine.status === 'ringing' && mine.initiator_id === user?.id && !mine.answered_at
  const since = mine ? (mine.answered_at ?? mine.started_at) : other?.started_at
  const elapsed = useElapsed(since ? new Date(since).getTime() : null)

  if (!mine && !other && !connecting) return c.error ? <div className="call-dock"><small className="cp-err">{c.error}</small></div> : null

  if (!mine && other) {
    const joinedPeople = other.participants.filter((p) => p.state === 'joined')
    return (
      <div className="call-dock pill">
        <span className="cp-live"><i />{elapsed}</span>
        <span className="cp-people">
          {joinedPeople.slice(0, 4).map((p) => <Person key={p.user_id} id={p.user_id} name={p.name} talking={false} />)}
          {joinedPeople.length > 4 && <span className="cp-more">+{joinedPeople.length - 4}</span>}
        </span>
        <span className="cp-label">Group {other.kind} call</span>
        <button className="cd voice sm" disabled={connecting} title="Join with voice" onClick={() => void c.join(other, false)}><span><Phone size={16} /></span>Join</button>
        <button className="cd video sm" disabled={connecting} title="Join with video" onClick={() => void c.join(other, true)}><span><Video size={16} /></span></button>
        {c.error && <small className="cp-err">{c.error}</small>}
      </div>
    )
  }

  const people = joined
    ? v.participants.map((p) => ({ id: p.identity, name: (p.isLocal ? 'You' : p.name) || 'Guest', talking: v.speaking.has(p.identity) }))
    : (mine?.participants ?? []).filter((p) => p.state !== 'declined' && p.state !== 'missed').map((p) => ({ id: p.user_id, name: p.name, talking: false }))
  const shown = people.slice(0, 4)

  return (
    <div className="call-dock pill">
      <span className="cp-live"><i />{dialling ? 'Calling…' : elapsed}</span>
      <span className="cp-people">
        {shown.map((p) => <Person key={p.id} {...p} />)}
        {people.length > shown.length && <span className="cp-more">+{people.length - shown.length}</span>}
      </span>
      {joined && (
        <>
          <button className={'cp-btn' + (v.micOn ? ' on' : ' off')} title={v.micOn ? 'Mute' : 'Unmute'} onClick={v.toggleMic}>{v.micOn ? <Mic size={17} /> : <MicOff size={17} />}</button>
          <button className={'cp-btn' + (v.camOn ? ' on' : ' off')} title={v.camOn ? 'Camera off' : 'Camera on'} onClick={v.toggleCam}>{v.camOn ? <Video size={17} /> : <VideoOff size={17} />}</button>
          {v.canShare && <button className={'cp-btn' + (v.screenOn ? ' on' : ' off')} title={v.screenOn ? 'Stop sharing screen' : 'Share your screen'} onClick={v.toggleScreen}>{v.screenOn ? <MonitorOff size={17} /> : <MonitorUp size={17} />}</button>}
          <button className={'cp-btn' + (v.handUp ? ' hand-on' : ' off')} title={v.handUp ? 'Lower hand' : 'Raise hand'} onClick={v.toggleHand}><Hand size={17} /></button>
        </>
      )}
      <button className="cp-btn end" title={dialling ? 'Cancel call' : 'Leave call'} onClick={() => void c.hangUp()}><PhoneOff size={17} /></button>
      {(v.error || c.error) && <small className="cp-err">{v.error || c.error}</small>}
    </div>
  )
}

/** A soft coloured glow along the top of the page that swells with whoever is talking. */
function Aurora() {
  const v = useVoice()
  const ref = useRef<HTMLDivElement>(null)
  const parts = useRef<Participant[]>([])
  parts.current = v.participants
  const on = v.status === 'connected'
  useEffect(() => {
    if (!on) return
    let raf = 0
    let level = 0
    const frame = () => {
      let target = 0
      for (const p of parts.current) target = Math.max(target, p.audioLevel || 0)
      level += (Math.min(1, target * 2.4) - level) * 0.22
      ref.current?.style.setProperty('--lvl', level.toFixed(3))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [on])
  return on ? <div ref={ref} className="aurora" aria-hidden><i /><i /><i /></div> : null
}

/** A ring tone made in the browser (no sound file needed). Browsers keep it silent until the page has been clicked once. */
function useRing(on: boolean) {
  useEffect(() => {
    if (!on) return
    let ctx: AudioContext | null = null
    let timer: ReturnType<typeof setInterval> | undefined
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
      const beep = () => {
        if (!ctx) return
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = 480
        g.gain.setValueAtTime(0.0001, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05)
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9)
        o.connect(g); g.connect(ctx.destination)
        o.start(); o.stop(ctx.currentTime + 1)
      }
      void ctx.resume().catch(() => {})
      beep()
      timer = setInterval(beep, 2000)
    } catch { /* no audio available */ }
    return () => { clearInterval(timer); void ctx?.close().catch(() => {}) }
  }, [on])
}

function IncomingCall() {
  const c = useCalls()
  const inc = c.incoming
  useRing(!!inc)
  if (!inc) return null
  const label = inc.call.scope === 'group' ? `Group ${inc.call.kind} call` : `${inc.call.kind === 'video' ? 'Video' : 'Voice'} call`
  return (
    <div className="incoming" role="alertdialog" aria-label={`Incoming call from ${inc.from.name}`}>
      <div className="incoming-card">
        <span className="incoming-pulse"><Pic id={inc.from.id} name={inc.from.name} url={inc.from.avatar_url} size={84} /></span>
        <b>{inc.from.name}</b>
        <small>Incoming {label.toLowerCase()}…</small>
        <div className="incoming-actions">
          <button className="decline" onClick={() => void c.decline()} aria-label="Decline"><PhoneOff size={22} /><span>Decline</span></button>
          <button className="accept" onClick={() => void c.answer()} aria-label="Answer">{inc.call.kind === 'video' ? <Video size={22} /> : <Phone size={22} />}<span>Answer</span></button>
        </div>
      </div>
    </div>
  )
}

/** "Smit raised a hand", like Meet. */
function HandToast() {
  const v = useVoice()
  const [note, setNote] = useState<{ id: string; name: string } | null>(null)
  const seen = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (v.status !== 'connected') { seen.current = new Set(); return }
    for (const id of v.hands) {
      if (seen.current.has(id)) continue
      const p = v.participants.find((x) => x.identity === id)
      if (p && !p.isLocal) setNote({ id, name: p.name || 'Someone' })
    }
    seen.current = new Set(v.hands)
  }, [v.hands, v.participants, v.status])
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 6000)
    return () => clearTimeout(t)
  }, [note])
  if (!note) return null
  return <div className="hand-toast"><Hand size={16} /><b>{note.name}</b> raised a hand<button onClick={() => setNote(null)} aria-label="Dismiss"><X size={14} /></button></div>
}

const MAX_SMALL = 8

/** Keep at most `max` tiles; the last slot becomes a "+N" tile so nobody is silently cut off. */
const cap = <T,>(list: T[], max: number) =>
  list.length > max ? { shown: list.slice(0, max - 1), extra: list.length - (max - 1) } : { shown: list, extra: 0 }

function useAttach(track: { attach: (el: HTMLVideoElement) => unknown; detach: (el: HTMLVideoElement) => unknown } | undefined) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    track.attach(el)
    return () => { track.detach(el) }
  }, [track])
  return ref
}

/** One person: their camera, or an avatar when it's off. */
const PersonTile = memo(function PersonTile({ p, talking, micOn, tick }: { p: Participant; talking: boolean; micOn: boolean; tick: number }) {
  void tick
  const track = p.isCameraEnabled ? p.getTrackPublication(Track.Source.Camera)?.videoTrack : undefined
  const ref = useAttach(track)
  const muted = !(p.isLocal ? micOn : p.isMicrophoneEnabled)
  return (
    <div className={'vp-tile' + (talking ? ' talking' : '')}>
      {track ? <video ref={ref} autoPlay playsInline muted /> : <i className="vp-av" style={{ background: colorFor(p.identity) }}><Face id={p.identity} name={p.name || '?'} /></i>}
      <span>{p.isLocal ? 'You' : p.name}{muted && <MicOff size={11} />}</span>
      {p.attributes?.hand === '1' && <em className="vp-hand"><Hand size={14} /></em>}
    </div>
  )
})

/** Someone else's shared screen. Yours is never played back to you (it would mirror itself). */
const ScreenTile = memo(function ScreenTile({ p, tick }: { p: Participant; tick: number }) {
  void tick
  const ref = useAttach(p.getTrackPublication(Track.Source.ScreenShare)?.videoTrack)
  return (
    <div className="vp-tile screen">
      <video ref={ref} autoPlay playsInline muted />
      <span>{p.name}'s screen</span>
    </div>
  )
})

/** Only exists while a camera or screen share is on. Everyone in the call gets a tile. */
function VideoPopup() {
  const v = useVoice()
  const [full, setFull] = useState(false)
  const [mini, setMini] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  const screens = v.participants.filter((p) => p.isScreenShareEnabled && !p.isLocal)
  const presenting = v.screenOn
  const anyVideo = v.participants.some((p) => p.isCameraEnabled) || screens.length > 0 || presenting
  if (v.status !== 'connected' || !anyVideo) return null

  // people with a camera first, so they are never the ones hidden behind "+N"
  const people = [...v.participants].sort((a, b) => Number(b.isCameraEnabled) - Number(a.isCameraEnabled))
  const stage = screens.length > 0
  const n = people.length
  const { shown, extra } = cap(people, stage ? 5 : full ? 24 : MAX_SMALL)
  const slots = shown.length + (extra ? 1 : 0)

  // grid shape follows head-count (like Meet): 1 → 1 col, 2–4 → 2 cols, more → 3
  const cols = full ? (slots <= 1 ? 1 : slots === 2 ? 2 : Math.ceil(Math.sqrt(slots))) : slots <= 1 ? 1 : slots <= 4 ? 2 : 3
  const rows = Math.ceil(slots / cols)
  const size = stage || presenting ? 'w-screen' : n <= 1 ? 'w-1' : n <= 4 ? 'w-2' : 'w-3'

  const onDown = (e: React.PointerEvent) => {
    if (full || (e.target as HTMLElement).closest('button') || !box.current) return
    const r = box.current.getBoundingClientRect()
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy })
  }
  const onUp = () => {
    if (!drag.current || !box.current || !pos) { drag.current = null; return }
    drag.current = null
    const { width, height } = box.current.getBoundingClientRect()
    const left = pos.x + width / 2 < window.innerWidth / 2
    const top = pos.y + height / 2 < window.innerHeight / 2
    setPos({ x: left ? 16 : window.innerWidth - width - 16, y: top ? 76 : window.innerHeight - height - 84 })
  }

  const people$ = (
    <>
      {shown.map((p) => <PersonTile key={p.identity} p={p} talking={v.speaking.has(p.identity)} micOn={v.micOn} tick={v.tick} />)}
      {extra > 0 && <div className="vp-tile more"><b>+{extra}</b><span>more</span></div>}
    </>
  )

  const style = full || !pos ? undefined : { left: pos.x, top: pos.y, bottom: 'auto' }
  return (
    <div ref={box} className={'vpop ' + size + (full ? ' full' : '') + (mini ? ' mini' : '')} style={style}>
      <div className="vp-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onClick={() => { if (mini) setMini(false) }}>
        <b>{stage || presenting ? <MonitorUp size={14} /> : <Video size={14} />} {stage || presenting ? 'Screen share' : 'Video'} · {n}</b>
        <span>
          <button title={mini ? 'Restore' : 'Minimise'} onClick={(e) => { e.stopPropagation(); setMini(!mini); setFull(false) }}>{mini ? <Maximize2 size={14} /> : <Minus size={14} />}</button>
          {!mini && <button title={full ? 'Exit full screen' : 'Full screen'} onClick={() => setFull(!full)}>{full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>}
        </span>
      </div>
      {!mini && presenting && (
        <div className="vp-presenting">
          <MonitorUp size={16} /><b>You're presenting to everyone</b>
          <button onClick={v.toggleScreen}>Stop</button>
        </div>
      )}
      {!mini && (stage ? (
        <div className="vp-stage">
          <div className="vp-main" style={{ gridTemplateColumns: `repeat(${screens.length > 1 ? 2 : 1}, 1fr)` }}>
            {screens.map((p) => <ScreenTile key={p.identity} p={p} tick={v.tick} />)}
          </div>
          <div className="vp-strip">{people$}</div>
        </div>
      ) : (
        <div className="vp-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, ...(full ? { gridTemplateRows: `repeat(${rows}, 1fr)` } : {}) }}>{people$}</div>
      ))}
    </div>
  )
}

export default function CallPanel() {
  return <><Aurora /><Pill /><VideoPopup /><IncomingCall /><HandToast /></>
}

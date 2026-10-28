import { memo, useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Minus, Mic, MicOff, MonitorOff, MonitorUp, Phone, PhoneOff, Video, VideoOff } from 'lucide-react'
import { Track, type Participant } from 'livekit-client'
import { useVoice } from '../voice'
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

/** Bottom-left: two launch buttons, or a small pill once a call is going. */
function Pill() {
  const v = useVoice()
  const joined = v.status === 'connected'
  const connecting = v.status === 'connecting'
  const since = joined ? (v.live.startedAt ?? v.joinedAt) : v.live.startedAt
  const elapsed = useElapsed(joined || v.live.active ? since : null)

  if (!joined && !v.live.active) {
    return (
      <div className="call-dock">
        <button className="cd voice" disabled={connecting} onClick={() => void v.join(false)}><span><Phone size={18} /></span>{connecting ? 'Joining…' : 'Voice'}</button>
        <button className="cd video" disabled={connecting} onClick={() => void v.join(true)}><span><Video size={18} /></span>Video</button>
        {v.error && <small className="cp-err">{v.error}</small>}
      </div>
    )
  }

  const people = joined
    ? v.participants.map((p) => ({ id: p.identity, name: (p.isLocal ? 'You' : p.name) || 'Guest', talking: v.speaking.has(p.identity) }))
    : v.live.participants.map((p) => ({ id: p.id, name: p.name, talking: false }))
  const shown = people.slice(0, 4)

  return (
    <div className="call-dock pill">
      <span className="cp-live"><i />{elapsed}</span>
      <span className="cp-people">
        {shown.map((p) => <Person key={p.id} {...p} />)}
        {people.length > shown.length && <span className="cp-more">+{people.length - shown.length}</span>}
      </span>
      {joined ? (
        <>
          <button className="cp-chip" title={v.mode === 'open' ? 'Switch to push to talk' : 'Switch to open mic'} onClick={() => v.setMode(v.mode === 'open' ? 'ptt' : 'open')}>
            {v.mode === 'open' ? 'Open mic' : 'Push to talk'}
          </button>
          {v.mode === 'open'
            ? <button className={'cp-btn' + (v.micOn ? ' on' : ' off')} title={v.micOn ? 'Mute' : 'Unmute'} onClick={v.toggleMic}>{v.micOn ? <Mic size={17} /> : <MicOff size={17} />}</button>
            : <button className={'cp-btn ptt' + (v.micOn ? ' on' : ' off')} title="Hold to talk (or hold Space)" onPointerDown={v.pttDown} onPointerUp={v.pttUp} onPointerLeave={v.pttUp}>
                {v.micOn ? <Mic size={17} /> : <MicOff size={17} />}<small>hold</small>
              </button>}
          <button className={'cp-btn' + (v.camOn ? ' on' : ' off')} title={v.camOn ? 'Camera off' : 'Camera on'} onClick={v.toggleCam}>{v.camOn ? <Video size={17} /> : <VideoOff size={17} />}</button>
          {v.canShare && <button className={'cp-btn' + (v.screenOn ? ' on' : ' off')} title={v.screenOn ? 'Stop sharing screen' : 'Share your screen'} onClick={v.toggleScreen}>{v.screenOn ? <MonitorOff size={17} /> : <MonitorUp size={17} />}</button>}
          <button className="cp-btn end" title="Leave call" onClick={v.leave}><PhoneOff size={17} /></button>
        </>
      ) : (
        <>
          {v.live.video && <span className="cp-vid" title="Someone has their camera on"><Video size={14} /></span>}
          <button className="cd voice sm" disabled={connecting} title="Join with voice" onClick={() => void v.join(false)}><span><Phone size={16} /></span>Join</button>
          <button className="cd video sm" disabled={connecting} title="Join with video" onClick={() => void v.join(true)}><span><Video size={16} /></span></button>
        </>
      )}
      {v.error && <small className="cp-err">{v.error}</small>}
    </div>
  )
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
  return <><Pill /><VideoPopup /></>
}

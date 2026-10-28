import { memo, useEffect, useRef, useState } from 'react'
import { Maximize2, MonitorOff, MonitorUp, Mic, MicOff, Minimize2, Phone, PhoneOff, Video, VideoOff } from 'lucide-react'
import { Track, type Participant } from 'livekit-client'
import { useVoice } from '../voice'
import { colorFor, initials } from '../presence'

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
      <i style={{ background: colorFor(id) }}>{initials(name)}</i>
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

type Source = 'camera' | 'screen'

const Tile = memo(function Tile({ p, source, talking, tick }: { p: Participant; source: Source; talking: boolean; tick: number }) {
  void tick
  const ref = useRef<HTMLVideoElement>(null)
  const track = p.getTrackPublication(source === 'screen' ? Track.Source.ScreenShare : Track.Source.Camera)?.videoTrack
  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    track.attach(el)
    return () => { track.detach(el) }
  }, [track])
  const who = p.isLocal ? 'You' : p.name
  return (
    <div className={'vp-tile' + (source === 'screen' ? ' screen' : '') + (talking ? ' talking' : '')}>
      <video ref={ref} autoPlay playsInline muted />
      <span>{source === 'screen' ? p.isLocal ? 'Your screen' : `${who}'s screen` : who}</span>
    </div>
  )
})

/** Only exists while a camera or a screen share is on. Drag it, snap it to a corner, or take it full screen. */
function VideoPopup() {
  const v = useVoice()
  const [full, setFull] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  const tiles: { p: Participant; source: Source }[] = v.participants.flatMap((p) => [
    ...(p.isCameraEnabled ? [{ p, source: 'camera' as const }] : []),
    ...(p.isScreenShareEnabled ? [{ p, source: 'screen' as const }] : []),
  ]).sort((a, b) => Number(b.source === 'screen') - Number(a.source === 'screen'))
  if (v.status !== 'connected' || !tiles.length) return null
  const hasScreen = tiles.some((t) => t.source === 'screen')

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

  const style = full || !pos ? undefined : { left: pos.x, top: pos.y, bottom: 'auto' }
  return (
    <div ref={box} className={'vpop' + (full ? ' full' : '') + (hasScreen ? ' has-screen' : '')} style={style}>
      <div className="vp-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
        <b>{hasScreen ? <MonitorUp size={14} /> : <Video size={14} />} {hasScreen ? 'Screen share' : `Video · ${tiles.length}`}</b>
        <span>
          <button title={full ? 'Exit full screen' : 'Full screen'} onClick={() => setFull(!full)}>{full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
        </span>
      </div>
      <div className="vp-grid">{tiles.map(({ p, source }) => <Tile key={p.identity + source} p={p} source={source} talking={v.speaking.has(p.identity)} tick={v.tick} />)}</div>
    </div>
  )
}

export default function CallPanel() {
  return <><Pill /><VideoPopup /></>
}

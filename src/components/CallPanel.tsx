import { useEffect, useRef, useState } from 'react'
import { Maximize2, Mic, MicOff, Minimize2, PhoneOff, Video, VideoOff, Radio } from 'lucide-react'
import { Track, type Participant } from 'livekit-client'
import { useVoice } from '../voice'
import { colorFor, initials } from '../presence'

function Tile({ p, talking }: { p: Participant; talking: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const track = p.getTrackPublication(Track.Source.Camera)?.videoTrack
  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    track.attach(el)
    return () => { track.detach(el) }
  }, [track])
  return (
    <div className={'call-tile' + (talking ? ' talking' : '')}>
      {track ? <video ref={ref} autoPlay playsInline muted /> : <i style={{ background: colorFor(p.identity) }}>{initials(p.name || '?')}</i>}
      <span>{p.isLocal ? 'You' : p.name}{!p.isMicrophoneEnabled && ' · muted'}</span>
    </div>
  )
}

export default function CallPanel() {
  const v = useVoice()
  const [full, setFull] = useState(false)
  const [mini, setMini] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  if (v.status !== 'connected') return null

  const onDown = (e: React.PointerEvent) => {
    if (full || (e.target as HTMLElement).closest('button')) return
    const r = e.currentTarget.parentElement!.getBoundingClientRect()
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setPos({
      x: Math.min(window.innerWidth - 80, Math.max(0, e.clientX - drag.current.dx)),
      y: Math.min(window.innerHeight - 50, Math.max(0, e.clientY - drag.current.dy)),
    })
  }
  const onUp = () => {
    drag.current = null
    // snap to the nearest corner so it never covers the middle of the page
    if (pos) setPos({ x: pos.x < window.innerWidth / 2 ? 16 : window.innerWidth - 316, y: pos.y < window.innerHeight / 2 ? 80 : window.innerHeight - 340 })
  }

  const style = full || !pos ? undefined : { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
  return (
    <div className={'call-panel' + (full ? ' full' : '') + (mini ? ' mini' : '')} style={style}>
      <div className="call-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
        <b><Radio size={14} /> Live call · {v.participants.length}</b>
        <span>
          <button title={mini ? 'Expand' : 'Minimise'} onClick={() => setMini(!mini)}>{mini ? <Maximize2 size={14} /> : <Minimize2 size={14} />}</button>
          <button title={full ? 'Back to corner' : 'Full screen'} onClick={() => { setFull(!full); setMini(false) }}>{full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
        </span>
      </div>
      {!mini && <div className="call-grid">{v.participants.map((p) => <Tile key={p.identity} p={p} talking={v.speaking.has(p.identity)} />)}</div>}
      {v.error && <div className="call-err">{v.error}</div>}
      <div className="call-bar">
        <div className="seg">
          <button className={v.mode === 'open' ? 'on' : ''} onClick={() => v.setMode('open')}>Open mic</button>
          <button className={v.mode === 'ptt' ? 'on' : ''} onClick={() => v.setMode('ptt')}>Push to talk</button>
        </div>
        {v.mode === 'open'
          ? <button className={'round' + (v.micOn ? '' : ' off')} title={v.micOn ? 'Mute' : 'Unmute'} onClick={v.toggleMic}>{v.micOn ? <Mic size={18} /> : <MicOff size={18} />}</button>
          : <button className={'round ptt' + (v.micOn ? '' : ' off')} title="Hold to talk (or hold Space)"
              onPointerDown={v.pttDown} onPointerUp={v.pttUp} onPointerLeave={v.pttUp}>{v.micOn ? <Mic size={18} /> : <MicOff size={18} />}<small>hold</small></button>}
        <button className={'round' + (v.camOn ? '' : ' off')} title={v.camOn ? 'Camera off' : 'Camera on'} onClick={v.toggleCam}>{v.camOn ? <Video size={18} /> : <VideoOff size={18} />}</button>
        <button className="round end" title="Leave call" onClick={v.leave}><PhoneOff size={18} /></button>
      </div>
    </div>
  )
}

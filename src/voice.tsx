import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Room, RoomEvent, Track, type Participant, type RemoteTrack } from 'livekit-client'

export type MicMode = 'open' | 'ptt'
type Status = 'idle' | 'connecting' | 'connected'

// phones and tablets cannot capture their screen from a web page; they can still watch
const CAN_SHARE = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function'

type VoiceCtx = {
  joinedAt: number | null
  status: Status
  error: string
  room: Room | null
  participants: Participant[]
  tick: number
  speaking: Set<string>
  mode: MicMode
  micOn: boolean
  camOn: boolean
  screenOn: boolean
  canShare: boolean
  joinWith: (conn: { url: string; token: string }, withVideo?: boolean) => Promise<void>
  handUp: boolean
  hands: Set<string>
  toggleHand: () => void
  leave: () => void
  setMode: (m: MicMode) => void
  toggleMic: () => void
  toggleCam: () => void
  toggleScreen: () => void
  pttDown: () => void
  pttUp: () => void
}

const Ctx = createContext<VoiceCtx | null>(null)
export const useVoice = () => useContext(Ctx)!

// Say what actually went wrong instead of always blaming permissions.
const deviceError = (e: unknown, what: 'microphone' | 'camera') => {
  const n = e instanceof Error ? e.name : ''
  if (n === 'NotAllowedError' || n === 'SecurityError') return `${what[0]!.toUpperCase()}${what.slice(1)} is blocked. Allow it in the browser address bar.`
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return `No ${what} found on this device.`
  if (n === 'NotReadableError' || n === 'AbortError') return `Your ${what} is being used by another app or tab. Close it and try again.`
  return `Could not start your ${what}.`
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const roomRef = useRef<Room | null>(null)
  const audioBox = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [tick, bump] = useState(0)
  const [speaking, setSpeaking] = useState<Set<string>>(new Set())
  const [mode, setModeState] = useState<MicMode>('open')
  const modeRef = useRef<MicMode>('open')
  const [micOn, setMicOn] = useState(false)
  const [camOn, setCamOn] = useState(false)
  const [screenOn, setScreenOn] = useState(false)
  const [handUp, setHandUp] = useState(false)
  const [joinedAt, setJoinedAt] = useState<number | null>(null)

  const rerender = useCallback(() => bump((n) => n + 1), [])

  // The button flips at once; the browser's mic call catches up in the background.
  // Calls are chained so a quick tap-tap (or push-to-talk release) can't land out of order.
  const micQueue = useRef<Promise<void>>(Promise.resolve())
  const micWant = useRef(false)
  const setMic = useCallback((on: boolean) => {
    if (!roomRef.current) return
    micWant.current = on
    setMicOn(on)
    micQueue.current = micQueue.current.then(async () => {
      const room = roomRef.current
      if (!room || room.localParticipant.isMicrophoneEnabled === micWant.current) return
      try { await room.localParticipant.setMicrophoneEnabled(micWant.current); setError('') }
      catch (e) { micWant.current = false; setMicOn(false); setError(deviceError(e, 'microphone')) }
    })
  }, [])

  const leave = useCallback(() => {
    roomRef.current?.disconnect()
    roomRef.current = null
    audioBox.current?.replaceChildren()
    micWant.current = false; setStatus('idle'); setJoinedAt(null); setMicOn(false); setCamOn(false); setScreenOn(false); setHandUp(false); setSpeaking(new Set())
  }, [])

  /** Join the LiveKit room of one particular call (the server hands out the address and token). */
  const joinWith = useCallback(async (conn: { url: string; token: string }, withVideo = false) => {
    if (roomRef.current) return
    setError(''); setStatus('connecting')
    try {
      const { url, token } = conn
      const room = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      roomRef.current = room
      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio) audioBox.current?.appendChild(track.attach())
          rerender()
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => { track.detach().forEach((el) => el.remove()); rerender() })
        .on(RoomEvent.ActiveSpeakersChanged, (s) => setSpeaking((prev) => {
          const next = new Set(s.map((p) => p.identity))
          return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next
        }))
        .on(RoomEvent.Reconnecting, () => setError('Connection unstable, reconnecting…'))
        .on(RoomEvent.Reconnected, () => setError(''))
        .on(RoomEvent.ParticipantConnected, rerender)
        .on(RoomEvent.ParticipantDisconnected, rerender)
        .on(RoomEvent.ParticipantAttributesChanged, rerender)
        .on(RoomEvent.TrackMuted, rerender)
        .on(RoomEvent.TrackUnmuted, rerender)
        .on(RoomEvent.LocalTrackPublished, rerender)
        .on(RoomEvent.LocalTrackUnpublished, () => { setScreenOn(room.localParticipant.isScreenShareEnabled); rerender() })
        .on(RoomEvent.Disconnected, () => { if (roomRef.current === room) leave() })
      await room.connect(url, token)
      await room.startAudio()
      setStatus('connected')
      setJoinedAt(Date.now())
      if (modeRef.current === 'open') setMic(true)
      if (withVideo) { setCamOn(true); room.localParticipant.setCameraEnabled(true).then(() => setError('')).catch((e: unknown) => { setCamOn(false); setError(deviceError(e, 'camera')) }) }
    } catch (e) {
      roomRef.current?.disconnect(); roomRef.current = null
      setStatus('idle'); setError(e instanceof Error ? e.message : 'Could not join the call')
    }
  }, [leave, rerender, setMic])

  const setMode = useCallback((m: MicMode) => {
    modeRef.current = m; setModeState(m)
    // open mic: hot now. push to talk: muted until the key/button is held.
    if (roomRef.current) setMic(m === 'open')
  }, [setMic])

  const toggleMic = useCallback(() => { setMic(!micWant.current) }, [setMic])
  const toggleCam = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const on = !room.localParticipant.isCameraEnabled
    setCamOn(on)
    room.localParticipant.setCameraEnabled(on).then(() => setError('')).catch((e: unknown) => { setCamOn(false); setError(deviceError(e, 'camera')) })
  }, [])
  // The browser's own "Stop sharing" bar also ends the track; LocalTrackUnpublished keeps the button in step.
  const toggleScreen = useCallback(() => {
    const room = roomRef.current
    if (!room || !CAN_SHARE) return
    const on = !room.localParticipant.isScreenShareEnabled
    setScreenOn(on)
    room.localParticipant.setScreenShareEnabled(on, { contentHint: 'detail' }).catch((e: unknown) => {
      setScreenOn(false)
      // closing the browser's picker is a cancel, not an error
      if (!(e instanceof Error && /permission|denied|notallowed|abort/i.test(e.name + e.message))) setError('Could not share the screen.')
    })
  }, [])
  const toggleHand = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const on = room.localParticipant.attributes?.hand !== '1'
    setHandUp(on)
    void room.localParticipant.setAttributes({ hand: on ? '1' : '' }).catch(() => setHandUp(!on))
  }, [])
  const pttDown = useCallback(() => { if (modeRef.current === 'ptt') setMic(true) }, [setMic])
  const pttUp = useCallback(() => { if (modeRef.current === 'ptt') setMic(false) }, [setMic])

  // hold Space to talk (ignored while typing in a field)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat && !typing(e.target) && roomRef.current && modeRef.current === 'ptt') { e.preventDefault(); pttDown() } }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space' && roomRef.current && modeRef.current === 'ptt') pttUp() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', pttUp)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', pttUp) }
  }, [pttDown, pttUp])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 6000)
    return () => clearTimeout(t)
  }, [error])

  useEffect(() => () => { roomRef.current?.disconnect() }, [])

  const value = useMemo<VoiceCtx>(() => {
    const room = roomRef.current
    const participants = room ? [room.localParticipant, ...room.remoteParticipants.values()] : []
    const hands = new Set(participants.filter((p) => p.attributes?.hand === '1').map((p) => p.identity))
    return { joinedAt, status, error, room, participants, tick, speaking, mode, micOn, camOn, screenOn, handUp, hands, toggleHand, canShare: CAN_SHARE, joinWith, leave, setMode, toggleMic, toggleCam, toggleScreen, pttDown, pttUp }
    // `tick` changes whenever someone joins, leaves or (un)mutes, so the participant list refreshes
  }, [tick, joinedAt, status, error, speaking, mode, micOn, camOn, screenOn, handUp, toggleHand, joinWith, leave, setMode, toggleMic, toggleCam, toggleScreen, pttDown, pttUp])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div ref={audioBox} style={{ display: 'none' }} />
    </Ctx.Provider>
  )
}

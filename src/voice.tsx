import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Room, RoomEvent, Track, type Participant, type RemoteTrack } from 'livekit-client'
import { api } from './api'

export type MicMode = 'open' | 'ptt'
type Status = 'idle' | 'connecting' | 'connected'

type VoiceCtx = {
  status: Status
  error: string
  room: Room | null
  participants: Participant[]
  tick: number
  speaking: Set<string>
  mode: MicMode
  micOn: boolean
  camOn: boolean
  join: () => Promise<void>
  leave: () => void
  setMode: (m: MicMode) => void
  toggleMic: () => void
  toggleCam: () => void
  pttDown: () => void
  pttUp: () => void
}

const Ctx = createContext<VoiceCtx | null>(null)
export const useVoice = () => useContext(Ctx)!

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
      try { await room.localParticipant.setMicrophoneEnabled(micWant.current) }
      catch { micWant.current = false; setMicOn(false); setError('Microphone blocked. Allow it in the browser address bar.') }
    })
  }, [])

  const leave = useCallback(() => {
    roomRef.current?.disconnect()
    roomRef.current = null
    audioBox.current?.replaceChildren()
    micWant.current = false; setStatus('idle'); setMicOn(false); setCamOn(false); setSpeaking(new Set())
  }, [])

  const join = useCallback(async () => {
    if (roomRef.current) return
    setError(''); setStatus('connecting')
    try {
      const { url, token } = await api.get<{ url: string; token: string }>('/voice/token')
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
        .on(RoomEvent.TrackMuted, rerender)
        .on(RoomEvent.TrackUnmuted, rerender)
        .on(RoomEvent.LocalTrackPublished, rerender)
        .on(RoomEvent.LocalTrackUnpublished, rerender)
        .on(RoomEvent.Disconnected, () => { if (roomRef.current === room) leave() })
      await room.connect(url, token)
      await room.startAudio()
      setStatus('connected')
      if (modeRef.current === 'open') setMic(true)
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
    room.localParticipant.setCameraEnabled(on).catch(() => { setCamOn(false); setError('Camera blocked. Allow it in the browser address bar.') })
  }, [])
  const pttDown = useCallback(() => { if (modeRef.current === 'ptt') setMic(true) }, [setMic])
  const pttUp = useCallback(() => { if (modeRef.current === 'ptt') setMic(false) }, [setMic])

  // hold Space to talk (ignored while typing in a field)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat && !typing(e.target) && roomRef.current) { e.preventDefault(); pttDown() } }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space' && roomRef.current && modeRef.current === 'ptt') pttUp() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', pttUp)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', pttUp) }
  }, [pttDown, pttUp])

  useEffect(() => () => { roomRef.current?.disconnect() }, [])

  const value = useMemo<VoiceCtx>(() => {
    const room = roomRef.current
    const participants = room ? [room.localParticipant, ...room.remoteParticipants.values()] : []
    return { status, error, room, participants, tick, speaking, mode, micOn, camOn, join, leave, setMode, toggleMic, toggleCam, pttDown, pttUp }
    // `tick` changes whenever someone joins, leaves or (un)mutes, so the participant list refreshes
  }, [tick, status, error, speaking, mode, micOn, camOn, join, leave, setMode, toggleMic, toggleCam, pttDown, pttUp])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div ref={audioBox} style={{ display: 'none' }} />
    </Ctx.Provider>
  )
}

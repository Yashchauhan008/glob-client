import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Room, RoomEvent, Track, type Participant, type RemoteTrack } from 'livekit-client'
import { api } from './api'

export type MicMode = 'open' | 'ptt'
type Status = 'idle' | 'connecting' | 'connected'

type VoiceCtx = {
  status: Status
  error: string
  room: Room | null
  participants: Participant[]
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
  const [, bump] = useState(0)
  const [speaking, setSpeaking] = useState<Set<string>>(new Set())
  const [mode, setModeState] = useState<MicMode>('open')
  const modeRef = useRef<MicMode>('open')
  const [micOn, setMicOn] = useState(false)
  const [camOn, setCamOn] = useState(false)

  const rerender = useCallback(() => bump((n) => n + 1), [])

  const setMic = useCallback(async (on: boolean) => {
    const room = roomRef.current
    if (!room) return
    try { await room.localParticipant.setMicrophoneEnabled(on); setMicOn(on) }
    catch { setError('Microphone blocked. Allow it in the browser address bar.'); setMicOn(false) }
  }, [])

  const leave = useCallback(() => {
    roomRef.current?.disconnect()
    roomRef.current = null
    audioBox.current?.replaceChildren()
    setStatus('idle'); setMicOn(false); setCamOn(false); setSpeaking(new Set())
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
        .on(RoomEvent.ActiveSpeakersChanged, (s) => setSpeaking(new Set(s.map((p) => p.identity))))
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
      if (modeRef.current === 'open') await setMic(true)
    } catch (e) {
      roomRef.current?.disconnect(); roomRef.current = null
      setStatus('idle'); setError(e instanceof Error ? e.message : 'Could not join the call')
    }
  }, [leave, rerender, setMic])

  const setMode = useCallback((m: MicMode) => {
    modeRef.current = m; setModeState(m)
    // open mic: hot now. push to talk: muted until the key/button is held.
    if (roomRef.current) void setMic(m === 'open')
  }, [setMic])

  const toggleMic = useCallback(() => { void setMic(!roomRef.current?.localParticipant.isMicrophoneEnabled) }, [setMic])
  const toggleCam = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const on = !room.localParticipant.isCameraEnabled
    try { await room.localParticipant.setCameraEnabled(on); setCamOn(on) }
    catch { setError('Camera blocked. Allow it in the browser address bar.') }
  }, [])
  const pttDown = useCallback(() => { if (modeRef.current === 'ptt') void setMic(true) }, [setMic])
  const pttUp = useCallback(() => { if (modeRef.current === 'ptt') void setMic(false) }, [setMic])

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

  const room = roomRef.current
  const participants = room ? [room.localParticipant, ...room.remoteParticipants.values()] : []
  return (
    <Ctx.Provider value={{ status, error, room, participants, speaking, mode, micOn, camOn, join, leave, setMode, toggleMic, toggleCam, pttDown, pttUp }}>
      {children}
      <div ref={audioBox} style={{ display: 'none' }} />
    </Ctx.Provider>
  )
}

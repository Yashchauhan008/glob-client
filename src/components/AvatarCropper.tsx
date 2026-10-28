import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Modal } from './ui'

const VIEW = 280 // size of the on-screen preview circle, in px
const OUT = 512 // size of the picture we send; the server shrinks it further

/** Pick which part of a photo becomes the profile picture: drag to move, slide or scroll to zoom. */
export default function AvatarCropper({ file, onCancel, onSave }: { file: File; onCancel: () => void; onSave: (cropped: File) => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const imgRef = useRef<HTMLImageElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [broken, setBroken] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 }) // image centre, relative to the preview centre
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  // the photo always covers the circle at zoom 1; zoom only makes it bigger
  const scale = size ? (VIEW / Math.min(size.w, size.h)) * zoom : 1
  const clamp = (o: { x: number; y: number }, s = scale) => {
    if (!size) return o
    const mx = Math.max(0, (size.w * s - VIEW) / 2), my = Math.max(0, (size.h * s - VIEW) / 2)
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) }
  }

  const changeZoom = (z: number) => {
    const next = Math.min(4, Math.max(1, z))
    if (!size) return
    setZoom(next)
    setOff((o) => clamp(o, (VIEW / Math.min(size.w, size.h)) * next))
  }

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setOff(clamp({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y }))
  }

  const save = async () => {
    const img = imgRef.current
    if (!img || !size) return
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = OUT
    const sw = VIEW / scale // the part of the photo inside the circle, in photo pixels
    const sx = (size.w * scale / 2 - VIEW / 2 - off.x) / scale
    const sy = (size.h * scale / 2 - VIEW / 2 - off.y) / scale
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sw, 0, 0, OUT, OUT)
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.92))
    if (blob) onSave(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
  }

  return (
    <Modal title="Your picture" onClose={onCancel}>
      {broken ? (
        <>
          <p className="muted">This photo type can't be previewed here. It will be uploaded as it is and centred automatically.</p>
          <div className="crop-actions"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn" onClick={() => onSave(file)}>Upload</button></div>
        </>
      ) : (
        <>
          <div
            className="crop-view" style={{ width: VIEW, height: VIEW }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null }}
            onWheel={(e) => changeZoom(zoom - e.deltaY / 400)}
          >
            <img
              ref={imgRef} src={url} alt="" draggable={false}
              onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setBroken(true)}
              style={size ? { width: size.w * scale, height: size.h * scale, transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))` } : { visibility: 'hidden' }}
            />
          </div>
          <p className="muted crop-hint">Drag to move. Slide to zoom.</p>
          <div className="crop-zoom">
            <button type="button" aria-label="Zoom out" onClick={() => changeZoom(zoom - 0.25)}><Minus size={16} /></button>
            <input type="range" min={1} max={4} step={0.01} value={zoom} aria-label="Zoom" onChange={(e) => changeZoom(Number(e.target.value))} />
            <button type="button" aria-label="Zoom in" onClick={() => changeZoom(zoom + 0.25)}><Plus size={16} /></button>
          </div>
          <div className="crop-actions"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn" disabled={!size} onClick={() => void save()}>Save picture</button></div>
        </>
      )}
    </Modal>
  )
}

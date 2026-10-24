import { colorFor, colorStrong, usePresence } from '../presence'

export default function Cursors() {
  const { cursors } = usePresence()
  return (
    <div className="cursor-layer">
      {cursors.map((c) => (
        <div key={c.user_id} className="cursor" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, color: colorStrong(c.user_id) }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 2l7 19 3-8 8-3z" stroke="#fff" strokeWidth="1.5" /></svg>
          <span style={{ background: colorFor(c.user_id) }}>{c.name}</span>
        </div>
      ))}
    </div>
  )
}

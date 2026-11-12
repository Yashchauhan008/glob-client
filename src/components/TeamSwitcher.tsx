import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Settings2 } from 'lucide-react'
import { useTeams } from '../teams'

/** The name of the team you are in, with a menu to move to another one. */
export default function TeamSwitcher() {
  const { teams, current, isRoot, switchTo } = useTeams()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  if (!current) return null
  const many = teams.length > 1 || isRoot
  return (
    <div className="team-switch" ref={ref}>
      <button className="team-pill" onClick={() => many && setOpen(!open)} aria-haspopup={many} aria-expanded={open} title={many ? 'Switch team' : current.name} style={many ? undefined : { cursor: 'default' }}>
        <b>{current.name}</b>{many && <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="menu team-menu" role="menu">
          {teams.map((t) => (
            <button key={t.id} role="menuitem" className={t.id === current.id ? 'on' : ''} onClick={() => { setOpen(false); switchTo(t.id) }}>
              <span className="tm-name">{t.name}</span>
              <small>{t.members}</small>
              {t.id === current.id && <Check size={15} />}
            </button>
          ))}
          {isRoot && <><hr /><Link to="/admin" onClick={() => setOpen(false)}><Settings2 size={16} /> Manage teams</Link></>}
        </div>
      )}
    </div>
  )
}

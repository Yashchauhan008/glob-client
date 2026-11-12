import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Check, Layers, LayoutGrid, Settings2, UserRound } from 'lucide-react'
import { useTeams } from '../teams'

/** A button for the bottom bar: shows the team you are in and opens a list to move to another one. */
export default function TeamSwitcher() {
  const { teams, current, isRoot, switchTo, leave } = useTeams()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !menu.current?.contains(t)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  if (!current) return null
  const tip = `Workspace: ${current.name}`
  return (
    <>
      <button ref={ref} className="mint" data-tip={tip} aria-label={`Switch team, now in ${current.name}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Layers size={20} strokeWidth={2} />
      </button>
      {open && createPortal(
        // outside the dock, so the dock's round-button styling does not apply to the list
        <div className="menu team-menu" role="menu" ref={menu}>
          {teams.map((t) => (
            <button key={t.id} role="menuitem" className={t.id === current.id ? 'on' : ''} onClick={() => { setOpen(false); switchTo(t.id) }}>
              <span className="tm-name">{t.name}</span>
              <small>{t.members}</small>
              {t.id === current.id && <Check size={15} />}
            </button>
          ))}
          <hr /><button role="menuitem" onClick={() => leave('/')}><LayoutGrid size={16} /> All workspaces</button>
          <button role="menuitem" onClick={() => leave('/personal/ideas')}><UserRound size={16} /> Personal space</button>
          {isRoot && <Link to="/admin" onClick={() => setOpen(false)}><Settings2 size={16} /> Manage teams</Link>}
        </div>,
        document.body,
      )}
    </>
  )
}

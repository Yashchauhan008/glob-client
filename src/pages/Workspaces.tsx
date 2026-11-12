import { useState } from 'react'
import { ArrowRight, LogOut, Settings2, Users } from 'lucide-react'
import { useAuth } from '../auth'
import { useTeams } from '../teams'
import Logo from '../components/Logo'
import AdminTeams from './AdminTeams'

/** Where everyone lands after signing in: their own workspaces (globs). Pick one to go in. */
export default function Workspaces() {
  const { user, signOut } = useAuth()
  const { teams, lastId, isRoot, switchTo } = useTeams()
  const [managing, setManaging] = useState(false)
  if (managing) return <AdminTeams standalone onBack={() => setManaging(false)} />

  // the one you used last comes first
  const list = [...teams].sort((a, b) => Number(b.id === lastId) - Number(a.id === lastId))
  return (
    <div className="solo">
      <header className="solo-bar">
        <Logo size={30} />
        <span className="solo-actions">
          {isRoot && <button className="btn small ghost" onClick={() => setManaging(true)}><Settings2 size={14} /> Manage teams</button>}
          <button className="btn small ghost" onClick={signOut}><LogOut size={14} /> Sign out</button>
        </span>
      </header>
      <main className="solo-main">
        <h1 className="ws-title">Your workspaces</h1>
        <p className="muted ws-sub">Hi {user?.name?.split(' ')[0]}. Choose a workspace to open.</p>
        <ul className="ws-grid">
          {list.map((t) => (
            <li key={t.id}>
              <button className="ws-card" onClick={() => switchTo(t.id)}>
                <span className="at-icon"><Users size={20} /></span>
                <span className="ws-name"><b>{t.name}</b>
                  <small>{t.members} {t.members === 1 ? 'person' : 'people'}{t.role === 'owner' ? ' · you are an owner' : ''}</small>
                </span>
                {t.id === lastId && <span className="chip">Last opened</span>}
                <ArrowRight size={18} />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}

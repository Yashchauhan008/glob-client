import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, Code2, Lightbulb, LayoutGrid, CheckSquare, LogOut, MapPin, Moon, Sun } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { useTeams } from '../teams'
import { useTheme } from '../theme'
import { colorFor, initials } from '../presence'
import Logo from '../components/Logo'
import PinsPanel from '../components/Pins'
import { PersonalIdeas, PersonalTasks, type PersonalCounts } from '../components/PersonalLists'
import { Header } from '../components/ui'
import WorkspaceCards from './Workspaces'
import PersonalDashboard from '../components/PersonalDashboard'

const SECTIONS = [
  { id: 'workspaces', label: 'Workspaces', icon: LayoutGrid, cls: 'sky' },
  { id: 'dashboard', label: 'Dashboard', icon: Code2, cls: 'sun' },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb, cls: 'lilac' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, cls: 'pink' },
  { id: 'map', label: 'Map', icon: MapPin, cls: 'mint' },
] as const
type Section = (typeof SECTIONS)[number]['id']

type Account = { name: string; email: string; avatar_url: string | null; last_login_at: string | null; prev_login_at: string | null; login_count: number }
const stamp = (s: string) => new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Your own space, built like a glob: top bar, a small side panel, and the bottom dock to move between sections. */
export default function PersonalApp() {
  const { section = 'dashboard', id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const { teams, switchTo, lastId } = useTeams()
  const { signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const me = useQuery({ queryKey: ['personal', 'overview'], queryFn: () => api.get<{ account: Account; counts: PersonalCounts }>('/personal/overview') })
  if (!SECTIONS.some((s) => s.id === section)) return <Navigate to="/personal" replace />
  const here = section as Section
  const a = me.data?.account
  const c = me.data?.counts
  const count: Record<Section, number | undefined> = { workspaces: undefined, dashboard: undefined, ideas: c?.ideas, tasks: c?.open_tasks, map: c?.pins }
  const name = a?.name ?? user?.name ?? ''
  const avatar = a?.avatar_url ?? user?.avatar_url ?? null

  return (
    <div className="stage">
      <div className="frame">
        <header className="topbar">
          <div className="logo"><Logo size={34} /></div>
          <span className="mobile-title" style={{ display: 'none' }}>Personal</span>
          <span className="pa-title">Personal space</span>
          <div className="who">
            <button className="theme-btn" onClick={toggle} aria-label="Toggle dark mode">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="btn small ghost" onClick={signOut}><LogOut size={14} /> Sign out</button>
          </div>
        </header>

        <div className="body">
          <main className={'main' + (here === 'dashboard' ? ' board-mode' : '')}>
            <div className="content">
              {here === 'workspaces' && <WorkspaceCards />}
              {here === 'dashboard' && <PersonalDashboard id={id} />}
              {here === 'ideas' && <><Header title="Ideas" /><p className="muted at-help">Ideas only you can see.</p><PersonalIdeas /></>}
              {here === 'tasks' && <><Header title="Tasks" /><p className="muted at-help">Your private to-do list.</p><PersonalTasks /></>}
              {here === 'map' && <><Header title="Map" /><p className="muted at-help">Places you want to remember: visited, next meet point, good spots, or your own tags. Only you see these.</p><PinsPanel base="/personal/pins" height={460} /></>}
            </div>
          </main>

          <aside className="events-panel pa-side">
            <i className="acct-av pa-av" style={{ background: colorFor(user?.id ?? name) }}>{avatar ? <img className="av-img" src={avatar} alt="" /> : initials(name)}</i>
            <h3>{name}</h3>
            <p className="muted">{a?.email ?? user?.email}</p>
            <ul className="pa-facts">
              <li><Clock size={14} /> {a?.prev_login_at ? `Last time ${stamp(a.prev_login_at)}` : 'First sign-in'}</li>
              {a && <li>{a.login_count} {a.login_count === 1 ? 'sign-in' : 'sign-ins'}</li>}
            </ul>
            <h4>Your workspaces</h4>
            <div className="pa-ws">
              {teams.map((t) => <button key={t.id} onClick={() => switchTo(t.id)}><b>{t.name}</b><small>{t.id === lastId ? 'last' : t.members}</small></button>)}
              {!teams.length && <small className="muted">None yet.</small>}
            </div>
          </aside>
        </div>

        <div className="dock">
          {SECTIONS.map(({ id, label, icon: Icon, cls }) => (
            <button key={id} className={cls + (id === here ? ' active' : '')} data-tip={`${label}${count[id] ? ` · ${count[id]}` : ''}`} aria-label={label} aria-current={id === here} onClick={() => nav(`/personal/${id}`)}>
              <Icon size={20} strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

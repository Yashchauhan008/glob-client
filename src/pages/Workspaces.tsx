import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, CalendarDays, CheckSquare, Clock, Lightbulb, LogIn, LogOut, Settings2, Users } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { useTeams } from '../teams'
import { colorFor, initials } from '../presence'
import Logo from '../components/Logo'
import AdminTeams from './AdminTeams'
import PersonalSpace, { type PersonalCounts } from '../components/PersonalSpace'

/** Where everyone lands after signing in: their own workspaces (globs). Pick one to go in. */
type Overview = {
  id: string; ideas: number; open_tasks: number; tasks_due: number; open_leads: number; events_week: number
  next_event: { title: string; starts_at: string } | null; last_activity: string | null
  people: { id: string; name: string; avatar_url: string | null }[]
}

const ago = (s: string | null) => {
  if (!s) return 'No activity yet'
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000)
  if (m < 1) return 'Active just now'
  if (m < 60) return `Active ${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `Active ${h}h ago` : `Active ${Math.floor(h / 24)}d ago`
}
const when = (s: string) => new Date(s).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

type Account = { id: string; name: string; email: string; avatar_url: string | null; created_at: string; last_login_at: string | null; prev_login_at: string | null; login_count: number; workspaces: number }
const day = (s: string) => new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const stamp = (s: string) => new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Who is signed in: picture, name, email, and when they were here before. */
function AccountCard({ a, counts }: { a?: Account; counts?: PersonalCounts }) {
  const { user } = useAuth()
  const name = a?.name ?? user?.name ?? ''
  const avatar = a?.avatar_url ?? user?.avatar_url ?? null
  return (
    <section className="acct">
      <i className="acct-av" style={{ background: colorFor(user?.id ?? name) }}>{avatar ? <img className="av-img" src={avatar} alt="" /> : initials(name)}</i>
      <div className="acct-main">
        <h2>{name}</h2>
        <p>{a?.email ?? user?.email}</p>
        <div className="acct-facts">
          <span title="This session"><LogIn size={14} /> Signed in now</span>
          {a?.prev_login_at && <span title="Your previous sign-in"><Clock size={14} /> Last time {stamp(a.prev_login_at)}</span>}
          {a && <span>{a.login_count} {a.login_count === 1 ? 'sign-in' : 'sign-ins'}</span>}
          {a && <span>{a.workspaces} {a.workspaces === 1 ? 'workspace' : 'workspaces'}</span>}
          {a && <span>Member since {day(a.created_at)}</span>}
        </div>
      </div>
      {counts && counts.tasks_due > 0 && <span className="ws-due"><AlertCircle size={14} /> {counts.tasks_due} personal {counts.tasks_due === 1 ? 'task is' : 'tasks are'} due</span>}
    </section>
  )
}

export default function Workspaces() {
  const { user, signOut } = useAuth()
  const { teams, lastId, isRoot, switchTo } = useTeams()
  const [managing, setManaging] = useState(false)
  const ov = useQuery({ queryKey: ['teams', 'overview'], queryFn: () => api.get<{ items: Overview[] }>('/teams/overview') })
  const me = useQuery({ queryKey: ['personal', 'overview'], queryFn: () => api.get<{ account: Account; counts: PersonalCounts }>('/personal/overview') })
  const stats = new Map((ov.data?.items ?? []).map((o) => [o.id, o]))
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
      <main className="solo-main wide">
        <AccountCard a={me.data?.account} counts={me.data?.counts} />
        <h1 className="ws-title">Your workspaces</h1>
        <p className="muted ws-sub">Hi {user?.name?.split(' ')[0]}. Choose a workspace to open.</p>
        <ul className="ws-grid">
          {list.map((t) => {
            const o = stats.get(t.id)
            return (
              <li key={t.id}>
                <button className="ws-card" onClick={() => switchTo(t.id)}>
                  <span className="ws-top">
                    <span className="at-icon"><Users size={20} /></span>
                    <span className="ws-name"><b>{t.name}</b>
                      <small>{t.members} {t.members === 1 ? 'person' : 'people'}{t.role === 'owner' ? ' · you are an owner' : ''}</small>
                    </span>
                    {t.id === lastId && <span className="chip">Last opened</span>}
                    <ArrowRight size={18} />
                  </span>
                  {o ? (
                    <>
                      <span className="ws-stats">
                        <span title="Ideas"><Lightbulb size={14} /><b>{o.ideas}</b> ideas</span>
                        <span title="Open tasks"><CheckSquare size={14} /><b>{o.open_tasks}</b> open tasks</span>
                        <span title="Leads still in play"><Users size={14} /><b>{o.open_leads}</b> leads</span>
                        <span title="Events in the next 7 days"><CalendarDays size={14} /><b>{o.events_week}</b> this week</span>
                      </span>
                      {o.tasks_due > 0 && <span className="ws-due"><AlertCircle size={14} /> {o.tasks_due} {o.tasks_due === 1 ? 'task is' : 'tasks are'} due or late</span>}
                      <span className="ws-next">{o.next_event ? <>Next: <b>{o.next_event.title}</b> · {when(o.next_event.starts_at)}</> : 'Nothing scheduled'}</span>
                      <span className="ws-foot">
                        <span className="ws-people">
                          {o.people.map((p) => <i key={p.id} title={p.name} style={{ background: colorFor(p.id) }}>{p.avatar_url ? <img className="av-img" src={p.avatar_url} alt="" /> : initials(p.name)}</i>)}
                          {t.members > o.people.length && <i className="more">+{t.members - o.people.length}</i>}
                        </span>
                        <small>{ago(o.last_activity)}</small>
                      </span>
                    </>
                  ) : <span className="ws-next">{ov.isError ? '' : 'Loading…'}</span>}
                </button>
              </li>
            )
          })}
        </ul>
        <h1 className="ws-title">Your personal space</h1>
        <p className="muted ws-sub">Ideas, tasks and places that are just yours, outside any workspace.</p>
        <PersonalSpace counts={me.data?.counts} />
      </main>
    </div>
  )
}

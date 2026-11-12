import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, CalendarDays, CheckSquare, Lightbulb, Settings2, Users } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import { useTeams } from '../teams'
import { colorFor, initials } from '../presence'
import { Empty } from '../components/ui'
import AdminTeams from './AdminTeams'

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

/** Every workspace you can open, with a glance at what is happening in each. Click one to go in. */
export default function WorkspaceCards() {
  const { teams, lastId, isRoot, switchTo } = useTeams()
  const [managing, setManaging] = useState(false)
  const ov = useQuery({ queryKey: ['teams', 'overview'], queryFn: () => api.get<{ items: Overview[] }>('/teams/overview') })
  const stats = new Map((ov.data?.items ?? []).map((o) => [o.id, o]))
  // the one you used last comes first
  const list = [...teams].sort((a, b) => Number(b.id === lastId) - Number(a.id === lastId))
  if (managing) return <><button className="btn small ghost" onClick={() => setManaging(false)}>← Back to workspaces</button><AdminTeams /></>
  return (
    <>
      <div className="page-head"><h1>Workspaces</h1>
        <div className="actions">{isRoot && <button className="btn small ghost" onClick={() => setManaging(true)}><Settings2 size={14} /> Manage teams</button>}</div>
      </div>
      <p className="muted at-help">Choose a workspace to open. You can come back here any time from the bottom bar.</p>
      {!list.length && <Empty>You are not in a workspace yet. Ask a team owner to invite you.</Empty>}
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
    </>
  )
}

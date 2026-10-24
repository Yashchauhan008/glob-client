import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { useAuth } from '../auth'
import { PRODUCT_COLOR, STAGES, STAGE_COLOR, type Idea, type Lead } from '../types'
import { Pill, fmtDate, fmtDateTime } from '../components/ui'
import { LeadMap } from '../components/maps'
import { colorFor, initials, usePresence } from '../presence'

type Dash = {
  team: { ideas: number; notes: number; votes: number; questions: number; open_questions: number; answers: number; messages: number; upcoming_events: number; feasibility: number | null; todos_done: number; todos_total: number }
  open_notes: { id: string; kind: string; body: string; idea_id: string; idea_title: string }[]
  products: { id: string; name: string; url: string; status: string }[]
  todos_due: { id: string; title: string; due_date: string }[]
  leads: { stage: string; count: number }[]
  follow_ups: { id: string; name: string; company: string | null; next_follow_up_at: string }[]
  month: { won: number; lost: number }
  map_leads: Lead[]
}

const tile = (c: string) => ({ '--c': c }) as React.CSSProperties

export default function Home() {
  const { user } = useAuth()
  const { roster } = usePresence()
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dash>('/dashboard') })
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: () => api.get<{ items: Idea[] }>('/ideas') })
  if (!data) return <p className="muted">Loading…</p>
  const t = data.team
  const thoughts = t.ideas + t.notes + t.votes + t.questions + t.answers
  const rated = ideas.data?.items.filter((i) => i.feasibility != null) ?? []
  const doable = rated.filter((i) => i.feasibility! >= 3.5)
  const stretch = rated.filter((i) => i.feasibility! < 2.5)
  const online = [...new Map(roster.map((r) => [r.user_id, r])).values()]
  const leadCount = (s: string) => data.leads.find((l) => l.stage === s)?.count ?? 0
  const where = (r: string) => '/' + (r.split('/')[1] || 'home')

  return (
    <>
      <div className="page-head"><h1>Hi {user!.name.split(' ')[0]}, here’s the team <span>👋</span></h1></div>

      <div className="stats big">
        <div className="stat" style={tile('#d3e9f8')}><b>{t.ideas}</b><span>Ideas</span></div>
        <div className="stat" style={tile('#e6d3f8')}><b>{thoughts}</b><span>Thoughts shared</span></div>
        <div className="stat" style={tile('#d3f2cc')}><b>{t.feasibility ?? '–'}</b><span>Avg. feasibility /5</span></div>
        <div className="stat" style={tile('#fbe9b8')}><b>{t.open_questions}</b><span>Open questions</span></div>
        <div className="stat dashed"><b>{t.todos_done}/{t.todos_total}</b><span>Tasks done</span></div>
      </div>

      <div className="cols-2">
        <section className="panel">
          <h3>Live now</h3>
          <div className="live-list">
            <div className="live-row"><i style={{ background: colorFor(user!.id) }}>{initials(user!.name)}</i><span>{user!.name} (you)</span></div>
            {online.map((o) => <Link key={o.user_id} to={where(o.route)} className="live-row"><i style={{ background: colorFor(o.user_id) }}>{initials(o.name)}</i><span>{o.name}</span><small>on {where(o.route).slice(1)}</small></Link>)}
          </div>
          {!online.length && <p className="muted">Nobody else is online right now.</p>}
        </section>
        <section className="panel">
          <h3>How possible is it? <em>{rated.length} of {ideas.data?.items.length ?? 0} ideas rated</em></h3>
          <div className="feas">
            <div><b>{doable.length}</b><span>look doable</span></div>
            <div><b>{rated.length - doable.length - stretch.length}</b><span>maybe</span></div>
            <div><b>{stretch.length}</b><span>stretch</span></div>
          </div>
          {doable.slice(0, 3).map((i) => <Link key={i.id} to={`/ideas/${i.id}`} className="row-link"><span>{i.title}</span><small>{i.feasibility}/5</small></Link>)}
          {!rated.length && <p className="muted">Rate ideas on their page to see what’s realistic.</p>}
        </section>
      </div>

      <div className="cols-2">
        <section className="panel">
          <h3>Problems without a solution yet</h3>
          {data.open_notes.map((n) => <Link key={n.id} to={`/ideas/${n.idea_id}`} className="row-link"><Pill color="#f9d2e4">problem</Pill><span>{n.body}</span><small>{n.idea_title}</small></Link>)}
          {!data.open_notes.length && <p className="muted">Every problem has a solution.</p>}
        </section>
        <section className="panel">
          <h3>Due &amp; follow-ups</h3>
          {data.todos_due.map((x) => <Link key={x.id} to="/tasks" className="row-link"><span>{x.title}</span><small>{fmtDate(x.due_date)}</small></Link>)}
          {data.follow_ups.map((f) => <Link key={f.id} to={`/leads/${f.id}`} className="row-link"><span>Follow up: {f.name}</span><small>{fmtDateTime(f.next_follow_up_at)}</small></Link>)}
          {!data.todos_due.length && !data.follow_ups.length && <p className="muted">All clear.</p>}
        </section>
      </div>

      <div className="cols-2">
        <section className="panel">
          <h3>Products</h3>
          {data.products.map((p) => <div key={p.id} className="row-link"><Pill color={PRODUCT_COLOR[p.status]!}>{p.status}</Pill><span>{p.name}</span>{p.url && <a href={p.url} target="_blank" rel="noreferrer">open ↗</a>}</div>)}
          {!data.products.length && <p className="muted">No products.</p>}
        </section>
        <section className="panel">
          <h3>CRM <em>this month: {data.month.won} won · {data.month.lost} lost</em></h3>
          <div className="mini-stages">{STAGES.map((s) => <Link to="/leads" key={s} style={{ background: STAGE_COLOR[s] }}><b>{leadCount(s)}</b><span>{s}</span></Link>)}</div>
        </section>
      </div>
      <LeadMap leads={data.map_leads} height={260} />
    </>
  )
}

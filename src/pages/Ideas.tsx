import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, List, Search, Waypoints } from 'lucide-react'
import { api } from '../api'
import { IDEA_COLOR, type Idea } from '../types'
import { CsvTools, Empty, Pill } from '../components/ui'
import Avatars, { Meter } from '../components/Avatars'
import { useQuick } from '../components/quick'

export default function Ideas() {
  const quick = useQuick()
  const { data } = useQuery({ queryKey: ['ideas'], queryFn: () => api.get<{ items: Idea[] }>('/ideas') })
  const [view, setView] = useState<'flow' | 'list' | 'grid'>('flow')
  const [q, setQ] = useState('')
  const items = data?.items ?? []
  const shown = useMemo(() => items.filter((i) => (i.title + i.description).toLowerCase().includes(q.toLowerCase())), [items, q])
  const shipped = items.filter((i) => i.status === 'shipped').length
  const thinking = items.filter((i) => !['shipped', 'dropped'].includes(i.status)).length

  return (
    <>
      <div className="page-head">
        <h1>Team Ideas <span>💡</span></h1>
        <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ideas" /></label>
      </div>

      <div className="with-rail">
        <div className="rail">
          <button className={view === 'flow' ? 'on' : ''} onClick={() => setView('flow')} title="Flow"><Waypoints size={18} /></button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} title="List"><List size={18} /></button>
          <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} title="Grid"><LayoutGrid size={18} /></button>
        </div>
        <div className="grow">
          <div className="stats">
            <div className="stat" style={{ '--c': '#d3e9f8' } as React.CSSProperties}><b>{items.length}</b><span>Total</span></div>
            <div className="stat" style={{ '--c': '#d3f2cc' } as React.CSSProperties}><b>{shipped}</b><span>Shipped 🎉</span></div>
            <div className="stat dashed"><b>{thinking}</b><span>Being thought</span></div>
            <div className="stat-actions"><CsvTools entity="ideas" importable invalidate={['ideas']} /><button className="btn" onClick={() => quick('idea')}>+ New idea</button></div>
          </div>

          {!shown.length && <Empty>{items.length ? 'No idea matches.' : 'No ideas yet — drop the first one with the lilac button below.'}</Empty>}
          <div className={'ideas ' + view}>
            {shown.map((i) => (
              <Link key={i.id} to={`/ideas/${i.id}`} className={'idea status-' + i.status} style={{ '--c': IDEA_COLOR[i.status] } as React.CSSProperties}>
                {i.cover && <img className="idea-cover" src={i.cover} alt="" loading="lazy" />}
                <h3>{i.title}</h3>
                <p>{i.description || 'No description yet.'}</p>
                <Meter value={i.feasibility} votes={i.votes} />
                <div className="idea-foot">
                  <Pill color="rgba(255,255,255,.75)">{i.status}</Pill>
                  <span className="chip">💭 {i.thoughts}</span>
                  <span className="chip">❓ {i.asks + i.problems}</span>
                  {!!i.attachments && <span className="chip">📎 {i.attachments}</span>}
                  <Avatars names={i.contributors} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

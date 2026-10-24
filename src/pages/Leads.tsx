import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { STAGES, STAGE_COLOR, type Lead } from '../types'
import { CsvTools, Empty, Header, Modal, Pill, fmtDate } from '../components/ui'
import LeadForm from '../components/LeadForm'
import { LeadMap } from '../components/maps'

export default function Leads() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['leads'], queryFn: () => api.get<{ items: Lead[] }>('/leads') })
  const [view, setView] = useState<'table' | 'pipeline' | 'map'>('pipeline')
  const [open, setOpen] = useState(false)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['todos'] }) }
  const create = useMutation({ mutationFn: (b: object) => api.post('/leads', b), onSuccess: () => { refresh(); setOpen(false) } })
  const move = useMutation({ mutationFn: ({ id, stage }: { id: string; stage: string }) => api.patch(`/leads/${id}`, { stage }), onSuccess: refresh })
  const items = data?.items ?? []

  return (
    <>
      <Header title="Leads">
        <div className="seg">{(['pipeline', 'table', 'map'] as const).map((v) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v}</button>)}</div>
        <CsvTools entity="leads" importable invalidate={['leads']} />
        <button className="btn" onClick={() => setOpen(true)}>New lead</button>
      </Header>

      {view !== 'map' && !items.length && <Empty>No leads yet. Add one or import a CSV.</Empty>}

      {view === 'pipeline' && (
        <div className="pipeline">
          {STAGES.map((s) => (
            <div key={s} className="lane" onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData('text/plain'); if (id) move.mutate({ id, stage: s }) }}>
              <div className="lane-head"><Pill color={STAGE_COLOR[s]}>{s}</Pill><span>{items.filter((l) => l.stage === s).length}</span></div>
              {items.filter((l) => l.stage === s).map((l) => (
                <Link key={l.id} to={`/leads/${l.id}`} className="lead-card" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)}>
                  <b>{l.name}</b>{l.company && <span>{l.company}</span>}
                  {l.next_follow_up_at && <small>follow up {fmtDate(l.next_follow_up_at)}</small>}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

      {view === 'table' && !!items.length && (
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Company</th><th>Stage</th><th>Email</th><th>Phone</th><th>Follow-up</th></tr></thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id}>
                  <td><Link to={`/leads/${l.id}`}>{l.name}</Link></td><td>{l.company}</td>
                  <td><Pill color={STAGE_COLOR[l.stage]}>{l.stage}</Pill></td><td>{l.email}</td><td>{l.phone}</td><td>{fmtDate(l.next_follow_up_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'map' && (
        <>
          <LeadMap leads={items} height={560} />
          <p className="muted">{items.filter((l) => l.latitude != null).length} of {items.length} leads have a location.</p>
        </>
      )}

      {open && (
        <Modal title="New lead" onClose={() => setOpen(false)}>
          <LeadForm onSubmit={(b) => create.mutate(b)} busy={create.isPending} error={create.error?.message} />
        </Modal>
      )}
    </>
  )
}

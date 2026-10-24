import Attachments from '../components/Attachments'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { STAGES, STAGE_COLOR, type Activity, type Lead } from '../types'
import { Header, Modal, Pill, fmtDateTime } from '../components/ui'
import LeadForm from '../components/LeadForm'

type Detail = Lead & { activities: Activity[] }
const KINDS = ['note', 'call', 'email', 'meeting'] as const

export default function LeadDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const key = ['lead', id]
  const { data } = useQuery({ queryKey: key, queryFn: () => api.get<Detail>(`/leads/${id}`) })
  const [edit, setEdit] = useState(false)
  const [kind, setKind] = useState<(typeof KINDS)[number]>('note')
  const refresh = () => { ['lead', 'leads', 'dashboard', 'todos'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })) }
  const patch = useMutation({ mutationFn: (b: object) => api.patch(`/leads/${id}`, b), onSuccess: () => { refresh(); setEdit(false) } })
  const log = useMutation({ mutationFn: (b: object) => api.post(`/leads/${id}/activities`, b), onSuccess: refresh })
  const del = useMutation({ mutationFn: () => api.del(`/leads/${id}`), onSuccess: () => { refresh(); nav('/leads') } })

  if (!data) return <p className="muted">Loading…</p>
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = e.currentTarget
    log.mutate({ kind, body: String(new FormData(f).get('body')) })
    f.reset()
  }
  return (
    <>
      <Header title={data.name}>
        <select value={data.stage} onChange={(e) => patch.mutate({ stage: e.target.value })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn ghost" onClick={() => setEdit(true)}>Edit</button>
        <button className="btn ghost" onClick={() => confirm('Delete this lead?') && del.mutate()}>Delete</button>
      </Header>
      <p className="muted"><Link to="/leads">← All leads</Link></p>

      <div className="cols-2">
        <section className="panel">
          <Pill color={STAGE_COLOR[data.stage]}>{data.stage}</Pill>
          <dl className="facts">
            {([['Company', data.company], ['Email', data.email], ['Phone', data.phone], ['Source', data.source], ['Address', data.address],
              ['Follow-up', data.next_follow_up_at && fmtDateTime(data.next_follow_up_at)], ['Lost reason', data.lost_reason]] as const)
              .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <h3 className="att-title">Links &amp; images</h3>
          <Attachments type="lead" id={data.id} />
        </section>
        <section className="panel">
          <h3>Activity</h3>
          <form className="row-form" onSubmit={submit}>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <input name="body" placeholder="What happened?" required style={{ flex: 1 }} />
            <button className="btn">Log</button>
          </form>
          <div className="timeline">
            {data.activities.map((a) => (
              <div key={a.id} className={'event ' + a.kind}>
                <span className="tag">{a.kind.replace('_', ' ')}</span>
                <p>{a.body}</p>
                <small>{a.owner_name} · {fmtDateTime(a.created_at)}</small>
              </div>
            ))}
            {!data.activities.length && <p className="muted">No activity yet.</p>}
          </div>
        </section>
      </div>

      {edit && (
        <Modal title="Edit lead" onClose={() => setEdit(false)}>
          <LeadForm lead={data} onSubmit={(b) => patch.mutate(b)} busy={patch.isPending} error={patch.error?.message} />
        </Modal>
      )}
    </>
  )
}

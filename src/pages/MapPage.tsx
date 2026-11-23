import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { Header } from '../components/ui'
import PinsPanel from '../components/Pins'
import { LeadMap } from '../components/maps'
import { useTeams } from '../teams'
import type { Lead } from '../types'
import { STAGE_COLOR, STAGES } from '../types'

type View = 'places' | 'crm'

/** Shared map: team pins, plus CRM leads that have a location. */
export default function MapPage() {
  const { current } = useTeams()
  const [params, setParams] = useSearchParams()
  const initial = params.get('view') === 'crm' ? 'crm' : 'places'
  const [view, setView] = useState<View>(initial)
  const leads = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.get<{ items: Lead[] }>('/leads').then((r) => r.items),
    enabled: view === 'crm',
  })
  const items = leads.data ?? []
  const located = useMemo(() => items.filter((l) => l.latitude != null && l.longitude != null), [items])
  const [stage, setStage] = useState<string | null>(null)
  const shown = stage ? located.filter((l) => l.stage === stage) : located

  const pick = (v: View) => {
    setView(v)
    setParams(v === 'crm' ? { view: 'crm' } : {}, { replace: true })
  }

  return (
    <>
      <Header title="Map">
        <div className="seg" role="tablist" aria-label="Map view">
          <button role="tab" aria-selected={view === 'places'} className={view === 'places' ? 'on' : ''} onClick={() => pick('places')}>Places</button>
          <button role="tab" aria-selected={view === 'crm'} className={view === 'crm' ? 'on' : ''} onClick={() => pick('crm')}>CRM leads</button>
        </div>
      </Header>

      {view === 'places' ? (
        <>
          <p className="muted at-help">Places {current?.name ?? 'your team'} has pinned: where you have been, where to meet next, good spots. Everyone in this workspace sees them.</p>
          <PinsPanel base="/pins" height={520} />
        </>
      ) : (
        <>
          <p className="muted at-help">CRM leads with a saved address. Open a pin to jump to the lead.</p>
          <div className="pins-bar">
            <div className="tag-row">
              <button className={'tag-chip' + (stage === null ? ' on' : '')} onClick={() => setStage(null)}>All <b>{located.length}</b></button>
              {STAGES.map((s) => {
                const n = located.filter((l) => l.stage === s).length
                if (!n) return null
                return (
                  <button key={s} className={'tag-chip' + (stage === s ? ' on' : '')} onClick={() => setStage(stage === s ? null : s)}>
                    <i style={{ background: STAGE_COLOR[s] }} />{s} <b>{n}</b>
                  </button>
                )
              })}
            </div>
          </div>
          <LeadMap leads={shown} height={560} />
          <p className="muted">{located.length} of {items.length} leads have a location{stage ? ` · showing ${shown.length} in ${stage}` : ''}.</p>
        </>
      )}
    </>
  )
}

import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { EVENT_KINDS, IDEA_STATUSES, type Idea, type Lead } from '../types'
import { Modal } from './ui'
import { MarkdownField } from './Markdown'
import LeadForm from './LeadForm'
import { AttachDraft, emptyDraft, saveDraft, type AttachEntity, type Draft } from './Attachments'

export type QuickKind = 'idea' | 'question' | 'todo' | 'event' | 'lead'
type Opts = { date?: string; idea_id?: string }
const Ctx = createContext<(k: QuickKind, o?: Opts) => void>(() => {})
export const useQuick = () => useContext(Ctx)

const TITLES: Record<QuickKind, string> = { idea: 'New idea', question: 'Ask the team', todo: 'New task', event: 'New event', lead: 'New lead' }
const today = () => new Date().toISOString().slice(0, 10)

export function QuickProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ kind: QuickKind; opts: Opts } | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const qc = useQueryClient()
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: () => api.get<{ items: Idea[] }>('/ideas'), enabled: !!state })
  const done = () => {
    ['ideas', 'idea', 'questions', 'todos', 'agenda', 'events', 'leads', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    setState(null); setDraft(emptyDraft)
  }
  const create = useMutation({
    mutationFn: async ({ path, body }: { path: string; body: object }) => {
      const row = await api.post<{ id: string }>(path, body)
      const type: AttachEntity | null = path === '/ideas' ? 'idea' : path === '/questions' ? 'question' : null
      if (type && (draft.links.length || draft.files.length)) await saveDraft(type, row.id, draft)
      return row
    },
    onSuccess: done,
  })

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const g = (k: string) => String(f.get(k) || '').trim()
    switch (state!.kind) {
      case 'idea': return create.mutate({ path: '/ideas', body: { title: g('title'), description: g('description'), status: g('status') } })
      case 'question': return create.mutate({ path: '/questions', body: { title: g('title'), body: g('body'), idea_id: g('idea_id') || null } })
      case 'todo': return create.mutate({ path: '/todos', body: { title: g('title'), due_date: g('date') || null, idea_id: g('idea_id') || null } })
      case 'event': {
        const start = new Date(`${g('date')}T${g('start') || '09:00'}`)
        const end = g('end') ? new Date(`${g('date')}T${g('end')}`) : null
        return create.mutate({ path: '/events', body: { title: g('title'), kind: g('kind'), starts_at: start.toISOString(), ends_at: end?.toISOString() ?? null, notes: g('notes'), idea_id: g('idea_id') || null } })
      }
    }
  }
  const ideaSelect = (
    <select name="idea_id" defaultValue={state?.opts.idea_id ?? ''}><option value="">Link to an idea…</option>{ideas.data?.items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select>
  )

  return (
    <Ctx.Provider value={(kind, opts = {}) => { create.reset(); setDraft(emptyDraft); setState({ kind, opts }) }}>
      {children}
      {state && (
        <Modal title={TITLES[state.kind]} onClose={() => setState(null)}>
          {state.kind === 'lead' ? (
            <LeadForm busy={create.isPending} error={create.error?.message} onSubmit={(b: object) => create.mutate({ path: '/leads', body: b })} />
          ) : (
            <form onSubmit={submit}>
              <input name="title" placeholder={state.kind === 'question' ? 'What do you want to know?' : 'Title'} required autoFocus />
              {state.kind === 'idea' && <><MarkdownField name="description" placeholder="Describe the idea (Markdown works)" rows={5} /><select name="status">{IDEA_STATUSES.map((s) => <option key={s}>{s}</option>)}</select><AttachDraft draft={draft} setDraft={setDraft} /></>}
              {state.kind === 'question' && <><textarea name="body" placeholder="Details (optional)" rows={3} />{ideaSelect}<AttachDraft draft={draft} setDraft={setDraft} /></>}
              {state.kind === 'todo' && <><input name="date" type="date" defaultValue={state.opts.date} />{ideaSelect}</>}
              {state.kind === 'event' && (
                <>
                  <select name="kind">{EVENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
                  <input name="date" type="date" defaultValue={state.opts.date ?? today()} required />
                  <div className="two"><input name="start" type="time" defaultValue="09:00" required /><input name="end" type="time" /></div>
                  <textarea name="notes" placeholder="Notes" rows={3} />
                  {ideaSelect}
                </>
              )}
              {create.error && <div className="form-err">{create.error.message}</div>}
              <button className="btn" disabled={create.isPending}>Create</button>
            </form>
          )}
        </Modal>
      )}
    </Ctx.Provider>
  )
}
export type { Lead }

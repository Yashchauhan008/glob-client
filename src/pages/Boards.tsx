import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Lightbulb, Plus, Presentation, Search, Shapes } from 'lucide-react'
import { api, ApiError } from '../api'
import { Empty, Modal } from '../components/ui'
import type { BoardSummary, Idea } from '../types'

export const ago = (s: string) => {
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Small form used here and on the idea page: name a new board and optionally link it to an idea. */
export function NewBoard({ ideaId, onClose }: { ideaId?: string; onClose: () => void }) {
  const nav = useNavigate()
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: () => api.get<{ items: Idea[] }>('/ideas') })
  const [idea, setIdea] = useState(ideaId ?? '')
  const make = useMutation({
    mutationFn: (title: string) => api.post<{ id: string }>('/boards', { title, idea_id: idea || null }),
    onSuccess: (r) => nav(`/boards/${r.id}`),
  })
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); make.mutate(String(new FormData(e.currentTarget).get('title') ?? '').trim()) }
  return (
    <Modal title="New board" onClose={onClose}>
      <form onSubmit={submit}>
        <input name="title" autoFocus placeholder="Board name (e.g. Checkout flow)" maxLength={200} />
        {!ideaId && (
          <select value={idea} onChange={(e) => setIdea(e.target.value)} aria-label="Link to an idea">
            <option value="">Not linked to an idea</option>
            {ideas.data?.items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        )}
        {make.error && <p className="tc-err">{make.error instanceof ApiError ? make.error.message : 'Could not create the board'}</p>}
        <button className="btn" disabled={make.isPending}>{make.isPending ? 'Creating…' : 'Create board'}</button>
      </form>
    </Modal>
  )
}

export function BoardCard({ b }: { b: BoardSummary }) {
  return (
    <Link to={`/boards/${b.id}`} className="board-card">
      <div className="bc-thumb">{b.thumb_url ? <img src={b.thumb_url} alt="" loading="lazy" /> : <Presentation size={34} strokeWidth={1.6} />}</div>
      <div className="bc-body">
        <h3>{b.title}</h3>
        <div className="bc-meta">
          {b.idea_title && <span className="chip"><Lightbulb size={12} className="ico" /> {b.idea_title}</span>}
          <span className="chip"><Shapes size={12} className="ico" /> {b.shapes}</span>
        </div>
        <small>{b.owner_name} · {ago(b.updated_at)}</small>
      </div>
    </Link>
  )
}

export default function Boards() {
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['boards'], queryFn: () => api.get<{ items: BoardSummary[] }>('/boards'), refetchInterval: 20000 })
  const items = data?.items ?? []
  const shown = useMemo(() => items.filter((b) => (b.title + (b.idea_title ?? '')).toLowerCase().includes(q.toLowerCase())), [items, q])

  return (
    <>
      <div className="page-head">
        <h1>Boards <span className="h-ico"><Presentation size={34} strokeWidth={2.2} /></span></h1>
        <div className="actions">
          <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search boards" /></label>
          <button className="btn" onClick={() => setAdding(true)}><Plus size={16} /> New board</button>
        </div>
      </div>
      {isLoading ? <Empty>Loading boards…</Empty> : !shown.length ? (
        <Empty>{items.length ? 'No board matches that search.' : 'No boards yet. Make one to sketch a flow, a diagram or just think out loud together.'}</Empty>
      ) : <div className="board-grid">{shown.map((b) => <BoardCard key={b.id} b={b} />)}</div>}
      {adding && <NewBoard onClose={() => setAdding(false)} />}
    </>
  )
}

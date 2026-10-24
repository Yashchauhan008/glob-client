import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Empty } from '../components/ui'
import { useQuick } from '../components/quick'
import Avatars from '../components/Avatars'

type Q = { id: string; title: string; body: string; owner_id: string; owner_name: string; idea_id: string | null; idea_title: string | null; accepted_answer_id: string | null; answers_count: number; created_at: string }
type QD = Q & { answers: { id: string; body: string; owner_name: string; created_at: string }[] }

function Question({ q }: { q: Q }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const detail = useQuery({ queryKey: ['question', q.id], queryFn: () => api.get<QD>(`/questions/${q.id}`), enabled: open })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['question', q.id] }); qc.invalidateQueries({ queryKey: ['questions'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) }
  const answer = useMutation({ mutationFn: (body: string) => api.post(`/questions/${q.id}/answers`, { body }), onSuccess: refresh })
  const accept = useMutation({ mutationFn: (a: string) => api.post(`/questions/${q.id}/accept/${a}`), onSuccess: refresh })
  const del = useMutation({ mutationFn: () => api.del(`/questions/${q.id}`), onSuccess: refresh })
  const solved = !!q.accepted_answer_id

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = e.currentTarget
    answer.mutate(String(new FormData(f).get('body')))
    f.reset()
  }
  return (
    <div className={'qcard' + (solved ? ' solved' : '')}>
      <button className="qhead" onClick={() => setOpen(!open)}>
        <div><h3>{q.title}</h3><small>{q.owner_name} · {new Date(q.created_at).toLocaleDateString()}{q.idea_title ? ` · on “${q.idea_title}”` : ''}</small></div>
        <span className="chip">{solved ? '✅ answered' : `${q.answers_count} answer${q.answers_count === 1 ? '' : 's'}`}</span>
      </button>
      {open && (
        <div className="qbody">
          {q.body && <p>{q.body}</p>}
          {q.idea_id && <Link to={`/ideas/${q.idea_id}`} className="link">Open idea →</Link>}
          {detail.data?.answers.map((a) => (
            <div key={a.id} className={'answer' + (a.id === q.accepted_answer_id ? ' accepted' : '')}>
              <Avatars names={[a.owner_name]} /><div><p>{a.body}</p><small>{a.owner_name}</small></div>
              {q.owner_id === user?.id && a.id !== q.accepted_answer_id && <button className="btn ghost small" onClick={() => accept.mutate(a.id)}><Check size={12} /> Accept</button>}
              {a.id === q.accepted_answer_id && <span className="chip">accepted</span>}
            </div>
          ))}
          <form className="row-form" onSubmit={submit}>
            <input name="body" placeholder="Write an answer…" required style={{ flex: 1 }} /><button className="btn">Answer</button>
            {q.owner_id === user?.id && <button type="button" className="btn ghost" onClick={() => confirm('Delete question?') && del.mutate()}>Delete</button>}
          </form>
        </div>
      )}
    </div>
  )
}

export default function QA() {
  const quick = useQuick()
  const { data } = useQuery({ queryKey: ['questions'], queryFn: () => api.get<{ items: Q[] }>('/questions') })
  const items = data?.items ?? []
  const open = items.filter((q) => !q.accepted_answer_id).length
  return (
    <>
      <div className="page-head"><h1>Questions <span>🙋</span></h1><button className="btn" onClick={() => quick('question')}>+ Ask the team</button></div>
      <div className="stats">
        <div className="stat" style={{ '--c': '#d3e9f8' } as React.CSSProperties}><b>{items.length}</b><span>Asked</span></div>
        <div className="stat" style={{ '--c': '#e6d3f8' } as React.CSSProperties}><b>{open}</b><span>Still open</span></div>
        <div className="stat" style={{ '--c': '#d3f2cc' } as React.CSSProperties}><b>{items.length - open}</b><span>Answered</span></div>
      </div>
      {!items.length && <Empty>No questions yet. Ask something the team should figure out.</Empty>}
      <div className="qlist">{items.map((q) => <Question key={q.id} q={q} />)}</div>
    </>
  )
}

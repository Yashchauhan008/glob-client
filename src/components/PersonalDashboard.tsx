import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Braces, Code2, Database, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '../api'
import CodeBlock, { type Widget } from './CodeBlock'
import { Empty, Modal } from './ui'

const COUNTER = `<div style="text-align:center;padding:16px">
  <div id="n" style="font-size:56px;font-weight:800">0</div>
  <button id="plus">+1</button> <button id="reset">Reset</button>
</div>
<script>
  // localStorage works as usual here: the value is saved to your account and is still there after a refresh
  let n = Number(localStorage.getItem('count') || 0);
  const show = () => document.getElementById('n').textContent = n;
  document.getElementById('plus').onclick = () => { n++; localStorage.setItem('count', n); show(); };
  document.getElementById('reset').onclick = () => { n = 0; localStorage.setItem('count', n); show(); };
  show();
</script>`

function Editor({ initial, onClose }: { initial?: Widget; onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [html, setHtml] = useState(initial?.html ?? '')
  const [err, setErr] = useState('')
  const save = useMutation({
    mutationFn: () => {
      const body = { title: title.trim() || 'Untitled block', html }
      return initial ? api.patch(`/personal/widgets/${initial.id}`, body) : api.post('/personal/widgets', body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['personal', 'widgets'] }); onClose() },
    onError: (e: Error) => setErr(e instanceof ApiError ? e.message : 'Could not save'),
  })
  const submit = (e: FormEvent) => { e.preventDefault(); if (!html.trim()) return setErr('Paste some HTML first'); setErr(''); save.mutate() }
  return (
    <Modal title={initial ? 'Edit block' : 'Add a code block'} onClose={onClose}>
      <form className="cb-form" onSubmit={submit}>
        <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Counter" aria-label="Title" autoFocus />
        <textarea className="cb-code" value={html} spellCheck={false} rows={16} onChange={(e) => setHtml(e.target.value)}
          placeholder={'Paste your HTML here: a full page or just a snippet, with <style> and <script> if you like.'} aria-label="HTML code" />
        <div className="cb-tips">
          <button type="button" className="btn small ghost" onClick={() => { setHtml(COUNTER); if (!title) setTitle('Counter') }}><Code2 size={14} /> Insert a counter example</button>
          <small className="muted">Whatever your code keeps in <code>localStorage</code> is saved to your account.</small>
        </div>
        {err && <p className="tc-err">{err}</p>}
        <button className="btn" disabled={save.isPending}>{initial ? 'Save changes' : 'Add to dashboard'}</button>
      </form>
    </Modal>
  )
}

/** Your own dashboard: blocks of code you pasted, running side by side, each remembering its own data. */
export default function PersonalDashboard() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['personal', 'widgets'], queryFn: () => api.get<{ items: Widget[] }>('/personal/widgets').then((r) => r.items) })
  const [editing, setEditing] = useState<Widget | 'new' | null>(null)
  const [viewing, setViewing] = useState<Widget | null>(null)
  const [reload, setReload] = useState<Record<string, number>>({})
  const live = useRef<Record<string, Record<string, string>>>({}) // each block's newest data, for the "Data" view
  const refresh = () => qc.invalidateQueries({ queryKey: ['personal', 'widgets'] })
  const del = useMutation({ mutationFn: (id: string) => api.del(`/personal/widgets/${id}`), onSuccess: refresh })
  const reset = useMutation({
    mutationFn: (id: string) => api.put(`/personal/widgets/${id}/data`, { data: {} }),
    onSuccess: (_r, id) => { live.current[id] = {}; setReload((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 })); setViewing(null); refresh() },
  })
  const items = q.data ?? []

  return (
    <>
      <div className="page-head"><h1>Dashboard</h1>
        <div className="actions"><button className="btn small" onClick={() => setEditing('new')}><Plus size={14} /> Add code block</button></div>
      </div>
      <p className="muted at-help">Paste any HTML page or snippet and it runs here, on your dashboard. Anything it saves with <code>localStorage</code> (a counter, a to-do list, settings) is kept in your account, so it is still there after a refresh.</p>

      {q.isLoading ? null : !items.length ? <Empty>Nothing here yet. Add a code block, or start from the counter example.</Empty> : (
        <div className="cb-grid">
          {items.map((w) => (
            <section key={w.id} className="cb-card">
              <header>
                <b>{w.title}</b>
                <span>
                  <button className="icon-btn" title="Saved data (JSON)" aria-label="Saved data" onClick={() => setViewing(w)}><Database size={14} /></button>
                  <button className="icon-btn" title="Edit code" aria-label={`Edit ${w.title}`} onClick={() => setEditing(w)}><Pencil size={14} /></button>
                  <button className="icon-btn danger" title="Delete" aria-label={`Delete ${w.title}`} onClick={() => { if (confirm(`Delete “${w.title}” and its saved data?`)) del.mutate(w.id) }}><Trash2 size={14} /></button>
                </span>
              </header>
              <CodeBlock key={`${w.id}:${reload[w.id] ?? 0}`} widget={w} onData={(id, d) => { live.current[id] = d }} />
            </section>
          ))}
        </div>
      )}

      {editing && <Editor initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {viewing && (
        <Modal title={`${viewing.title}: saved data`} onClose={() => setViewing(null)}>
          <p className="muted"><Braces size={14} /> This is what the block has stored, as JSON on the server.</p>
          <pre className="cb-json">{JSON.stringify(live.current[viewing.id] ?? viewing.data ?? {}, null, 2)}</pre>
          <button className="btn small ghost" disabled={reset.isPending} onClick={() => { if (confirm('Erase all saved data for this block? The block starts fresh.')) reset.mutate(viewing.id) }}>Reset data</button>
        </Modal>
      )}
    </>
  )
}

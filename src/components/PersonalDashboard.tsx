import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Braces, Code2, Database, Maximize2, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '../api'
import CodeBlock, { type Widget } from './CodeBlock'
import { Modal } from './ui'

const COUNTER = `<div style="font-family:system-ui,sans-serif;text-align:center;padding:48px 16px">
  <div id="n" style="font-size:80px;font-weight:800">0</div>
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

function Editor({ initial, onClose, onSaved }: { initial?: Widget; onClose: () => void; onSaved: (w: Widget) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [html, setHtml] = useState(initial?.html ?? '')
  const [err, setErr] = useState('')
  const save = useMutation({
    mutationFn: () => {
      const body = { title: title.trim() || 'Untitled dashboard', html }
      return initial ? api.patch<Widget>(`/personal/widgets/${initial.id}`, body) : api.post<Widget>('/personal/widgets', body)
    },
    onSuccess: (w) => { onSaved(w); onClose() },
    onError: (e: Error) => setErr(e instanceof ApiError ? e.message : 'Could not save'),
  })
  const submit = (e: FormEvent) => { e.preventDefault(); if (!html.trim()) return setErr('Paste some HTML first'); setErr(''); save.mutate() }
  return (
    <Modal title={initial ? 'Edit dashboard' : 'New dashboard'} onClose={onClose}>
      <form className="cb-form" onSubmit={submit}>
        <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Name, e.g. Habit tracker" aria-label="Name" autoFocus />
        <textarea className="cb-code" value={html} spellCheck={false} rows={16} onChange={(e) => setHtml(e.target.value)}
          placeholder={'Paste your HTML here: a full page or just a snippet, with <style> and <script> if you like.'} aria-label="HTML code" />
        <div className="cb-tips">
          <button type="button" className="btn small ghost" onClick={() => { setHtml(COUNTER); if (!title) setTitle('Counter') }}><Code2 size={14} /> Insert a counter example</button>
          <small className="muted">Whatever your code keeps in <code>localStorage</code> is saved to your account.</small>
        </div>
        {err && <p className="tc-err">{err}</p>}
        <button className="btn" disabled={save.isPending}>{initial ? 'Save changes' : 'Create dashboard'}</button>
      </form>
    </Modal>
  )
}

const LAST = 'glob_last_dashboard'
const remembered = () => { try { return localStorage.getItem(LAST) } catch { return null } }

/**
 * Your dashboards, one per screen. There is always at least one (made for you); add as many more as you like and
 * switch with the strip at the top. Each is pasted HTML running full-size, and remembers its own data.
 */
export default function PersonalDashboard({ id }: { id?: string }) {
  const qc = useQueryClient()
  const nav = useNavigate()
  const q = useQuery({ queryKey: ['personal', 'widgets'], queryFn: () => api.get<{ items: Widget[] }>('/personal/widgets').then((r) => r.items) })
  const [editing, setEditing] = useState<Widget | 'new' | null>(null)
  const [viewing, setViewing] = useState(false)
  const [reload, setReload] = useState<Record<string, number>>({})
  const live = useRef<Record<string, Record<string, string>>>({}) // each dashboard's newest data, for the "Data" view
  const box = useRef<HTMLDivElement>(null)
  const items = q.data ?? []
  // the one in the address, else the one you had open last time, else the first
  const current = items.find((w) => w.id === id) ?? items.find((w) => w.id === remembered()) ?? items[0]

  useEffect(() => { if (current) { try { localStorage.setItem(LAST, current.id) } catch { /* private mode */ } } }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => qc.invalidateQueries({ queryKey: ['personal', 'widgets'] })
  const go = (w: Widget) => nav(`/personal/dashboard/${w.id}`)
  const del = useMutation({
    mutationFn: (w: Widget) => api.del(`/personal/widgets/${w.id}`),
    onSuccess: () => { refresh(); nav('/personal/dashboard', { replace: true }) },
    onError: (e: Error) => alert(e.message),
  })
  const reset = useMutation({
    mutationFn: (w: Widget) => api.put(`/personal/widgets/${w.id}/data`, { data: {} }),
    onSuccess: (_r, w) => { live.current[w.id] = {}; setReload((r) => ({ ...r, [w.id]: (r[w.id] ?? 0) + 1 })); setViewing(false); refresh() },
  })

  if (!current) return null
  return (
    <div className="dash">
      <div className="dash-bar">
        <div className="dash-tabs" role="tablist" aria-label="Dashboards">
          {items.map((w) => (
            <button key={w.id} role="tab" aria-selected={w.id === current.id} className={w.id === current.id ? 'on' : ''} onClick={() => go(w)}>{w.title}</button>
          ))}
          <button className="dash-new" title="New dashboard" aria-label="New dashboard" onClick={() => setEditing('new')}><Plus size={15} /></button>
        </div>
        <span className="dash-actions">
          <button className="icon-btn" title="Full screen" aria-label="Full screen" onClick={() => box.current?.requestFullscreen?.().catch(() => {})}><Maximize2 size={14} /></button>
          <button className="icon-btn" title="Saved data (JSON)" aria-label="Saved data" onClick={() => setViewing(true)}><Database size={14} /></button>
          <button className="icon-btn" title="Edit code or rename" aria-label={`Edit ${current.title}`} onClick={() => setEditing(current)}><Pencil size={14} /></button>
          {items.length > 1 && <button className="icon-btn danger" title="Delete this dashboard" aria-label={`Delete ${current.title}`}
            onClick={() => { if (confirm(`Delete “${current.title}” and its saved data?`)) del.mutate(current) }}><Trash2 size={14} /></button>}
        </span>
      </div>

      <div className="dash-stage">
        <CodeBlock key={`${current.id}:${reload[current.id] ?? 0}`} widget={{ ...current, data: live.current[current.id] ?? current.data }} fill boxRef={box} onData={(wid, d) => {
          live.current[wid] = d
          // keep the cached copy current, so coming back to this dashboard later starts from what it last saved
          qc.setQueryData<Widget[]>(['personal', 'widgets'], (all) => all?.map((w) => (w.id === wid ? { ...w, data: d } : w)))
        }} />
      </div>

      {editing && <Editor initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(w) => { refresh(); if (editing === 'new') go(w) }} />}
      {viewing && (
        <Modal title={`${current.title}: saved data`} onClose={() => setViewing(false)}>
          <p className="muted"><Braces size={14} /> This is what the dashboard has stored, as JSON on the server.</p>
          <pre className="cb-json">{JSON.stringify(live.current[current.id] ?? current.data ?? {}, null, 2)}</pre>
          <button className="btn small ghost" disabled={reset.isPending} onClick={() => { if (confirm('Erase all saved data for this dashboard? It starts fresh.')) reset.mutate(current) }}>Reset data</button>
        </Modal>
      )}
    </div>
  )
}

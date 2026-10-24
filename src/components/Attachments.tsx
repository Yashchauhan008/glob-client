import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, ImagePlus, Link2, X } from 'lucide-react'
import { api, uploadImage, uploadThumbnail } from '../api'
import { Modal } from './ui'
import { faviconUrl, fileUrl } from '../files'

export type AttachEntity = 'idea' | 'note' | 'question' | 'todo' | 'event' | 'lead'
export type Attachment = { id: string; kind: 'link' | 'image'; url: string; title: string; thumb_url?: string | null; created_at?: string; owner_name?: string }
export type Draft = { links: string[]; files: File[] }
export const emptyDraft: Draft = { links: [], files: [] }

const SITES: [RegExp, string, string][] = [
  [/(^|\.)instagram\.com$/, 'Instagram', 'linear-gradient(135deg,#f9ce34,#ee2a7b 55%,#6228d7)'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube', '#ff2d2d'],
  [/(^|\.)tiktok\.com$/, 'TikTok', '#111'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'X', '#111'],
  [/(^|\.)reddit\.com$/, 'Reddit', '#ff4500'],
  [/(^|\.)linkedin\.com$/, 'LinkedIn', '#0a66c2'],
  [/(^|\.)github\.com$/, 'GitHub', '#24292f'],
]
export function describeLink(url: string) {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    const host = u.hostname.replace(/^www\./, '')
    const site = SITES.find(([re]) => re.test(host))
    const path = (u.pathname + u.search).replace(/\/$/, '')
    return { host, label: site?.[1] ?? host, bg: site?.[2] ?? '#5b5b66', path: path.length > 1 ? path : '', known: !!site }
  } catch { return { host: url, label: 'Link', bg: '#5b5b66', path: '', known: false } }
}

export function LinkCard({ a, onRemove, onThumb }: { a: Pick<Attachment, 'url' | 'title' | 'thumb_url'>; onRemove?: () => void; onThumb?: (f: File) => void }) {
  const d = describeLink(a.url)
  const pick = useRef<HTMLInputElement>(null)
  const href = /^https?:\/\//i.test(a.url) ? a.url : `https://${a.url}`
  return (
    <div className="att-link">
      <a href={href} target="_blank" rel="noreferrer noopener">
        {a.thumb_url
          ? <span className="att-pic"><img src={fileUrl(a.thumb_url)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} /></span>
          : d.known
            ? <span className="att-badge" style={{ background: d.bg }}>{d.label.slice(0, 2).toUpperCase()}</span>
            : <span className="att-fav"><img src={faviconUrl(a.url)} alt="" width={22} height={22} onError={(e) => { e.currentTarget.style.display = 'none' }} /></span>}
        <span className="att-text"><b>{a.title || d.label}</b><small>{d.host}{d.path}</small></span>
        <ExternalLink size={15} />
      </a>
      {onThumb && !a.thumb_url && (
        <>
          <button type="button" className="att-addpic" onClick={() => pick.current?.click()}><ImagePlus size={13} /> Add preview</button>
          <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onThumb(f); e.target.value = '' }} />
        </>
      )}
      {onRemove && <button type="button" className="att-x" aria-label="Remove" onClick={onRemove}><X size={14} /></button>}
    </div>
  )
}

/** Collects links + pasted/dropped/chosen images; works for saved rows (via `onAddLink`/`onAddFiles`) or a draft. */
function Adder({ onLink, onFiles, busy }: { onLink: (url: string) => void; onFiles: (f: File[]) => void; busy?: boolean }) {
  const [url, setUrl] = useState('')
  const pick = useRef<HTMLInputElement>(null)
  const images = (list: FileList | File[] | null) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'))
  const addLink = () => { const v = url.trim(); if (v) { onLink(v); setUrl('') } }
  const onPaste = (e: ClipboardEvent) => {
    const imgs = images(e.clipboardData.files)
    if (imgs.length) { e.preventDefault(); onFiles(imgs) }
  }
  const onDrop = (e: DragEvent) => { const imgs = images(e.dataTransfer.files); if (imgs.length) { e.preventDefault(); onFiles(imgs) } }
  return (
    <div className="att-add" onPaste={onPaste} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="att-input">
        <Link2 size={16} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a reel / post link…" disabled={busy}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} />
        <button type="button" className="btn small" onClick={addLink} disabled={!url.trim() || busy}>Add</button>
      </div>
      <button type="button" className="btn ghost small" onClick={() => pick.current?.click()} disabled={busy}><ImagePlus size={15} /> Image</button>
      <input ref={pick} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(images(e.target.files)); e.target.value = '' }} />
      <small className="att-hint">You can also paste or drop a screenshot here.</small>
    </div>
  )
}

/** Attachments of a saved item: thumbnails, link cards, add/remove. */
export default function Attachments({ type, id, editable = true }: { type: AttachEntity; id: string; editable?: boolean }) {
  const qc = useQueryClient()
  const key = ['attachments', type, id]
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ items: Attachment[] }>(`/attachments?type=${type}&id=${id}`),
    // a fresh link's preview is fetched in the background: look again for a short while
    refetchInterval: (query) => query.state.data?.items.some((a) => a.kind === 'link' && !a.thumb_url && a.created_at && Date.now() - new Date(a.created_at).getTime() < 25000) ? 2500 : false,
  })
  const [open, setOpen] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['ideas'] }) }

  const addLink = useMutation({ mutationFn: (url: string) => api.post('/attachments', { entity_type: type, entity_id: id, kind: 'link', url }), onSuccess: () => { setErr(''); refresh() }, onError: (e: Error) => setErr(e.message) })
  const addFiles = useMutation({
    mutationFn: async (files: File[]) => { for (const f of files) { const up = await uploadImage(f); await api.post('/attachments', { entity_type: type, entity_id: id, kind: 'image', file_id: up.file_id }) } },
    onSuccess: () => { setErr(''); refresh() }, onError: (e: Error) => setErr(e.message),
  })
  const setThumb = useMutation({ mutationFn: ({ id: aid, file }: { id: string; file: File }) => uploadThumbnail(aid, file), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })
  const del = useMutation({ mutationFn: (aid: string) => api.del(`/attachments/${aid}`), onSuccess: refresh })

  const items = q.data?.items ?? []
  const images = items.filter((a) => a.kind === 'image')
  const links = items.filter((a) => a.kind === 'link')
  return (
    <div className="att">
      {!!images.length && (
        <div className="att-grid">
          {images.map((a) => (
            <div key={a.id} className="att-thumb">
              <button type="button" onClick={() => setOpen(fileUrl(a.url))} aria-label="Open image"><img src={fileUrl(a.url)} alt="" loading="lazy" /></button>
              {editable && <button type="button" className="att-x" aria-label="Remove" onClick={() => del.mutate(a.id)}><X size={14} /></button>}
            </div>
          ))}
        </div>
      )}
      {!!links.length && <div className="att-links">{links.map((a) => <LinkCard key={a.id} a={a} onRemove={editable ? () => del.mutate(a.id) : undefined} onThumb={editable ? (file) => setThumb.mutate({ id: a.id, file }) : undefined} />)}</div>}
      {!items.length && !q.isLoading && <p className="muted">Nothing attached yet.</p>}
      {editable && <Adder busy={addLink.isPending || addFiles.isPending} onLink={(u) => addLink.mutate(u)} onFiles={(f) => f.length && addFiles.mutate(f)} />}
      {(addFiles.isPending || addLink.isPending) && <small className="muted">Saving…</small>}
      {err && <div className="form-err">{err}</div>}
      {open && <Modal title="" onClose={() => setOpen(null)}><img className="att-full" src={open} alt="" /><a className="link" href={open} target="_blank" rel="noreferrer">Open original</a></Modal>}
    </div>
  )
}

/** Attach while creating: nothing is sent until the item exists (see `saveDraft`). */
export function AttachDraft({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const previews = useRef(new Map<File, string>())
  const src = (f: File) => { if (!previews.current.has(f)) previews.current.set(f, URL.createObjectURL(f)); return previews.current.get(f)! }
  return (
    <div className="att att-draft">
      {!!draft.files.length && (
        <div className="att-grid">
          {draft.files.map((f, i) => (
            <div key={i} className="att-thumb"><img src={src(f)} alt="" /><button type="button" className="att-x" aria-label="Remove" onClick={() => setDraft({ ...draft, files: draft.files.filter((_, j) => j !== i) })}><X size={14} /></button></div>
          ))}
        </div>
      )}
      {!!draft.links.length && <div className="att-links">{draft.links.map((l, i) => <LinkCard key={i} a={{ url: l, title: '' }} onRemove={() => setDraft({ ...draft, links: draft.links.filter((_, j) => j !== i) })} />)}</div>}
      <Adder onLink={(u) => setDraft({ ...draft, links: [...draft.links, u] })} onFiles={(f) => setDraft({ ...draft, files: [...draft.files, ...f] })} />
    </div>
  )
}

export async function saveDraft(type: AttachEntity, id: string, draft: Draft) {
  for (const url of draft.links) await api.post('/attachments', { entity_type: type, entity_id: id, kind: 'link', url })
  for (const f of draft.files) { const up = await uploadImage(f); await api.post('/attachments', { entity_type: type, entity_id: id, kind: 'image', file_id: up.file_id }) }
}

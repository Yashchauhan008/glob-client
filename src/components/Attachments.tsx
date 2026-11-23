import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, ExternalLink, Eye, FileText, ImagePlus, Link2, Paperclip, StickyNote, X } from 'lucide-react'
import { api, uploadAttachmentFile, uploadImage, uploadThumbnail } from '../api'
import { Modal } from './ui'
import { faviconUrl, fileUrl } from '../files'

export type AttachEntity = 'idea' | 'note' | 'question' | 'todo' | 'event' | 'lead'
export type AttachKind = 'link' | 'image' | 'text' | 'video' | 'document'
export type Attachment = {
  id: string
  kind: AttachKind
  url: string
  title: string
  body?: string
  thumb_url?: string | null
  created_at?: string
  owner_name?: string
}
export type Draft = { links: string[]; files: File[]; docs: File[]; notes: string[] }
export const emptyDraft: Draft = { links: [], files: [], docs: [], notes: [] }

const SITES: [RegExp, string, string][] = [
  [/(^|\.)instagram\.com$/, 'Instagram', 'linear-gradient(135deg,#f9ce34,#ee2a7b 55%,#6228d7)'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube', '#ff2d2d'],
  [/(^|\.)tiktok\.com$/, 'TikTok', '#111'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'X', '#111'],
  [/(^|\.)reddit\.com$/, 'Reddit', '#ff4500'],
  [/(^|\.)linkedin\.com$/, 'LinkedIn', '#0a66c2'],
  [/(^|\.)github\.com$/, 'GitHub', '#24292f'],
  [/(^|\.)(docs\.google\.com|drive\.google\.com)$/, 'Google Docs', '#1a73e8'],
  [/(^|\.)notion\.so$/, 'Notion', '#111'],
  [/(^|\.)figma\.com$/, 'Figma', '#a259ff'],
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

function hrefOf(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function fileLabel(name: string) {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : 'FILE'
  return ext.slice(0, 4)
}

function extOf(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/)
  return m?.[1] ?? ''
}

const isStoredFile = (url: string) => /\/files\//.test(url)
type Preview = { url: string; title: string; kind: AttachKind }

function FilePreview({ preview, onClose }: { preview: Preview; onClose: () => void }) {
  const src = fileUrl(preview.url) || hrefOf(preview.url)
  const name = preview.title || 'File'
  const ext = extOf(name) || extOf(src)
  const [text, setText] = useState<string | null>(null)
  const [textErr, setTextErr] = useState('')
  const image = preview.kind === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
  const video = preview.kind === 'video' || ['mp4', 'webm', 'mov', 'm4v', 'ogg'].includes(ext)
  const pdf = ext === 'pdf'
  const office = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext)
  const plain = ['txt', 'csv', 'json', 'md', 'log', 'tsv'].includes(ext)
  const known = image || video || pdf || office || plain

  useEffect(() => {
    if (!plain) return
    let alive = true
    fetch(src)
      .then((r) => { if (!r.ok) throw new Error('Could not load the file'); return r.text() })
      .then((t) => { if (alive) setText(t) })
      .catch((e: Error) => { if (alive) setTextErr(e.message) })
    return () => { alive = false }
  }, [plain, src])

  return (
    <Modal title={name} onClose={onClose}>
      <div className="att-preview">
        {image && <img className="att-full" src={src} alt={name} />}
        {video && <video className="att-preview-media" src={src} controls autoPlay playsInline />}
        {pdf && <iframe className="att-preview-frame" title={name} src={src} />}
        {office && (
          <iframe
            className="att-preview-frame"
            title={name}
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(src)}`}
          />
        )}
        {plain && (
          textErr ? <p className="form-err">{textErr}</p>
            : text == null ? <p className="muted">Loading…</p>
              : <pre className="att-preview-text">{text}</pre>
        )}
        {!known && (
          <div className="att-preview-empty">
            <FileText size={36} />
            <p>No in-browser preview for this file type.</p>
          </div>
        )}
        <div className="att-preview-actions">
          <a className="btn small" href={src} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Open</a>
          <a className="btn ghost small" href={src} download={name}><Download size={14} /> Download</a>
        </div>
      </div>
    </Modal>
  )
}

export function LinkCard({ a, onRemove, onThumb }: { a: Pick<Attachment, 'url' | 'title' | 'thumb_url'>; onRemove?: () => void; onThumb?: (f: File) => void }) {
  const d = describeLink(a.url)
  const pick = useRef<HTMLInputElement>(null)
  return (
    <div className="att-link">
      <a href={hrefOf(a.url)} target="_blank" rel="noreferrer noopener">
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

function DocCard({ a, onRemove, onPreview }: { a: Pick<Attachment, 'url' | 'title' | 'kind'>; onRemove?: () => void; onPreview?: () => void }) {
  const name = a.title || (a.kind === 'video' ? 'Video' : 'Document')
  const href = a.url && a.url !== '#' ? (fileUrl(a.url) || hrefOf(a.url)) : ''
  const open = () => { if (onPreview && href) onPreview(); else if (href) window.open(href, '_blank', 'noopener,noreferrer') }
  return (
    <div className="att-link">
      <button type="button" className="att-link-btn" onClick={open} disabled={!href}>
        <span className="att-badge" style={{ background: a.kind === 'video' ? '#ff2d2d' : '#3a3a3e' }}>{fileLabel(name)}</span>
        <span className="att-text"><b>{name}</b><small>{a.kind === 'video' ? 'Video file' : 'Document'} · click to preview</small></span>
        <Eye size={15} />
      </button>
      {onRemove && <button type="button" className="att-x" aria-label="Remove" onClick={onRemove}><X size={14} /></button>}
    </div>
  )
}

function NoteCard({ a, onRemove }: { a: Pick<Attachment, 'title' | 'body'>; onRemove?: () => void }) {
  return (
    <div className="att-note">
      <StickyNote size={16} />
      <div className="att-text"><b>{a.title || 'Note'}</b>{!!a.body && a.body !== a.title && <small>{a.body}</small>}</div>
      {onRemove && <button type="button" className="att-x" aria-label="Remove" onClick={onRemove}><X size={14} /></button>}
    </div>
  )
}

/** Collects links, images, docs, and short notes for a reference list. */
function Adder({
  onLink, onImages, onDocs, onNote, busy,
}: {
  onLink: (url: string) => void
  onImages: (f: File[]) => void
  onDocs: (f: File[]) => void
  onNote: (text: string) => void
  busy?: boolean
}) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [writing, setWriting] = useState(false)
  const imgPick = useRef<HTMLInputElement>(null)
  const docPick = useRef<HTMLInputElement>(null)
  const images = (list: FileList | File[] | null) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'))
  const docs = (list: FileList | File[] | null) => [...(list ?? [])].filter((f) => !f.type.startsWith('image/'))
  const addLink = () => { const v = url.trim(); if (v) { onLink(v); setUrl('') } }
  const addNote = (e: FormEvent) => {
    e.preventDefault()
    const v = note.trim()
    if (!v) return
    onNote(v)
    setNote('')
    setWriting(false)
  }
  const onPaste = (e: ClipboardEvent) => {
    const imgs = images(e.clipboardData.files)
    if (imgs.length) { e.preventDefault(); onImages(imgs); return }
    const files = docs(e.clipboardData.files)
    if (files.length) { e.preventDefault(); onDocs(files) }
  }
  const onDrop = (e: DragEvent) => {
    const imgs = images(e.dataTransfer.files)
    const files = docs(e.dataTransfer.files)
    if (!imgs.length && !files.length) return
    e.preventDefault()
    if (imgs.length) onImages(imgs)
    if (files.length) onDocs(files)
  }
  return (
    <div className="att-add" onPaste={onPaste} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="att-input">
        <Link2 size={16} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste any link…" disabled={busy}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} />
        <button type="button" className="btn small" onClick={addLink} disabled={!url.trim() || busy}>Add</button>
      </div>
      <button type="button" className="btn ghost small" onClick={() => imgPick.current?.click()} disabled={busy}><ImagePlus size={15} /> Image</button>
      <button type="button" className="btn ghost small" onClick={() => docPick.current?.click()} disabled={busy}><Paperclip size={15} /> File</button>
      <button type="button" className="btn ghost small" onClick={() => setWriting((v) => !v)} disabled={busy}><FileText size={15} /> Note</button>
      <input ref={imgPick} type="file" accept="image/*" multiple hidden onChange={(e) => { onImages(images(e.target.files)); e.target.value = '' }} />
      <input ref={docPick} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.mp4,.webm,.mov,.m4v,application/*,video/*" multiple hidden onChange={(e) => { onDocs(docs(e.target.files)); e.target.value = '' }} />
      {writing && (
        <form className="att-note-form" onSubmit={addNote}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="A short reference note…" autoFocus disabled={busy} />
          <button type="submit" className="btn small" disabled={!note.trim() || busy}>Save note</button>
        </form>
      )}
      <small className="att-hint">Links, images, docs, or a note. Paste or drop files here too.</small>
    </div>
  )
}

/** References on a saved item: images, clickable links, docs, notes. */
export default function Attachments({ type, id, editable = true }: { type: AttachEntity; id: string; editable?: boolean }) {
  const qc = useQueryClient()
  const key = ['attachments', type, id]
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ items: Attachment[] }>(`/attachments?type=${type}&id=${id}`),
    refetchInterval: (query) => query.state.data?.items.some((a) => (a.kind === 'link' || a.kind === 'video') && !a.thumb_url && a.created_at && Date.now() - new Date(a.created_at).getTime() < 25000) ? 2500 : false,
  })
  const [open, setOpen] = useState<Preview | null>(null)
  const [err, setErr] = useState('')
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['ideas'] }) }

  const addLink = useMutation({
    mutationFn: (url: string) => api.post('/attachments', { entity_type: type, entity_id: id, kind: 'link', url }),
    onSuccess: () => { setErr(''); refresh() }, onError: (e: Error) => setErr(e.message),
  })
  const addImages = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) {
        const up = await uploadImage(f)
        await api.post('/attachments', { entity_type: type, entity_id: id, kind: 'image', file_id: up.file_id })
      }
    },
    onSuccess: () => { setErr(''); refresh() }, onError: (e: Error) => setErr(e.message),
  })
  const addDocs = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) {
        const up = await uploadAttachmentFile(f)
        await api.post('/attachments', { entity_type: type, entity_id: id, kind: up.kind, file_id: up.file_id, title: up.name })
      }
    },
    onSuccess: () => { setErr(''); refresh() }, onError: (e: Error) => setErr(e.message),
  })
  const addNote = useMutation({
    mutationFn: (text: string) => api.post('/attachments', { entity_type: type, entity_id: id, kind: 'text', body: text, title: text.slice(0, 80) }),
    onSuccess: () => { setErr(''); refresh() }, onError: (e: Error) => setErr(e.message),
  })
  const setThumb = useMutation({ mutationFn: ({ id: aid, file }: { id: string; file: File }) => uploadThumbnail(aid, file), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })
  const del = useMutation({ mutationFn: (aid: string) => api.del(`/attachments/${aid}`), onSuccess: refresh })
  const remove = (id: string, label: string) => { if (confirm(`Remove “${label}”?`)) del.mutate(id) }

  const items = q.data?.items ?? []
  const images = items.filter((a) => a.kind === 'image')
  const links = items.filter((a) => a.kind === 'link' || (a.kind === 'video' && !isStoredFile(a.url)))
  const docs = items.filter((a) => a.kind === 'document' || (a.kind === 'video' && isStoredFile(a.url)))
  const notes = items.filter((a) => a.kind === 'text')
  const busy = addLink.isPending || addImages.isPending || addDocs.isPending || addNote.isPending
  const previewOf = (a: Attachment): Preview => ({ url: a.url, title: a.title || (a.kind === 'video' ? 'Video' : 'Document'), kind: a.kind })

  return (
    <div className="att">
      {!!images.length && (
        <div className="att-grid">
          {images.map((a) => (
            <div key={a.id} className="att-thumb">
              <button type="button" onClick={() => setOpen(previewOf(a))} aria-label="Open image"><img src={fileUrl(a.url)} alt="" loading="lazy" /></button>
              {editable && <button type="button" className="att-x" aria-label="Remove" onClick={() => remove(a.id, a.title || 'this image')}><X size={14} /></button>}
            </div>
          ))}
        </div>
      )}
      {!!links.length && <div className="att-links">{links.map((a) => <LinkCard key={a.id} a={a} onRemove={editable ? () => remove(a.id, a.title || a.url) : undefined} onThumb={editable ? (file) => setThumb.mutate({ id: a.id, file }) : undefined} />)}</div>}
      {!!docs.length && <div className="att-links">{docs.map((a) => <DocCard key={a.id} a={a} onPreview={() => setOpen(previewOf(a))} onRemove={editable ? () => remove(a.id, a.title || 'this file') : undefined} />)}</div>}
      {!!notes.length && <div className="att-notes">{notes.map((a) => <NoteCard key={a.id} a={a} onRemove={editable ? () => remove(a.id, a.title || 'this note') : undefined} />)}</div>}
      {!items.length && !q.isLoading && <p className="muted">Nothing referenced yet.</p>}
      {editable && (
        <Adder
          busy={busy}
          onLink={(u) => addLink.mutate(u)}
          onImages={(f) => f.length && addImages.mutate(f)}
          onDocs={(f) => f.length && addDocs.mutate(f)}
          onNote={(t) => addNote.mutate(t)}
        />
      )}
      {busy && <small className="muted">Saving…</small>}
      {err && <div className="form-err">{err}</div>}
      {open && <FilePreview preview={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** Collect references while creating; nothing is sent until the item exists (see `saveDraft`). */
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
      {!!draft.docs.length && <div className="att-links">{draft.docs.map((f, i) => <DocCard key={i} a={{ url: '#', title: f.name, kind: f.type.startsWith('video/') ? 'video' : 'document' }} onRemove={() => setDraft({ ...draft, docs: draft.docs.filter((_, j) => j !== i) })} />)}</div>}
      {!!draft.notes.length && <div className="att-notes">{draft.notes.map((n, i) => <NoteCard key={i} a={{ title: n.slice(0, 80), body: n }} onRemove={() => setDraft({ ...draft, notes: draft.notes.filter((_, j) => j !== i) })} />)}</div>}
      <Adder
        onLink={(u) => setDraft({ ...draft, links: [...draft.links, u] })}
        onImages={(f) => setDraft({ ...draft, files: [...draft.files, ...f] })}
        onDocs={(f) => setDraft({ ...draft, docs: [...draft.docs, ...f] })}
        onNote={(t) => setDraft({ ...draft, notes: [...draft.notes, t] })}
      />
    </div>
  )
}

export async function saveDraft(type: AttachEntity, id: string, draft: Draft) {
  for (const url of draft.links) await api.post('/attachments', { entity_type: type, entity_id: id, kind: 'link', url })
  for (const f of draft.files) { const up = await uploadImage(f); await api.post('/attachments', { entity_type: type, entity_id: id, kind: 'image', file_id: up.file_id }) }
  for (const f of draft.docs) {
    const up = await uploadAttachmentFile(f)
    await api.post('/attachments', { entity_type: type, entity_id: id, kind: up.kind, file_id: up.file_id, title: up.name })
  }
  for (const note of draft.notes) await api.post('/attachments', { entity_type: type, entity_id: id, kind: 'text', body: note, title: note.slice(0, 80) })
}

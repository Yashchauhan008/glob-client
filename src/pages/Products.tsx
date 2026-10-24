import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Globe, Pencil, Trash2 } from 'lucide-react'
import { api } from '../api'
import { faviconUrl, prettyUrl } from '../files'
import { PRODUCT_COLOR, PRODUCT_STATUSES, type Idea, type Product } from '../types'
import { CsvTools, Empty, Header, Modal } from '../components/ui'
import { Description, MarkdownField } from '../components/Markdown'

function ProductForm({ product, ideas, busy, error, onSubmit }: { product?: Product; ideas: Idea[]; busy: boolean; error?: string; onSubmit: (b: object) => void }) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    onSubmit({ name: String(f.get('name')).trim(), url: String(f.get('url') || '').trim(), description: String(f.get('description') || ''), status: f.get('status'), idea_id: f.get('idea_id') || null })
  }
  return (
    <form onSubmit={submit}>
      <input name="name" placeholder="Name" defaultValue={product?.name} required autoFocus />
      <input name="url" placeholder="https://…" defaultValue={product?.url} />
      <MarkdownField name="description" rows={7} defaultValue={product?.description ?? ''} placeholder="What is it, who is it for, links, status notes… (Markdown works)" />
      <select name="status" defaultValue={product?.status ?? 'building'}>{PRODUCT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      <select name="idea_id" defaultValue={product?.idea_id ?? ''}><option value="">No linked idea</option>{ideas.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select>
      {error && <div className="form-err">{error}</div>}
      <button className="btn" disabled={busy}>{product ? 'Save' : 'Create'}</button>
    </form>
  )
}

function Favicon({ url }: { url: string }) {
  const [bad, setBad] = useState(false)
  const src = faviconUrl(url, 64)
  if (!src || bad) return <span className="pc-fav fallback"><Globe size={18} /></span>
  return <span className="pc-fav"><img src={src} alt="" width={28} height={28} onError={() => setBad(true)} /></span>
}

export default function Products() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['products'], queryFn: () => api.get<{ items: Product[] }>('/products') })
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: () => api.get<{ items: Idea[] }>('/ideas') })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const done = () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) }
  const create = useMutation({ mutationFn: (b: object) => api.post('/products', b), onSuccess: () => { done(); setOpen(false) } })
  const patch = useMutation({ mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) => api.patch(`/products/${id}`, b), onSuccess: () => { done(); setEditing(null) } })
  const del = useMutation({ mutationFn: (id: string) => api.del(`/products/${id}`), onSuccess: done })

  const items = data?.items ?? []
  return (
    <>
      <Header title="Products">
        <CsvTools entity="products" invalidate={['products']} />
        <button className="btn" onClick={() => { create.reset(); setOpen(true) }}>New product</button>
      </Header>
      {!items.length && <Empty>No products yet.</Empty>}
      <div className="grid products-grid">
        {items.map((p) => (
          <div key={p.id} className="card pcard2" style={{ '--c': PRODUCT_COLOR[p.status] } as React.CSSProperties}>
            <div className="pc-top">
              <div className="pc-title">{p.url && <Favicon url={p.url} />}<h3>{p.name}</h3></div>
              <span className={'pc-status ' + p.status}><i />{p.status}</span>
            </div>
            {p.url
              ? <a href={/^https?:\/\//i.test(p.url) ? p.url : `https://${p.url}`} target="_blank" rel="noreferrer" className="pc-link"><span>{prettyUrl(p.url)}</span><ArrowUpRight size={14} /></a>
              : <span className="pc-nolink">No link yet</span>}
            {p.description && <Description text={p.description} lines={3} />}
            {p.idea_title && <div className="pc-idea">From idea · <b>{p.idea_title}</b></div>}
            <div className="pc-actions">
              <select value={p.status} onChange={(e) => patch.mutate({ id: p.id, status: e.target.value })} aria-label="Status">
                {PRODUCT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="pc-del" aria-label="Edit product" title="Edit" onClick={() => { patch.reset(); setEditing(p) }}><Pencil size={15} /></button>
              <button className="pc-del danger" aria-label="Delete product" title="Delete" onClick={() => confirm('Delete product?') && del.mutate(p.id)}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <Modal title="New product" onClose={() => setOpen(false)}>
          <ProductForm ideas={ideas.data?.items ?? []} busy={create.isPending} error={create.error?.message} onSubmit={(b) => create.mutate(b)} />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit product" onClose={() => setEditing(null)}>
          <ProductForm product={editing} ideas={ideas.data?.items ?? []} busy={patch.isPending} error={patch.error?.message} onSubmit={(b) => patch.mutate({ id: editing.id, ...b })} />
        </Modal>
      )}
    </>
  )
}

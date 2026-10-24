import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { PRODUCT_COLOR, PRODUCT_STATUSES, type Idea, type Product } from '../types'
import { CsvTools, Empty, Header, Modal } from '../components/ui'

export default function Products() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['products'], queryFn: () => api.get<{ items: Product[] }>('/products') })
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: () => api.get<{ items: Idea[] }>('/ideas') })
  const [open, setOpen] = useState(false)
  const done = () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) }
  const create = useMutation({ mutationFn: (b: object) => api.post('/products', b), onSuccess: () => { done(); setOpen(false) } })
  const patch = useMutation({ mutationFn: ({ id, ...b }: { id: string; status: string }) => api.patch(`/products/${id}`, b), onSuccess: done })
  const del = useMutation({ mutationFn: (id: string) => api.del(`/products/${id}`), onSuccess: done })

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    create.mutate({ name: f.get('name'), url: f.get('url'), status: f.get('status'), idea_id: f.get('idea_id') || null })
  }
  const items = data?.items ?? []
  return (
    <>
      <Header title="Products">
        <CsvTools entity="products" invalidate={['products']} />
        <button className="btn" onClick={() => setOpen(true)}>New product</button>
      </Header>
      {!items.length && <Empty>No products yet.</Empty>}
      <div className="grid">
        {items.map((p) => (
          <div key={p.id} className="card" style={{ '--c': PRODUCT_COLOR[p.status] } as React.CSSProperties}>
            <h3>{p.name}</h3>
            {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="link">{p.url.replace(/^https?:\/\//, '')} ↗</a> : <p>No link</p>}
            {p.idea_title && <div className="meta">from idea: {p.idea_title}</div>}
            <div className="row">
              <select value={p.status} onChange={(e) => patch.mutate({ id: p.id, status: e.target.value })}>
                {PRODUCT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="btn ghost small" onClick={() => confirm('Delete product?') && del.mutate(p.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <Modal title="New product" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <input name="name" placeholder="Name" required autoFocus />
            <input name="url" placeholder="https://…" />
            <select name="status" defaultValue="building">{PRODUCT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <select name="idea_id"><option value="">No linked idea</option>{ideas.data?.items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select>
            <button className="btn" disabled={create.isPending}>Create</button>
          </form>
        </Modal>
      )}
    </>
  )
}

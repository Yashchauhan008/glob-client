import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Check, Pencil, Trash2, X } from 'lucide-react'
import { api, uploadAvatar } from '../api'
import { useAuth } from '../auth'
import { Empty, Header } from '../components/ui'
import { Face, useTeam } from '../components/Avatar'
import { colorFor, usePresence } from '../presence'
import type { TeamMember } from '../types'

const ago = (s: string | null) => {
  if (!s) return 'never'
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function Card({ m, mine, online }: { m: TeamMember; mine: boolean; online: boolean }) {
  const qc = useQueryClient()
  const { updateUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(m.name)
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)

  const done = (r: { name: string; avatar_url: string | null }) => {
    updateUser({ name: r.name, avatar_url: r.avatar_url }); qc.invalidateQueries({ queryKey: ['team'] }); setEditing(false); setErr('')
  }
  const save = useMutation({
    mutationFn: (body: { name?: string; remove_avatar?: boolean }) => api.patch<{ name: string; avatar_url: string | null }>('/team/me', body),
    onSuccess: done,
    onError: (e: Error) => setErr(e.message),
  })
  const upload = useMutation({ mutationFn: uploadAvatar, onSuccess: done, onError: (e: Error) => setErr(e.message) })
  const busy = save.isPending || upload.isPending

  const pick = (f: File | undefined) => { if (f) { setErr(''); upload.mutate(f) } }

  return (
    <div className={'team-card' + (mine ? ' mine' : '')}>
      <div className="tc-avatar">
        <i style={{ background: colorFor(m.id) }}><Face id={m.id} name={m.name} /></i>
        {online && <b className="tc-online" title="Online now" />}
        {mine && (
          <button className="tc-cam" title="Change picture" disabled={busy} onClick={() => file.current?.click()}><Camera size={15} /></button>
        )}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      {editing ? (
        <form className="tc-edit" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate({ name: name.trim() }) }}>
          <input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Your name" />
          <button type="submit" className="ok" title="Save" disabled={busy || !name.trim()}><Check size={16} /></button>
          <button type="button" title="Cancel" onClick={() => { setEditing(false); setName(m.name); setErr('') }}><X size={16} /></button>
        </form>
      ) : (
        <h3>{m.name}{mine && <span className="tc-you">you</span>}{mine && <button className="tc-pen" title="Edit name" onClick={() => setEditing(true)}><Pencil size={14} /></button>}</h3>
      )}
      <p className="tc-mail">{m.email}</p>
      {err && <p className="tc-err">{err}</p>}

      <div className="tc-stats">
        <span><b>{m.ideas}</b>ideas</span>
        <span><b>{m.tasks_done}</b>tasks done</span>
        <span><b>{online ? 'now' : ago(m.last_active)}</b>active</span>
      </div>
      <small className="tc-joined">Joined {new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</small>
      {mine && m.avatar_url && <button className="tc-remove" disabled={busy} onClick={() => save.mutate({ remove_avatar: true })}><Trash2 size={13} /> Remove picture</button>}
    </div>
  )
}

export default function Team() {
  const { user } = useAuth()
  const { roster } = usePresence()
  const q = useTeam()
  const online = new Set(roster.map((r) => r.user_id))
  if (user) online.add(user.id)
  // you first, then A–Z
  const people = [...(q.data ?? [])].sort((a, b) => Number(b.id === user?.id) - Number(a.id === user?.id))

  return (
    <>
      <Header title="Team" />
      {q.isLoading ? <Empty>Loading the team…</Empty> : !people.length ? <Empty>No one here yet.</Empty> : (
        <div className="team-grid">{people.map((m) => <Card key={m.id} m={m} mine={m.id === user?.id} online={online.has(m.id)} />)}</div>
      )}
    </>
  )
}

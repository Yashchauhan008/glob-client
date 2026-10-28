import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Camera, Check, Mail, Pencil, ShieldCheck, Trash2, UserPlus, UserRoundX, X } from 'lucide-react'
import { api, ApiError, uploadAvatar } from '../api'
import { useAuth } from '../auth'
import { Empty, Header } from '../components/ui'
import { Face, useIsRoot, useTeam } from '../components/Avatar'
import AvatarCropper from '../components/AvatarCropper'
import { colorFor, usePresence } from '../presence'
import type { Invite, TeamMember } from '../types'

/** Total time Glob has been open: 45m, 3h 20m, 2d 5h. */
const liveTime = (seconds: number) => {
  const m = Math.floor(seconds / 60), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (d) return `${d}d ${h % 24}h`
  if (h) return `${h}h ${m % 60}m`
  return `${m}m`
}

const ago = (s: string | null) => {
  if (!s) return 'never'
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function Card({ m, mine, online, admin }: { m: TeamMember; mine: boolean; online: boolean; admin: boolean }) {
  const qc = useQueryClient()
  const { updateUser } = useAuth()
  const canEdit = mine || admin // the admin can change anyone's name and picture
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(m.name)
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const [cropping, setCropping] = useState<File | null>(null)

  // admin only: stop someone signing in, let them back, or remove them from the team
  const refresh = () => { qc.invalidateQueries({ queryKey: ['team'] }); qc.invalidateQueries({ queryKey: ['invites'] }) }
  const block = useMutation({ mutationFn: () => api.post(`/team/${m.id}/block`), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })
  const unblock = useMutation({ mutationFn: () => api.post(`/team/${m.id}/unblock`), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })
  const remove = useMutation({ mutationFn: () => api.del(`/team/${m.id}`), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })
  const adminBusy = block.isPending || unblock.isPending || remove.isPending

  const done = (r: { name: string; avatar_url: string | null }) => {
    if (mine) updateUser({ name: r.name, avatar_url: r.avatar_url })
    qc.invalidateQueries({ queryKey: ['team'] }); setEditing(false); setErr('')
  }
  const save = useMutation({
    mutationFn: (body: { name?: string; remove_avatar?: boolean }) => api.patch<{ name: string; avatar_url: string | null }>(`/team/${m.id}`, body),
    onSuccess: done,
    onError: (e: Error) => setErr(e.message),
  })
  const upload = useMutation({ mutationFn: (f: File) => uploadAvatar(f, m.id), onSuccess: done, onError: (e: Error) => setErr(e.message) })
  const busy = save.isPending || upload.isPending

  const pick = (f: File | undefined) => { if (f) { setErr(''); setCropping(f) } }

  return (
    <div className={'team-card' + (mine ? ' mine' : '') + (m.status !== 'active' ? ' off' : '')}>
      {cropping && <AvatarCropper file={cropping} onCancel={() => setCropping(null)} onSave={(f) => { setCropping(null); upload.mutate(f) }} />}
      <div className="tc-avatar">
        <i style={{ background: colorFor(m.id) }}><Face id={m.id} name={m.name} /></i>
        {online && <b className="tc-online" title="Online now" />}
        {canEdit && (
          <button className="tc-cam" title="Change picture" disabled={busy} onClick={() => file.current?.click()}><Camera size={15} /></button>
        )}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      {editing ? (
        <form className="tc-edit" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate({ name: name.trim() }) }}>
          <input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label={mine ? 'Your name' : `${m.name}'s name`} />
          <button type="submit" className="ok" title="Save" disabled={busy || !name.trim()}><Check size={16} /></button>
          <button type="button" title="Cancel" onClick={() => { setEditing(false); setName(m.name); setErr('') }}><X size={16} /></button>
        </form>
      ) : (
        <h3>{m.name}{mine && <span className="tc-you">you</span>}{m.is_root && <span className="tc-you tc-admin"><ShieldCheck size={11} /> admin</span>}{m.status === 'blocked' && <span className="tc-you tc-blocked">blocked</span>}{m.status === 'not_invited' && <span className="tc-you tc-blocked">not invited</span>}{canEdit && <button className="tc-pen" title="Edit name" onClick={() => setEditing(true)}><Pencil size={14} /></button>}</h3>
      )}
      <p className="tc-mail">{m.email}</p>
      {err && <p className="tc-err">{err}</p>}

      <div className="tc-stats">
        <span><b>{m.ideas}</b>ideas</span>
        <span><b>{m.tasks_done}</b>tasks done</span>
        <span><b>{online ? 'now' : ago(m.last_active)}</b>active</span>
        <span title="Total time spent on Glob"><b>{liveTime(m.live_seconds ?? 0)}</b>live time</span>
      </div>
      <small className="tc-joined">Joined {new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</small>
      {admin && !mine && !m.is_root && (
        <div className="tc-admin-row">
          {m.status === 'blocked'
            ? <button disabled={adminBusy} onClick={() => unblock.mutate()}><Check size={14} /> Unblock</button>
            : <button disabled={adminBusy} onClick={() => { if (confirm(`Block ${m.name}? They are signed out right away and cannot sign in until you unblock them.`)) block.mutate() }}><Ban size={14} /> Block</button>}
          <button className="danger" disabled={adminBusy} onClick={() => { if (confirm(`Remove ${m.name} from Glob for good?\n\nTheir ideas, tasks, leads, boards and messages move to you. They are signed out and taken off the invite list.`)) remove.mutate() }}><Trash2 size={14} /> Remove</button>
        </div>
      )}
      {canEdit && m.avatar_url && <button className="tc-remove" disabled={busy} onClick={() => save.mutate({ remove_avatar: true })}><Trash2 size={13} /> Remove picture</button>}
    </div>
  )
}

/** Admin only: the list of emails that may sign in. */
function Invites() {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(true)
  const q = useQuery({ queryKey: ['invites'], queryFn: () => api.get<{ root_email: string | null; items: Invite[] }>('/team/invites') })
  const add = useMutation({
    mutationFn: (emails: string) => api.post<{ added: number; already: number; invalid: string[] }>('/team/invites', { emails }),
    onSuccess: (r) => {
      setText('')
      setNote([r.added && `${r.added} invited`, r.already && `${r.already} already on the list`, r.invalid.length && `not valid: ${r.invalid.join(', ')}`].filter(Boolean).join(' · '))
      qc.invalidateQueries({ queryKey: ['invites'] }); qc.invalidateQueries({ queryKey: ['team'] })
    },
    onError: (e: Error) => setNote(e instanceof ApiError ? e.message : 'Could not add that'),
  })
  const drop = useMutation({
    mutationFn: (email: string) => api.del(`/team/invites/${encodeURIComponent(email)}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invites'] }); qc.invalidateQueries({ queryKey: ['team'] }) },
  })
  const submit = (e: FormEvent) => { e.preventDefault(); if (text.trim()) { setNote(''); add.mutate(text) } }
  const items = q.data?.items ?? []

  return (
    <section className="invites">
      <button className="inv-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span><Mail size={16} /> <b>Who can sign in</b></span>
        <small>{items.length} invited · only you can see this</small>
      </button>
      {open && (
        <>
          <form className="inv-add" onSubmit={submit}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add emails, separated by commas or spaces" aria-label="Emails to invite" />
            <button className="btn" disabled={add.isPending || !text.trim()}><UserPlus size={15} /> Invite</button>
          </form>
          {note && <p className="inv-note">{note}</p>}
          <p className="muted inv-help">Anyone not on this list cannot sign in or sign up. Removing an email signs that person out straight away.</p>
          <ul className="inv-list">
            {q.data?.root_email && <li><span className="inv-mail">{q.data.root_email}</span><span className="chip"><ShieldCheck size={12} className="ico" /> admin</span></li>}
            {items.filter((i) => i.email !== q.data?.root_email).map((i) => (
              <li key={i.email}>
                <span className="inv-mail">{i.email}</span>
                <span className="chip">{i.blocked ? 'blocked' : i.name ? `joined as ${i.name}` : 'not signed up yet'}</span>
                <button title="Remove from the list" aria-label={`Remove ${i.email}`} disabled={drop.isPending}
                  onClick={() => { if (confirm(`Remove ${i.email}? ${i.user_id ? 'They will be signed out right away.' : 'They will not be able to sign up.'}`)) drop.mutate(i.email) }}><UserRoundX size={15} /></button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export default function Team() {
  const { user } = useAuth()
  const { roster } = usePresence()
  const q = useTeam()
  const admin = useIsRoot()
  const online = new Set(roster.map((r) => r.user_id))
  if (user) online.add(user.id)
  // you first, then A–Z
  const people = [...(q.data ?? [])].sort((a, b) => Number(b.id === user?.id) - Number(a.id === user?.id))

  return (
    <>
      <Header title="Team" />
      {admin && <Invites />}
      {q.isLoading ? <Empty>Loading the team…</Empty> : !people.length ? <Empty>No one here yet.</Empty> : (
        <div className="team-grid">{people.map((m) => <Card key={m.id} m={m} mine={m.id === user?.id} online={online.has(m.id)} admin={admin} />)}</div>
      )}
    </>
  )
}

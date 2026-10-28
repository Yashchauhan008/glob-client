import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Camera, Check, Mail, Pencil, Trash2, UserPlus, UserRoundX, X } from 'lucide-react'
import { api, ApiError, uploadAvatar } from '../api'
import { useAuth } from '../auth'
import { useAdmin } from '../admin'
import { Empty, Header } from '../components/ui'
import { Face, useTeam } from '../components/Avatar'
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
  const canEdit = mine || admin // with admin mode on, anyone's name and picture can be changed
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(m.name)
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const [cropping, setCropping] = useState<File | null>(null)

  const refresh = () => { qc.invalidateQueries({ queryKey: ['team'] }); qc.invalidateQueries({ queryKey: ['invites'] }) }
  const block = useMutation({ mutationFn: () => api.post(`/team/${m.id}/block`), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })
  const unblock = useMutation({ mutationFn: () => api.post(`/team/${m.id}/unblock`), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })
  const remove = useMutation({ mutationFn: () => api.del(`/team/${m.id}`), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })

  const done = (r: { name: string; avatar_url: string | null }) => {
    if (mine) updateUser({ name: r.name, avatar_url: r.avatar_url })
    qc.invalidateQueries({ queryKey: ['team'] }); setEditing(false); setErr('')
  }
  const save = useMutation({
    mutationFn: (body: { name?: string; remove_avatar?: boolean }) => api.patch<{ name: string; avatar_url: string | null }>(`/team/${m.id}`, body),
    onSuccess: done, onError: (e: Error) => setErr(e.message),
  })
  const upload = useMutation({ mutationFn: (f: File) => uploadAvatar(f, m.id), onSuccess: done, onError: (e: Error) => setErr(e.message) })
  const busy = save.isPending || upload.isPending || block.isPending || unblock.isPending || remove.isPending

  return (
    <div className={'team-card' + (mine ? ' mine' : '') + (m.status !== 'active' ? ' off' : '')}>
      {cropping && <AvatarCropper file={cropping} onCancel={() => setCropping(null)} onSave={(f) => { setCropping(null); upload.mutate(f) }} />}

      <div className="tc-avatar">
        <i style={{ background: colorFor(m.id) }}><Face id={m.id} name={m.name} /></i>
        {online && <b className="tc-online" title="Online now" />}
        {canEdit && <button className="tc-cam" title="Change picture" disabled={busy} onClick={() => file.current?.click()}><Camera size={14} /></button>}
        {canEdit && m.avatar_url && <button className="tc-rm" title="Remove picture" disabled={busy} onClick={() => save.mutate({ remove_avatar: true })}><X size={12} /></button>}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setErr(''); setCropping(f) } e.target.value = '' }} />
      </div>

      {editing ? (
        <form className="tc-edit" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate({ name: name.trim() }) }}>
          <input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label={mine ? 'Your name' : `${m.name}'s name`} />
          <button type="submit" className="ok" title="Save" disabled={busy || !name.trim()}><Check size={16} /></button>
          <button type="button" title="Cancel" onClick={() => { setEditing(false); setName(m.name); setErr('') }}><X size={16} /></button>
        </form>
      ) : (
        <h3>
          <span className="tc-name">{m.name}</span>
          {mine && <span className="tc-you">you</span>}
          {m.status === 'blocked' && <span className="tc-you tc-blocked">blocked</span>}
          {m.status === 'not_invited' && <span className="tc-you tc-blocked">not invited</span>}
          {canEdit && <button className="tc-pen" title="Edit name" onClick={() => setEditing(true)}><Pencil size={13} /></button>}
        </h3>
      )}
      <p className="tc-mail" title={m.email}>{m.email}</p>
      {err && <p className="tc-err">{err}</p>}

      <div className="tc-stats">
        <span><b>{m.ideas}</b>ideas</span>
        <span><b>{m.tasks_done}</b>tasks done</span>
        <span title="Total time spent on Glob"><b>{liveTime(m.live_seconds ?? 0)}</b>live time</span>
      </div>
      <small className="tc-joined">{online ? 'Active now' : `Active ${ago(m.last_active)}`} · Joined {new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</small>

      {admin && !mine && !m.is_root && (
        <div className="tc-admin-row">
          {m.status === 'blocked'
            ? <button disabled={busy} onClick={() => unblock.mutate()}><Check size={14} /> Unblock</button>
            : <button disabled={busy} onClick={() => { if (confirm(`Block ${m.name}? They are signed out right away and cannot sign in until you unblock them.`)) block.mutate() }}><Ban size={14} /> Block</button>}
          <button className="danger" disabled={busy} onClick={() => { if (confirm(`Remove ${m.name} from Glob for good?\n\nTheir ideas, tasks, leads, boards and messages move to you. They are signed out and taken off the invite list.`)) remove.mutate() }}><Trash2 size={14} /> Remove</button>
        </div>
      )}
    </div>
  )
}

/** Admin only: the list of emails that may sign in. New emails get a welcome email. */
function Whitelist() {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const q = useQuery({ queryKey: ['invites'], queryFn: () => api.get<{ root_email: string | null; items: Invite[] }>('/team/invites') })
  const add = useMutation({
    mutationFn: (emails: string) => api.post<{ added: number; already: number; invalid: string[] }>('/team/invites', { emails }),
    onSuccess: (r) => {
      setText('')
      setNote([r.added && `${r.added} invited, a welcome email is on its way`, r.already && `${r.already} already on the list`, r.invalid.length && `not valid: ${r.invalid.join(', ')}`].filter(Boolean).join(' · '))
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
      <div className="inv-head"><span><Mail size={16} /> <b>Who can sign in</b></span><small>{items.length} invited</small></div>
      <form className="inv-add" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add emails, separated by commas or spaces" aria-label="Emails to invite" />
        <button className="btn" disabled={add.isPending || !text.trim()}><UserPlus size={15} /> Invite</button>
      </form>
      {note && <p className="inv-note">{note}</p>}
      <p className="muted inv-help">Anyone not on this list cannot sign in or sign up. New emails get a welcome message. Removing an email signs that person out straight away.</p>
      <ul className="inv-list">
        {items.map((i) => {
          const fixed = i.email === q.data?.root_email // this one is always allowed in
          return (
            <li key={i.email}>
              <span className="inv-mail">{i.email}</span>
              <span className="chip">{i.blocked ? 'blocked' : i.name ? `joined as ${i.name}` : 'not signed up yet'}</span>
              {!fixed && (
                <button title="Remove from the list" aria-label={`Remove ${i.email}`} disabled={drop.isPending}
                  onClick={() => { if (confirm(`Remove ${i.email}? ${i.user_id ? 'They will be signed out right away.' : 'They will not be able to sign up.'}`)) drop.mutate(i.email) }}><UserRoundX size={15} /></button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Team() {
  const { user } = useAuth()
  const { roster } = usePresence()
  const q = useTeam()
  const { active: admin } = useAdmin()
  const [view, setView] = useState<'team' | 'whitelist'>('team')
  const online = new Set(roster.map((r) => r.user_id))
  if (user) online.add(user.id)
  // you first, then A–Z; with admin mode off the admin sees the same list as everyone else
  const people = [...(q.data ?? [])]
    .filter((m) => admin || m.status === 'active')
    .sort((a, b) => Number(b.id === user?.id) - Number(a.id === user?.id))
  const showing = admin ? view : 'team'

  return (
    <>
      <Header title="Team">
        {admin && (
          <div className="seg" role="tablist" aria-label="Team or whitelist">
            <button role="tab" aria-selected={showing === 'team'} className={showing === 'team' ? 'on' : ''} onClick={() => setView('team')}>Team</button>
            <button role="tab" aria-selected={showing === 'whitelist'} className={showing === 'whitelist' ? 'on' : ''} onClick={() => setView('whitelist')}>Whitelist</button>
          </div>
        )}
      </Header>
      {showing === 'whitelist' ? <Whitelist /> : q.isLoading ? <Empty>Loading the team…</Empty> : !people.length ? <Empty>No one here yet.</Empty> : (
        <div className="team-grid">{people.map((m) => <Card key={m.id} m={m} mine={m.id === user?.id} online={online.has(m.id)} admin={admin} />)}</div>
      )}
    </>
  )
}

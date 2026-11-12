import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Camera, Check, Crown, Mail, Pencil, Trash2, UserMinus, UserPlus, UserRoundX, X } from 'lucide-react'
import { api, ApiError, uploadAvatar } from '../api'
import { useAuth } from '../auth'
import { useAdmin } from '../admin'
import { Empty, Header } from '../components/ui'
import { Face, useCanManage, useTeam } from '../components/Avatar'
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

function Card({ m, mine, online, admin, manage }: { m: TeamMember; mine: boolean; online: boolean; admin: boolean; manage: boolean }) {
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
  const leave = useMutation({ mutationFn: () => api.del(`/team/${m.id}`), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })
  const erase = useMutation({ mutationFn: () => api.del(`/team/${m.id}/account`), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })
  const setRole = useMutation({ mutationFn: (role: 'owner' | 'member') => api.patch(`/team/${m.id}/role`, { role }), onSuccess: refresh, onError: (e: Error) => setErr(e.message) })

  const done = (r: { name: string; avatar_url: string | null }) => {
    if (mine) updateUser({ name: r.name, avatar_url: r.avatar_url })
    qc.invalidateQueries({ queryKey: ['team'] }); setEditing(false); setErr('')
  }
  const save = useMutation({
    mutationFn: (body: { name?: string; remove_avatar?: boolean }) => api.patch<{ name: string; avatar_url: string | null }>(`/team/${m.id}`, body),
    onSuccess: done, onError: (e: Error) => setErr(e.message),
  })
  const upload = useMutation({ mutationFn: (f: File) => uploadAvatar(f, m.id), onSuccess: done, onError: (e: Error) => setErr(e.message) })
  const busy = save.isPending || upload.isPending || block.isPending || unblock.isPending || leave.isPending || erase.isPending || setRole.isPending

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
          {m.role === 'owner' && <span className="tc-you tc-owner" title="Can invite people and manage this team"><Crown size={11} /> owner</span>}
          {m.status === 'blocked' && <span className="tc-you tc-blocked">blocked</span>}
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

      {manage && !mine && !m.is_root && (
        <div className="tc-admin-row">
          <button disabled={busy} title={m.role === 'owner' ? 'They stay in the team but can no longer invite or remove people' : 'They will be able to invite and remove people'}
            onClick={() => setRole.mutate(m.role === 'owner' ? 'member' : 'owner')}><Crown size={14} /> {m.role === 'owner' ? 'Make member' : 'Make owner'}</button>
          <button className="danger" disabled={busy} onClick={() => { if (confirm(`Remove ${m.name} from this team?\n\nTheir ideas, tasks and messages stay with the team. Their account and other teams are untouched.`)) leave.mutate() }}><UserMinus size={14} /> Remove</button>
        </div>
      )}
      {admin && !mine && !m.is_root && (
        <div className="tc-admin-row">
          {m.status === 'blocked'
            ? <button disabled={busy} onClick={() => unblock.mutate()}><Check size={14} /> Unblock</button>
            : <button disabled={busy} title="Signs them out of every team" onClick={() => { if (confirm(`Block ${m.name} everywhere? They are signed out of every team right away and cannot sign in until you unblock them.`)) block.mutate() }}><Ban size={14} /> Block</button>}
          <button className="danger" disabled={busy} title="Deletes the account itself" onClick={() => { if (confirm(`Delete ${m.name}'s account for good?\n\nTheir work in every team moves to you. They are signed out and cannot sign in again.`)) erase.mutate() }}><Trash2 size={14} /> Delete account</button>
        </div>
      )}
    </div>
  )
}

/** Team owners: invite people into this team. Waiting invitations are listed until the person signs up. */
function Invites() {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [role, setRole] = useState<'member' | 'owner'>('member')
  const q = useQuery({ queryKey: ['invites'], queryFn: () => api.get<{ items: Invite[] }>('/team/invites') })
  const add = useMutation({
    mutationFn: (emails: string) => api.post<{ added: number; already: number; invalid: string[] }>('/team/invites', { emails, role }),
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
      <div className="inv-head"><span><Mail size={16} /> <b>Invite people to this team</b></span><small>{items.length} waiting</small></div>
      <form className="inv-add" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add emails, separated by commas or spaces" aria-label="Emails to invite" />
        <select value={role} onChange={(e) => setRole(e.target.value as 'member' | 'owner')} aria-label="Role" title="Owners can invite and remove people">
          <option value="member">Member</option><option value="owner">Owner</option>
        </select>
        <button className="btn" disabled={add.isPending || !text.trim()}><UserPlus size={15} /> Invite</button>
      </form>
      {note && <p className="inv-note">{note}</p>}
      <p className="muted inv-help">People who already have a Glob account join this team straight away. Everyone else gets a welcome email and joins when they sign up. Only people invited to a team can sign up.</p>
      {!items.length ? <p className="muted inv-help">No one is waiting to join.</p> : (
        <ul className="inv-list">
          {items.map((i) => (
            <li key={i.email}>
              <span className="inv-mail">{i.email}</span>
              <span className="chip wait">{i.role === 'owner' ? 'Owner · ' : ''}Not signed up yet</span>
              <button title="Withdraw the invitation" aria-label={`Withdraw ${i.email}`} disabled={drop.isPending}
                onClick={() => { if (confirm(`Withdraw the invitation for ${i.email}?`)) drop.mutate(i.email) }}><UserRoundX size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Team() {
  const { user } = useAuth()
  const { roster } = usePresence()
  const q = useTeam()
  const admin = useAdmin()
  const canManage = useCanManage()
  const [view, setView] = useState<'team' | 'invites'>('team')
  const online = new Set(roster.map((r) => r.user_id))
  if (user) online.add(user.id)
  // owners manage their team; the platform admin can switch the extra tools off to look like everyone else
  const manage = canManage && (!admin.isRoot || admin.on)
  // you first, then A–Z
  const people = [...(q.data ?? [])]
    .filter((m) => manage || m.status === 'active')
    .sort((a, b) => Number(b.id === user?.id) - Number(a.id === user?.id))
  const showing = manage ? view : 'team'

  return (
    <>
      <Header title="Team">
        {manage && (
          <div className="seg" role="tablist" aria-label="Team or invites">
            <button role="tab" aria-selected={showing === 'team'} className={showing === 'team' ? 'on' : ''} onClick={() => setView('team')}>Team</button>
            <button role="tab" aria-selected={showing === 'invites'} className={showing === 'invites' ? 'on' : ''} onClick={() => setView('invites')}>Invites</button>
          </div>
        )}
      </Header>
      {showing === 'invites' ? <Invites /> : q.isLoading ? <Empty>Loading the team…</Empty> : !people.length ? <Empty>No one here yet.</Empty> : (
        <div className="team-grid">{people.map((m) => <Card key={m.id} m={m} mine={m.id === user?.id} online={online.has(m.id)} admin={admin.active} manage={manage} />)}</div>
      )}
    </>
  )
}

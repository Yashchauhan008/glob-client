import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ChevronDown, Crown, LogOut, Pencil, Plus, Trash2, UserMinus, UserPlus, Users } from 'lucide-react'
import { api, ApiError, setTeamId } from '../api'
import { useAuth } from '../auth'
import { TEAMS_KEY, useTeamList, useTeams, type TeamInfo } from '../teams'
import { Empty, Header } from '../components/ui'
import Logo from '../components/Logo'

type Person = { id: string; name: string; email: string }
type Roster = { members: (Person & { role: 'owner' | 'member' })[]; pending: { email: string; role: string }[]; available: Person[] }

/** Who is in one team: add existing people or new emails, change roles, remove. Nobody gets in unless they are added here. */
function Members({ team }: { team: TeamInfo }) {
  const qc = useQueryClient()
  const key = ['team-roster', team.id]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<Roster>(`/teams/${team.id}/members`) })
  const [pick, setPick] = useState('')
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<'member' | 'owner'>('member')
  const [note, setNote] = useState('')
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: TEAMS_KEY }) }
  const fail = (e: Error) => setNote(e instanceof ApiError ? e.message : 'Something went wrong')
  const add = useMutation({
    mutationFn: (list: string) => api.post(`/teams/${team.id}/members`, { emails: list, role }),
    onSuccess: () => { setPick(''); setEmails(''); setNote(''); refresh() }, onError: fail,
  })
  const setRoleOf = useMutation({ mutationFn: (v: { id: string; role: string }) => api.patch(`/teams/${team.id}/members/${v.id}`, { role: v.role }), onSuccess: refresh, onError: fail })
  const drop = useMutation({ mutationFn: (id: string) => api.del(`/teams/${team.id}/members/${id}`), onSuccess: refresh, onError: fail })
  const dropInvite = useMutation({ mutationFn: (email: string) => api.del(`/teams/${team.id}/invites/${encodeURIComponent(email)}`), onSuccess: refresh, onError: fail })
  const submit = (e: FormEvent) => { e.preventDefault(); setNote(''); const list = [pick, emails].filter(Boolean).join(' '); if (list.trim()) add.mutate(list) }
  const d = q.data

  return (
    <div className="at-members">
      <form className="inv-add" onSubmit={submit}>
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add an existing person">
          <option value="">Add existing person…</option>
          {d?.available.map((p) => <option key={p.id} value={p.email}>{p.name} · {p.email}</option>)}
        </select>
        <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="or new emails" aria-label="Emails" />
        <select value={role} onChange={(e) => setRole(e.target.value as 'member' | 'owner')} aria-label="Role"><option value="member">Member</option><option value="owner">Owner</option></select>
        <button className="btn small" disabled={add.isPending || (!pick && !emails.trim())}><UserPlus size={14} /> Add</button>
      </form>
      {note && <p className="inv-note">{note}</p>}
      {q.isLoading ? <p className="muted">Loading…</p> : (
        <ul className="inv-list">
          {d?.members.map((m) => (
            <li key={m.id}>
              <span className="inv-mail">{m.name} · {m.email}</span>
              <span className={'chip ' + (m.role === 'owner' ? 'ok' : '')}>{m.role === 'owner' ? 'Owner' : 'Member'}</span>
              <button title={m.role === 'owner' ? 'Make member' : 'Make owner'} disabled={setRoleOf.isPending} onClick={() => setRoleOf.mutate({ id: m.id, role: m.role === 'owner' ? 'member' : 'owner' })}><Crown size={15} /></button>
              <button title="Remove from this team" disabled={drop.isPending} onClick={() => { if (confirm(`Remove ${m.name} from ${team.name}?`)) drop.mutate(m.id) }}><UserMinus size={15} /></button>
            </li>
          ))}
          {d?.pending.map((p) => (
            <li key={p.email}>
              <span className="inv-mail">{p.email}</span><span className="chip wait">Invited{p.role === 'owner' ? ' as owner' : ''}</span>
              <button title="Withdraw invitation" disabled={dropInvite.isPending} onClick={() => dropInvite.mutate(p.email)}><UserMinus size={15} /></button>
            </li>
          ))}
          {!d?.members.length && !d?.pending.length && <li><span className="inv-mail muted">No one in this team yet. Add people above.</span></li>}
        </ul>
      )}
    </div>
  )
}

/** Platform admin: make small Globs (teams), name their first owner, rename them, open them, delete them. */
export default function AdminTeams({ standalone = false, onBack }: { standalone?: boolean; onBack?: () => void }) {
  const qc = useQueryClient()
  const { signOut } = useAuth()
  const { current, switchTo } = useTeams()
  const q = useTeamList()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [note, setNote] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: TEAMS_KEY })
  const fail = (e: Error) => setNote(e instanceof ApiError ? e.message : 'Something went wrong')
  const create = useMutation({
    mutationFn: () => api.post<TeamInfo>('/teams', { name: name.trim(), owner_email: owner.trim() }),
    onSuccess: (t) => {
      setName(''); setOwner('')
      setNote(owner.trim() ? `“${t.name}” is ready. ${owner.trim()} is its owner, and gets an invite if they have no account yet.` : `“${t.name}” is ready. Open it to invite people.`)
      refresh()
    },
    onError: fail,
  })
  const rename = useMutation({ mutationFn: (v: { id: string; name: string }) => api.patch(`/teams/${v.id}`, { name: v.name }), onSuccess: refresh, onError: fail })
  const remove = useMutation({
    mutationFn: (t: TeamInfo) => api.del(`/teams/${t.id}`),
    onSuccess: (_r, t) => {
      if (t.id === current?.id) { setTeamId(null); window.location.assign('/admin') } else refresh()
    },
    onError: fail,
  })
  const submit = (e: FormEvent) => { e.preventDefault(); setNote(''); if (name.trim()) create.mutate() }
  const teams = q.data?.items ?? []

  const body = (
    <>
      <Header title="Teams" />
      <p className="muted at-help">Each team is its own small Glob: its own ideas, tasks, CRM, boards, chat and calls. People in one team never see another team. Name an owner and they can invite their own people.</p>
      <form className="at-form" onSubmit={submit}>
        <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Team name" aria-label="Team name" />
        <input value={owner} type="email" onChange={(e) => setOwner(e.target.value)} placeholder="Owner’s email (optional)" aria-label="Owner email" />
        <button className="btn" disabled={create.isPending || !name.trim()}><Plus size={15} /> Create team</button>
      </form>
      {note && <p className="inv-note">{note}</p>}

      {q.isLoading ? <Empty>Loading teams…</Empty> : !teams.length ? <Empty>No teams yet. Create the first one above.</Empty> : (
        <ul className="at-list">
          {teams.map((t) => (
            <li key={t.id} className={t.id === current?.id ? 'here' : ''}>
              <span className="at-icon"><Users size={18} /></span>
              <span className="at-name"><b>{t.name}</b><small>{t.members} {t.members === 1 ? 'person' : 'people'}{t.id === current?.id ? ' · you are here' : ''}</small></span>
              <button className="btn small ghost" title="Add or remove people" aria-expanded={openId === t.id} onClick={() => setOpenId(openId === t.id ? null : t.id)}>People <ChevronDown size={13} /></button>
              <button className="btn small ghost" title="Open this team" onClick={() => switchTo(t.id)} disabled={t.id === current?.id}>Open <ArrowRight size={13} /></button>
              <button className="icon-btn" title="Rename" aria-label={`Rename ${t.name}`} disabled={rename.isPending}
                onClick={() => { const n = window.prompt('Rename team', t.name)?.trim(); if (n && n !== t.name) rename.mutate({ id: t.id, name: n }) }}><Pencil size={15} /></button>
              <button className="icon-btn danger" title="Delete" aria-label={`Delete ${t.name}`} disabled={remove.isPending}
                onClick={() => { if (window.prompt(`Delete “${t.name}” and everything in it: ideas, tasks, leads, boards, chat and files.\n\nThis cannot be undone. Type the team name to confirm.`)?.trim() === t.name) remove.mutate(t) }}><Trash2 size={15} /></button>
              {openId === t.id && <Members team={t} />}
            </li>
          ))}
        </ul>
      )}
    </>
  )

  if (!standalone) return body
  return (
    <div className="solo">
      <header className="solo-bar"><Logo size={30} /><span className="solo-actions">{onBack && <button className="btn small ghost" onClick={onBack}>Back to workspaces</button>}<button className="btn small ghost" onClick={signOut}><LogOut size={14} /> Sign out</button></span></header>
      <main className="solo-main">{body}</main>
    </div>
  )
}

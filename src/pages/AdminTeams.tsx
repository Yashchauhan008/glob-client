import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, LogOut, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { api, ApiError, setTeamId } from '../api'
import { useAuth } from '../auth'
import { TEAMS_KEY, useTeamList, useTeams, type TeamInfo } from '../teams'
import { Empty, Header } from '../components/ui'
import Logo from '../components/Logo'

/** Platform admin: make small Globs (teams), name their first owner, rename them, open them, delete them. */
export default function AdminTeams({ standalone = false }: { standalone?: boolean }) {
  const qc = useQueryClient()
  const { signOut } = useAuth()
  const { current, switchTo } = useTeams()
  const q = useTeamList()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [note, setNote] = useState('')

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
              <button className="btn small ghost" title="Open this team" onClick={() => switchTo(t.id)} disabled={t.id === current?.id}>Open <ArrowRight size={13} /></button>
              <button className="icon-btn" title="Rename" aria-label={`Rename ${t.name}`} disabled={rename.isPending}
                onClick={() => { const n = window.prompt('Rename team', t.name)?.trim(); if (n && n !== t.name) rename.mutate({ id: t.id, name: n }) }}><Pencil size={15} /></button>
              <button className="icon-btn danger" title="Delete" aria-label={`Delete ${t.name}`} disabled={remove.isPending}
                onClick={() => { if (window.prompt(`Delete “${t.name}” and everything in it: ideas, tasks, leads, boards, chat and files.\n\nThis cannot be undone. Type the team name to confirm.`)?.trim() === t.name) remove.mutate(t) }}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </>
  )

  if (!standalone) return body
  return (
    <div className="solo">
      <header className="solo-bar"><Logo size={30} /><button className="btn small ghost" onClick={signOut}><LogOut size={14} /> Sign out</button></header>
      <main className="solo-main">{body}</main>
    </div>
  )
}

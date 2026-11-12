import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, getTeamId, setTeamId } from './api'

export type TeamInfo = { id: string; name: string; role: 'owner' | 'member'; members: number; created_at: string }
type TeamsRes = { is_root: boolean; last_team_id: string | null; items: TeamInfo[] }

export const TEAMS_KEY = ['teams']

/** The teams you can open (all of them for the platform admin). */
export const useTeamList = () => useQuery({ queryKey: TEAMS_KEY, queryFn: () => api.get<TeamsRes>('/teams'), staleTime: 60_000 })

type Ctx = { teams: TeamInfo[]; current: TeamInfo | null; lastId: string | null; leave: () => void; isRoot: boolean; loading: boolean; failed: boolean; switchTo: (id: string) => void }
const TeamCtx = createContext<Ctx>({ teams: [], current: null, lastId: null, leave: () => {}, isRoot: false, loading: true, failed: false, switchTo: () => {} })
export const useTeams = () => useContext(TeamCtx)

/**
 * Knows which team you are working in. The choice is remembered, and if that team is gone (deleted, or you were
 * taken out of it) the first one you can open is used instead. Switching reloads the app so nothing from the
 * old team can linger in memory or on a live connection.
 */
export function TeamProvider({ children }: { children: ReactNode }) {
  const q = useTeamList()
  const teams = q.data?.items ?? []
  const stored = getTeamId()
  // You are only "in" a team after choosing it on the workspaces page (signing out forgets the choice).
  const current = teams.find((t) => t.id === stored) ?? null
  if (!current && q.data && stored) setTeamId(null) // that team is gone, or you were taken out of it

  const value = useMemo<Ctx>(() => ({
    teams, current, lastId: q.data?.last_team_id ?? null, isRoot: q.data?.is_root === true, loading: q.isLoading, failed: q.isError,
    switchTo: (id) => {
      setTeamId(id)
      // remember it on the server first, so it is marked "last opened" on any device
      api.put(`/teams/${id}/last`, {}).catch(() => {}).finally(() => window.location.assign('/home'))
    },
    /** Back to the workspaces page. */
    leave: () => { setTeamId(null); window.location.assign('/') },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [q.data, q.isLoading, q.isError, current?.id])
  return <TeamCtx.Provider value={value}>{children}</TeamCtx.Provider>
}

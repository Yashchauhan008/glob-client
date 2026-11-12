import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, getTeamId, setTeamId } from './api'

export type TeamInfo = { id: string; name: string; role: 'owner' | 'member'; members: number; created_at: string }
type TeamsRes = { is_root: boolean; last_team_id: string | null; items: TeamInfo[] }

export const TEAMS_KEY = ['teams']

/** The teams you can open (all of them for the platform admin). */
export const useTeamList = () => useQuery({ queryKey: TEAMS_KEY, queryFn: () => api.get<TeamsRes>('/teams'), staleTime: 60_000 })

type Ctx = { teams: TeamInfo[]; current: TeamInfo | null; isRoot: boolean; loading: boolean; failed: boolean; switchTo: (id: string) => void }
const TeamCtx = createContext<Ctx>({ teams: [], current: null, isRoot: false, loading: true, failed: false, switchTo: () => {} })
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
  // this browser's choice, else the team you last worked in on any device, else the first one
  const current = teams.find((t) => t.id === stored) ?? teams.find((t) => t.id === q.data?.last_team_id) ?? teams[0] ?? null
  // written during render on purpose: the screens below start fetching straight away and must already send the right team
  if (current && current.id !== stored) setTeamId(current.id)
  if (!current && q.data && stored) setTeamId(null)

  const value = useMemo<Ctx>(() => ({
    teams, current, isRoot: q.data?.is_root === true, loading: q.isLoading, failed: q.isError,
    switchTo: (id) => {
      if (id === current?.id) return
      setTeamId(id)
      // remember it on the server first, so the next sign-in opens this team
      api.put(`/teams/${id}/last`, {}).catch(() => {}).finally(() => window.location.assign('/home'))
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [q.data, q.isLoading, q.isError, current?.id])
  return <TeamCtx.Provider value={value}>{children}</TeamCtx.Provider>
}

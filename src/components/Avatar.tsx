import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { initials } from '../presence'
import type { TeamMember } from '../types'

const fetchTeam = () => api.get<{ items: TeamMember[] }>('/team').then((r) => r.items)

/** One shared list of everyone, so a changed picture or name shows up everywhere. */
export const useTeam = () => useQuery({ queryKey: ['team'], queryFn: fetchTeam, staleTime: 60_000 })

export const useAvatarUrl = (id: string) =>
  useQuery({ queryKey: ['team'], queryFn: fetchTeam, staleTime: 60_000, select: (items) => items.find((m) => m.id === id)?.avatar_url ?? null }).data

/** Goes inside an avatar circle: their photo if they set one, otherwise their initials. */
export function Face({ id, name }: { id: string; name: string }) {
  const url = useAvatarUrl(id)
  return url ? <img className="av-img" src={url} alt="" draggable={false} /> : <>{initials(name)}</>
}

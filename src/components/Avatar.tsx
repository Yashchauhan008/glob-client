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

/** Crop to a centred square and shrink, so a 10 MB phone photo does not get loaded for a 30px circle. */
export async function squareAvatar(file: File, size = 320): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.88))
  if (!blob) throw new Error('Could not read that image')
  return new File([blob], 'avatar.webp', { type: 'image/webp' })
}

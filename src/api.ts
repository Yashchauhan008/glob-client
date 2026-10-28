const API = import.meta.env.VITE_API_URL || 'http://localhost:3008'
export const API_URL = API
const KEY = 'glob_token'

export const getToken = () => localStorage.getItem(KEY)
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY)

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(API + path, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.status === 401 && token && !path.startsWith('/auth')) {
    setToken(null)
    window.location.href = '/login'
  }
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('json') ? await res.json() : await res.text()
  if (!res.ok) throw new ApiError((data as any)?.message || 'Request failed', res.status)
  return data as T
}

export const api = {
  get: <T,>(p: string) => request<T>(p),
  post: <T,>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T,>(p: string, body: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T,>(p: string, body: unknown) => request<T>(p, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (p: string) => request<void>(p, { method: 'DELETE' }),
  text: (p: string) => request<string>(p),
}

export async function downloadCsv(entity: string) {
  const csv = await api.text(`/csv/export/${entity}`)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${entity}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export async function uploadImage(file: File): Promise<{ file_id: string; url: string }> {
  const token = getToken()
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(API + '/attachments/upload', { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data?.message || 'Upload failed', res.status)
  return data
}

/** The server crops it to a small square and compresses it, so the original photo can be sent as is. */
export async function uploadAvatar(file: File): Promise<{ id: string; name: string; email: string; avatar_url: string | null }> {
  const token = getToken()
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(API + '/team/me/avatar', { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data?.message || 'Upload failed', res.status)
  return data
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' }

/** A picture dropped onto a whiteboard. The server stores it in S3 and tells everyone else on the board. */
export async function uploadBoardImage(boardId: string, fileId: string, blob: Blob): Promise<void> {
  const token = getToken()
  const body = new FormData()
  body.append('fileId', fileId)
  body.append('file', blob, `${fileId.slice(0, 40)}.${EXT[blob.type] ?? 'png'}`)
  const res = await fetch(`${API}/boards/${boardId}/images`, { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new ApiError((await res.json().catch(() => ({})))?.message || 'Upload failed', res.status)
}

export async function uploadBoardThumb(boardId: string, blob: Blob): Promise<void> {
  const token = getToken()
  const body = new FormData()
  body.append('file', blob, 'preview.webp')
  await fetch(`${API}/boards/${boardId}/thumbnail`, { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} })
}

export async function uploadThumbnail(attachmentId: string, file: File): Promise<void> {
  const token = getToken()
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`${API}/attachments/${attachmentId}/thumbnail`, { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new ApiError((await res.json().catch(() => ({})))?.message || 'Upload failed', res.status)
}

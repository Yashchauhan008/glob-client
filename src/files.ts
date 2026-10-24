import { API_URL } from './api'

/** Uploaded files are always served by the API, so rebuild the address from the key — whatever host was saved with it. */
export function fileUrl(u: string | null | undefined): string {
  if (!u) return ''
  const m = u.match(/\/files\/(.+)$/)
  return m ? `${API_URL}/files/${m[1]}` : u
}

export function hostOf(url: string): string {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '') } catch { return '' }
}

/** Small site icon for a link (looked up by Google's favicon service). */
export const faviconUrl = (url: string, size = 64) => {
  const host = hostOf(url)
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}` : ''
}

/** Markdown → readable one-liner for card previews. */
export const plain = (md: string) =>
  md.replace(/```[\s\S]*?```/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~|-]{1,}/g, ' ').replace(/\s+/g, ' ').trim()

/** "host/path" without the scheme or trailing slash, safe on bad input. */
export function prettyUrl(url: string): string {
  try { const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`); return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, '') } catch { return url }
}

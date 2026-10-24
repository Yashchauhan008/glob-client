import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { User } from '../types'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SRC = 'https://accounts.google.com/gsi/client'

type Google = { accounts: { id: {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
} } }

function loadGoogle(): Promise<Google> {
  const w = window as unknown as { google?: Google }
  if (w.google?.accounts) return Promise.resolve(w.google)
  return new Promise((resolve, reject) => {
    const s = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`) ?? Object.assign(document.createElement('script'), { src: SRC, async: true })
    s.addEventListener('load', () => resolve(w.google!))
    s.addEventListener('error', () => reject(new Error('Could not load Google')))
    if (!s.isConnected) document.head.appendChild(s)
  })
}

export default function GoogleButton({ onError }: { onError: (m: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return
    let off = false
    loadGoogle().then((g) => {
      if (off || !box.current) return
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            const r = await api.post<{ token: string; user: User }>('/auth/google', { id_token: credential })
            signIn(r.token, r.user); nav('/home')
          } catch (e) { onError((e as Error).message) }
        },
      })
      const width = Math.min(box.current.clientWidth || 360, 400)
      g.accounts.id.renderButton(box.current, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center', width })
      setReady(true)
    }).catch(() => onError('Could not load Google sign-in'))
    return () => { off = true }
  }, [])

  if (!CLIENT_ID) return null
  return (
    <>
      <div className="or"><span>or</span></div>
      <div className={'google-box' + (ready ? '' : ' loading')} ref={box} />
    </>
  )
}

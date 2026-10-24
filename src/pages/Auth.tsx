import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { User } from '../types'

type AuthRes = { token: string; user: User }

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-side"><div className="logo">glob</div><p>Plan ideas, track products, close leads — together.</p></div>
        <div className="auth-form"><h1>{title}</h1><p className="muted">{sub}</p>{children}</div>
      </div>
    </div>
  )
}

export function Login() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true); setErr('')
    try {
      const r = await api.post<AuthRes>('/auth/login', { email: String(f.get('email')).toLowerCase(), password: f.get('password') })
      signIn(r.token, r.user); nav('/home')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Shell title="Welcome back" sub="Log in to your workspace.">
      <form onSubmit={submit}>
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required minLength={5} />
        {err && <div className="form-err">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="muted">New here? <Link to="/register">Create an account</Link></p>
    </Shell>
  )
}

export function Register() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [regToken, setRegToken] = useState<string | null>(sessionStorage.getItem('glob_reg_token'))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const register = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true); setErr('')
    try {
      const r = await api.post<{ token: string }>('/auth/register', {
        name: f.get('name'), email: String(f.get('email')).toLowerCase(), password: f.get('password'),
      })
      sessionStorage.setItem('glob_reg_token', r.token); setRegToken(r.token)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const verify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true); setErr('')
    try {
      const r = await api.post<AuthRes>('/auth/verify-registration', { token: regToken, otp: f.get('otp') })
      sessionStorage.removeItem('glob_reg_token')
      signIn(r.token, r.user); nav('/home')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  if (regToken)
    return (
      <Shell title="Verify your email" sub="Enter the 6-digit code we emailed you.">
        <form onSubmit={verify}>
          <input name="otp" inputMode="numeric" placeholder="123456" required maxLength={6} autoFocus />
          {err && <div className="form-err">{err}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
        </form>
        <p className="muted"><a href="#" onClick={(e) => { e.preventDefault(); sessionStorage.removeItem('glob_reg_token'); setRegToken(null) }}>Start over</a></p>
      </Shell>
    )
  return (
    <Shell title="Create account" sub="We'll email you a code to confirm.">
      <form onSubmit={register}>
        <input name="name" placeholder="Name" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password (min 5)" required minLength={5} />
        {err && <div className="form-err">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Sending code…' : 'Continue'}</button>
      </form>
      <p className="muted">Have an account? <Link to="/login">Log in</Link></p>
    </Shell>
  )
}

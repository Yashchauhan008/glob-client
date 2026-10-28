import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { Eye, EyeOff, Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme'
import AuthArt from '../components/AuthArt'
import GoogleButton from '../components/GoogleButton'
import Logo from '../components/Logo'
import type { User } from '../types'

type AuthRes = { token: string; user: User }

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
}

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <ThemeToggle />
      <div className="auth-card">
        <div className="auth-side"><AuthArt /></div>
        <div className="auth-form">
          <div className="auth-brand"><Logo size={30} /></div>
          <h1>{title}</h1><p className="sub">{sub}</p>{children}
        </div>
      </div>
    </div>
  )
}

function Field({ label, type = 'text', ...rest }: { label: string; type?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  const pw = type === 'password'
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-box">
        <input {...rest} type={pw && show ? 'text' : type} />
        {pw && <button type="button" tabIndex={-1} aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
      </div>
    </label>
  )
}

export function Login() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [err, setErr] = useState(() => {
    try { const n = sessionStorage.getItem('glob_notice') ?? ''; sessionStorage.removeItem('glob_notice'); return n } catch { return '' }
  })
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
    <Shell title="Welcome Back!" sub="Enter your details below">
      <form onSubmit={submit}>
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@team.com" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" placeholder="••••••" required minLength={5} />
        {err && <div className="form-err">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <GoogleButton onError={setErr} />
      <p className="auth-foot">Don't have an account? <Link to="/register">Sign up</Link></p>
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
      <Shell title="Check your email" sub="Enter the 6-digit code we sent you">
        <form onSubmit={verify} autoComplete="off">
          <input name="otp" autoComplete="one-time-code" inputMode="numeric" autoCorrect="off" spellCheck={false} placeholder="123456" required maxLength={6} autoFocus />
          {err && <div className="form-err">{err}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
        </form>
        <p className="auth-foot"><a href="#" onClick={(e) => { e.preventDefault(); sessionStorage.removeItem('glob_reg_token'); setRegToken(null) }}>Start over</a></p>
      </Shell>
    )
  return (
    <Shell title="Join Glob" sub="We'll email you a code to confirm">
      <form onSubmit={register}>
        <Field label="Name" name="name" autoComplete="name" placeholder="Your name" required />
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@team.com" required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" placeholder="At least 5 characters" required minLength={5} />
        {err && <div className="form-err">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Sending code…' : 'Continue'}</button>
      </form>
      <GoogleButton onError={setErr} />
      <p className="auth-foot">Already have an account? <Link to="/login">Log in</Link></p>
    </Shell>
  )
}

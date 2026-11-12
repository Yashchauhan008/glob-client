import { LogOut } from 'lucide-react'
import { useAuth } from '../auth'
import Logo from '../components/Logo'

/** Signed in, but not in any team yet. */
export default function NoTeam({ error = false }: { error?: boolean }) {
  const { user, signOut } = useAuth()
  return (
    <div className="solo">
      <header className="solo-bar"><Logo size={30} /><button className="btn small ghost" onClick={signOut}><LogOut size={14} /> Sign out</button></header>
      <main className="solo-main solo-center">
        {error ? (
          <>
            <h1>Could not load your teams</h1>
            <p className="muted">Check your connection and try again.</p>
            <button className="btn" onClick={() => window.location.reload()}>Try again</button>
          </>
        ) : (
          <>
            <h1>You are not in a team yet</h1>
            <p className="muted">Ask a team owner to invite <b>{user?.email}</b>. As soon as they do, the team shows up here.</p>
            <button className="btn" onClick={() => window.location.reload()}>Check again</button>
          </>
        )}
      </main>
    </div>
  )
}

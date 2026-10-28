import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, matchPath, useLocation } from 'react-router-dom'
import { CalendarDays, CheckSquare, ChevronDown, HelpCircle, History, Home, Lightbulb, LogOut, Menu, MessageCircle, Moon, Sun, Package, Plus, Users, X } from 'lucide-react'
import { useAuth } from '../auth'
import { useTheme } from '../theme'
import { ALERT_KEY, ALERT_TIP, useAlerts } from '../alerts'
import { CONTENT_ID, colorFor, initials, usePresence } from '../presence'
import Logo from './Logo'
import Cursors from './Cursors'
import EventsPanel from './EventsPanel'
import Discussion from './Discussion'
import { useMedia } from '../media'
import ChatBox from './ChatBox'
import { QuickProvider, useQuick } from './quick'
import { VoiceProvider } from '../voice'
import CallPanel from './CallPanel'

const NAV = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/ideas', label: 'Ideas', icon: Lightbulb },
  { to: '/qa', label: 'Q&A', icon: HelpCircle },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/leads', label: 'CRM', icon: Users },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/activity', label: 'Activity', icon: History },
]

function Dock({ toggleChat }: { toggleChat: () => void }) {
  const quick = useQuick()
  const items = [
    { icon: Lightbulb, tip: 'New idea', cls: 'lilac', run: () => quick('idea') },
    { icon: HelpCircle, tip: 'Ask a question', cls: 'sky', run: () => quick('question') },
    { icon: CheckSquare, tip: 'New task', cls: 'pink', run: () => quick('todo') },
    { icon: CalendarDays, tip: 'New event', cls: 'sun', run: () => quick('event') },
    { icon: MessageCircle, tip: 'Team chat', cls: 'mint', run: toggleChat },
    { icon: Plus, tip: 'New lead', cls: 'dark', run: () => quick('lead') },
  ]
  return (
    <div className="dock">
      {items.map(({ icon: Icon, tip, cls, run }) => <button key={tip} className={cls} data-tip={tip} aria-label={tip} onClick={run}><Icon size={20} strokeWidth={2} /></button>)}
    </div>
  )
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const { roster } = usePresence()
  const { theme, toggle } = useTheme()
  const wide = useMedia('(min-width: 1101px)')
  const { pathname } = useLocation()
  const alerts = useAlerts(pathname)
  const ideaMatch = matchPath('/ideas/:id', pathname)
  const [chatOpen, setChatOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => { setNavOpen(false); setMenu(false) }, [pathname])
  const current = NAV.find((n) => pathname === n.to || pathname.startsWith(n.to + '/'))
  const barRef = useRef<HTMLElement>(null)
  const islandRef = useRef<HTMLDivElement>(null)

  // centre the island under the active nav item; CSS glides it there (no jump on first paint)
  const placed = useRef(false)
  const place = () => {
    const bar = barRef.current, island = islandRef.current
    const active = bar?.querySelector<HTMLElement>('.nav-item.active')
    if (!bar || !island) return
    if (!active) { island.classList.remove('ready'); placed.current = false; return }
    const b = bar.getBoundingClientRect(), r = active.getBoundingClientRect()
    const left = `${r.left - b.left + r.width / 2}px`
    if (!placed.current) {
      island.style.transition = 'none'
      island.style.left = left
      void island.offsetWidth
      island.style.transition = ''
      placed.current = true
    } else island.style.left = left
    island.classList.add('ready')
  }
  useLayoutEffect(() => { place() }, [pathname])
  useEffect(() => {
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [])
  const online = [...new Map(roster.map((r) => [r.user_id, r])).values()]

  return (
    <QuickProvider>
      <VoiceProvider>
      <div className="stage">
        <div className="frame">
          <header className="topbar" ref={barRef}>
            <div className="island" ref={islandRef} />
            <div className="logo"><Logo size={34} /></div>
            <span className="mobile-title">{current?.label}</span>
            <nav className={navOpen ? 'open' : ''}>
              {NAV.map(({ to, label, icon: Icon }) => {
                const here = roster.filter((r) => r.route !== pathname && (r.route === to || r.route.startsWith(to + '/')))
                const unique = [...new Map(here.map((r) => [r.user_id, r])).values()]
                return (
                  <NavLink key={to} to={to} title={label} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                    <Icon size={20} strokeWidth={1.8} />
                    <span className="nav-label">{label}</span>
                    {(() => {
                      const k = ALERT_KEY[to]
                      const n = k && alerts ? alerts[k] : 0
                      return n > 0 ? <span key={n} className={'nav-badge ' + k} title={ALERT_TIP[k](n)} aria-label={ALERT_TIP[k](n)}>{n > 9 ? '9+' : n}</span> : null
                    })()}
                    <span className="nav-presence">
                      {unique.map((r) => <span key={r.user_id} className="nav-dot" title={`${r.name} is here`} style={{ background: colorFor(r.user_id) }}>{initials(r.name)}</span>)}
                    </span>
                  </NavLink>
                )
              })}
            </nav>
            <button className="nav-toggle" aria-label="Menu" onClick={() => setNavOpen((v) => !v)}>{navOpen ? <X size={22} /> : <Menu size={22} />}</button>
            <div className="who">
              <div className="live" title="Online now">
                {online.map((o) => <i key={o.user_id} title={`${o.name} · ${o.route}`} style={{ background: colorFor(o.user_id) }}>{initials(o.name)}</i>)}
              </div>
              <button className="theme-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button className="user" onClick={() => setMenu(!menu)}>
                <i className="me-av" style={{ background: colorFor(user!.id) }}>{initials(user!.name)}</i>
                <span><b>{user!.name}</b><small>{user!.email}</small></span><ChevronDown size={16} />
              </button>
              {menu && <div className="menu"><button onClick={toggle}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}</button><button onClick={signOut}><LogOut size={16} /> Log out</button></div>}
            </div>
          </header>
          <div className="body">
            <main className="main">
              <div id={CONTENT_ID} className="content">
                <Outlet />
                <Cursors />
              </div>
            </main>
            {ideaMatch && wide ? (
              <aside className="events-panel idea-side"><h2>Chat <span>💬</span></h2><Discussion key={ideaMatch.params.id} ideaId={ideaMatch.params.id!} /></aside>
            ) : <EventsPanel />}
          </div>
          <Dock toggleChat={() => setChatOpen((v) => !v)} />
        </div>
        <ChatBox open={chatOpen} setOpen={setChatOpen} />
        <CallPanel />
      </div>
      </VoiceProvider>
    </QuickProvider>
  )
}

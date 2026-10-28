import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lightbulb, Maximize2, Minimize2, Trash2 } from 'lucide-react'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { useTheme } from '../theme'
import { colorFor, usePresence } from '../presence'
import { Face } from '../components/Avatar'
import type { BoardFull, BoardSummary, Idea } from '../types'

// the whiteboard engine is big, so it is only downloaded when someone opens a board
const BoardCanvas = lazy(() => import('../components/BoardCanvas'))

type Peer = { user_id: string; name: string }

export default function Board() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const { theme } = useTheme()
  const { socket } = usePresence()
  const [title, setTitle] = useState('')
  const [ideaId, setIdeaId] = useState('')
  const [peers, setPeers] = useState<Peer[]>([])
  const page = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false) // the browser's real full screen
  const [wide, setWide] = useState(false) // fallback where the browser has none (iPhone): the board covers the app

  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === page.current)
    document.addEventListener('fullscreenchange', sync)
    return () => { document.removeEventListener('fullscreenchange', sync); if (document.fullscreenElement === page.current) void document.exitFullscreen() }
  }, [])

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return }
    if (wide) { setWide(false); return }
    const el = page.current
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => setWide(true))
    else setWide(true)
  }, [wide])

  const board = useQuery({
    queryKey: ['board', id], queryFn: () => api.get<BoardFull>(`/boards/${id}`),
    staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false, retry: false,
  })
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: () => api.get<{ items: Idea[] }>('/ideas') })

  useEffect(() => { if (board.data) { setTitle(board.data.title); setIdeaId(board.data.idea_id ?? '') } }, [board.data])

  // who else is on this board, and edits to its name or idea link from other people
  useEffect(() => {
    if (!socket || !id) return
    const onPeers = (p: { boardId: string; peers: Peer[] }) => { if (p.boardId === id) setPeers(p.peers) }
    const onMeta = (m: { boardId: string; title: string; idea_id: string | null }) => { if (m.boardId === id) { setTitle(m.title); setIdeaId(m.idea_id ?? '') } }
    const onGone = (m: { boardId: string }) => { if (m.boardId === id) nav('/boards') }
    socket.on('board:peers', onPeers); socket.on('board:meta', onMeta); socket.on('board:deleted', onGone)
    return () => { socket.off('board:peers', onPeers); socket.off('board:meta', onMeta); socket.off('board:deleted', onGone) }
  }, [socket, id, nav])

  const save = useMutation({
    mutationFn: (b: { title?: string; idea_id?: string | null }) => api.patch<BoardSummary>(`/boards/${id}`, b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['boards'] }) },
  })
  const del = useMutation({ mutationFn: () => api.del(`/boards/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['boards'] }); nav('/boards') } })

  if (board.isLoading) return <p className="muted">Opening board…</p>
  if (board.isError || !board.data) {
    return (
      <div className="empty">
        {board.error instanceof ApiError && board.error.status === 404 ? 'This board does not exist any more.' : 'Could not open this board.'}
        <p><Link to="/boards" className="link">Back to boards</Link></p>
      </div>
    )
  }
  const b = board.data
  const linked = ideas.data?.items.find((i) => i.id === ideaId)
  const others = peers.filter((p) => p.user_id !== user?.id)

  return (
    <div ref={page} className={'board-page' + (wide ? ' cover' : '')}>
      <div className="board-bar">
        <Link to="/boards" className="bb-back" title="All boards"><ArrowLeft size={18} /></Link>
        <input
          className="bb-title" value={title} maxLength={200} aria-label="Board name"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { const t = title.trim(); if (t && t !== b.title) save.mutate({ title: t }); else setTitle(b.title) }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        <span className="bb-idea">
          <Lightbulb size={15} />
          <select value={ideaId} aria-label="Linked idea" onChange={(e) => { setIdeaId(e.target.value); save.mutate({ idea_id: e.target.value || null }) }}>
            <option value="">No linked idea</option>
            {ideas.data?.items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
          {linked && <Link to={`/ideas/${linked.id}`} className="link">Open idea</Link>}
        </span>
        <span className="bb-peers" title={others.length ? others.map((p) => p.name).join(', ') + ' here now' : 'Only you are here'}>
          {others.slice(0, 5).map((p) => <i key={p.user_id} style={{ background: colorFor(p.user_id) }}><Face id={p.user_id} name={p.name} /></i>)}
          {others.length > 5 && <i className="more">+{others.length - 5}</i>}
          <small>{others.length ? `${others.length + 1} here` : 'Just you'}</small>
        </span>
        <button className="bb-del bb-neutral" title={full || wide ? 'Exit full screen' : 'Full screen'} onClick={toggleFull}>
          {full || wide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        {b.owner_id === user?.id && (
          <button className="bb-del" title="Delete board" onClick={() => { if (confirm(`Delete "${b.title}" for everyone? This cannot be undone.`)) del.mutate() }}><Trash2 size={16} /></button>
        )}
      </div>
      <div className="board-canvas">
        <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Loading the canvas…</p>}>
          <BoardCanvas board={b} theme={theme} />
        </Suspense>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CaptureUpdateAction, Excalidraw, MainMenu, exportToBlob, reconcileElements } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { BinaryFileData, BinaryFiles, Collaborator, ExcalidrawImperativeAPI, SocketId } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { api, uploadBoardImage, uploadBoardThumb } from '../api'
import { colorFor, colorStrong, usePresence } from '../presence'
import type { BoardFull, BoardImage } from '../types'

type Remote = Parameters<typeof reconcileElements>[1]
type Pointer = { boardId: string; socket_id: string; user_id: string; name: string; x: number; y: number; tool: 'pointer' | 'laser' }

const SEND_MS = 60 // edits are batched this long before going out
const POINTER_MS = 50
const THUMB_MS = 15000 // a fresh list preview, this long after the last change

const toDataURL = (blob: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = no; r.readAsDataURL(blob) })

/** The shared canvas: shapes, freehand, arrows that stay attached, text, pictures. Everyone on the board sees edits live. */
export default function BoardCanvas({ board, theme }: { board: BoardFull; theme: 'light' | 'dark' }) {
  const { socket } = usePresence()
  const qc = useQueryClient()
  const boardId = board.id
  const [api_, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  apiRef.current = api_

  // the version of each element the server already has, so only real changes go out (and remote ones never echo back)
  const sent = useRef(new Map<string, number>(board.elements.map((e) => [e.id as string, e.version as number])))
  const pending = useRef(new Map<string, ExcalidrawElement>())
  const sendTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const knownImages = useRef(new Set<string>()) // picture ids already uploaded, or already loaded from the server
  const scene = useRef<{ elements: readonly ExcalidrawElement[]; appState: Record<string, unknown>; files: BinaryFiles } | null>(null)
  const collaborators = useRef(new Map<SocketId, Collaborator>())
  const frame = useRef(0)
  const lastPointer = useRef(0)
  const thumbTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const thumbDirty = useRef(false)

  const initialData = useMemo(() => ({ elements: board.elements as unknown as ExcalidrawElement[], scrollToContent: true }), [board.elements])

  const flush = useCallback(() => {
    sendTimer.current = undefined
    if (!pending.current.size) return
    socket?.emit('board:elements', { boardId, elements: [...pending.current.values()] })
    pending.current.clear()
  }, [socket, boardId])

  const makeThumb = useCallback(async () => {
    const s = scene.current
    if (!s || !thumbDirty.current) return
    thumbDirty.current = false
    const shapes = s.elements.filter((e) => !e.isDeleted)
    if (!shapes.length) return
    try {
      const blob = await exportToBlob({
        elements: shapes, files: s.files, mimeType: 'image/webp', quality: 0.7, maxWidthOrHeight: 640,
        appState: { ...s.appState, exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
      })
      await uploadBoardThumb(boardId, blob)
      qc.invalidateQueries({ queryKey: ['boards'] })
    } catch { /* the preview is a nicety */ }
  }, [boardId, qc])

  const loadImage = useCallback(async (fileId: string, ref: BoardImage) => {
    const a = apiRef.current
    if (!a || knownImages.current.has(fileId)) return
    knownImages.current.add(fileId)
    try {
      const blob = await (await fetch(ref.url)).blob()
      a.addFiles([{ id: fileId, mimeType: blob.type || ref.mime, dataURL: await toDataURL(blob), created: Date.now() } as unknown as BinaryFileData])
    } catch { knownImages.current.delete(fileId) }
  }, [])

  const applyRemote = useCallback((remote: Record<string, unknown>[]) => {
    const a = apiRef.current
    if (!a || !remote.length) return
    for (const e of remote) sent.current.set(e.id as string, e.version as number)
    const merged = reconcileElements(a.getSceneElementsIncludingDeleted(), remote as unknown as Remote, a.getAppState())
    a.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER })
  }, [])

  const showCollaborators = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      apiRef.current?.updateScene({ collaborators: new Map(collaborators.current) })
    })
  }, [])

  // pictures that were already on the board
  useEffect(() => {
    if (!api_) return
    for (const [fileId, ref] of Object.entries(board.images)) void loadImage(fileId, ref)
  }, [api_, board.images, loadImage])

  // live sync
  useEffect(() => {
    if (!socket || !api_) return

    // catch up on anything we missed (first join, or after the connection dropped), and push what we did offline
    const sync = async () => {
      socket.emit('board:join', { boardId })
      try {
        const fresh = await api.get<BoardFull>(`/boards/${boardId}`)
        const theirs = new Map(fresh.elements.map((e) => [e.id as string, e.version as number]))
        applyRemote(fresh.elements)
        for (const [fileId, ref] of Object.entries(fresh.images)) void loadImage(fileId, ref)
        const ours = apiRef.current?.getSceneElementsIncludingDeleted().filter((e) => !theirs.has(e.id) || e.version > theirs.get(e.id)!) ?? []
        if (ours.length) socket.emit('board:elements', { boardId, elements: ours })
      } catch { /* retried on the next reconnect */ }
    }

    const onElements = (m: { boardId: string; elements: Record<string, unknown>[] }) => { if (m.boardId === boardId) applyRemote(m.elements) }
    const onImage = (m: { boardId: string; fileId: string } & BoardImage) => { if (m.boardId === boardId) void loadImage(m.fileId, m) }
    const onPointer = (p: Pointer) => {
      if (p.boardId !== boardId) return
      collaborators.current.set(p.socket_id as SocketId, {
        pointer: { x: p.x, y: p.y, tool: p.tool }, username: p.name, id: p.user_id,
        color: { background: colorFor(p.user_id), stroke: colorStrong(p.user_id) },
      })
      showCollaborators()
    }
    const onGone = (m: { boardId: string; socket_id: string }) => { if (m.boardId === boardId) { collaborators.current.delete(m.socket_id as SocketId); showCollaborators() } }

    socket.on('board:elements', onElements); socket.on('board:image', onImage)
    socket.on('board:pointer', onPointer); socket.on('board:pointer-gone', onGone)
    socket.on('connect', sync)
    if (socket.connected) void sync()

    return () => {
      socket.off('board:elements', onElements); socket.off('board:image', onImage)
      socket.off('board:pointer', onPointer); socket.off('board:pointer-gone', onGone)
      socket.off('connect', sync)
      clearTimeout(sendTimer.current); flush()
      socket.emit('board:leave', { boardId })
      cancelAnimationFrame(frame.current)
    }
  }, [socket, api_, boardId, applyRemote, loadImage, showCollaborators, flush])

  // leaving the board: make sure the list preview is up to date
  useEffect(() => () => { clearTimeout(thumbTimer.current); void makeThumb() }, [makeThumb])

  const onChange = useCallback((elements: readonly ExcalidrawElement[], appState: Record<string, unknown>, files: BinaryFiles) => {
    scene.current = { elements, appState, files }
    let changed = false
    for (const el of elements) {
      if (sent.current.get(el.id) === el.version) continue
      sent.current.set(el.id, el.version)
      pending.current.set(el.id, el)
      changed = true
    }
    if (changed) {
      sendTimer.current ??= setTimeout(flush, SEND_MS)
      thumbDirty.current = true
      clearTimeout(thumbTimer.current)
      thumbTimer.current = setTimeout(() => { void makeThumb() }, THUMB_MS)
    }
    // a picture added on this screen: store it so everyone else can load it
    for (const el of elements) {
      if (el.type !== 'image' || el.isDeleted || !el.fileId || knownImages.current.has(el.fileId)) continue
      const file = files[el.fileId]
      if (!file) continue
      knownImages.current.add(el.fileId)
      fetch(file.dataURL).then((r) => r.blob()).then((blob) => uploadBoardImage(boardId, file.id, blob)).catch(() => knownImages.current.delete(file.id))
    }
  }, [boardId, flush, makeThumb])

  const onPointerUpdate = useCallback(({ pointer }: { pointer: { x: number; y: number; tool: 'pointer' | 'laser' } }) => {
    const now = Date.now()
    if (now - lastPointer.current < POINTER_MS) return
    lastPointer.current = now
    socket?.emit('board:pointer', { boardId, x: pointer.x, y: pointer.y, tool: pointer.tool })
  }, [socket, boardId])

  return (
    <Excalidraw
      excalidrawAPI={setApi}
      initialData={initialData}
      onChange={onChange as never}
      onPointerUpdate={onPointerUpdate as never}
      isCollaborating
      theme={theme}
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false } }}
    >
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.DefaultItems.Help />
      </MainMenu>
    </Excalidraw>
  )
}

import type { ReactNode } from 'react'

export const Header = ({ title, children }: { title: string; children?: ReactNode }) => (
  <header className="page-head">
    <h1>{title}</h1>
    <div className="actions">{children}</div>
  </header>
)

export const Pill = ({ color, children }: { color: string; children: ReactNode }) => (
  <span className="pill" style={{ background: color }}>{children}</span>
)

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>

/** Always ask before a remove/delete. Returns true only if the person confirms. */
export const askDelete = (what: string) =>
  window.confirm(`${what}\n\nThis cannot be undone.`)

export const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''
export const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

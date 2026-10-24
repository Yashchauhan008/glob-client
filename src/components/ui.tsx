import { useState, type ReactNode } from 'react'
import { api, downloadCsv } from '../api'
import { useQueryClient } from '@tanstack/react-query'

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

export const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''
export const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

type ImportResult = { created: number; updated: number; errors: { row: number; message: string }[] }

/** Export button plus optional CSV import with a row-error list. */
export function CsvTools({ entity, importable, invalidate }: { entity: string; importable?: boolean; invalidate: string[] }) {
  const qc = useQueryClient()
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      const csv = await file.text()
      setResult(await api.post<ImportResult>(`/csv/import/${entity}`, { csv }))
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    } catch (e) {
      setResult({ created: 0, updated: 0, errors: [{ row: 0, message: (e as Error).message }] })
    } finally { setBusy(false) }
  }

  return (
    <>
      <button className="btn ghost" onClick={() => downloadCsv(entity)}>Export CSV</button>
      {importable && (
        <label className="btn ghost">
          {busy ? 'Importing…' : 'Import CSV'}
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      )}
      {result && (
        <div className="modal-back" onClick={() => setResult(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import finished</h3>
            <p>{result.created} created, {result.updated} updated, {result.errors.length} row error(s)</p>
            {result.errors.length > 0 && (
              <ul className="errors">{result.errors.map((er, i) => <li key={i}>Row {er.row}: {er.message}</li>)}</ul>
            )}
            <button className="btn" onClick={() => setResult(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}

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

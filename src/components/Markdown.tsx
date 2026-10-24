import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Markdown with links opened in a new tab and images switched off (no tracking pixels from pasted text). */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _n, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer nofollow" />,
          img: () => null,
        }}
      >{text}</ReactMarkdown>
    </div>
  )
}

/** Description block like YouTube's: a few lines, then "Show more". */
export function Description({ text, lines = 3, empty }: { text: string; lines?: number; empty?: string }) {
  const [open, setOpen] = useState(false)
  const [clipped, setClipped] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (el) setClipped(el.scrollHeight > el.clientHeight + 2 || open)
  }, [text, open])
  if (!text.trim()) return empty ? <p className="muted">{empty}</p> : null
  return (
    <div className="desc">
      <div ref={box} className={'desc-body' + (open ? ' open' : '')} style={{ ['--lines' as string]: lines }}><Markdown text={text} /></div>
      {clipped && <button type="button" className="desc-more" onClick={() => setOpen(!open)}>{open ? 'Show less' : '…more'}</button>}
    </div>
  )
}

/** Textarea with a Write / Preview switch. Keeps its name, so it works inside plain <form> + FormData. */
export function MarkdownField({ name, defaultValue = '', placeholder, rows = 5 }: { name: string; defaultValue?: string; placeholder?: string; rows?: number }) {
  const [text, setText] = useState(defaultValue)
  const [preview, setPreview] = useState(false)
  return (
    <div className="mdf">
      <div className="mdf-bar">
        <button type="button" className={!preview ? 'on' : ''} onClick={() => setPreview(false)}>Write</button>
        <button type="button" className={preview ? 'on' : ''} onClick={() => setPreview(true)}>Preview</button>
        <small>Markdown: **bold**, - lists, [links](https://…), # headings</small>
      </div>
      <textarea name={name} rows={rows} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} hidden={preview} />
      {preview && <div className="mdf-preview">{text.trim() ? <Markdown text={text} /> : <p className="muted">Nothing to preview yet.</p>}</div>}
    </div>
  )
}

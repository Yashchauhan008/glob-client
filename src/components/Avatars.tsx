import { colorFor, initials } from '../presence'

export default function Avatars({ names = [], max = 4 }: { names?: string[]; max?: number }) {
  return (
    <span className="avatars">
      {names.slice(0, max).map((n) => <i key={n} title={n} style={{ background: colorFor(n) }}>{initials(n)}</i>)}
      {names.length > max && <i className="more">+{names.length - max}</i>}
    </span>
  )
}

export function Meter({ value, votes }: { value: number | null; votes: number }) {
  return (
    <div className="meter" title="Team feasibility rating">
      <span className="bars">{[1, 2, 3, 4, 5].map((n) => <b key={n} className={value != null && value >= n - 0.25 ? 'on' : ''} />)}</span>
      <small>{value != null ? `${value}/5 · ${votes} vote${votes === 1 ? '' : 's'}` : 'not rated yet'}</small>
    </div>
  )
}

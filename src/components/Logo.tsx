export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#f8f8f5" />
      <g transform="translate(32 32) scale(.74) translate(-32 -32)"><g fill="#0c0c0d"><circle cx="32" cy="15" r="13"/><circle cx="32" cy="49" r="13"/><circle cx="15" cy="32" r="13"/><circle cx="49" cy="32" r="13"/></g><path d="M17 24C27 20 36 26 32 32C28 38 37 44 47 40" fill="none" stroke="#f8f8f5" strokeWidth="11" strokeLinecap="round"/><path d="M17 24C27 20 36 26 32 32C28 38 37 44 47 40" fill="none" stroke="#0c0c0d" strokeWidth="5" strokeLinecap="round"/></g>
    </svg>
  )
}

export default function Logo({ size = 36 }: { size?: number }) {
  return <span className="logo-lock"><LogoMark size={size} /><span className="logo-word">glob</span></span>
}

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="18" fill="#f8f8f5" />
      <circle cx="30" cy="34" r="17" fill="#0c0c0d" />
      <ellipse cx="30" cy="34" rx="7.5" ry="17" fill="none" stroke="#f8f8f5" strokeWidth="3" />
      <path d="M13 34h34" stroke="#f8f8f5" strokeWidth="3" />
      <circle cx="47" cy="17" r="7" fill="#7fe07a" stroke="#f8f8f5" strokeWidth="3" />
    </svg>
  )
}

export default function Logo({ size = 36 }: { size?: number }) {
  return <span className="logo-lock"><LogoMark size={size} /><span className="logo-word">glob</span></span>
}

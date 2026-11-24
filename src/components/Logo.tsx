export function LogoMark({ size = 36 }: { size?: number }) {
  return <img className="logo-mark" src="/logo-mark.png" width={size} height={size} alt="" aria-hidden draggable={false} style={{ objectFit: 'contain' }} />
}

export default function Logo({ size = 36 }: { size?: number }) {
  return <span className="logo-lock"><LogoMark size={size} /><span className="logo-word">glob</span></span>
}

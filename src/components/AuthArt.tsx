const petals = Array.from({ length: 16 }, (_, i) => i * 22.5)

export default function AuthArt() {
  return (
    <svg className="auth-art-svg" viewBox="0 0 500 590" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="gBlue" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#a9b8fb" /><stop offset=".55" stopColor="#6577ec" /><stop offset="1" stopColor="#4453d6" /></radialGradient>
        <radialGradient id="gGold" cx=".3" cy=".3" r=".9"><stop offset="0" stopColor="#f6dd8a" /><stop offset="1" stopColor="#c9961f" /></radialGradient>
        <radialGradient id="gPurple" cx=".4" cy=".35" r=".75"><stop offset="0" stopColor="#d3c8ff" /><stop offset=".6" stopColor="#9a86f3" /><stop offset="1" stopColor="#6f5ae0" /></radialGradient>
        <radialGradient id="gPetal" cx=".5" cy=".25" r=".9"><stop offset="0" stopColor="#c6b9ff" /><stop offset="1" stopColor="#7e69ec" /></radialGradient>
        <radialGradient id="gYellow" cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#ffe97a" /><stop offset="1" stopColor="#e2ae16" /></radialGradient>
        <radialGradient id="gBubble" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".6" stopColor="#eef0f6" stopOpacity=".55" /><stop offset="1" stopColor="#c9cddc" stopOpacity=".55" /></radialGradient>
        <radialGradient id="gSilver" cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#f3f2fb" /><stop offset="1" stopColor="#a9a6c4" /></radialGradient>
        <linearGradient id="gCube" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6b78f2" /><stop offset="1" stopColor="#3340c7" /></linearGradient>
        <pattern id="stripes" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><rect width="46" height="46" fill="#e8b73a" /><rect width="23" height="46" fill="#f7efd3" /></pattern>
        <clipPath id="cGold"><circle cx="90" cy="120" r="190" /></clipPath>
      </defs>
      <rect width="500" height="590" fill="#dedee0" />

      <g clipPath="url(#cGold)"><circle cx="90" cy="120" r="190" fill="url(#stripes)" /><circle cx="90" cy="120" r="190" fill="url(#gGold)" opacity=".35" /></g>
      <circle cx="440" cy="190" r="150" fill="url(#gBlue)" />
      <g className="float-a">
        <circle cx="352" cy="82" r="48" fill="url(#gBubble)" /><ellipse cx="336" cy="64" rx="14" ry="9" fill="#fff" opacity=".8" />
      </g>
      <g className="float-b">
        <ellipse cx="44" cy="260" rx="46" ry="52" fill="url(#gSilver)" /><ellipse cx="62" cy="244" rx="12" ry="9" fill="#fff" opacity=".85" />
      </g>

      <g className="float-b">
        <g transform="translate(250 305)">
          {petals.map((a) => <ellipse key={a} cx="0" cy="-88" rx="30" ry="58" fill="url(#gPetal)" stroke="#f1ecff" strokeOpacity=".55" strokeWidth="2" transform={`rotate(${a})`} />)}
          <circle r="92" fill="url(#gPurple)" />
          <ellipse cx="-30" cy="-6" rx="13" ry="20" fill="#0c0c0d" /><ellipse cx="34" cy="-8" rx="13" ry="20" fill="#0c0c0d" />
          <ellipse cx="-24" cy="-14" rx="4" ry="6" fill="#fff" opacity=".7" /><ellipse cx="40" cy="-16" rx="4" ry="6" fill="#fff" opacity=".7" />
          <ellipse cx="2" cy="34" rx="8" ry="5.5" fill="#0c0c0d" />
        </g>
      </g>

      <g className="float-a">
        <circle cx="395" cy="485" r="100" fill="url(#gPurple)" />
        <circle cx="352" cy="470" r="88" fill="url(#gBubble)" /><ellipse cx="320" cy="430" rx="22" ry="12" fill="#fff" opacity=".7" />
      </g>
      <g className="float-b">
        <ellipse cx="40" cy="505" rx="52" ry="92" fill="url(#gBlue)" transform="rotate(-8 40 505)" /><ellipse cx="38" cy="508" rx="14" ry="28" fill="#dedee0" opacity=".9" />
      </g>
      <path className="float-a" d="M130 470c0-34 42-52 78-46 44 8 54 54 38 92-14 34-52 50-86 40-20-6-30-26-30-86z" fill="url(#gYellow)" />
      <path className="float-b" d="M274 536l58-22 40 54-60 36-46-20z" fill="url(#gCube)" />
      <circle cx="24" cy="410" r="30" fill="url(#gBubble)" />
    </svg>
  )
}

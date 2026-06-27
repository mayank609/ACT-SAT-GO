/**
 * Hand-built SVG hero illustration for the login marketing panel:
 * a cheerful student at a laptop, surrounded by floating achievement cards
 * (progress chart, lightbulb, "780 / Your Score" badge, target bullseye).
 * Pure SVG — no external asset needed.
 */
export function StudentHero({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Student studying at a laptop">
      <defs>
        <radialGradient id="sh-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#dbeafe" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sh-hoodie" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2454d6" />
        </linearGradient>
        <linearGradient id="sh-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#b8c2d1" />
        </linearGradient>
        <linearGradient id="sh-desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0b07e" />
          <stop offset="100%" stopColor="#c8895a" />
        </linearGradient>
        <linearGradient id="sh-score" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="sh-target" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {/* soft background glow */}
      <ellipse cx="200" cy="205" rx="190" ry="180" fill="url(#sh-glow)" />

      {/* scattered sparkles / dots */}
      <g opacity="0.7">
        <circle cx="70" cy="60" r="3" fill="#93c5fd" />
        <circle cx="340" cy="100" r="3.5" fill="#fbbf24" />
        <circle cx="360" cy="250" r="3" fill="#93c5fd" />
        <circle cx="46" cy="300" r="3" fill="#fbbf24" />
        <circle cx="200" cy="40" r="2.5" fill="#60a5fa" />
        <g stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round">
          <path d="M318 52 v8 M314 56 h8" />
        </g>
        <g stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round">
          <path d="M58 150 v8 M54 154 h8" />
        </g>
      </g>

      {/* dotted connector curves */}
      <g stroke="#bfdbfe" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" fill="none">
        <path d="M120 120 C150 95 165 120 180 150" />
        <path d="M285 115 C262 130 250 145 235 165" />
        <path d="M315 195 C290 200 275 210 258 225" />
      </g>

      {/* ───────── floating: progress chart card ───────── */}
      <g transform="rotate(-5 78 110)">
        <rect x="20" y="74" width="120" height="78" rx="14" fill="#ffffff" />
        <rect x="20" y="74" width="120" height="78" rx="14" fill="#ffffff" stroke="#eef2f7" />
        <text x="34" y="98" fill="#94a3b8" fontSize="11" fontWeight="700" fontFamily="Inter, sans-serif">Progress</text>
        <polyline points="34,138 56,126 76,130 96,110 116,114 130,96" fill="none" stroke="#2f6dff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="130" cy="96" r="4" fill="#2f6dff" />
        <path d="M34 138 L56 126 L76 130 L96 110 L116 114 L130 96 V146 H34 Z" fill="#2f6dff" opacity="0.08" />
      </g>

      {/* ───────── floating: lightbulb idea bubble ───────── */}
      <g transform="rotate(8 268 80)">
        <rect x="240" y="50" width="58" height="58" rx="16" fill="#facc15" />
        <path d="M250 106 l8 10 l6 -8 z" fill="#facc15" />
        <g transform="translate(269 78)">
          <circle cx="0" cy="-2" r="11" fill="#fff" />
          <rect x="-5" y="7" width="10" height="6" rx="2" fill="#fff" />
          <path d="M-3 13 h6 M-2 16 h4" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
          <path d="M0 -8 v5 M-4 -1 h8" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>

      {/* ───────── floating: score badge ───────── */}
      <g transform="rotate(6 348 178)">
        <rect x="300" y="150" width="96" height="58" rx="16" fill="url(#sh-score)" />
        <text x="348" y="186" fill="#ffffff" fontSize="26" fontWeight="800" textAnchor="middle" fontFamily="Inter, sans-serif">780</text>
        <text x="348" y="200" fill="#dcfce7" fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="Inter, sans-serif">Your Score</text>
      </g>

      {/* ───────── floating: target bullseye badge ───────── */}
      <g transform="rotate(-7 36 218)">
        <rect x="8" y="190" width="58" height="58" rx="16" fill="url(#sh-target)" />
        <circle cx="37" cy="219" r="16" fill="none" stroke="#ffffff" strokeWidth="3" />
        <circle cx="37" cy="219" r="9" fill="none" stroke="#bfdbfe" strokeWidth="3" />
        <circle cx="37" cy="219" r="3" fill="#ffffff" />
      </g>

      {/* ═════════ desk + character ═════════ */}
      {/* ground shadow */}
      <ellipse cx="200" cy="352" rx="150" ry="20" fill="#1e3a8a" opacity="0.08" />

      {/* books stack (left) */}
      <g>
        <rect x="56" y="300" width="78" height="16" rx="4" fill="#2563eb" />
        <text x="95" y="312" fill="#fff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Inter, sans-serif">SAT</text>
        <rect x="60" y="284" width="70" height="16" rx="4" fill="#f97316" />
        <text x="95" y="296" fill="#fff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Inter, sans-serif">ACT</text>
        <rect x="64" y="268" width="64" height="16" rx="4" fill="#facc15" />
        <text x="96" y="280" fill="#7c4a03" fontSize="7.5" fontWeight="800" textAnchor="middle" fontFamily="Inter, sans-serif">STRATEGY</text>
      </g>

      {/* potted plant (right) */}
      <g>
        <path d="M318 304 q-12 -34 4 -50 q6 16 -4 50 z" fill="#22c55e" />
        <path d="M334 304 q14 -30 -2 -46 q-8 14 2 46 z" fill="#16a34a" />
        <path d="M326 304 q0 -40 0 -52 q4 24 4 52 z" fill="#4ade80" />
        <path d="M312 300 h36 l-5 22 h-26 z" fill="#e8895f" />
        <rect x="310" y="296" width="40" height="8" rx="3" fill="#f0a07e" />
      </g>

      {/* character behind desk */}
      <g>
        {/* neck */}
        <rect x="191" y="196" width="18" height="20" rx="6" fill="#e9b487" />
        {/* hood / collar behind */}
        <path d="M150 250 Q150 214 188 208 L212 208 Q250 214 250 250 Z" fill="url(#sh-hoodie)" />
        {/* head */}
        <circle cx="200" cy="166" r="40" fill="#f4c8a0" />
        {/* ears */}
        <circle cx="161" cy="170" r="7.5" fill="#f4c8a0" />
        <circle cx="239" cy="170" r="7.5" fill="#efb98f" />
        {/* hair */}
        <path d="M159 156 C156 122 176 106 200 106 C224 106 244 122 241 156 C234 142 226 138 219 141 C214 127 206 125 200 127 C190 123 182 130 181 142 C173 137 165 145 159 156 Z" fill="#4a3526" />
        {/* eyebrows */}
        <path d="M180 156 q6 -4 13 -1" stroke="#3a2a1d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M207 155 q7 -3 13 1" stroke="#3a2a1d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* eyes */}
        <circle cx="187" cy="166" r="4.5" fill="#2d2a26" />
        <circle cx="213" cy="166" r="4.5" fill="#2d2a26" />
        <circle cx="188.6" cy="164.4" r="1.4" fill="#fff" />
        <circle cx="214.6" cy="164.4" r="1.4" fill="#fff" />
        {/* cheeks */}
        <circle cx="174" cy="180" r="5" fill="#f7a89a" opacity="0.55" />
        <circle cx="226" cy="180" r="5" fill="#f7a89a" opacity="0.55" />
        {/* smile */}
        <path d="M185 181 Q200 197 215 181 Q200 189 185 181 Z" fill="#b3553a" />
        <path d="M185 181 Q200 196 215 181" stroke="#8a4128" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* shoulders / hoodie body */}
        <path d="M148 300 L148 252 Q148 218 188 213 L212 213 Q252 218 252 252 L252 300 Z" fill="url(#sh-hoodie)" />
        {/* hood drawstrings */}
        <path d="M190 218 v22 M210 218 v22" stroke="#1e40af" strokeWidth="3" strokeLinecap="round" />
        <circle cx="190" cy="242" r="3" fill="#1e40af" />
        <circle cx="210" cy="242" r="3" fill="#1e40af" />
        {/* chest target logo */}
        <circle cx="200" cy="266" r="11" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
        <circle cx="200" cy="266" r="4.5" fill="#fbbf24" />
      </g>

      {/* desk top */}
      <rect x="44" y="316" width="312" height="18" rx="9" fill="url(#sh-desk)" />
      <rect x="44" y="316" width="312" height="6" rx="3" fill="#ecc79a" />

      {/* laptop (lid back faces viewer, on the desk) */}
      <g>
        {/* arms / sleeves resting on laptop */}
        <path d="M150 246 Q138 268 156 300 L186 300 Q172 268 178 250 Z" fill="url(#sh-hoodie)" />
        <path d="M250 246 Q262 268 244 300 L214 300 Q228 268 222 250 Z" fill="url(#sh-hoodie)" />
        {/* hands */}
        <ellipse cx="168" cy="300" rx="11" ry="8" fill="#f4c8a0" />
        <ellipse cx="232" cy="300" rx="11" ry="8" fill="#efb98f" />

        {/* lid */}
        <path d="M156 314 L244 314 L236 244 Q236 240 232 240 L168 240 Q164 240 164 244 Z" fill="url(#sh-lid)" />
        <path d="M156 314 L244 314 L236 244 Q236 240 232 240 L168 240 Q164 240 164 244 Z" stroke="#94a3b8" strokeWidth="1.5" />
        {/* laptop logo */}
        <circle cx="200" cy="278" r="13" fill="none" stroke="#f59e0b" strokeWidth="3" />
        <circle cx="200" cy="278" r="5" fill="#f59e0b" />
        {/* base front */}
        <path d="M150 314 L250 314 L262 326 Q262 330 258 330 L142 330 Q138 330 138 326 Z" fill="#cbd5e1" stroke="#9aa6b8" strokeWidth="1" />
      </g>

      {/* coffee mug (right of laptop) */}
      <g>
        <path d="M286 300 v-22 q14 0 14 0 a8 8 0 0 1 0 16 q-3 0 -3 0" fill="none" stroke="#1e3a8a" strokeWidth="4" />
        <rect x="262" y="278" width="30" height="30" rx="6" fill="#1e3a8a" />
        <circle cx="277" cy="293" r="7" fill="none" stroke="#fbbf24" strokeWidth="2" />
        <circle cx="277" cy="293" r="2.5" fill="#fbbf24" />
        <path d="M270 272 q-3 -6 2 -11 M283 272 q3 -6 -2 -11" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8" />
      </g>
    </svg>
  );
}

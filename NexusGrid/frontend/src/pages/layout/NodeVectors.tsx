/**
 * Flat-style SVG vector illustrations for layout node cards.
 * Each vector scales to its container (width 100%, height 100%).
 */

interface VecProps {
  isDark: boolean;
  /** accent colour (used by ComputerVector screen) */
  color?: string;
}

const S = { w: '100%', h: '100%' };

// ─── Building — front facade ──────────────────────────────────────────────────
export function BuildingVector({ isDark }: VecProps) {
  const wall = isDark ? '#4c1d95' : '#ddd6fe';
  const wallDark = isDark ? '#3b0764' : '#c4b5fd';
  const win = isDark ? '#8b5cf6' : '#a78bfa';
  const winLit = isDark ? '#fbbf24' : '#fde68a';
  const stroke = isDark ? '#7c3aed' : '#8b5cf6';
  const glass = isDark ? '#1e1b4b' : '#ede9fe';
  return (
    <svg viewBox="0 0 140 130" width={S.w} height={S.h} preserveAspectRatio="xMidYMid meet">
      {/* ground */}
      <rect x="4" y="122" width="132" height="4" rx="2" fill={wallDark} />
      {/* side wing */}
      <rect x="98" y="52" width="34" height="70" rx="2" fill={wallDark} stroke={stroke} strokeWidth="1.5" />
      {[60, 76, 92, 108].map((y) => (
        <rect key={y} x="104" y={y} width="22" height="9" rx="1.5" fill={win} opacity="0.7" />
      ))}
      {/* main tower */}
      <rect x="18" y="14" width="76" height="108" rx="3" fill={wall} stroke={stroke} strokeWidth="2" />
      {/* roof parapet + AC unit */}
      <rect x="14" y="10" width="84" height="7" rx="2" fill={wallDark} stroke={stroke} strokeWidth="1.5" />
      <rect x="34" y="2" width="18" height="9" rx="1.5" fill={wallDark} stroke={stroke} strokeWidth="1.5" />
      <rect x="62" y="4" width="10" height="7" rx="1.5" fill={wallDark} />
      {/* window grid: 3 cols × 4 rows */}
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={26 + c * 22}
            y={22 + r * 20}
            width="16"
            height="13"
            rx="2"
            fill={(r + c) % 3 === 1 ? winLit : win}
            stroke={stroke}
            strokeWidth="0.75"
          />
        )),
      )}
      {/* entrance: canopy + double glass door */}
      <rect x="42" y="98" width="28" height="4" rx="1.5" fill={stroke} />
      <rect x="46" y="102" width="20" height="20" rx="1.5" fill={glass} stroke={stroke} strokeWidth="1.5" />
      <line x1="56" y1="102" x2="56" y2="122" stroke={stroke} strokeWidth="1.25" />
      <circle cx="53" cy="113" r="1.2" fill={stroke} />
      <circle cx="59" cy="113" r="1.2" fill={stroke} />
      {/* path + shrubs */}
      <rect x="44" y="122" width="24" height="3" fill={glass} />
      <circle cx="32" cy="119" r="5" fill={isDark ? '#166534' : '#86efac'} />
      <circle cx="82" cy="119" r="5" fill={isDark ? '#166534' : '#86efac'} />
    </svg>
  );
}

// ─── Floor — top-down floor plan ─────────────────────────────────────────────
export function FloorVector({ isDark }: VecProps) {
  const wall = '#3b82f6';
  const roomFill = isDark ? '#172554' : '#eff6ff';
  const corridor = isDark ? '#1e3a8a' : '#dbeafe';
  const label = isDark ? '#60a5fa' : '#93c5fd';
  return (
    <svg viewBox="0 0 200 84" width={S.w} height={S.h} preserveAspectRatio="xMidYMid meet">
      {/* outer walls */}
      <rect x="4" y="4" width="192" height="76" rx="3" fill={roomFill} stroke={wall} strokeWidth="2.5" />
      {/* corridor */}
      <rect x="6" y="34" width="188" height="16" fill={corridor} />
      {/* top rooms */}
      {[
        { x: 6, w: 44 }, { x: 52, w: 50 }, { x: 104, w: 44 }, { x: 150, w: 44 },
      ].map((r, i) => (
        <g key={i}>
          <rect x={r.x} y="6" width={r.w} height="28" fill={roomFill} stroke={wall} strokeWidth="1.25" />
          <line x1={r.x + r.w / 2 - 5} y1="34" x2={r.x + r.w / 2 + 5} y2="34" stroke={corridor} strokeWidth="2.5" />
          <rect x={r.x + 6} y="11" width={r.w - 12} height="7" rx="1" fill={label} opacity="0.55" />
        </g>
      ))}
      {/* bottom rooms */}
      {[
        { x: 6, w: 60 }, { x: 68, w: 60 }, { x: 130, w: 42 },
      ].map((r, i) => (
        <g key={i}>
          <rect x={r.x} y="50" width={r.w} height="28" fill={roomFill} stroke={wall} strokeWidth="1.25" />
          <line x1={r.x + r.w / 2 - 5} y1="50" x2={r.x + r.w / 2 + 5} y2="50" stroke={corridor} strokeWidth="2.5" />
          <rect x={r.x + 6} y="64" width={r.w - 12} height="7" rx="1" fill={label} opacity="0.55" />
        </g>
      ))}
      {/* stairwell */}
      <g>
        <rect x="174" y="50" width="20" height="28" fill={corridor} stroke={wall} strokeWidth="1.25" />
        {[55, 60, 65, 70].map((y) => (
          <line key={y} x1="176" y1={y} x2="192" y2={y} stroke={wall} strokeWidth="1" opacity="0.7" />
        ))}
      </g>
      {/* corridor dots */}
      {[30, 70, 110, 150].map((x) => (
        <circle key={x} cx={x} cy="42" r="1.5" fill={wall} opacity="0.5" />
      ))}
    </svg>
  );
}

// ─── Room / Lab — top-down lab layout ────────────────────────────────────────
export function RoomVector({ isDark }: VecProps) {
  const wall = '#6366f1';
  const floor = isDark ? '#1e1b4b' : '#eef2ff';
  const desk = isDark ? '#312e81' : '#ffffff';
  const deskStroke = isDark ? '#818cf8' : '#a5b4fc';
  const screen = isDark ? '#22d3ee' : '#38bdf8';
  return (
    <svg viewBox="0 0 140 124" width={S.w} height={S.h} preserveAspectRatio="xMidYMid meet">
      {/* walls */}
      <rect x="4" y="4" width="132" height="116" rx="3" fill={floor} stroke={wall} strokeWidth="2.5" />
      {/* window (right wall) */}
      <rect x="134" y="40" width="4" height="30" fill={isDark ? '#0ea5e9' : '#bae6fd'} stroke={wall} strokeWidth="1" />
      {/* door with swing arc (bottom-left) */}
      <line x1="22" y1="120" x2="40" y2="120" stroke={floor} strokeWidth="4" />
      <path d="M 22 120 A 18 18 0 0 1 40 102" fill="none" stroke={wall} strokeWidth="1.25" strokeDasharray="3 2" />
      <line x1="22" y1="120" x2="22" y2="102" stroke={wall} strokeWidth="2" />
      {/* teacher desk + screen (top) */}
      <rect x="52" y="12" width="36" height="12" rx="2" fill={desk} stroke={deskStroke} strokeWidth="1.25" />
      <rect x="58" y="15" width="8" height="6" rx="1" fill={screen} opacity="0.85" />
      {/* two rows of student workstations */}
      {[40, 68].map((y) =>
        [14, 58, 100].map((x) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="28" height="14" rx="2" fill={desk} stroke={deskStroke} strokeWidth="1.25" />
            <rect x={x + 4} y={y + 3} width="9" height="7" rx="1" fill={screen} opacity="0.85" />
            <rect x={x + 16} y={y + 4} width="8" height="5" rx="1" fill={deskStroke} opacity="0.8" />
            <rect x={x + 9} y={y + 15} width="10" height="4" rx="2" fill={deskStroke} opacity="0.7" />
          </g>
        )),
      )}
      {/* back bench */}
      <rect x="14" y="98" width="76" height="12" rx="2" fill={desk} stroke={deskStroke} strokeWidth="1.25" />
      {[22, 42, 62].map((x) => (
        <rect key={x} x={x} y="101" width="9" height="6" rx="1" fill={screen} opacity="0.85" />
      ))}
      {/* server cabinet corner */}
      <rect x="106" y="96" width="22" height="16" rx="2" fill={deskStroke} opacity="0.55" stroke={deskStroke} strokeWidth="1" />
      <circle cx="112" cy="101" r="1.5" fill="#10b981" />
      <circle cx="112" cy="107" r="1.5" fill="#f59e0b" />
    </svg>
  );
}

// ─── Computer — desktop monitor + keyboard + mouse ───────────────────────────
export function ComputerVector({ isDark, color = '#10b981' }: VecProps) {
  const bezel = color;
  const deskLine = isDark ? '#475569' : '#cbd5e1';
  return (
    <svg viewBox="0 0 140 104" width={S.w} height={S.h} preserveAspectRatio="xMidYMid meet">
      {/* monitor */}
      <rect x="24" y="6" width="92" height="58" rx="5" fill={bezel} />
      <rect x="29" y="11" width="82" height="48" rx="3" fill={isDark ? '#0f172a' : '#f8fafc'} />
      {/* screen content: code lines */}
      <rect x="34" y="17" width="14" height="4" rx="2" fill={color} />
      <rect x="52" y="17" width="34" height="4" rx="2" fill={color} opacity="0.45" />
      <rect x="40" y="25" width="26" height="4" rx="2" fill="#facc15" opacity="0.8" />
      <rect x="70" y="25" width="18" height="4" rx="2" fill={color} opacity="0.35" />
      <rect x="40" y="33" width="40" height="4" rx="2" fill={color} opacity="0.55" />
      <rect x="34" y="41" width="20" height="4" rx="2" fill="#f472b6" opacity="0.8" />
      <rect x="58" y="41" width="30" height="4" rx="2" fill={color} opacity="0.35" />
      <rect x="34" y="49" width="10" height="4" rx="2" fill={color} />
      {/* status dot */}
      <circle cx="104" cy="54" r="2.2" fill={color} />
      {/* stand */}
      <rect x="64" y="64" width="12" height="9" fill={bezel} />
      <rect x="48" y="73" width="44" height="5" rx="2.5" fill={bezel} />
      {/* keyboard */}
      <rect x="30" y="84" width="60" height="14" rx="3" fill={isDark ? '#1e293b' : '#e2e8f0'} stroke={deskLine} strokeWidth="1.25" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4, 5, 6].map((c) => (
          <rect key={`${r}-${c}`} x={34 + c * 7.5} y={87 + r * 3.6} width="5.5" height="2.6" rx="0.8" fill={deskLine} opacity="0.8" />
        )),
      )}
      {/* mouse */}
      <ellipse cx="104" cy="91" rx="6" ry="8" fill={isDark ? '#1e293b' : '#e2e8f0'} stroke={deskLine} strokeWidth="1.25" />
      <line x1="104" y1="84" x2="104" y2="89" stroke={deskLine} strokeWidth="1" />
    </svg>
  );
}

// ─── Server — blade tower ────────────────────────────────────────────────────
export function ServerVector({ isDark, color = '#f59e0b' }: VecProps) {
  const chassis = isDark ? color + '26' : color + '1a';
  const blade = isDark ? color + '40' : color + '33';
  const stroke = color;
  const vent = color;
  return (
    <svg viewBox="0 0 140 104" width={S.w} height={S.h} preserveAspectRatio="xMidYMid meet">
      <rect x="30" y="4" width="80" height="92" rx="5" fill={chassis} stroke={stroke} strokeWidth="2" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="36" y={10 + i * 21} width="68" height="17" rx="2.5" fill={blade} stroke={stroke} strokeWidth="1" />
          {/* drive handle */}
          <rect x="40" y={13 + i * 21} width="4" height="11" rx="1" fill={stroke} opacity="0.8" />
          {/* vents */}
          {[0, 1, 2, 3, 4].map((v) => (
            <line key={v} x1={50 + v * 7} y1={13 + i * 21} x2={50 + v * 7} y2={24 + i * 21} stroke={vent} strokeWidth="1.5" opacity="0.5" />
          ))}
          {/* LEDs */}
          <circle cx="92" cy={16 + i * 21} r="2" fill={i === 2 ? '#f59e0b' : '#10b981'} />
          <circle cx="98" cy={16 + i * 21} r="2" fill="#10b981" />
          <rect x="90" y={21 + i * 21} width="10" height="2.5" rx="1" fill={vent} opacity="0.6" />
        </g>
      ))}
      {/* feet */}
      <rect x="36" y="96" width="12" height="4" rx="1.5" fill={stroke} />
      <rect x="92" y="96" width="12" height="4" rx="1.5" fill={stroke} />
    </svg>
  );
}

// ─── Network switch — front panel with ports ─────────────────────────────────
export function SwitchVector({ isDark, color = '#06b6d4' }: VecProps) {
  const chassis = isDark ? color + '26' : color + '1a';
  const stroke = color;
  const port = isDark ? color + '40' : '#ffffff';
  return (
    <svg viewBox="0 0 140 104" width={S.w} height={S.h} preserveAspectRatio="xMidYMid meet">
      {/* incoming cables */}
      <path d="M 20 8 C 20 24, 34 22, 38 34" fill="none" stroke={stroke} strokeWidth="2" opacity="0.6" />
      <path d="M 70 6 C 70 20, 70 24, 70 34" fill="none" stroke={stroke} strokeWidth="2" opacity="0.6" />
      <path d="M 120 8 C 120 24, 106 22, 102 34" fill="none" stroke={stroke} strokeWidth="2" opacity="0.6" />
      {/* chassis */}
      <rect x="12" y="34" width="116" height="44" rx="5" fill={chassis} stroke={stroke} strokeWidth="2" />
      {/* brand stripe + status LEDs */}
      <rect x="18" y="40" width="26" height="5" rx="2" fill={stroke} opacity="0.7" />
      <circle cx="112" cy="42" r="2.2" fill="#10b981" />
      <circle cx="120" cy="42" r="2.2" fill="#f59e0b" />
      {/* two rows of 8 ports with link LEDs */}
      {[0, 1].map((row) =>
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <g key={`${row}-${i}`}>
            <rect x={19 + i * 13} y={50 + row * 14} width="10" height="9" rx="1.5" fill={port} stroke={stroke} strokeWidth="1" />
            <rect x={22 + i * 13} y={50 + row * 14} width="4" height="3" fill={stroke} opacity="0.6" />
            <circle cx={31 + i * 13} cy={52 + row * 14} r="1.1" fill={(i + row) % 3 === 0 ? '#f59e0b' : '#10b981'} />
          </g>
        )),
      )}
      {/* rack ears */}
      <rect x="6" y="42" width="6" height="28" rx="1.5" fill={chassis} stroke={stroke} strokeWidth="1.5" />
      <rect x="128" y="42" width="6" height="28" rx="1.5" fill={chassis} stroke={stroke} strokeWidth="1.5" />
      <circle cx="9" cy="48" r="1.4" fill={stroke} />
      <circle cx="9" cy="64" r="1.4" fill={stroke} />
      <circle cx="131" cy="48" r="1.4" fill={stroke} />
      <circle cx="131" cy="64" r="1.4" fill={stroke} />
    </svg>
  );
}

// ─── Router — chassis with antennas + signal ─────────────────────────────────
export function RouterVector({ isDark, color = '#14b8a6' }: VecProps) {
  const chassis = isDark ? color + '26' : color + '1a';
  const stroke = color;
  const port = isDark ? color + '40' : '#ffffff';
  return (
    <svg viewBox="0 0 140 104" width={S.w} height={S.h} preserveAspectRatio="xMidYMid meet">
      {/* signal waves */}
      <path d="M 58 22 A 17 17 0 0 1 82 22" fill="none" stroke={stroke} strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      <path d="M 63 28 A 10 10 0 0 1 77 28" fill="none" stroke={stroke} strokeWidth="2" opacity="0.6" strokeLinecap="round" />
      <circle cx="70" cy="34" r="2.4" fill={stroke} />
      {/* antennas */}
      <line x1="34" y1="52" x2="24" y2="20" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="18" r="2.6" fill={stroke} />
      <line x1="106" y1="52" x2="116" y2="20" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <circle cx="116" cy="18" r="2.6" fill={stroke} />
      {/* chassis */}
      <rect x="18" y="50" width="104" height="34" rx="8" fill={chassis} stroke={stroke} strokeWidth="2" />
      {/* LED row */}
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={34 + i * 12} cy="60" r="2.4" fill={i === 3 ? '#f59e0b' : '#10b981'} />
      ))}
      <rect x="96" y="56" width="18" height="8" rx="2" fill={stroke} opacity="0.65" />
      {/* ports */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={30 + i * 16} y="68" width="12" height="9" rx="1.5" fill={port} stroke={stroke} strokeWidth="1" />
      ))}
      <rect x="96" y="68" width="18" height="9" rx="1.5" fill={port} stroke={stroke} strokeWidth="1" />
      {/* feet */}
      <rect x="28" y="84" width="14" height="4" rx="2" fill={stroke} opacity="0.7" />
      <rect x="98" y="84" width="14" height="4" rx="2" fill={stroke} opacity="0.7" />
    </svg>
  );
}

// ─── Printer — multifunction with paper ──────────────────────────────────────
export function PrinterVector({ isDark, color = '#ec4899' }: VecProps) {
  const body = isDark ? color + '26' : color + '1a';
  const stroke = color;
  const paper = isDark ? '#e2e8f0' : '#ffffff';
  const paperLine = isDark ? '#94a3b8' : '#cbd5e1';
  return (
    <svg viewBox="0 0 140 104" width={S.w} height={S.h} preserveAspectRatio="xMidYMid meet">
      {/* input paper (top, tilted stack) */}
      <rect x="46" y="4" width="48" height="26" rx="1.5" fill={paper} stroke={paperLine} strokeWidth="1.25" />
      <line x1="52" y1="11" x2="88" y2="11" stroke={paperLine} strokeWidth="1.5" />
      <line x1="52" y1="17" x2="82" y2="17" stroke={paperLine} strokeWidth="1.5" />
      <line x1="52" y1="23" x2="86" y2="23" stroke={paperLine} strokeWidth="1.5" />
      {/* main body */}
      <rect x="16" y="30" width="108" height="42" rx="6" fill={body} stroke={stroke} strokeWidth="2" />
      {/* scanner lid line */}
      <line x1="16" y1="40" x2="124" y2="40" stroke={stroke} strokeWidth="1.25" opacity="0.6" />
      {/* control panel */}
      <rect x="92" y="46" width="24" height="16" rx="2.5" fill={isDark ? color + '55' : color + '33'} stroke={stroke} strokeWidth="1" />
      <rect x="95" y="49" width="10" height="6" rx="1" fill={isDark ? color + '99' : '#ffffff'} />
      <circle cx="111" cy="52" r="2" fill="#10b981" />
      <circle cx="97" cy="59" r="1.4" fill={stroke} opacity="0.7" />
      <circle cx="103" cy="59" r="1.4" fill={stroke} opacity="0.7" />
      <circle cx="109" cy="59" r="1.4" fill={stroke} opacity="0.7" />
      {/* output slot + printed page */}
      <rect x="26" y="50" width="56" height="5" rx="2" fill={isDark ? '#1e293b' : color} opacity={isDark ? 1 : 0.25} />
      <rect x="32" y="55" width="44" height="30" rx="1.5" fill={paper} stroke={paperLine} strokeWidth="1.25" />
      <line x1="38" y1="63" x2="70" y2="63" stroke={stroke} strokeWidth="1.5" opacity="0.7" />
      <line x1="38" y1="69" x2="64" y2="69" stroke={paperLine} strokeWidth="1.5" />
      <line x1="38" y1="75" x2="68" y2="75" stroke={paperLine} strokeWidth="1.5" />
      {/* base + feet */}
      <rect x="20" y="88" width="100" height="8" rx="3" fill={body} stroke={stroke} strokeWidth="1.5" />
      <rect x="28" y="96" width="12" height="4" rx="1.5" fill={stroke} opacity="0.7" />
      <rect x="100" y="96" width="12" height="4" rx="1.5" fill={stroke} opacity="0.7" />
    </svg>
  );
}

// ─── UPS — battery unit with power sockets ───────────────────────────────────
export function UPSVector({ isDark, color = '#eab308' }: VecProps) {
  const body = isDark ? color + '26' : color + '1a';
  const stroke = color;
  const panel = isDark ? color + '40' : color + '33';
  return (
    <svg viewBox="0 0 140 104" width={S.w} height={S.h} preserveAspectRatio="xMidYMid meet">
      {/* chassis */}
      <rect x="24" y="8" width="92" height="88" rx="7" fill={body} stroke={stroke} strokeWidth="2" />
      {/* display panel */}
      <rect x="34" y="16" width="72" height="24" rx="3" fill={isDark ? '#0f172a' : '#1e293b'} />
      {/* battery gauge */}
      <rect x="40" y="21" width="46" height="9" rx="2" fill="none" stroke="#facc15" strokeWidth="1.5" />
      <rect x="86" y="24" width="3" height="4" rx="1" fill="#facc15" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={43 + i * 14} y="23.5" width="11" height="4.5" rx="1" fill={i < 2 ? '#4ade80' : '#facc15'} />
      ))}
      <rect x="40" y="33" width="28" height="3" rx="1.5" fill="#4ade80" opacity="0.8" />
      {/* bolt icon */}
      <path d="M 98 20 L 92 29 L 96 29 L 93 36 L 101 26 L 96.5 26 Z" fill="#facc15" />
      {/* sockets */}
      <rect x="34" y="46" width="72" height="34" rx="3" fill={panel} stroke={stroke} strokeWidth="1.25" opacity="0.9" />
      {[0, 1].map((r) =>
        [0, 1].map((c) => (
          <g key={`${r}-${c}`}>
            <rect x={41 + c * 34} y={50 + r * 16} width="24" height="12" rx="2.5" fill={isDark ? '#1c1917' : '#ffffff'} stroke={stroke} strokeWidth="1" />
            <circle cx={49 + c * 34} cy={56 + r * 16} r="1.6" fill={stroke} />
            <circle cx={57 + c * 34} cy={56 + r * 16} r="1.6" fill={stroke} />
          </g>
        )),
      )}
      {/* power button + LEDs */}
      <circle cx="46" cy="88" r="4" fill="none" stroke={stroke} strokeWidth="1.5" />
      <line x1="46" y1="84.5" x2="46" y2="88" stroke={stroke} strokeWidth="1.5" />
      <circle cx="88" cy="88" r="2" fill="#10b981" />
      <circle cx="96" cy="88" r="2" fill="#facc15" />
    </svg>
  );
}

// ─── Rack — server cabinet ───────────────────────────────────────────────────
export function RackVector({ isDark, color = '#64748b' }: VecProps) {
  const frame = isDark ? color + '26' : color + '1f';
  const stroke = color;
  const unit = isDark ? '#0f172a' : '#f8fafc';
  return (
    <svg viewBox="0 0 140 104" width={S.w} height={S.h} preserveAspectRatio="xMidYMid meet">
      {/* cabinet */}
      <rect x="34" y="4" width="72" height="92" rx="4" fill={frame} stroke={stroke} strokeWidth="2" />
      {/* mounting rails */}
      <line x1="42" y1="8" x2="42" y2="92" stroke={stroke} strokeWidth="1" opacity="0.5" strokeDasharray="2 3" />
      <line x1="98" y1="8" x2="98" y2="92" stroke={stroke} strokeWidth="1" opacity="0.5" strokeDasharray="2 3" />
      {/* units: switch, servers, patch panel, blank, UPS */}
      {[
        { y: 9,  h: 11, leds: ['#10b981', '#10b981'], vents: false, ports: true },
        { y: 23, h: 14, leds: ['#10b981', '#f59e0b'], vents: true,  ports: false },
        { y: 40, h: 14, leds: ['#10b981', '#10b981'], vents: true,  ports: false },
        { y: 57, h: 11, leds: [], vents: false, ports: true },
        { y: 71, h: 20, leds: ['#f59e0b'], vents: true, ports: false },
      ].map((u, i) => (
        <g key={i}>
          <rect x="40" y={u.y} width="60" height={u.h} rx="2" fill={unit} stroke={stroke} strokeWidth="1.25" />
          {u.vents && [0, 1, 2, 3, 4, 5].map((v) => (
            <line key={v} x1={48 + v * 7} y1={u.y + 3} x2={48 + v * 7} y2={u.y + u.h - 3} stroke={stroke} strokeWidth="1.25" opacity="0.4" />
          ))}
          {u.ports && [0, 1, 2, 3, 4].map((p) => (
            <rect key={p} x={46 + p * 9} y={u.y + 3.5} width="6" height="4.5" rx="1" fill={stroke} opacity="0.55" />
          ))}
          {u.leds.map((c, li) => (
            <circle key={li} cx={94 - li * 6} cy={u.y + u.h / 2} r="1.8" fill={c} />
          ))}
        </g>
      ))}
      {/* feet / casters */}
      <circle cx="42" cy="99" r="3" fill={stroke} opacity="0.7" />
      <circle cx="98" cy="99" r="3" fill={stroke} opacity="0.7" />
    </svg>
  );
}
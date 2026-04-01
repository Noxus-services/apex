interface MusclesDiagramProps {
  primaryMuscles: string[]
  secondaryMuscles: string[]
  size?: number
}

// Normalise a muscle name to a canonical key
function canonicalize(name: string): string {
  return name.toLowerCase().trim()
}

// Map canonical muscle names to diagram region keys
const MUSCLE_MAP: Record<string, string> = {
  // Chest
  pectorals: 'chest',
  pectoral: 'chest',
  chest: 'chest',
  // Abs
  abs: 'abs',
  abdominals: 'abs',
  core: 'abs',
  obliques: 'abs',
  // Shoulders
  delts: 'shoulders',
  deltoid: 'shoulders',
  shoulders: 'shoulders',
  'front delts': 'shoulders',
  'rear delts': 'shoulders',
  // Biceps
  biceps: 'biceps',
  brachialis: 'biceps',
  brachioradialis: 'biceps',
  // Triceps
  triceps: 'triceps',
  // Quads
  quads: 'quads',
  quadriceps: 'quads',
  // Hamstrings
  hamstrings: 'hamstrings',
  ischio: 'hamstrings',
  // Glutes
  glutes: 'glutes',
  fessiers: 'glutes',
  // Calves
  calves: 'calves',
  mollets: 'calves',
  gastrocnemius: 'calves',
  // Lats / back
  lats: 'back',
  back: 'back',
  dorsaux: 'back',
  rhomboids: 'back',
  erectors: 'back',
  'erector spinae': 'back',
  'hip flexors': 'abs',
  // Traps
  traps: 'traps',
  'trapèzes': 'traps',
  trapezius: 'traps',
  // Forearms
  forearms: 'forearms',
  // Rotator cuff misc
  'rotator cuff': 'shoulders',
}

function resolveRegion(muscle: string): string | null {
  return MUSCLE_MAP[canonicalize(muscle)] ?? null
}

const REGION_LABELS: Record<string, string> = {
  chest: 'Pectoraux',
  abs: 'Abdominaux',
  shoulders: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quadriceps',
  hamstrings: 'Ischio',
  glutes: 'Fessiers',
  calves: 'Mollets',
  back: 'Dorsaux',
  traps: 'Trapèzes',
  forearms: 'Avant-bras',
}

export function MusclesDiagram({ primaryMuscles, secondaryMuscles, size = 220 }: MusclesDiagramProps) {
  const primaryRegions = new Set(primaryMuscles.map(resolveRegion).filter(Boolean) as string[])
  const secondaryRegions = new Set(
    secondaryMuscles
      .map(resolveRegion)
      .filter((r): r is string => r !== null && !primaryRegions.has(r))
  )

  function fill(region: string): string {
    if (primaryRegions.has(region)) return 'rgba(255,68,68,0.85)'
    if (secondaryRegions.has(region)) return 'rgba(255,107,53,0.65)'
    return '#242424'
  }

  function stroke(region: string): string {
    if (primaryRegions.has(region)) return '#ff4444'
    if (secondaryRegions.has(region)) return '#ff6b35'
    return '#3a3a3a'
  }

  // Scale factor based on size (base design at 220px wide, 340px tall)
  const W = size
  const H = Math.round(size * 1.545)
  const sx = W / 220
  const sy = H / 340

  function t(x: number, y: number): string {
    return `${(x * sx).toFixed(1)},${(y * sy).toFixed(1)}`
  }

  // Legend entries to show
  const activePrimary = [...primaryRegions]
  const activeSecondary = [...secondaryRegions]

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ── Head ──────────────────────────────────────────────────── */}
        <ellipse
          cx={`${(110 * sx).toFixed(1)}`}
          cy={`${(22 * sy).toFixed(1)}`}
          rx={`${(16 * sx).toFixed(1)}`}
          ry={`${(18 * sy).toFixed(1)}`}
          fill="#2a2a2a"
          stroke="#3a3a3a"
          strokeWidth="1"
        />
        {/* Neck */}
        <rect
          x={`${(104 * sx).toFixed(1)}`}
          y={`${(38 * sy).toFixed(1)}`}
          width={`${(12 * sx).toFixed(1)}`}
          height={`${(10 * sy).toFixed(1)}`}
          fill="#2a2a2a"
        />

        {/* ── Traps ──────────────────────────────────────────────────── */}
        <path
          d={`M ${t(97,48)} C ${t(82,52)} ${t(72,56)} ${t(70,62)} L ${t(80,62)} C ${t(85,56)} ${t(95,54)} ${t(104,52)} Z`}
          fill={fill('traps')}
          stroke={stroke('traps')}
          strokeWidth="0.8"
        />
        <path
          d={`M ${t(123,48)} C ${t(138,52)} ${t(148,56)} ${t(150,62)} L ${t(140,62)} C ${t(135,56)} ${t(125,54)} ${t(116,52)} Z`}
          fill={fill('traps')}
          stroke={stroke('traps')}
          strokeWidth="0.8"
        />

        {/* ── Shoulders (deltoids) ───────────────────────────────────── */}
        <ellipse
          cx={`${(72 * sx).toFixed(1)}`}
          cy={`${(68 * sy).toFixed(1)}`}
          rx={`${(14 * sx).toFixed(1)}`}
          ry={`${(12 * sy).toFixed(1)}`}
          fill={fill('shoulders')}
          stroke={stroke('shoulders')}
          strokeWidth="0.8"
        />
        <ellipse
          cx={`${(148 * sx).toFixed(1)}`}
          cy={`${(68 * sy).toFixed(1)}`}
          rx={`${(14 * sx).toFixed(1)}`}
          ry={`${(12 * sy).toFixed(1)}`}
          fill={fill('shoulders')}
          stroke={stroke('shoulders')}
          strokeWidth="0.8"
        />

        {/* ── Chest (pectorals) ─────────────────────────────────────── */}
        <path
          d={`M ${t(84,62)} C ${t(84,72)} ${t(88,86)} ${t(100,92)} L ${t(110,88)} L ${t(110,62)} Z`}
          fill={fill('chest')}
          stroke={stroke('chest')}
          strokeWidth="0.8"
        />
        <path
          d={`M ${t(136,62)} C ${t(136,72)} ${t(132,86)} ${t(120,92)} L ${t(110,88)} L ${t(110,62)} Z`}
          fill={fill('chest')}
          stroke={stroke('chest')}
          strokeWidth="0.8"
        />

        {/* ── Torso body outline ────────────────────────────────────── */}
        <path
          d={`M ${t(84,62)} L ${t(80,62)} L ${t(78,130)} L ${t(96,138)} L ${t(110,140)} L ${t(124,138)} L ${t(142,130)} L ${t(140,62)} L ${t(136,62)} L ${t(120,92)} L ${t(110,88)} L ${t(100,92)} Z`}
          fill="none"
          stroke="#3a3a3a"
          strokeWidth="1"
        />

        {/* ── Abs ───────────────────────────────────────────────────── */}
        {/* 3 rows of 2 ab segments */}
        {[0, 1, 2].map(row => (
          <g key={row}>
            <rect
              x={`${(98 * sx).toFixed(1)}`}
              y={`${((94 + row * 14) * sy).toFixed(1)}`}
              width={`${(10 * sx).toFixed(1)}`}
              height={`${(11 * sy).toFixed(1)}`}
              rx={`${(2 * sx).toFixed(1)}`}
              fill={fill('abs')}
              stroke={stroke('abs')}
              strokeWidth="0.8"
            />
            <rect
              x={`${(112 * sx).toFixed(1)}`}
              y={`${((94 + row * 14) * sy).toFixed(1)}`}
              width={`${(10 * sx).toFixed(1)}`}
              height={`${(11 * sy).toFixed(1)}`}
              rx={`${(2 * sx).toFixed(1)}`}
              fill={fill('abs')}
              stroke={stroke('abs')}
              strokeWidth="0.8"
            />
          </g>
        ))}

        {/* ── Back (lats) — visible as side fills ──────────────────── */}
        <path
          d={`M ${t(80,62)} L ${t(78,130)} L ${t(96,138)} L ${t(96,94)} L ${t(85,80)} Z`}
          fill={fill('back')}
          stroke={stroke('back')}
          strokeWidth="0.8"
        />
        <path
          d={`M ${t(140,62)} L ${t(142,130)} L ${t(124,138)} L ${t(124,94)} L ${t(135,80)} Z`}
          fill={fill('back')}
          stroke={stroke('back')}
          strokeWidth="0.8"
        />

        {/* ── Biceps (left arm) ─────────────────────────────────────── */}
        <path
          d={`M ${t(58,80)} C ${t(54,90)} ${t(52,106)} ${t(55,118)} L ${t(65,118)} C ${t(64,106)} ${t(66,90)} ${t(68,80)} Z`}
          fill={fill('biceps')}
          stroke={stroke('biceps')}
          strokeWidth="0.8"
        />
        {/* ── Biceps (right arm) ────────────────────────────────────── */}
        <path
          d={`M ${t(162,80)} C ${t(166,90)} ${t(168,106)} ${t(165,118)} L ${t(155,118)} C ${t(156,106)} ${t(154,90)} ${t(152,80)} Z`}
          fill={fill('biceps')}
          stroke={stroke('biceps')}
          strokeWidth="0.8"
        />

        {/* ── Triceps (left arm — slightly behind, muted) ─────────────── */}
        <path
          d={`M ${t(58,80)} C ${t(50,90)} ${t(48,108)} ${t(52,120)} L ${t(56,120)} C ${t(53,108)} ${t(54,90)} ${t(60,80)} Z`}
          fill={fill('triceps')}
          stroke={stroke('triceps')}
          strokeWidth="0.8"
          opacity="0.7"
        />
        {/* ── Triceps (right arm) ──────────────────────────────────────── */}
        <path
          d={`M ${t(162,80)} C ${t(170,90)} ${t(172,108)} ${t(168,120)} L ${t(164,120)} C ${t(167,108)} ${t(166,90)} ${t(160,80)} Z`}
          fill={fill('triceps')}
          stroke={stroke('triceps')}
          strokeWidth="0.8"
          opacity="0.7"
        />

        {/* ── Forearms (left) ───────────────────────────────────────── */}
        <path
          d={`M ${t(55,118)} C ${t(52,130)} ${t(52,148)} ${t(55,160)} L ${t(63,158)} C ${t(62,146)} ${t(62,130)} ${t(65,118)} Z`}
          fill={fill('forearms')}
          stroke={stroke('forearms')}
          strokeWidth="0.8"
        />
        {/* ── Forearms (right) ──────────────────────────────────────── */}
        <path
          d={`M ${t(165,118)} C ${t(168,130)} ${t(168,148)} ${t(165,160)} L ${t(157,158)} C ${t(158,146)} ${t(158,130)} ${t(155,118)} Z`}
          fill={fill('forearms')}
          stroke={stroke('forearms')}
          strokeWidth="0.8"
        />

        {/* ── Hip / Glutes area ─────────────────────────────────────── */}
        <path
          d={`M ${t(78,130)} L ${t(75,152)} L ${t(96,156)} L ${t(110,154)} L ${t(124,156)} L ${t(145,152)} L ${t(142,130)} L ${t(124,138)} L ${t(110,140)} L ${t(96,138)} Z`}
          fill={fill('glutes')}
          stroke={stroke('glutes')}
          strokeWidth="0.8"
        />

        {/* ── Quads (left leg) ──────────────────────────────────────── */}
        <path
          d={`M ${t(78,152)} C ${t(72,168)} ${t(70,188)} ${t(74,210)} L ${t(90,210)} C ${t(88,188)} ${t(90,168)} ${t(96,156)} Z`}
          fill={fill('quads')}
          stroke={stroke('quads')}
          strokeWidth="0.8"
        />
        {/* ── Quads (right leg) ─────────────────────────────────────── */}
        <path
          d={`M ${t(142,152)} C ${t(148,168)} ${t(150,188)} ${t(146,210)} L ${t(130,210)} C ${t(132,188)} ${t(130,168)} ${t(124,156)} Z`}
          fill={fill('quads')}
          stroke={stroke('quads')}
          strokeWidth="0.8"
        />

        {/* Inner thigh gap */}
        <path
          d={`M ${t(96,156)} C ${t(100,170)} ${t(104,190)} ${t(106,212)} L ${t(114,212)} C ${t(116,190)} ${t(120,170)} ${t(124,156)} L ${t(110,154)} Z`}
          fill={fill('quads')}
          stroke={stroke('quads')}
          strokeWidth="0.8"
        />

        {/* ── Hamstrings — shown behind as darker band ──────────────── */}
        <path
          d={`M ${t(74,152)} C ${t(68,170)} ${t(68,192)} ${t(72,212)} L ${t(80,212)} C ${t(77,192)} ${t(74,170)} ${t(78,152)} Z`}
          fill={fill('hamstrings')}
          stroke={stroke('hamstrings')}
          strokeWidth="0.8"
          opacity="0.55"
        />
        <path
          d={`M ${t(146,152)} C ${t(152,170)} ${t(152,192)} ${t(148,212)} L ${t(140,212)} C ${t(143,192)} ${t(146,170)} ${t(142,152)} Z`}
          fill={fill('hamstrings')}
          stroke={stroke('hamstrings')}
          strokeWidth="0.8"
          opacity="0.55"
        />

        {/* ── Knees ─────────────────────────────────────────────────── */}
        <ellipse
          cx={`${(82 * sx).toFixed(1)}`}
          cy={`${(215 * sy).toFixed(1)}`}
          rx={`${(12 * sx).toFixed(1)}`}
          ry={`${(8 * sy).toFixed(1)}`}
          fill="#2a2a2a"
          stroke="#3a3a3a"
          strokeWidth="0.8"
        />
        <ellipse
          cx={`${(138 * sx).toFixed(1)}`}
          cy={`${(215 * sy).toFixed(1)}`}
          rx={`${(12 * sx).toFixed(1)}`}
          ry={`${(8 * sy).toFixed(1)}`}
          fill="#2a2a2a"
          stroke="#3a3a3a"
          strokeWidth="0.8"
        />

        {/* ── Calves (left) ─────────────────────────────────────────── */}
        <path
          d={`M ${t(72,222)} C ${t(68,238)} ${t(70,256)} ${t(74,272)} L ${t(90,272)} C ${t(92,256)} ${t(94,238)} ${t(90,222)} Z`}
          fill={fill('calves')}
          stroke={stroke('calves')}
          strokeWidth="0.8"
        />
        {/* ── Calves (right) ────────────────────────────────────────── */}
        <path
          d={`M ${t(148,222)} C ${t(152,238)} ${t(150,256)} ${t(146,272)} L ${t(130,272)} C ${t(128,256)} ${t(126,238)} ${t(130,222)} Z`}
          fill={fill('calves')}
          stroke={stroke('calves')}
          strokeWidth="0.8"
        />

        {/* ── Feet ──────────────────────────────────────────────────── */}
        <ellipse
          cx={`${(81 * sx).toFixed(1)}`}
          cy={`${(278 * sy).toFixed(1)}`}
          rx={`${(14 * sx).toFixed(1)}`}
          ry={`${(7 * sy).toFixed(1)}`}
          fill="#2a2a2a"
          stroke="#3a3a3a"
          strokeWidth="0.8"
        />
        <ellipse
          cx={`${(139 * sx).toFixed(1)}`}
          cy={`${(278 * sy).toFixed(1)}`}
          rx={`${(14 * sx).toFixed(1)}`}
          ry={`${(7 * sy).toFixed(1)}`}
          fill="#2a2a2a"
          stroke="#3a3a3a"
          strokeWidth="0.8"
        />
      </svg>

      {/* Legend */}
      {(activePrimary.length > 0 || activeSecondary.length > 0) && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 max-w-xs">
          {activePrimary.map(region => (
            <div key={region} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(255,68,68,0.85)' }}
              />
              <span className="text-xs text-[rgba(240,237,230,0.7)]">
                {REGION_LABELS[region] ?? region}
              </span>
            </div>
          ))}
          {activeSecondary.map(region => (
            <div key={region} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(255,107,53,0.65)' }}
              />
              <span className="text-xs text-[rgba(240,237,230,0.45)]">
                {REGION_LABELS[region] ?? region}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

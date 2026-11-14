import { TRAIL_POINTS } from '../lib/trailPoints'
import type { Progress } from '../lib/rules'

const project = (lon: number, lat: number): [number, number] => [95 + (lon - 34.75) * 175, 24 + (33.32 - lat) * 200]
const XY = TRAIL_POINTS.map(([, lo, la]) => project(lo, la))
const LABELS = new Set([0, 2, 6, 8, 13, 19, 22, 26, 31, 34, 42, 46, 56])

/** פס של 56 משבצות: מבט מהיר על ההתקדמות. */
export function TrailStrip({ progress, next = [] }: { progress: Progress; next?: number[] }) {
  const cells = Array.from({ length: 56 }, (_, i) => i + 1)
  return (
    <div role="img" aria-label={`${progress.completedSegments} מקטעים הושלמו ו־${progress.startedSegments} התחילו מתוך 56`} className="grid grid-cols-[repeat(28,minmax(0,1fr))] gap-[2px]">
      {cells.map((n) => {
        const st = progress.segmentState.get(n)
        const frac = progress.partialFraction.get(n) ?? 0
        const style =
          st === 'completed'
            ? { background: 'var(--color-accent)' }
            : st === 'partial'
              ? { background: `linear-gradient(to left, var(--color-accent) 0 ${frac * 100}%, var(--color-line) ${frac * 100}% 100%)` }
              : next.includes(n)
                ? { background: 'var(--color-card)', border: '1.5px solid var(--color-accent)' }
                : { background: 'var(--color-line)' }
        return <span key={n} className="box-border h-3.5 rounded-[2px]" style={style} />
      })}
    </div>
  )
}

/** מפה סכמטית של השביל; לחיצה על מקטע בוחרת אותו. */
export function TrailMap({
  progress, next = [], selected, onSelect,
}: { progress: Progress; next?: number[]; selected: number | null; onSelect: (n: number) => void }) {
  let here: [number, number] | null = null
  const lines = XY.slice(0, 56).map((a, i) => {
    const n = i + 1
    const b = XY[i + 1]
    const st = progress.segmentState.get(n)
    const frac = st === 'completed' ? 1 : st === 'partial' ? progress.partialFraction.get(n) ?? 0.4 : 0
    const mid: [number, number] = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]
    if (frac > 0) here = mid
    return { n, a, b, frac, mid }
  })
  return (
    <svg viewBox="0 0 390 800" className="block h-auto w-full" role="group" aria-label="מפה סכמטית של שביל ישראל">
      {lines.map(({ n, a, b }) => (
        <path key={`b${n}`} d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`} stroke={selected === n ? 'var(--color-primary)' : 'var(--color-track)'} strokeWidth={selected === n ? 6 : 4} strokeLinecap="round" />
      ))}
      {lines.filter((l) => next.includes(l.n)).map(({ n, a, b }) => (
        <path key={`n${n}`} d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`} stroke="var(--color-accent)" strokeWidth={4} strokeDasharray="2 5" strokeLinecap="round" />
      ))}
      {lines.filter((l) => l.frac > 0).map(({ n, a, mid }) => (
        <path key={`d${n}`} d={`M${a[0]} ${a[1]}L${mid[0]} ${mid[1]}`} stroke="var(--color-accent)" strokeWidth={7} strokeLinecap="round" />
      ))}
      {TRAIL_POINTS.map(([name, lo], i) => {
        if (!LABELS.has(i)) return null
        const [x, y] = XY[i]
        const west = lo < 35.0
        return (
          <g key={name}>
            <circle cx={x} cy={y} r={3} fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth={1.5} />
            <text x={west ? x - 9 : x + 9} y={y + 4} textAnchor={west ? 'end' : 'start'} fontSize={12} fill="var(--color-ink)">{name}</text>
          </g>
        )
      })}
      {here && (
        <g aria-hidden="true">
          <circle cx={here[0]} cy={here[1]} r={13} fill="var(--color-accent)" opacity={0.2} />
          <circle cx={here[0]} cy={here[1]} r={6} fill="var(--color-accent)" stroke="var(--color-card)" strokeWidth={2} />
        </g>
      )}
      {/* אזורי לחיצה רחבים, אחד לכל מקטע */}
      {lines.map(({ n, a, b }) => (
        <path
          key={`h${n}`}
          d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`}
          stroke="transparent"
          strokeWidth={22}
          strokeLinecap="round"
          role="button"
          tabIndex={0}
          aria-label={`מקטע ${n}`}
          style={{ cursor: 'pointer', outline: 'none' }}
          onClick={() => onSelect(n)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n) } }}
        />
      ))}
    </svg>
  )
}

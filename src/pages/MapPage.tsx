import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../lib/data'
import { fmt } from '../lib/rules'
import { Layout, Spinner } from '../components/ui'
import { TrailMap } from '../components/Trail'
import { AmbassadorBox } from '../components/Ambassador'
import { upcomingTrips } from './Home'

export default function MapPage() {
  const { data, progress, daysOf, segment } = useApp()
  const [sel, setSel] = useState<number | null>(null)
  if (!data || !progress) return <Layout><Spinner /></Layout>

  const next = upcomingTrips(data.trips).find((t) => t.kind !== 'reserve')
  const nextSegs = next ? daysOf(next.id).map((d) => d.segment_number).filter((n): n is number => n != null) : []
  const first = [...progress.segmentState.keys()][0] ?? null
  const current = sel ?? first
  const seg = segment(current)
  const segDays = data.days.filter((d) => d.segment_number === current)
  const st = current != null ? progress.segmentState.get(current) : undefined
  const frac = st === 'completed' ? 1 : current != null ? progress.partialFraction.get(current) ?? 0 : 0
  const walkedDays = segDays.filter((d) => d.completion !== 'none')
  const plannedTrips = [...new Set(segDays.filter((d) => d.completion === 'none').map((d) => d.trip_id))]
    .map((id) => data.trips.find((t) => t.id === id)!)
    .filter((t) => t && t.status !== 'cancelled')

  return (
    <Layout>
      <header className="flex flex-col gap-3.5 px-5 pt-5 pb-2">
        <h1 className="font-display text-[24px] font-bold">כמה התקדמנו</h1>
        <div className="flex items-end gap-5">
          <div><div className="font-display text-[40px] leading-none font-bold text-acctext">{progress.walkedKm}</div><div className="mt-1 text-[13px] text-muted">ק״מ על השביל</div></div>
          <div><div className="font-display text-[26px] leading-none font-bold">{progress.completedSegments} / 56</div><div className="mt-1 text-[13px] text-muted">מקטעים שלמים</div></div>
          <div><div className="font-display text-[26px] leading-none font-bold">{progress.startedSegments}</div><div className="mt-1 text-[13px] text-muted">התחלנו</div></div>
        </div>
        <ul aria-label="מקרא" className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-[22px] rounded bg-accent" />נהלך</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1 w-[22px] rounded bg-track" />לפנינו</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="w-[22px] border-t-4 border-dotted border-accent" />הטיול הבא</li>
        </ul>
        <p className="text-[13px] text-muted">לוחצים על מקטע כדי לראות אותו.</p>
      </header>

      <div className="border-y border-line bg-card">
        <TrailMap progress={progress} next={nextSegs} selected={current} onSelect={setSel} />
      </div>

      {seg && (
        <section aria-label="המקטע שנבחר" className="px-5 pt-4">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card px-[18px] py-4">
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-primary px-2.5 py-1 font-display text-[15px] font-bold text-onp">{seg.number}</span>
              <div className="flex flex-col">
                <span className="font-display text-[17px] font-semibold">{seg.start_name} ← {seg.end_name}</span>
                <span className="text-[13px] text-muted">{seg.region}{seg.official_km ? ` · ${seg.official_km} ק״מ` : ''}</span>
              </div>
            </div>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded bg-line"><div className="h-full bg-accent" style={{ width: `${frac * 100}%` }} /></div>
            <p className="text-[15px] leading-relaxed">
              {walkedDays.length
                ? walkedDays.map((d) => `${st === 'completed' ? 'הושלם' : `נהלכו ${d.completed_km ?? ''} ק״מ`}${d.date ? ` ב־${fmt.dm(d.date)}` : ''}`).join(' · ')
                : 'עוד לא הלכנו כאן.'}
              {plannedTrips.length > 0 && ` ${walkedDays.length ? 'את השאר נשלים' : 'מתוכנן'}: ${plannedTrips.map((t) => (t.start_date ? fmt.range(t.start_date, t.end_date) : 'תאריך בקרוב')).join(', ')}.`}
            </p>
            {plannedTrips[0] && <Link to={`/trip/${plannedTrips[0].id}`} className="inline-flex min-h-11 items-center self-start rounded-xl border border-line px-4 text-[15px] font-medium no-underline">לטיול של המקטע</Link>}
          </div>
          <div className="mt-3"><AmbassadorBox segment={seg.number} /></div>
        </section>
      )}
    </Layout>
  )
}

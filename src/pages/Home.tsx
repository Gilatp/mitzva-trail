import { Link } from 'react-router-dom'
import { useApp } from '../lib/data'
import { closesLabel, daysUntil, fmt, registrationOpen, tripDistance } from '../lib/rules'
import { Card, DesertBand, Icon, Layout, Pending, SectionTitle, Spinner, TopBar, btn } from '../components/ui'
import { TrailStrip } from '../components/Trail'
import type { Trip } from '../lib/types'

export function upcomingTrips(trips: Trip[]) {
  const today = new Date().toISOString().slice(0, 10)
  return trips
    .filter((t) => t.status === 'planned' && t.kind !== 'blocked' && t.start_date && (t.end_date ?? t.start_date) >= today)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))
}

export default function Home() {
  const { data, me, progress, daysOf, session } = useApp()
  if (!data || !progress) return <Layout><TopBar /><Spinner /></Layout>

  const upcoming = upcomingTrips(data.trips).filter((t) => t.kind !== 'reserve')
  const next = upcoming[0]
  const later = upcoming.slice(1, 4)
  const waiting = data.trips.filter((t) => t.status === 'to_reschedule')
  const myReg = next && data.registrations.find((r) => r.trip_id === next.id && r.user_id === session?.user.id && r.status === 'active')
  const nextDays = next ? daysOf(next.id) : []
  const nextSegs = nextDays.map((d) => d.segment_number).filter((n): n is number => n != null)
  const youngDay = nextDays.find((d) => d.young_enabled)
  const fullKm = next ? tripDistance(next, nextDays) : null
  const open = next ? registrationOpen(next) : false
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'

  return (
    <Layout>
      <TopBar />
      <section className="px-5 pt-3">
        <p className="text-[15px] text-muted">{greeting}{me?.family_name ? `, משפחת ${me.family_name}` : ''}</p>
        {next ? (
          <>
            <h1 className="mt-1 mb-4 font-display text-[26px] leading-tight font-bold">
              {daysUntil(next.start_date!) <= 0 ? 'הטיול יוצא היום' : `הטיול הבא בעוד ${daysUntil(next.start_date!)} ימים`}
            </h1>
            <article className="overflow-hidden rounded-[20px] border border-line bg-card shadow-[0_1px_2px_rgba(20,30,40,0.05)]">
              <Link to={`/trip/${next.id}`} className="block no-underline">
                <DesertBand height={120}>
                  <div className="absolute top-3 right-3 rounded-xl bg-card px-3 py-1.5 text-center">
                    <div className="font-display text-[18px] leading-tight font-bold">{fmt.range(next.start_date, next.end_date)}</div>
                    <div className="text-[12px] text-muted">{fmt.weekdays(next.start_date, next.end_date)}</div>
                  </div>
                </DesertBand>
                <div className="flex flex-col gap-1 px-[18px] pt-4 pb-1">
                  <h2 className="font-display text-[21px] font-bold">{next.title}</h2>
                  <p className="text-[14px] text-muted">
                    {[next.region, nextSegs.length ? `מקטעים ${[...new Set(nextSegs)].join('–')}` : '', next.drive_time ? `${next.drive_time} נסיעה` : ''].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
              <div className="flex flex-col gap-2 px-[18px] pt-3 text-[14px]">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    <b>{youngDay ? 'השביל המלא' : 'המסלול'}</b>
                    {nextDays[0]?.main_participants ? ` · ${nextDays[0].main_participants}` : ''} · {fullKm != null ? `${fullKm} ק״מ` : <>מרחק <Pending /></>}
                  </span>
                </div>
                {youngDay && (
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    <span><b>השביל הצעיר</b>{youngDay.young_km ? ` · ${youngDay.young_km} ק״מ ביום` : ''}{youngDay.young_difficulty ? ` · ${youngDay.young_difficulty}` : ''}</span>
                  </div>
                )}
              </div>
              <div className="mx-[18px] mt-3.5 flex justify-between gap-2 rounded-xl bg-soft px-3 py-2.5 text-[14px]">
                <span>{myReg ? 'נרשמתם ✓' : open ? 'עוד לא נרשמתם' : 'ההרשמה סגורה'}</span>
                {open && <span className="text-muted">ההרשמה עד {closesLabel(next)}</span>}
              </div>
              <div className="flex gap-2.5 px-[18px] pt-3.5 pb-[18px]">
                {open && (
                  <Link to={`/trip/${next.id}/register`} className={`${btn.primary} flex-1`}>
                    {myReg ? 'עדכון ההרשמה' : 'להרשמה'}
                  </Link>
                )}
                <Link to={`/trip/${next.id}`} className={`${btn.secondary} ${open ? '' : 'flex-1'}`}>כל הפרטים</Link>
              </div>
            </article>
          </>
        ) : (
          <h1 className="mt-1 mb-4 font-display text-[24px] font-bold">אין כרגע טיול מתוכנן</h1>
        )}
      </section>

      <section className="px-5 pt-6">
        <Link to="/map" className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card px-[18px] py-4 no-underline">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[16px] font-semibold">איפה אנחנו על השביל</span>
            <span className="text-[14px] font-medium text-primary">למפה</span>
          </div>
          <TrailStrip progress={progress} next={nextSegs} />
          <span className="text-[14px] text-muted">
            {progress.walkedKm} ק״מ נהלכו · {progress.completedSegments} מקטעים הושלמו
            {progress.startedSegments ? ` · ${progress.startedSegments} התחילו` : ''}
          </span>
        </Link>
      </section>

      {later.length > 0 && (
        <section className="px-5 pt-6">
          <SectionTitle>בהמשך</SectionTitle>
          <Card>
            {later.map((t, i) => {
              const ds = daysOf(t.id)
              const segs = [...new Set(ds.map((d) => d.segment_number).filter(Boolean))]
              const km = tripDistance(t, ds)
              return (
                <Link key={t.id} to={`/trip/${t.id}`} className={`flex min-h-11 items-center gap-3 px-4 py-3.5 no-underline ${i ? 'border-t border-line' : ''}`}>
                  <div className="w-[50px] shrink-0 text-center">
                    <div className="font-display text-[16px] font-bold">{Number(t.start_date!.slice(8))}</div>
                    <div className="text-[12px] text-muted">{fmt.monthShort(t.start_date!)}</div>
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-medium">{t.title}</span>
                    <span className="text-[13px] text-muted">
                      {[segs.length ? `מקטע${segs.length > 1 ? 'ים' : ''} ${segs.join('–')}` : '', km != null ? `${km} ק״מ` : '', ds.length > 1 ? `${ds.length} ימים` : 'יום אחד'].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <Icon name="chevron" size={18} className="text-track" />
                </Link>
              )
            })}
          </Card>
          <Link to="/trips" className="mt-2.5 inline-block text-[14px] font-medium text-primary">ללוח הזמנים המלא</Link>
          {waiting.length > 0 && (
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{waiting.length} טיולים מחכים לתאריך חדש.</p>
          )}
        </section>
      )}
    </Layout>
  )
}

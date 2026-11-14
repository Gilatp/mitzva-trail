import { Link } from 'react-router-dom'
import { useApp } from '../lib/data'
import { fmt, tripDistance } from '../lib/rules'
import type { Trip } from '../lib/types'
import { Layout, SectionTitle, Spinner, TopBar } from '../components/ui'

export default function Trips() {
  const { data, daysOf, session } = useApp()
  if (!data) return <Layout><TopBar /><Spinner /></Layout>
  const today = new Date().toISOString().slice(0, 10)
  const dated = data.trips.filter((t) => t.start_date && t.status !== 'to_reschedule').sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))
  const future = dated.filter((t) => (t.end_date ?? t.start_date)! >= today)
  const past = dated.filter((t) => (t.end_date ?? t.start_date)! < today).reverse()
  const waiting = data.trips.filter((t) => t.status === 'to_reschedule')

  const byMonth = new Map<string, Trip[]>()
  for (const t of future) {
    const k = fmt.monthYear(t.start_date!)
    byMonth.set(k, [...(byMonth.get(k) ?? []), t])
  }

  const row = (t: Trip) => {
    const ds = daysOf(t.id)
    const segs = [...new Set(ds.map((d) => d.segment_number).filter(Boolean))]
    const km = tripDistance(t, ds)
    const mine = data.registrations.some((r) => r.trip_id === t.id && r.user_id === session?.user.id && r.status === 'active')
    const tag = t.kind === 'reserve' ? 'רזרבה' : t.kind === 'blocked' ? 'לא בארץ' : t.kind === 'mitzvah' ? 'יום מצווה' : t.status === 'completed' ? 'הושלם' : t.status === 'cancelled' ? 'בוטל' : mine ? 'נרשמתם' : ''
    const inner = (
      <>
        <div className="w-[64px] shrink-0 text-center font-display text-[15px] font-bold">{t.start_date ? fmt.range(t.start_date, t.end_date) : '—'}</div>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-medium">{t.title}</span>
          <span className="text-[13px] text-muted">{[segs.length ? `מקטעים ${segs.join('–')}` : '', km != null ? `${km} ק״מ` : '', t.region].filter(Boolean).join(' · ')}</span>
        </div>
        {tag && <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${mine ? 'bg-primary text-onp' : 'border border-line text-muted'}`}>{tag}</span>}
      </>
    )
    const cls = 'flex min-h-11 items-center gap-3 border-t border-line px-4 py-3 no-underline first:border-t-0'
    return t.kind === 'blocked' ? <div key={t.id} className={cls}>{inner}</div> : <Link key={t.id} to={`/trip/${t.id}`} className={cls}>{inner}</Link>
  }

  return (
    <Layout>
      <TopBar />
      <h1 className="px-5 pt-3 pb-1 font-display text-[24px] font-bold">כל הטיולים</h1>
      {[...byMonth].map(([month, ts]) => (
        <section key={month} className="px-5 pt-5">
          <SectionTitle>{month}</SectionTitle>
          <div className="rounded-2xl border border-line bg-card">{ts.map(row)}</div>
        </section>
      ))}
      {waiting.length > 0 && (
        <section className="px-5 pt-7">
          <SectionTitle>מחכים לתאריך חדש</SectionTitle>
          <div className="rounded-2xl border border-dashed border-line bg-card">{waiting.map(row)}</div>
        </section>
      )}
      {past.length > 0 && (
        <section className="px-5 pt-7">
          <SectionTitle>מאחורינו</SectionTitle>
          <div className="rounded-2xl border border-line bg-card">{past.map(row)}</div>
        </section>
      )}
    </Layout>
  )
}

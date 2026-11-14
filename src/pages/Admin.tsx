import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/data'
import { fmt } from '../lib/rules'
import type { Trip } from '../lib/types'
import { Card, Layout, SectionTitle, Spinner, btn } from '../components/ui'

type Tab = 'trips' | 'people' | 'regs' | 'amb'

function addDays(date: string, n: number) {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const diffDays = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** הזזת טיול: כל ימי ההליכה זזים איתו. */
function TripEditor({ trip, onDone }: { trip: Trip; onDone: () => void }) {
  const { data, daysOf, reload } = useApp()
  const [start, setStart] = useState(trip.start_date ?? '')
  const [status, setStatus] = useState(trip.status)
  const [dateStatus, setDateStatus] = useState(trip.date_status)
  const [busy, setBusy] = useState(false)
  const days = daysOf(trip.id)
  const length = trip.start_date && trip.end_date ? diffDays(trip.start_date, trip.end_date) : Math.max(days.length - 1, 0)
  const end = start ? addDays(start, length) : ''

  // אזהרות לפני שמירה
  const warnings: string[] = []
  if (start) {
    for (const o of data!.trips) {
      if (o.id === trip.id || !o.start_date || o.status === 'cancelled' || o.status === 'to_reschedule') continue
      const oEnd = o.end_date ?? o.start_date
      if (start <= oEnd && end >= o.start_date) warnings.push(o.kind === 'blocked' ? `נופל על "${o.title}"` : `חופף לטיול "${o.title}" (${fmt.range(o.start_date, o.end_date)})`)
    }
    for (const p of data!.settings?.blocked_periods ?? []) if (start <= p.to && end >= p.from) warnings.push(`נופל על ${p.label}`)
  }
  const regCount = data!.registrations.filter((r) => r.trip_id === trip.id && r.status === 'active').length

  async function save() {
    setBusy(true)
    const shift = trip.start_date && start ? diffDays(trip.start_date, start) : 0
    await supabase.from('trips').update({ start_date: start || null, end_date: end || null, status, date_status: dateStatus }).eq('id', trip.id)
    if (start) {
      for (const d of days) {
        const nd = d.date && shift ? addDays(d.date, shift) : !d.date ? addDays(start, d.day_number - 1) : d.date
        if (nd !== d.date) await supabase.from('trip_days').update({ date: nd }).eq('id', d.id)
      }
    }
    await reload()
    setBusy(false)
    onDone()
  }

  const msg = start
    ? `עדכון בטיול "${trip.title}": התאריך החדש הוא ${fmt.weekdays(start, end)} ${fmt.range(start, end)}${dateStatus === 'proposed' ? ' (עוד לא סופי)' : ''}. כל הפרטים באתר: ${location.origin}/trip/${trip.id}`
    : ''

  return (
    <div className="flex flex-col gap-3 border-t border-line bg-bg px-4 py-4">
      <label className="flex flex-col gap-1 text-[14px] font-medium">תאריך יציאה
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="min-h-12 rounded-xl border border-line bg-card px-3 text-[16px]" />
      </label>
      {start && length > 0 && <p className="text-[14px] text-muted">עד {fmt.weekdayLong(end)} {fmt.dm(end)} · {days.length} ימי הליכה זזים יחד</p>}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[14px] font-medium">סטטוס
          <select value={status} onChange={(e) => setStatus(e.target.value as Trip['status'])} className="min-h-12 rounded-xl border border-line bg-card px-3 text-[15px]">
            <option value="planned">מתוכנן</option><option value="to_reschedule">מחכה לתאריך</option><option value="completed">הושלם</option><option value="cancelled">בוטל</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[14px] font-medium">התאריך
          <select value={dateStatus} onChange={(e) => setDateStatus(e.target.value as Trip['date_status'])} className="min-h-12 rounded-xl border border-line bg-card px-3 text-[15px]">
            <option value="confirmed">מאושר</option><option value="proposed">מוצע</option>
          </select>
        </label>
      </div>
      {warnings.map((w) => <p key={w} role="alert" className="rounded-xl bg-warnbg px-3 py-2 text-[14px] text-warn">{w}</p>)}
      {regCount > 0 && start !== trip.start_date && <p className="text-[14px] text-muted">{regCount} משפחות רשומות יקבלו עדכון.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={busy} className={btn.primary}>שמירה</button>
        <button type="button" onClick={onDone} className={btn.secondary}>ביטול</button>
        {msg && <button type="button" onClick={() => navigator.clipboard.writeText(msg)} className={btn.secondary}>העתקת הודעה ל־WhatsApp</button>}
      </div>
    </div>
  )
}

export default function Admin() {
  const { data, me, reload, profile, daysOf } = useApp()
  const [tab, setTab] = useState<Tab>('trips')
  const [editing, setEditing] = useState<string | null>(null)
  const [emails, setEmails] = useState('')
  const [invites, setInvites] = useState<{ email: string; role: string; invited_at: string }[] | null>(null)
  async function loadInvites() {
    const { data } = await supabase.from('invitations').select('email, role, invited_at').order('invited_at', { ascending: false })
    setInvites(data ?? [])
  }
  useEffect(() => { if (tab === 'people' && invites === null) loadInvites() }, [tab, invites])
  if (!data || !me) return <Layout><Spinner /></Layout>
  if (me.role !== 'admin') return <Navigate to="/" replace />

  async function invite() {
    const list = emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /.+@.+\..+/.test(e))
    if (!list.length) return
    await supabase.from('invitations').upsert(list.map((email) => ({ email, role: 'member' })), { onConflict: 'email', ignoreDuplicates: true })
    setEmails('')
    loadInvites()
  }
  async function uninvite(email: string) {
    await supabase.from('invitations').delete().eq('email', email)
    loadInvites()
  }

  const today = new Date().toISOString().slice(0, 10)
  const trips = [...data.trips].sort((a, b) => ((a.start_date ?? '9') < (b.start_date ?? '9') ? -1 : 1))
  const missing = data.days.filter((d) => {
    const t = data.trips.find((x) => x.id === d.trip_id)
    return t?.status === 'planned' && (d.distance_km == null || !d.difficulty || (d.shuttle_required == null && d.route_type !== 'circular'))
  }).length

  const tabBtn = (k: Tab, label: string) => (
    <button type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`min-h-11 rounded-xl px-3 text-[14px] font-semibold ${tab === k ? 'bg-primary text-onp' : 'text-muted'}`}>{label}</button>
  )

  return (
    <Layout>
      <header className="flex items-center justify-between px-5 pt-5">
        <h1 className="font-display text-[24px] font-bold">ניהול</h1>
        <Link to="/me" className="text-[14px] text-primary">חזרה</Link>
      </header>
      <div role="group" aria-label="אזורי ניהול" className="mx-5 mt-4 flex flex-wrap gap-1 rounded-2xl border border-line bg-card p-1">
        {tabBtn('trips', 'טיולים ותאריכים')}{tabBtn('regs', 'הרשמות')}{tabBtn('people', 'מוזמנים')}{tabBtn('amb', 'שגרירים')}
      </div>

      {tab === 'trips' && (
        <section className="px-5 pt-5">
          <p className="mb-3 rounded-xl bg-warnbg px-3 py-2 text-[14px] text-warn">{missing} ימי הליכה מתוכננים עוד חסרים מרחק, קושי או החלטה על הקפצה.</p>
          <Card>
            {trips.map((t, i) => (
              <div key={t.id} className={i ? 'border-t border-line' : ''}>
                <button type="button" onClick={() => setEditing(editing === t.id ? null : t.id)} aria-expanded={editing === t.id} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-right">
                  <span className={`w-[70px] shrink-0 font-display text-[14px] font-bold ${t.start_date && t.start_date < today && t.status === 'to_reschedule' ? 'text-warn line-through' : ''}`}>{t.start_date ? fmt.range(t.start_date, t.end_date) : '—'}</span>
                  <span className="flex-1 text-[15px]">{t.title}</span>
                  <span className="text-[12px] text-muted">{{ planned: t.date_status === 'proposed' ? 'מוצע' : '', to_reschedule: 'מחכה', completed: 'הושלם', cancelled: 'בוטל' }[t.status]}</span>
                </button>
                {editing === t.id && <TripEditor trip={t} onDone={() => setEditing(null)} />}
              </div>
            ))}
          </Card>
          <p className="mt-3 text-[13px] text-muted">עריכת פרטי הימים (מרחק, הקפצה, שביל צעיר) תיכנס בשלב הבא. עד אז אפשר לערוך ב־Supabase ← Table Editor ← trip_days.</p>
        </section>
      )}

      {tab === 'regs' && (
        <section className="flex flex-col gap-4 px-5 pt-5">
          {trips.filter((t) => t.status === 'planned' && (t.end_date ?? t.start_date ?? '') >= today).map((t) => {
            const regs = data.registrations.filter((r) => r.trip_id === t.id && r.status === 'active')
            const ds = daysOf(t.id)
            const seats = regs.reduce((s, r) => s + (r.arriving_by_car ? r.car_seats : 0), 0)
            const cars = regs.filter((r) => r.arriving_by_car).length
            return (
              <Card key={t.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="text-[15px]">{t.title}</b>
                  <span className="text-[13px] text-muted">{fmt.range(t.start_date, t.end_date)}</span>
                </div>
                {regs.length ? (
                  <>
                    <p className="mt-1 text-[14px] text-muted">
                      {regs.length} משפחות · {regs.reduce((s, r) => s + r.adults + r.children, 0)} משתתפים · {cars} רכבים, {seats} מקומות פנויים
                    </p>
                    {ds.length > 1 && <p className="text-[14px] text-muted">{ds.map((d) => `${d.date ? fmt.weekdayLong(d.date) : 'יום ' + d.day_number}: ${regs.filter((r) => r.day_ids.includes(d.id)).reduce((s, r) => s + r.adults + r.children, 0)}`).join(' · ')}</p>}
                    <ul className="mt-2 flex flex-col gap-1 text-[14px]">
                      {regs.map((r) => <li key={r.id}>משפחת {profile(r.user_id)?.family_name || '—'} · {r.adults}+{r.children} · {r.full_count} בשביל המלא{r.arriving_by_car ? ` · רכב (${r.car_seats} מקומות)` : ''}</li>)}
                    </ul>
                  </>
                ) : <p className="mt-1 text-[14px] text-muted">אין נרשמים.</p>}
              </Card>
            )
          })}
        </section>
      )}

      {tab === 'people' && (
        <section className="px-5 pt-5">
          <SectionTitle>הזמנת משפחות</SectionTitle>
          <label htmlFor="emails" className="text-[14px] text-muted">מיילים, מופרדים בפסיק או בשורות. ההזמנה מאפשרת להם להיכנס עם המייל הזה.</label>
          <textarea id="emails" dir="ltr" rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-card p-3 text-[15px]" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={invite} className={btn.primary}>הוספה לרשימה</button>
            <button type="button" onClick={() => navigator.clipboard.writeText(`הוזמנתם להצטרף אלינו ל"שביל המצווה". נכנסים כאן עם המייל שלכם: ${location.origin}`)} className={btn.secondary}>העתקת הודעת הזמנה</button>
          </div>
          <div className="mt-5">
            <SectionTitle>ברשימה ({invites?.length ?? '…'})</SectionTitle>
            <Card>
              {(invites ?? []).map((i, idx) => {
                return (
                  <div key={i.email} className={`flex min-h-11 items-center gap-3 px-4 py-2 ${idx ? 'border-t border-line' : ''}`}>
                    <span dir="ltr" className="flex-1 text-left text-[14px]">{i.email}</span>
                    {i.role === 'admin' && <span className="text-[12px] text-muted">מנהל/ת</span>}
                    {i.role !== 'admin' && <button type="button" onClick={() => uninvite(i.email)} className="min-h-11 px-2 text-[13px] text-acctext">הסרה</button>}
                  </div>
                )
              })}
            </Card>
          </div>
        </section>
      )}

      {tab === 'amb' && (
        <section className="px-5 pt-5">
          <Card>
            {data.ambassadors.length ? data.ambassadors.map((a, i) => (
              <div key={a.id} className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
                <div className="flex flex-1 flex-col">
                  <span className="text-[15px]">מקטע {a.segment_number} · משפחת {profile(a.user_id)?.family_name || '—'}</span>
                  {a.plan && <span className="text-[13px] text-muted">{a.plan}</span>}
                </div>
                {a.status === 'pending'
                  ? <button type="button" onClick={async () => { await supabase.from('ambassadors').update({ status: 'approved' }).eq('id', a.id); reload() }} className={btn.quiet}>אישור</button>
                  : <span className="text-[13px] text-primary">מאושר</span>}
              </div>
            )) : <p className="px-4 py-3 text-[15px] text-muted">עוד אין מתנדבים.</p>}
          </Card>
        </section>
      )}
    </Layout>
  )
}

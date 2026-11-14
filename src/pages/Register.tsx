import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/data'
import { closesLabel, fmt, registrationOpen } from '../lib/rules'
import { Icon, Spinner, btn } from '../components/ui'
import type { Registration } from '../lib/types'

function Stepper({ label, sub, value, min = 0, max = 30, onChange }: { label: string; sub?: string; value: number; min?: number; max?: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5">
      <div className="flex flex-1 flex-col">
        <span className="text-[15px] font-medium">{label}</span>
        {sub && <span className="text-[13px] text-muted">{sub}</span>}
      </div>
      <button type="button" aria-label={`פחות: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="h-11 w-11 rounded-full border border-line bg-bg text-[20px] disabled:opacity-40">−</button>
      <span aria-live="polite" className="w-8 text-center font-display text-[18px] font-bold">{value}</span>
      <button type="button" aria-label={`יותר: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="h-11 w-11 rounded-full border border-line bg-bg text-[20px] disabled:opacity-40">+</button>
    </div>
  )
}

export default function Register() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, me, session, daysOf, reload } = useApp()
  const trip = data?.trips.find((t) => t.id === id)
  const existing = data?.registrations.find((r) => r.trip_id === id && r.user_id === session?.user.id) as Registration | undefined
  const days = trip ? daysOf(trip.id) : []
  const hasYoung = days.some((d) => d.young_enabled)

  const [dayIds, setDayIds] = useState<string[] | null>(null)
  const [adults, setAdults] = useState<number | null>(null)
  const [children, setChildren] = useState<number | null>(null)
  const [full, setFull] = useState<number | null>(null)
  const [car, setCar] = useState<boolean | null>(null)
  const [seats, setSeats] = useState<number | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'saved' | 'cancelled' | null>(null)
  const [err, setErr] = useState('')

  if (!data || !trip) return <Spinner />

  const active = existing?.status === 'active' ? existing : undefined
  const v = {
    dayIds: dayIds ?? (active ? active.day_ids : days.map((d) => d.id)),
    adults: adults ?? active?.adults ?? me?.adults ?? 2,
    children: children ?? active?.children ?? me?.children_ages.length ?? 0,
    car: car ?? active?.arriving_by_car ?? true,
    seats: seats ?? active?.car_seats ?? 0,
  }
  const total = v.adults + v.children
  const fullCount = Math.min(full ?? active?.full_count ?? Math.min(2, total), total)
  const young = total - fullCount
  const open = registrationOpen(trip)
  const canSubmit = open && consent && v.dayIds.length > 0 && total > 0 && !busy

  const dayWord =
    v.dayIds.length === days.length ? (days.length > 1 ? 'כל הימים' : '') : days.filter((d) => v.dayIds.includes(d.id)).map((d) => (d.date ? fmt.weekdayLong(d.date) : `יום ${d.day_number}`)).join(', ')
  const summary = [`${total} משתתפים`, dayWord, hasYoung ? `${fullCount} בשביל המלא, ${young} בצעיר` : ''].filter(Boolean).join(' · ')

  async function submit() {
    if (!session || !trip) return
    setBusy(true)
    setErr('')
    const row = {
      trip_id: trip.id, user_id: session.user.id, day_ids: v.dayIds, adults: v.adults, children: v.children,
      full_count: hasYoung ? fullCount : total, arriving_by_car: v.car, car_seats: v.car ? v.seats : 0, consent: true, status: 'active',
    }
    const { error } = existing
      ? await supabase.from('registrations').update(row).eq('id', existing.id)
      : await supabase.from('registrations').insert(row)
    setBusy(false)
    if (error) return setErr('לא הצלחנו לשמור. ייתכן שההרשמה כבר נסגרה.')
    await reload()
    setDone('saved')
  }

  async function cancel() {
    if (!existing) return
    setBusy(true)
    const { error } = await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', existing.id)
    setBusy(false)
    if (error) return setErr('לא הצלחנו לבטל. נסו שוב או כתבו למארגנים.')
    await reload()
    setDone('cancelled')
  }

  const header = (
    <header className="flex items-center gap-3 border-b border-line bg-card px-4 pt-3.5 pb-3">
      <Link to={`/trip/${trip.id}`} aria-label="סגירה" className="flex h-11 w-11 items-center justify-center rounded-full text-ink"><Icon name="x" /></Link>
      <div className="flex flex-col">
        <span className="font-display text-[17px] font-bold">{active ? 'עדכון ההרשמה' : 'הרשמה לטיול'}</span>
        <span className="text-[13px] text-muted">{trip.title} · {fmt.range(trip.start_date, trip.end_date)}</span>
      </div>
    </header>
  )

  if (done) {
    return (
      <div className="mx-auto min-h-dvh max-w-[560px] bg-bg">
        {header}
        <div className="flex flex-col items-center gap-3.5 px-7 py-14 text-center">
          <div className="flex h-18 w-18 items-center justify-center rounded-full bg-soft text-primary"><Icon name={done === 'saved' ? 'check' : 'x'} size={36} /></div>
          <h1 className="font-display text-[24px] font-bold">{done === 'saved' ? (active ? 'עדכנו!' : 'נרשמתם!') : 'ההרשמה בוטלה'}</h1>
          {done === 'saved' && <p className="text-[16px] leading-relaxed">{summary}</p>}
          <p className="text-[14px] leading-relaxed text-muted">
            {done === 'saved' ? `אפשר לשנות או לבטל עד ${closesLabel(trip)}. כשההרשמה תיסגר יגיע מייל עם כל הפרטים והשיבוץ להקפצות.` : 'מקווים לראות אתכם בטיול אחר.'}
          </p>
          <button type="button" onClick={() => nav('/')} className={`${btn.primary} mt-2`}>חזרה לבית</button>
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="mx-auto min-h-dvh max-w-[560px] bg-bg">
        {header}
        <p className="px-7 py-14 text-center text-[16px] leading-relaxed">ההרשמה לטיול הזה סגורה. אם בכל זאת תרצו להצטרף, כתבו למארגנים.</p>
      </div>
    )
  }

  const toggleDay = (did: string) => setDayIds(v.dayIds.includes(did) ? v.dayIds.filter((x) => x !== did) : [...v.dayIds, did])
  let step = 0
  const h = (t: string) => <h2 className="mb-1 font-display text-[17px] font-semibold">{++step} · {t}</h2>

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col bg-bg">
      {header}
      {days.length > 1 && (
        <section className="px-5 pt-5">
          {h('אילו ימים?')}
          <div className="mt-2.5 flex flex-col gap-2">
            {days.map((d) => {
              const on = v.dayIds.includes(d.id)
              return (
                <label key={d.id} className={`flex min-h-14 items-center gap-3 rounded-2xl bg-card px-4 py-2 ${on ? 'border-2 border-primary' : 'border border-line'}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleDay(d.id)} className="h-[22px] w-[22px] accent-primary" />
                  <span className="flex flex-col">
                    <b className="text-[15px]">{d.date ? `${fmt.weekdayLong(d.date)} ${fmt.dm(d.date)}` : `יום ${d.day_number}`}</b>
                    <span className="text-[13px] text-muted">{d.title}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </section>
      )}

      <section className="px-5 pt-6">
        {h('מי מגיע?')}
        <p className="mb-2.5 text-[13px] text-muted">{me?.adults ? 'מולא מהפרופיל של המשפחה. אפשר לשנות.' : 'אפשר לשמור את זה בפרופיל, ואז זה יתמלא לבד.'}</p>
        <div className="rounded-2xl border border-line bg-card [&>*+*]:border-t [&>*+*]:border-line">
          <Stepper label="מבוגרים" value={v.adults} min={0} onChange={setAdults} />
          <Stepper label="ילדים" sub={me?.children_ages.length ? `בני ${me.children_ages.join(', ')}` : undefined} value={v.children} onChange={setChildren} />
        </div>
      </section>

      {hasYoung && (
        <section className="px-5 pt-6">
          {h('כמה מכם בשביל המלא?')}
          <p className="mb-2.5 text-[13px] text-muted">כל השאר הולכים בשביל הצעיר ונפגשים בסוף.</p>
          <div className="rounded-2xl border border-line bg-card">
            <Stepper label="בשביל המלא" sub={young ? `${young} בשביל הצעיר` : 'אף אחד בשביל הצעיר'} value={fullCount} max={total} onChange={setFull} />
          </div>
        </section>
      )}

      <section className="px-5 pt-6">
        {h('רכב')}
        <label className="mt-2.5 flex min-h-13 items-center gap-3 rounded-2xl border border-line bg-card px-4">
          <input type="checkbox" checked={v.car} onChange={() => setCar(!v.car)} className="h-[22px] w-[22px] accent-primary" />
          <span className="text-[15px]">מגיעים ברכב שלנו</span>
        </label>
        {v.car && (
          <div className="mt-2 rounded-2xl border border-line bg-card">
            <Stepper label="מקומות פנויים להקפצה" sub="עוזר לנו לתכנן את ההקפצות" value={v.seats} max={8} onChange={setSeats} />
          </div>
        )}
      </section>

      <section className="px-5 pt-6 pb-6">
        <label className="flex items-start gap-3 text-[15px] leading-relaxed">
          <input type="checkbox" checked={consent} onChange={() => setConsent(!consent)} className="mt-0.5 h-[22px] w-[22px] shrink-0 accent-primary" />
          <span>קראנו את <Link to={`/trip/${trip.id}`} className="underline">פרטי המסלול</Link>, כולל המים והבטיחות</span>
        </label>
        {active && (
          <button type="button" onClick={cancel} disabled={busy} className="mt-6 min-h-11 text-[15px] font-medium text-acctext underline">ביטול ההרשמה</button>
        )}
        {err && <p role="alert" className="mt-3 rounded-xl bg-warnbg p-3 text-[15px] text-warn">{err}</p>}
      </section>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-1.5 border-t border-line bg-card px-5 pt-3 pb-[max(18px,env(safe-area-inset-bottom))]">
        <span className="text-center text-[13px] text-muted">{summary}</span>
        <button type="button" onClick={submit} disabled={!canSubmit} className={btn.primary}>{active ? 'שמירת השינויים' : 'אישור הרשמה'}</button>
      </div>
    </div>
  )
}

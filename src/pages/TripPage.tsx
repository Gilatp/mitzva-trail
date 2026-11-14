import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { bestEnrichment, firstSentences, useApp } from '../lib/data'
import { closesLabel, dayPlan, fmt, hhmm, registrationOpen } from '../lib/rules'
import type { TripDay } from '../lib/types'
import { BackButton, Card, DesertBand, Icon, Layout, Pending, SectionTitle, Spinner, btn } from '../components/ui'
import { AmbassadorBox } from '../components/Ambassador'

const YOUNG_TYPE: Record<string, string> = { together: 'יוצאים יחד', join_end: 'מצטרפים בסוף', parallel: 'מסלול מקביל' }
const STATUS_LABEL: Record<string, string> = { to_reschedule: 'מחכה לתאריך חדש', completed: 'הטיול הסתיים', cancelled: 'הטיול בוטל' }

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2.5">
      <div className="text-[12px] text-muted">{k}</div>
      <div className="mt-0.5 font-display text-[17px] font-semibold">{v ?? <Pending />}</div>
    </div>
  )
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v)
  if (!shown.length) return null
  return (
    <Card>
      {shown.map(([k, v], i) => (
        <div key={k} className={`flex gap-2.5 px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
          <span className="w-24 shrink-0 text-[14px] text-muted">{k}</span>
          <span className="text-[15px] leading-relaxed">{v}</span>
        </div>
      ))}
    </Card>
  )
}

export default function TripPage() {
  const { id } = useParams()
  const { data, daysOf, session, profile } = useApp()
  const [dayIdx, setDayIdx] = useState(0)
  const [track, setTrack] = useState<'full' | 'young'>('full')
  if (!data) return <Layout><Spinner /></Layout>
  const trip = data.trips.find((t) => t.id === id)
  if (!trip) return <Layout><p className="p-10 text-center">הטיול לא נמצא.</p></Layout>

  const days = daysOf(trip.id)
  const day: TripDay | undefined = days[Math.min(dayIdx, days.length - 1)]
  const hasYoung = !!day?.young_enabled
  const t = hasYoung ? track : 'full'
  const open = registrationOpen(trip)
  const regs = data.registrations.filter((r) => r.trip_id === trip.id && r.status === 'active')
  const myReg = regs.find((r) => r.user_id === session?.user.id)
  const segs = [...new Set(days.map((d) => d.segment_number).filter((n): n is number => n != null))]
  const enr = bestEnrichment(data.enrichment, day?.segment_number ?? null)
  const updates = [trip.flood_alert, trip.area_closures, trip.route_changes, trip.weather_note].filter(Boolean)

  const plan = day && dayPlan({
    distanceKm: t === 'full' ? day.distance_km : day.young_km,
    driveMinutes: day.drive_minutes,
    needsShuttle: t === 'full' && !!day.shuttle_required,
    date: day.date,
  })

  return (
    <Layout>
      <div className="relative">
        <DesertBand height={170} />
        <BackButton to="/" />
      </div>

      <header className="flex flex-col gap-1 px-5 pt-4">
        <h1 className="font-display text-[25px] leading-tight font-bold">{trip.title}</h1>
        <p className="text-[14px] text-muted">
          {[trip.start_date ? `${fmt.weekdays(trip.start_date, trip.end_date)} ${fmt.range(trip.start_date, trip.end_date)}` : 'מחכה לתאריך', trip.region, segs.length ? `מקטעים ${segs.join('–')}` : '']
            .filter(Boolean).join(' · ')}
        </p>
        {trip.date_status === 'proposed' && <p className="text-[14px] text-warn">התאריך עוד לא סופי</p>}
      </header>

      <div className="mx-5 mt-3.5 flex items-center gap-3 rounded-2xl bg-soft px-3.5 py-3">
        <div className="flex-1 text-[14px] leading-snug">
          {STATUS_LABEL[trip.status] ?? (myReg ? 'נרשמתם ✓' : open ? 'עוד לא נרשמתם' : 'ההרשמה סגורה')}
          {open && <><br /><span className="text-muted">ההרשמה פתוחה עד {closesLabel(trip)}</span></>}
        </div>
        {open && <Link to={`/trip/${trip.id}/register`} className={btn.primary}>{myReg ? 'עדכון' : 'להרשמה'}</Link>}
      </div>

      {updates.length > 0 && (
        <div role="note" className="mx-5 mt-3 flex gap-2.5 rounded-2xl border border-accent bg-card px-4 py-3 text-[15px] leading-relaxed">
          <Icon name="alert" className="mt-0.5 shrink-0 text-acctext" />
          <div>{updates.map((u) => <p key={u}>{u}</p>)}</div>
        </div>
      )}

      {days.length > 1 && (
        <div role="group" aria-label="בחירת יום" className="mx-5 mt-5 grid border-b border-line" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))` }}>
          {days.map((d, i) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={i === dayIdx}
              onClick={() => setDayIdx(i)}
              className={`-mb-px min-h-14 border-b-[3px] pt-2 pb-2.5 font-display text-[15px] font-semibold ${i === dayIdx ? 'border-primary text-ink' : 'border-transparent text-muted'}`}
            >
              {d.date ? `${fmt.weekdayLong(d.date)} ${fmt.dm(d.date)}` : `יום ${d.day_number}`}
              <br />
              <span className="text-[12px] font-normal text-muted">יום {d.day_number}{d.segment_number ? ` · מקטע ${d.segment_number}` : ''}</span>
            </button>
          ))}
        </div>
      )}

      {day && hasYoung && (
        <section className="px-5 pt-4">
          <p className="mb-2 text-[14px] text-muted">באיזה שביל אתם?</p>
          <div role="group" aria-label="בחירת שביל" className="grid grid-cols-2 gap-1.5 rounded-2xl bg-line p-1">
            {(['full', 'young'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={t === k}
                onClick={() => setTrack(k)}
                className={`min-h-14 rounded-xl font-display text-[15px] leading-tight font-semibold ${t === k ? 'bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-muted'}`}
              >
                {k === 'full' ? 'השביל המלא' : 'השביל הצעיר'}
                <br />
                <span className="text-[12px] font-normal">{k === 'full' ? day.main_participants || 'על שביל ישראל' : 'כל השאר'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {day && (
        <section className="flex flex-col gap-3.5 px-5 pt-4">
          <div>
            <h2 className="font-display text-[20px] leading-snug font-bold">{t === 'full' ? day.title || `${day.start_name} ← ${day.end_name}` : day.young_title || 'השביל הצעיר'}</h2>
            <p className="mt-1 text-[14px] text-muted">
              {t === 'full'
                ? [day.route_type === 'circular' ? 'מעגלי' : day.route_type === 'linear' ? 'נקודה לנקודה' : '', day.partial_route ? 'חלק מהמקטע' : 'על שביל ישראל'].filter(Boolean).join(' · ')
                : [YOUNG_TYPE[day.young_type], day.young_end === 'חזרה להתחלה' ? `הלוך ושוב מ${day.young_start}` : day.young_start && day.young_end ? `${day.young_start} ← ${day.young_end}` : ''].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {t === 'full' ? (
              <>
                <Fact k="מרחק" v={day.distance_km != null ? `${day.distance_km} ק״מ` : null} />
                <Fact k="קושי" v={day.difficulty || null} />
                <Fact k="מים" v={day.water_liters != null ? `${day.water_liters} ל׳` : null} />
              </>
            ) : (
              <>
                <Fact k="מרחק" v={day.young_km != null ? `${day.young_km} ק״מ` : null} />
                <Fact k="קושי" v={day.young_difficulty || null} />
                <Fact k="מים" v={day.water_liters != null ? `${day.water_liters} ל׳` : null} />
              </>
            )}
          </div>

          {t === 'full' ? day.route_description && <p className="text-[15px] leading-relaxed">{day.route_description}</p> : day.young_notes && <p className="text-[15px] leading-relaxed">{day.young_notes}</p>}

          {plan && (
            <Card className="px-4 py-3.5">
              <div className="flex justify-between text-center">
                <div><div className="font-display text-[17px] font-semibold">{plan.leaveHome != null ? hhmm(plan.leaveHome) : '—'}</div><div className="text-[12px] text-muted">יציאה מהבית</div></div>
                <div><div className="font-display text-[17px] font-semibold text-primary">{hhmm(plan.start)}</div><div className="text-[12px] text-muted">מתחילים ללכת</div></div>
                <div><div className="font-display text-[17px] font-semibold">{plan.end != null ? hhmm(plan.end) : '—'}</div><div className="text-[12px] text-muted">סיום משוער</div></div>
                <div><div className="font-display text-[17px] font-semibold text-warn">{hhmm(plan.sunset)}</div><div className="text-[12px] text-muted">שקיעה</div></div>
              </div>
              {(plan.earlyWarning || plan.darkRisk) && (
                <p className="mt-2.5 text-[14px] text-warn">
                  {plan.earlyWarning && 'יציאה מוקדמת מאוד מהבית. '}
                  {plan.darkRisk && 'הסיום קרוב לשקיעה: כדאי להתחיל מוקדם או לקצר.'}
                </p>
              )}
            </Card>
          )}

          <Rows rows={[
            ['בטיחות', day.safety_notes],
            ['מים', [day.water_guidance, day.water_crossing === 'required' ? `חציית מים חובה${day.max_water_depth ? ` (עד ה${day.max_water_depth})` : ''}` : day.water_crossing === 'optional' ? 'חציית מים אפשרית' : ''].filter(Boolean).join(' · ')],
            ['שמש', day.sun_exposure],
            ['נקודות מילוט', day.escape_points],
            ['ציוד', day.gear],
            ['מפגש', t === 'young' ? day.young_meetup || 'עם ההולכים בשביל המלא — הנקודה תתעדכן' : day.young_enabled ? day.young_meetup : ''],
            ['חניה', day.parking_notes],
            ['כלבים', trip.dog_allowed === false ? 'בלי כלבים' : trip.dog_notes],
          ]} />

          {t === 'full' && (
            day.shuttle_required ? (
              <div className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-accent bg-card px-4 py-3.5">
                <div className="flex items-center gap-2 font-display text-[16px] font-semibold"><Icon name="car" size={20} />צריך הקפצת רכבים</div>
                <p className="text-[15px] leading-relaxed">{day.shuttle_details || 'הפרטים יתעדכנו כאן.'}</p>
                <p className="text-[14px] text-muted">{day.shuttle_drivers ? `מסיעים: ${day.shuttle_drivers}` : 'המארגנים ישבצו נהגים אחרי סגירת ההרשמה.'}</p>
              </div>
            ) : day.shuttle_required == null && day.route_type !== 'circular' ? (
              <p className="text-[14px] text-muted">הקפצת רכבים: <Pending /></p>
            ) : null
          )}
        </section>
      )}

      {enr && (
        <section aria-label="על הדרך" className="px-5 pt-6">
          <SectionTitle>על הדרך</SectionTitle>
          <p className="mb-2.5 text-[15px] leading-relaxed">{firstSentences(enr.geography || enr.location, 2)}</p>
          {enr.things_to_notice && <p className="mb-2.5 text-[15px] leading-relaxed"><b>שימו לב: </b>{firstSentences(enr.things_to_notice, 1)}</p>}
          {enr.trivia_question && (
            <details className="rounded-xl border border-line bg-card px-4 py-3">
              <summary className="min-h-6 text-[15px] font-bold">שאלה לדרך</summary>
              <p className="mt-2 text-[15px] leading-relaxed">{enr.trivia_question}</p>
              {enr.trivia_answer && <p className="mt-2 text-[14px] leading-relaxed text-muted">{enr.trivia_answer}</p>}
            </details>
          )}
        </section>
      )}

      {day?.segment_number && (
        <section className="px-5 pt-5">
          <AmbassadorBox segment={day.segment_number} />
        </section>
      )}

      <section aria-label="מי מגיע" className="px-5 pt-6">
        <SectionTitle>מי מגיע</SectionTitle>
        {regs.length ? (
          <ul className="flex flex-col gap-1.5 text-[15px]">
            {regs.map((r) => (
              <li key={r.id}>
                משפחת {profile(r.user_id)?.family_name || '—'} · {r.adults + r.children} משתתפים
                {days.length > 1 && r.day_ids.length < days.length ? ` · ${days.filter((d) => r.day_ids.includes(d.id)).map((d) => (d.date ? fmt.weekdayLong(d.date) : `יום ${d.day_number}`)).join(', ')}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-muted">עוד אין נרשמים.</p>
        )}
      </section>
    </Layout>
  )
}

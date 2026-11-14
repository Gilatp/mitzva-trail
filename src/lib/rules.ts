// חוקי האתר. פונקציות טהורות, כדי שאפשר לבדוק אותן אוטומטית.
import type { Trip, TripDay } from './types'

const TZ = 'Asia/Jerusalem'

/** חצות של תאריך נתון בשעון ישראל, כרגע מוחלט. */
export function jerusalemMidnight(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d))
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(guess)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+2'
  const hours = Number(name.replace('GMT', '') || 0)
  return new Date(guess.getTime() - hours * 3600_000)
}

/** ההרשמה נסגרת 72 שעות לפני תחילת יום היציאה. */
export function registrationClosesAt(trip: Pick<Trip, 'start_date'>): Date | null {
  if (!trip.start_date) return null
  return new Date(jerusalemMidnight(trip.start_date).getTime() - 72 * 3600_000)
}

export function registrationOpen(
  trip: Pick<Trip, 'start_date' | 'status' | 'date_status' | 'kind'>,
  now: Date = new Date(),
): boolean {
  if (trip.status !== 'planned' || trip.date_status !== 'confirmed') return false
  if (trip.kind !== 'regular' && trip.kind !== 'mitzvah') return false
  const closes = registrationClosesAt(trip)
  return !!closes && now < closes
}

const DIFFICULTY_ORDER = ['קל', 'בינוני', 'מאתגר', 'קשה']

/** קושי הטיול: הערך שלו, ואם חסר — הקשה מבין ימיו. אם אין מידע — null ("בבדיקה"). */
export function tripDifficulty(trip: Pick<Trip, 'difficulty'>, days: Pick<TripDay, 'difficulty'>[]): string | null {
  if (trip.difficulty) return trip.difficulty
  const known = days.map((d) => d.difficulty).filter((x) => DIFFICULTY_ORDER.includes(x))
  if (!known.length) return null
  return known.sort((a, b) => DIFFICULTY_ORDER.indexOf(b) - DIFFICULTY_ORDER.indexOf(a))[0]
}

/** סה"כ הליכה בטיול: סכום הימים אם לכולם יש מרחק, אחרת ההערכה ברמת הטיול. לעולם לא מנחשים. */
export function tripDistance(trip: Pick<Trip, 'total_km_hint'>, days: Pick<TripDay, 'distance_km'>[]): number | null {
  if (days.length && days.every((d) => d.distance_km != null)) {
    return days.reduce((s, d) => s + Number(d.distance_km), 0)
  }
  return trip.total_km_hint != null ? Number(trip.total_km_hint) : null
}

export type Progress = {
  walkedKm: number
  completedSegments: number
  startedSegments: number
  segmentState: Map<number, 'completed' | 'partial'>
  partialFraction: Map<number, number>
}

/**
 * ההתקדמות על השביל. מקטע נחשב "הושלם" רק אם יום שהולך בו סומן completed.
 * ק"מ על השביל נספרים פעם אחת לכל מקטע, גם כשהמקטע מופיע בכמה טיולים,
 * ולא עולים על האורך הרשמי של המקטע.
 */
export function computeProgress(
  days: Pick<TripDay, 'segment_number' | 'completion' | 'completed_km' | 'trail_km'>[],
  officialKm: Map<number, number | null>,
): Progress {
  const kmBySeg = new Map<number, number>()
  const state = new Map<number, 'completed' | 'partial'>()
  for (const d of days) {
    if (d.segment_number == null || d.completion === 'none') continue
    const km = Number(d.trail_km ?? d.completed_km ?? 0)
    kmBySeg.set(d.segment_number, (kmBySeg.get(d.segment_number) ?? 0) + km)
    if (d.completion === 'completed') state.set(d.segment_number, 'completed')
    else if (!state.has(d.segment_number)) state.set(d.segment_number, 'partial')
  }
  let walkedKm = 0
  const partialFraction = new Map<number, number>()
  for (const [seg, km] of kmBySeg) {
    const official = officialKm.get(seg)
    const capped = official ? Math.min(km, official) : km
    walkedKm += state.get(seg) === 'completed' && official ? official : capped
    if (state.get(seg) === 'partial') partialFraction.set(seg, official ? Math.min(capped / official, 0.95) : 0.4)
  }
  let completed = 0
  let started = 0
  for (const s of state.values()) (s === 'completed' ? completed++ : started++)
  return { walkedKm: Math.round(walkedKm * 10) / 10, completedSegments: completed, startedSegments: started, segmentState: state, partialFraction }
}

/** שעות היום: יציאה מהבית, סיום משוער ואזהרות. קצב משפחתי 1.8 קמ"ש כולל עצירות. */
export function dayPlan(opts: { distanceKm: number | null; driveMinutes: number | null; needsShuttle: boolean; date: string | null }) {
  const start = 9 * 60 + 30
  const leaveHome = opts.driveMinutes != null ? start - opts.driveMinutes - 20 - (opts.needsShuttle ? 30 : 0) : null
  const walkMinutes = opts.distanceKm != null ? Math.round((opts.distanceKm / 1.8) * 60) : null
  const end = walkMinutes != null ? start + walkMinutes : null
  const sunset = opts.date ? SUNSET[Number(opts.date.slice(5, 7)) - 1] : null
  return {
    leaveHome,
    start,
    end,
    sunset,
    earlyWarning: leaveHome != null && leaveHome < 5 * 60 + 30,
    darkRisk: end != null && sunset != null && end + 60 > sunset,
  }
}

// שקיעה ממוצעת במרכז הארץ לפי חודש (דקות מחצות)
const SUNSET = [17 * 60 + 5, 17 * 60 + 30, 17 * 60 + 50, 19 * 60 + 5, 19 * 60 + 25, 19 * 60 + 45, 19 * 60 + 45, 19 * 60 + 25, 18 * 60 + 50, 18 * 60 + 10, 16 * 60 + 45, 16 * 60 + 40]

export function hhmm(minutes: number | null): string {
  if (minutes == null) return ''
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// ── תאריכים בעברית
const WEEKDAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת']
const WEEKDAY_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const MONTH = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const MONTH_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']

function parts(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return { y, m, d, wd }
}

export const fmt = {
  dm: (date: string) => { const p = parts(date); return `${p.d}.${p.m}` },
  weekdayLong: (date: string) => WEEKDAY_LONG[parts(date).wd],
  weekday: (date: string) => WEEKDAY[parts(date).wd],
  month: (date: string) => MONTH[parts(date).m - 1],
  monthShort: (date: string) => MONTH_SHORT[parts(date).m - 1],
  monthYear: (date: string) => { const p = parts(date); return `${MONTH[p.m - 1]} ${p.y}` },
  range: (a: string | null, b: string | null) => {
    if (!a) return 'מחכה לתאריך'
    if (!b || a === b) return fmt.dm(a)
    const pa = parts(a), pb = parts(b)
    return pa.m === pb.m ? `${pa.d}–${pb.d}.${pa.m}` : `${pa.d}.${pa.m}–${pb.d}.${pb.m}`
  },
  weekdays: (a: string | null, b: string | null) => {
    if (!a) return ''
    if (!b || a === b) return fmt.weekdayLong(a)
    return `${fmt.weekdayLong(a)}–${fmt.weekdayLong(b)}`
  },
}

export function daysUntil(date: string, now: Date = new Date()): number {
  return Math.ceil((jerusalemMidnight(date).getTime() - now.getTime()) / 86_400_000)
}

/** "ההרשמה פתוחה עד סוף יום ב׳ 7.12" */
export function closesLabel(trip: Pick<Trip, 'start_date'>): string {
  const c = registrationClosesAt(trip)
  if (!c) return ''
  const last = new Date(c.getTime() - 60_000)
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(last)
  return `סוף יום ${fmt.weekday(iso)} ${fmt.dm(iso)}`
}

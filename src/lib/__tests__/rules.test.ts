import { describe, expect, it } from 'vitest'
import { computeProgress, dayPlan, registrationClosesAt, registrationOpen, tripDifficulty, tripDistance } from '../rules'

const trip = { start_date: '2026-12-11', status: 'planned', date_status: 'confirmed', kind: 'regular' } as const

describe('חלון ההרשמה', () => {
  it('נסגר 72 שעות לפני חצות של יום היציאה, בשעון ישראל', () => {
    // 11.12 00:00 ישראל = 10.12 22:00 UTC; פחות 72 שעות = 7.12 22:00 UTC
    expect(registrationClosesAt(trip)?.toISOString()).toBe('2026-12-07T22:00:00.000Z')
  })
  it('פתוח לפני, סגור אחרי', () => {
    expect(registrationOpen(trip, new Date('2026-12-07T21:59:00Z'))).toBe(true)
    expect(registrationOpen(trip, new Date('2026-12-07T22:00:00Z'))).toBe(false)
  })
  it('סגור לטיול עם תאריך מוצע, רזרבה או טיול שמחכה לתאריך', () => {
    const now = new Date('2026-11-14T12:00:00Z')
    expect(registrationOpen({ ...trip, date_status: 'proposed' }, now)).toBe(false)
    expect(registrationOpen({ ...trip, kind: 'reserve' }, now)).toBe(false)
    expect(registrationOpen({ ...trip, status: 'to_reschedule' }, now)).toBe(false)
  })
  it('שעון קיץ: 72 שעות לפני חצות ישראל ביולי', () => {
    expect(registrationClosesAt({ start_date: '2027-07-16' })?.toISOString()).toBe('2027-07-12T21:00:00.000Z')
  })
})

describe('קושי ומרחק — לא ממציאים', () => {
  it('קושי: הערך של הטיול, אחרת הקשה מבין הימים, אחרת null', () => {
    expect(tripDifficulty({ difficulty: 'קל' }, [{ difficulty: 'מאתגר' }])).toBe('קל')
    expect(tripDifficulty({ difficulty: '' }, [{ difficulty: 'קל' }, { difficulty: 'בינוני' }])).toBe('בינוני')
    expect(tripDifficulty({ difficulty: '' }, [{ difficulty: '' }])).toBeNull()
  })
  it('מרחק: סכום הימים רק אם לכולם יש מרחק', () => {
    expect(tripDistance({ total_km_hint: null }, [{ distance_km: 5 }, { distance_km: 7 }])).toBe(12)
    expect(tripDistance({ total_km_hint: 20 }, [{ distance_km: 5 }, { distance_km: null }])).toBe(20)
    expect(tripDistance({ total_km_hint: null }, [{ distance_km: null }])).toBeNull()
  })
})

describe('התקדמות על השביל', () => {
  const official = new Map<number, number | null>([[21, 15], [16, 10]])
  it('מקטע שמופיע בכמה טיולים נספר פעם אחת ולא עובר את האורך הרשמי', () => {
    const p = computeProgress([
      { segment_number: 21, completion: 'partial', completed_km: 9, trail_km: null },
      { segment_number: 21, completion: 'partial', completed_km: 8, trail_km: null },
    ], official)
    expect(p.walkedKm).toBe(15)
    expect(p.startedSegments).toBe(1)
    expect(p.completedSegments).toBe(0)
  })
  it('חלקי אינו "הושלם"', () => {
    const p = computeProgress([{ segment_number: 16, completion: 'partial', completed_km: 4, trail_km: null }], official)
    expect(p.segmentState.get(16)).toBe('partial')
    expect(p.walkedKm).toBe(4)
  })
  it('ימים שלא נהלכו לא נספרים', () => {
    expect(computeProgress([{ segment_number: 16, completion: 'none', completed_km: null, trail_km: 10 }], official).walkedKm).toBe(0)
  })
})

describe('תכנון יום', () => {
  it('9 ק"מ בקצב 1.8 קמ"ש = 5 שעות; יציאה כוללת נסיעה, התארגנות והקפצה', () => {
    const p = dayPlan({ distanceKm: 9, driveMinutes: 90, needsShuttle: true, date: '2026-12-11' })
    expect(p.end).toBe(9 * 60 + 30 + 300)
    expect(p.leaveHome).toBe(9 * 60 + 30 - 90 - 20 - 30)
    expect(p.darkRisk).toBe(false)
  })
  it('סיכון חושך: סוף ההליכה ועוד שעה אחרי השקיעה', () => {
    expect(dayPlan({ distanceKm: 13, driveMinutes: 60, needsShuttle: false, date: '2026-12-11' }).darkRisk).toBe(true)
  })
})

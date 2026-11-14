import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Ambassador, Enrichment, Profile, Registration, Segment, Settings, Trip, TripDay } from './types'
import { computeProgress, type Progress } from './rules'

type Data = {
  segments: Segment[]
  trips: Trip[]
  days: TripDay[]
  enrichment: Enrichment[]
  registrations: Registration[]
  ambassadors: Ambassador[]
  profiles: Profile[]
  settings: Settings | null
}

type Ctx = {
  session: Session | null
  authReady: boolean
  me: Profile | null
  myContact: { email: string; phone: string } | null
  data: Data | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  progress: Progress | null
  daysOf: (tripId: string) => TripDay[]
  segment: (n: number | null) => Segment | undefined
  profile: (id: string) => Profile | undefined
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [data, setData] = useState<Data | null>(null)
  const [myContact, setMyContact] = useState<Ctx['myContact']>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const q = await Promise.all([
      supabase.from('segments').select('*').order('number'),
      supabase.from('trips').select('*').order('start_date', { nullsFirst: false }),
      supabase.from('trip_days').select('*').order('date').order('day_number'),
      supabase.from('enrichment').select('*'),
      supabase.from('registrations').select('*'),
      supabase.from('ambassadors').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('settings').select('*').maybeSingle(),
      supabase.from('profile_contacts').select('email, phone').maybeSingle(),
    ])
    const failed = q.find((r) => r.error)
    if (failed?.error) {
      setError(failed.error.message)
    } else {
      setData({
        segments: q[0].data as Segment[],
        trips: q[1].data as Trip[],
        days: q[2].data as TripDay[],
        enrichment: q[3].data as Enrichment[],
        registrations: q[4].data as Registration[],
        ambassadors: q[5].data as Ambassador[],
        profiles: q[6].data as Profile[],
        settings: q[7].data as Settings | null,
      })
      setMyContact(q[8].data as Ctx['myContact'])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (session) reload()
    else setData(null)
  }, [session, reload])

  const value = useMemo<Ctx>(() => {
    const me = data?.profiles.find((p) => p.id === session?.user.id) ?? null
    const official = new Map((data?.segments ?? []).map((s) => [s.number, s.official_km]))
    return {
      session, authReady, me, myContact, data, loading, error, reload,
      progress: data ? computeProgress(data.days, official) : null,
      daysOf: (tripId) => (data?.days ?? []).filter((d) => d.trip_id === tripId).sort((a, b) => a.day_number - b.day_number),
      segment: (n) => data?.segments.find((s) => s.number === n),
      profile: (id) => data?.profiles.find((p) => p.id === id),
    }
  }, [session, authReady, myContact, data, loading, error, reload])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp outside provider')
  return c
}

/** תוכן ההעשרה הכי מלא שפורסם למקטע. */
export function bestEnrichment(list: Enrichment[], seg: number | null): Enrichment | undefined {
  if (seg == null) return undefined
  const filled = (e: Enrichment) =>
    [e.geography, e.nature, e.history, e.people_and_culture, e.things_to_notice, e.trivia_question].filter(Boolean).join('').length
  return list.filter((e) => e.segment_number === seg && e.published).sort((a, b) => filled(b) - filled(a))[0]
}

/** שני המשפטים הראשונים של טקסט. */
export function firstSentences(text: string, n = 2): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  return parts.slice(0, n).join(' ')
}

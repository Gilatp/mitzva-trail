import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/data'
import { fmt } from '../lib/rules'
import { Card, Layout, SectionTitle, Spinner, TopBar, btn } from '../components/ui'

export default function Me() {
  const { data, me, myContact, session, reload } = useApp()
  const [form, setForm] = useState<{ family_name: string; contact_name: string; phone: string; adults: number; ages: string } | null>(null)
  const [saved, setSaved] = useState(false)
  if (!data || !me) return <Layout><TopBar /><Spinner /></Layout>

  const f = form ?? { family_name: me.family_name, contact_name: me.contact_name, phone: myContact?.phone ?? '', adults: me.adults, ages: me.children_ages.join(', ') }
  const set = (patch: Partial<typeof f>) => { setSaved(false); setForm({ ...f, ...patch }) }

  async function save() {
    const ages = f.ages.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n) && n >= 0 && n < 30)
    await supabase.from('profiles').update({ family_name: f.family_name.trim(), contact_name: f.contact_name.trim(), adults: f.adults, children_ages: ages }).eq('id', me!.id)
    await supabase.from('profile_contacts').update({ phone: f.phone.trim() }).eq('id', me!.id)
    await reload()
    setForm(null)
    setSaved(true)
  }

  const myRegs = data.registrations.filter((r) => r.user_id === session?.user.id && r.status === 'active')
  const myAmb = data.ambassadors.filter((a) => a.user_id === session?.user.id)
  const field = 'min-h-12 rounded-xl border border-line bg-card px-4 text-[16px]'

  return (
    <Layout>
      <TopBar />
      <h1 className="px-5 pt-3 font-display text-[24px] font-bold">{me.family_name ? `משפחת ${me.family_name}` : 'המשפחה שלנו'}</h1>
      <p className="px-5 pt-1 text-[14px] text-muted" dir="ltr" style={{ textAlign: 'right' }}>{myContact?.email}</p>

      {me.role === 'admin' && (
        <div className="px-5 pt-4"><Link to="/admin" className={`${btn.primary} w-full`}>ניהול האתר</Link></div>
      )}

      <section className="px-5 pt-6">
        <SectionTitle>הטיולים שנרשמנו אליהם</SectionTitle>
        {myRegs.length ? (
          <Card>
            {myRegs.map((r, i) => {
              const t = data.trips.find((x) => x.id === r.trip_id)
              if (!t) return null
              return (
                <Link key={r.id} to={`/trip/${t.id}`} className={`flex min-h-11 items-center justify-between gap-3 px-4 py-3 no-underline ${i ? 'border-t border-line' : ''}`}>
                  <span className="text-[15px] font-medium">{t.title}</span>
                  <span className="text-[13px] text-muted">{fmt.range(t.start_date, t.end_date)} · {r.adults + r.children} משתתפים</span>
                </Link>
              )
            })}
          </Card>
        ) : <p className="text-[15px] text-muted">עוד לא נרשמתם לטיול.</p>}
      </section>

      {myAmb.length > 0 && (
        <section className="px-5 pt-6">
          <SectionTitle>אנחנו שגרירים של</SectionTitle>
          <ul className="flex flex-col gap-1.5 text-[15px]">
            {myAmb.map((a) => <li key={a.id}>מקטע {a.segment_number}{a.status === 'pending' ? ' · ממתין לאישור' : ''}</li>)}
          </ul>
        </section>
      )}

      <section className="px-5 pt-6">
        <SectionTitle>פרטי המשפחה</SectionTitle>
        <p className="mb-3 text-[13px] text-muted">משמשים למילוי אוטומטי בהרשמה. הטלפון גלוי רק למארגנים.</p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[14px] font-medium">שם המשפחה<input className={field} value={f.family_name} onChange={(e) => set({ family_name: e.target.value })} /></label>
          <label className="flex flex-col gap-1.5 text-[14px] font-medium">איש/אשת קשר<input className={field} value={f.contact_name} onChange={(e) => set({ contact_name: e.target.value })} /></label>
          <label className="flex flex-col gap-1.5 text-[14px] font-medium">טלפון<input className={field} type="tel" dir="ltr" style={{ textAlign: 'right' }} value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
          <label className="flex flex-col gap-1.5 text-[14px] font-medium">מבוגרים<input className={field} type="number" min={0} max={20} value={f.adults} onChange={(e) => set({ adults: Number(e.target.value) })} /></label>
          <label className="flex flex-col gap-1.5 text-[14px] font-medium">גילאי הילדים<span className="text-[13px] font-normal text-muted">למשל: 12, 7</span><input className={field} value={f.ages} onChange={(e) => set({ ages: e.target.value })} /></label>
          <button type="button" onClick={save} disabled={!form} className={btn.primary}>שמירה</button>
          {saved && <p role="status" className="text-[14px] text-primary">נשמר.</p>}
        </div>
      </section>

      <section className="px-5 pt-8">
        <button type="button" onClick={() => supabase.auth.signOut()} className={btn.secondary}>יציאה מהאתר</button>
      </section>
    </Layout>
  )
}

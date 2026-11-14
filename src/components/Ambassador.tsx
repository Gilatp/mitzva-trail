import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/data'
import { btn } from './ui'

/** שגרירי המקטע + התנדבות. */
export function AmbassadorBox({ segment }: { segment: number }) {
  const { data, session, profile, reload } = useApp()
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState('')
  const [busy, setBusy] = useState(false)
  const list = (data?.ambassadors ?? []).filter((a) => a.segment_number === segment)
  const approved = list.filter((a) => a.status === 'approved')
  const mine = list.find((a) => a.user_id === session?.user.id)

  async function volunteer() {
    if (!session) return
    setBusy(true)
    await supabase.from('ambassadors').insert({ segment_number: segment, user_id: session.user.id, plan: plan.trim() })
    setBusy(false)
    setOpen(false)
    reload()
  }
  async function withdraw() {
    if (!mine) return
    setBusy(true)
    await supabase.from('ambassadors').delete().eq('id', mine.id)
    setBusy(false)
    reload()
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-dashed border-line bg-card px-4 py-3.5">
      {approved.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted">שגרירי מקטע {segment}</span>
          {approved.map((a) => (
            <p key={a.id} className="text-[15px] leading-relaxed">
              <b>משפחת {profile(a.user_id)?.family_name || '—'}</b>
              {a.plan ? ` · ${a.plan}` : ''}
            </p>
          ))}
        </div>
      ) : (
        !mine && <p className="text-[14px] leading-relaxed">מקטע {segment} עוד בלי שגריר. רוצים להכין משהו קטן לדרך: סיפור, משחק, טקס או מאכל מקומי?</p>
      )}

      {mine ? (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-[14px] text-muted">{mine.status === 'pending' ? 'ההתנדבות שלכם ממתינה לאישור המארגנים.' : 'אתם שגרירי המקטע הזה. תודה!'}</p>
          <button type="button" onClick={withdraw} disabled={busy} className={btn.quiet}>ביטול</button>
        </div>
      ) : open ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`plan-${segment}`} className="text-[14px] font-medium">מה אתם מתכננים? (לא חובה)</label>
          <textarea id={`plan-${segment}`} value={plan} onChange={(e) => setPlan(e.target.value)} rows={2} className="rounded-xl border border-line bg-bg p-3 text-[15px]" />
          <div className="flex gap-2">
            <button type="button" onClick={volunteer} disabled={busy} className={btn.primary}>אני בפנים</button>
            <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>לא עכשיו</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${btn.quiet} self-start`}>
          {approved.length ? 'גם אני רוצה לעזור' : 'אני רוצה להיות שגריר/ה'}
        </button>
      )}
    </div>
  )
}

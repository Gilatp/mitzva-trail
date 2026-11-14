import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Blaze, DesertBand, btn } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'not_invited' | 'error'>('idle')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (!error) return setState('sent')
    // המייל לא ברשימת המוזמנים: מסד הנתונים חוסם את יצירת המשתמש
    setState(/database error|not_invited/i.test(error.message) ? 'not_invited' : 'error')
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col bg-bg">
      <DesertBand height={220} />
      <div className="flex flex-1 flex-col gap-5 px-6 pt-8 pb-10">
        <div className="flex items-center gap-3">
          <Blaze size={30} />
          <h1 className="font-display text-[28px] font-bold">שביל המצווה</h1>
        </div>
        <p className="text-[16px] leading-relaxed text-muted">
          56 מקטעים, מהחרמון לאילת, בשנה אחת. האתר פתוח למשפחות שהוזמנו להצטרף.
        </p>

        {state === 'sent' ? (
          <div role="status" className="rounded-2xl bg-soft p-5 text-[16px] leading-relaxed">
            <b>שלחנו קישור כניסה ל־{email}.</b>
            <br />
            פותחים את המייל ולוחצים על הקישור. אם הוא לא הגיע תוך דקה, כדאי לבדוק בתיקיית הספאם.
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label htmlFor="email" className="text-[15px] font-medium">המייל שלכם</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12 rounded-xl border border-line bg-card px-4 text-right text-[16px]"
              placeholder="name@example.com"
            />
            <button type="submit" disabled={state === 'sending'} className={btn.primary}>
              {state === 'sending' ? 'שולחים…' : 'שלחו לי קישור כניסה'}
            </button>
            {state === 'not_invited' && (
              <p role="alert" className="rounded-xl bg-warnbg p-3 text-[15px] text-warn">
                המייל הזה עוד לא ברשימת המוזמנים. אם קיבלתם הזמנה למייל אחר, נסו אותו, או בקשו מהמארגנים להוסיף אתכם.
              </p>
            )}
            {state === 'error' && (
              <p role="alert" className="rounded-xl bg-warnbg p-3 text-[15px] text-warn">משהו השתבש בשליחה. נסו שוב בעוד רגע.</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

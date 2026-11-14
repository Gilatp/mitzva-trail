import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useApp } from '../lib/data'

export function Blaze({ size = 24 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="inline-flex flex-col overflow-hidden rounded-[5px] border border-line" style={{ width: size, height: size }}>
      <span className="flex-1 bg-[#E8742A]" />
      <span className="flex-1 bg-white" />
      <span className="flex-1 bg-[#1D5C9E]" />
    </span>
  )
}

/** מידע שעוד חסר: לא ממציאים, מסמנים. */
export function Pending({ children = 'בבדיקה' }: { children?: ReactNode }) {
  return <span className="inline-block rounded-md bg-warnbg px-2 py-0.5 text-[13px] font-medium text-warn">{children}</span>
}

export function DesertBand({ height = 120, children }: { height?: number; children?: ReactNode }) {
  const h = height
  return (
    <div className="relative overflow-hidden bg-sky" style={{ height: h }}>
      <svg aria-hidden="true" viewBox={`0 0 390 ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d={`M0 ${h * 0.58} L50 ${h * 0.43} L95 ${h * 0.52} L150 ${h * 0.3} L205 ${h * 0.48} L250 ${h * 0.38} L300 ${h * 0.52} L350 ${h * 0.35} L390 ${h * 0.43} L390 ${h} L0 ${h} Z`} className="fill-ill1" />
        <path d={`M0 ${h * 0.77} L60 ${h * 0.63} L120 ${h * 0.72} L180 ${h * 0.58} L240 ${h * 0.7} L300 ${h * 0.62} L390 ${h * 0.68} L390 ${h} L0 ${h} Z`} className="fill-ill2" />
        <path d={`M0 ${h * 0.92} C80 ${h * 0.85} 140 ${h * 0.95} 200 ${h * 0.88} C260 ${h * 0.82} 320 ${h * 0.93} 390 ${h * 0.87} L390 ${h} L0 ${h} Z`} className="fill-ill3" />
      </svg>
      {children}
    </div>
  )
}

export const btn = {
  primary: 'inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-5 font-display text-[16px] font-semibold text-onp no-underline disabled:bg-line disabled:text-muted',
  secondary: 'inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-card px-4 text-[15px] font-medium text-ink no-underline',
  quiet: 'inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-bg px-4 text-[14px] font-bold text-ink',
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card ${className}`}>{children}</div>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2.5 font-display text-[17px] font-semibold">{children}</h2>
}

const icons = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  back: <path d="M9 6l6 6-6 6" />,
  chevron: <path d="M15 6l-6 6 6 6" />,
  car: <><path d="M5 17h14v-5l-2-5H7l-2 5z" /><circle cx="8" cy="17" r="2" /><circle cx="16" cy="17" r="2" /></>,
  drop: <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>,
  check: <path d="M5 12l5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
}

export function Icon({ name, size = 22, className = '' }: { name: keyof typeof icons; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  )
}

export function BackButton({ to }: { to: string }) {
  return (
    <Link to={to} aria-label="חזרה" className="absolute right-3.5 top-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink">
      <Icon name="back" size={20} />
    </Link>
  )
}

export function Layout({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  const { me } = useApp()
  const item = (to: string, label: string, icon: keyof typeof icons) => (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-13 flex-col items-center justify-center gap-0.5 text-[12px] no-underline ${isActive ? 'font-bold text-primary' : 'text-muted'}`
      }
    >
      <Icon name={icon} />
      {label}
    </NavLink>
  )
  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col bg-bg">
      <main className="flex-1 pb-6">{children}</main>
      {nav && (
        <nav aria-label="ניווט ראשי" className="sticky bottom-0 grid grid-cols-4 border-t border-line bg-card px-1 pt-1.5 pb-[max(14px,env(safe-area-inset-bottom))]">
          {item('/', 'בית', 'home')}
          {item('/trips', 'טיולים', 'cal')}
          {item('/map', 'מפה', 'map')}
          {item('/me', me?.role === 'admin' ? 'שלנו · ניהול' : 'שלנו', 'user')}
        </nav>
      )}
    </div>
  )
}

export function TopBar() {
  const { me } = useApp()
  return (
    <header className="flex items-center justify-between px-5 pt-4 pb-2">
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <Blaze />
        <span className="font-display text-[18px] font-bold">שביל המצווה</span>
      </Link>
      <Link to="/me" aria-label="הפרופיל שלנו" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card font-display text-[15px] font-semibold text-primary no-underline">
        {(me?.family_name || me?.contact_name || '?').trim().charAt(0)}
      </Link>
    </header>
  )
}

export function Spinner({ label = 'טוען…' }: { label?: string }) {
  return <p role="status" className="p-10 text-center text-muted">{label}</p>
}

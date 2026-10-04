import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentRun } from './lib/agentRun'
import App from './App'
import type { Grant, Source } from './types'
import { AuthScreens } from './auth/AuthScreens'
import { SettingsPage } from './auth/SettingsPage'
import { DEFAULT_SCAN, PLANS, cleanStore, describeScan, orgsFor, seedStore, trialDaysLeft, type AuthStore } from './auth/session'

const AUTH_KEY = 'radar-grantow:auth:v1'

function loadStore(): AuthStore {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return seedStore()
    try {
      localStorage.removeItem('radar-grantow:v1:org-klient') // dane przykładowego klienta z wcześniejszej wersji
    } catch {
      /* brak dostępu */
    }
    return cleanStore(JSON.parse(raw) as AuthStore)
  } catch {
    return seedStore()
  }
}

interface Props {
  today?: Date
  persist?: boolean
  /** Dane startowe (w testach – dane demo) */
  initialGrants?: Grant[]
  initialSources?: Source[]
  /** Dane startowe logowania (w testach – dane demo z dwiema firmami) */
  seed?: (today: Date) => AuthStore
}

export default function Root({ today: todayProp, persist = true, initialGrants, initialSources, seed = () => seedStore() }: Props) {
  const [today] = useState(() => todayProp ?? new Date())
  const [store, setStore] = useState<AuthStore>(() => (persist ? loadStore() : seed(today)))
  const [page, setPage] = useState<'app' | 'settings' | 'historia'>('app')
  const [runs, setRuns] = useState<AgentRun[]>([])
  const onRunsChange = useCallback((r: AgentRun[]) => setRuns(r), [])
  const showHistory = useCallback(() => setPage('historia'), [])

  useEffect(() => {
    if (!persist) return
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(store))
    } catch {
      /* pamięć przeglądarki niedostępna */
    }
  }, [store, persist])

  if (!store.session) return <AuthScreens store={store} today={today} onChange={setStore} />

  const { email, orgId } = store.session
  const account = store.accounts.find((a) => a.email === email)!
  const orgs = orgsFor(store, email)
  const org = orgs.find((o) => o.id === orgId) ?? orgs[0]
  const trialLeft = trialDaysLeft(org, today)

  const logout = () => {
    setStore({ ...store, session: null })
    setPage('app')
  }
  const switchOrg = (id: string) => {
    setStore({ ...store, session: { email, orgId: id } })
    setPage('app')
  }

  const menu = (
    <div className="flex items-center gap-2">
    <SettingsButton active={page !== 'app'} onClick={() => setPage('settings')} />
    <AccountMenu
      name={account.name}
      email={email}
      orgName={org.name}
      orgs={orgs.map((o) => ({ id: o.id, name: o.name, current: o.id === org.id }))}
      onSwitch={switchOrg}
      onSettings={() => setPage('settings')}
      onHistory={showHistory}
      onLogout={logout}
    />
    </div>
  )

  const banner =
    trialLeft !== null ? (
      <div className="border-b border-indigo-200 bg-indigo-50">
        <p className="mx-auto max-w-7xl px-4 py-2 text-sm text-indigo-950 sm:px-6">
          Okres próbny: zostało <strong>{trialLeft} dni</strong>.{' '}
          <button type="button" onClick={() => setPage('settings')} className="font-medium underline underline-offset-2">
            Wybierz plan
          </button>
        </p>
      </div>
    ) : null

  if (page !== 'app') {
    return (
      <SettingsPage
        runs={runs}
        focus={page === 'historia' ? 'historia' : undefined}
        store={store}
        org={org}
        email={email}
        today={today}
        headerRight={menu}
        onBack={() => setPage('app')}
        onChange={setStore}
        onLogout={logout}
      />
    )
  }

  return (
    <App
      key={org.id}
      today={today}
      persist={persist}
      initialGrants={initialGrants}
      initialSources={initialSources}
      storageKey={`radar-grantow:v1:${org.id}`}
      ownSourcesLimit={PLANS[org.plan].ownSources}
      ownScanLabel={describeScan(org.scan ?? DEFAULT_SCAN)}
      headerRight={menu}
      banner={banner}
      onRunsChange={onRunsChange}
      onShowHistory={showHistory}
      userEmail={email}
    />
  )
}

function AccountMenu({
  name,
  email,
  orgName,
  orgs,
  onSwitch,
  onSettings,
  onHistory,
  onLogout,
}: {
  name: string
  email: string
  orgName: string
  orgs: { id: string; name: string; current: boolean }[]
  onSwitch: (id: string) => void
  onSettings: () => void
  onHistory: () => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initials = name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const item = 'block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Konto: ${name}, firma: ${orgName}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-300 bg-white py-1 pl-1 pr-3 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-700 text-xs font-semibold text-white" aria-hidden="true">
          {initials}
        </span>
        <span className="max-w-40 truncate font-medium text-slate-800">{orgName}</span>
        <span aria-hidden="true" className="text-slate-600">
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-600">{email}</p>
          </div>
          <div className="my-1 border-t border-slate-100" />
          <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Firma</p>
          <ul aria-label="Przełącz firmę">
            {orgs.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  aria-current={o.current || undefined}
                  className={`${item} ${o.current ? 'font-semibold text-indigo-800' : 'text-slate-800'}`}
                  onClick={() => {
                    setOpen(false)
                    onSwitch(o.id)
                  }}
                >
                  {o.current && <span aria-hidden="true">✓ </span>}
                  {o.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            className={`${item} text-slate-800`}
            onClick={() => {
              setOpen(false)
              onSettings()
            }}
          >
            Ustawienia firmy i konta
          </button>
          <button
            type="button"
            className={`${item} text-slate-800`}
            onClick={() => {
              setOpen(false)
              onHistory()
            }}
          >
            Historia sprawdzeń
          </button>
          <button type="button" className={`${item} text-slate-800`} onClick={onLogout}>
            Wyloguj się
          </button>
        </div>
      )}
    </div>
  )
}


function SettingsButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ustawienia"
      aria-current={active ? 'page' : undefined}
      title="Ustawienia"
      className={`flex h-9 w-9 items-center justify-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
        active ? 'border-indigo-700 bg-indigo-50 text-indigo-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <GearIcon />
    </button>
  )
}

function GearIcon() {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45)
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {teeth.map((a) => (
        <rect key={a} x="10.6" y="1.8" width="2.8" height="4" rx="0.8" fill="currentColor" stroke="none" transform={`rotate(${a} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="6.6" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  )
}

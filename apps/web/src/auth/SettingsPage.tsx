import { useEffect, useId, useState } from 'react'
import { RunLog } from '../components/AgentPanel'
import type { AgentRun } from '../lib/agentRun'
import {
  DEFAULT_SCAN,
  FREQUENCY_LABEL,
  WEEKDAYS,
  describeScan,
  secondHour,
  type ScanFrequency,
  type ScanSettings,
  PLANS,
  inviteMember, roleIn, trialDaysLeft, type AuthStore, type Org, type PlanId, type Role } from './session'

interface Props {
  store: AuthStore
  org: Org
  email: string
  today: Date
  headerRight: React.ReactNode
  onBack: () => void
  onChange: (s: AuthStore) => void
  onLogout: () => void
  /** Historia sprawdzeń stron (przebiegi agenta tej firmy) */
  runs?: AgentRun[]
  /** Otwórz od razu na sekcji */
  focus?: 'historia'
}

const card = 'rounded-xl border border-slate-200 bg-white p-5'
const inputCls = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm aria-[invalid=true]:border-rose-600'
const btn = 'rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
const limit = (n: number | null) => (n === null ? 'bez limitu' : String(n))

export function SettingsPage({ store, org, email, today, headerRight, onBack, onChange, onLogout, runs = [], focus }: Props) {
  const uid = useId()
  const isOwner = roleIn(org, email) === 'Właściciel'
  const [orgName, setOrgName] = useState(org.name)
  const [invite, setInvite] = useState({ email: '', role: 'Członek' as Role })
  const [inviteError, setInviteError] = useState('')
  const [status, setStatus] = useState('')
  const [scan, setScan] = useState<ScanSettings>(org.scan ?? DEFAULT_SCAN)
  const plan = PLANS[org.plan]
  const trialLeft = trialDaysLeft(org, today)

  useEffect(() => {
    if (focus !== 'historia') return
    const h = document.getElementById('run-log')
    h?.scrollIntoView?.({ block: 'start' })
    h?.focus()
  }, [focus])

  const updateOrg = (next: Org) => onChange({ ...store, orgs: store.orgs.map((o) => (o.id === next.id ? next : o)) })

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <button type="button" onClick={onBack} className="text-sm font-medium text-indigo-700 underline underline-offset-2">
              ← Wróć do naborów
            </button>
            <h1 className="mt-1 text-xl font-semibold">Ustawienia: {org.name}</h1>
          </div>
          {headerRight}
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <section aria-labelledby={`${uid}-org`} className={card}>
          <h2 id={`${uid}-org`} className="text-base font-semibold">
            Firma
          </h2>
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!orgName.trim()) return
              updateOrg({ ...org, name: orgName.trim() })
              setStatus('Zapisano nazwę firmy.')
            }}
          >
            <div className="flex-1">
              <label htmlFor={`${uid}-orgname`} className="text-sm font-medium text-slate-800">
                Nazwa firmy
              </label>
              <input id={`${uid}-orgname`} value={orgName} disabled={!isOwner} onChange={(e) => setOrgName(e.target.value)} className={inputCls} />
            </div>
            {isOwner && (
              <button type="submit" className={btn}>
                Zapisz
              </button>
            )}
          </form>
          <p className="mt-3 text-xs text-slate-600">Dane naborów, statusy i baza stron są oddzielne dla każdej firmy.</p>
        </section>

        <section aria-labelledby={`${uid}-plan`} className={card}>
          <h2 id={`${uid}-plan`} className="text-base font-semibold">
            Plan i płatności
          </h2>
          <p className="mt-2 text-sm">
            Aktualny plan: <strong>{plan.name}</strong>
            {trialLeft !== null && <> · zostało {trialLeft} dni</>}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Limit label="Własne strony" value={limit(plan.ownSources)} />
            <Limit label="Użytkownicy" value={`${org.members.length} / ${limit(plan.users)}`} />
            <Limit label="Profile „dla kogo”" value={limit(plan.forWhomProfiles)} />
          </dl>
          {isOwner && (
            <div className="mt-4">
              <label htmlFor={`${uid}-planpick`} className="text-sm font-medium text-slate-800">
                Zmień plan (symulacja – docelowo Stripe)
              </label>
              <select
                id={`${uid}-planpick`}
                value={org.plan}
                onChange={(e) => {
                  const next = e.target.value as PlanId
                  updateOrg({ ...org, plan: next, trial_ends: next === 'trial' ? org.trial_ends : undefined })
                  setStatus(`Zmieniono plan na „${PLANS[next].name}”.`)
                }}
                className={inputCls}
              >
                {Object.values(PLANS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        <section aria-labelledby={`${uid}-scan`} className={`${card} lg:col-span-2`}>
          <h2 id={`${uid}-scan`} className="text-base font-semibold">
            Sprawdzanie stron
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Jak często agent ma sprawdzać <strong>strony dodane przez Ciebie</strong>. Strony z Katalogu Radaru sprawdzamy centralnie codziennie o 6:00. Pojedynczej stronie możesz ustawić inną częstotliwość w zakładce „Baza stron”.
          </p>
          <p className="mt-3 text-sm">
            Teraz: <strong>{describeScan(org.scan ?? DEFAULT_SCAN)}</strong>
          </p>
          {isOwner ? (
            <form
              className="mt-4 space-y-4"
              aria-label="Harmonogram sprawdzania"
              onSubmit={(e) => {
                e.preventDefault()
                updateOrg({ ...org, scan })
                setStatus(`Zapisano harmonogram: ${describeScan(scan)}.`)
              }}
            >
              <fieldset>
                <legend className="text-sm font-medium text-slate-800">Jak często</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(FREQUENCY_LABEL) as ScanFrequency[]).map((f) => (
                    <label
                      key={f}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-600 ${
                        scan.frequency === f ? 'border-indigo-700 bg-indigo-50 font-medium text-indigo-900' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${uid}-freq`}
                        value={f}
                        checked={scan.frequency === f}
                        onChange={() => setScan((x) => ({ ...x, frequency: f }))}
                        className="accent-indigo-700"
                      />
                      {FREQUENCY_LABEL[f]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap items-end gap-4">
                {scan.frequency === 'co-tydzien' && (
                  <div>
                    <label htmlFor={`${uid}-wd`} className="text-sm font-medium text-slate-800">
                      Dzień tygodnia
                    </label>
                    <select id={`${uid}-wd`} value={scan.weekday} onChange={(e) => setScan((x) => ({ ...x, weekday: Number(e.target.value) }))} className={inputCls}>
                      {WEEKDAYS.map((d, i) => (
                        <option key={d} value={i + 1}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {scan.frequency !== 'recznie' && (
                <div>
                  <label htmlFor={`${uid}-hour`} className="text-sm font-medium text-slate-800">
                    {scan.frequency === '2x-dziennie' ? 'Pierwsze sprawdzenie o' : 'Godzina'}
                  </label>
                  <select id={`${uid}-hour`} value={scan.hour} onChange={(e) => setScan((x) => ({ ...x, hour: Number(e.target.value) }))} className={inputCls}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {h}:00
                      </option>
                    ))}
                  </select>
                </div>
                )}
                {scan.frequency === '2x-dziennie' && <p className="pb-2 text-sm text-slate-700">Drugie sprawdzenie o {secondHour(scan.hour)}:00</p>}
                <button type="submit" className={btn}>
                  Zapisz harmonogram
                </button>
              </div>
              <p className="text-xs text-slate-600">Częstsze sprawdzanie oznacza więcej zapytań do stron i do AI. Strony, które się nie zmieniły, nie trafiają do AI.</p>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Harmonogram może zmienić właściciel firmy.</p>
          )}
        </section>

        <div className="lg:col-span-2">
          <RunLog runs={runs} />
        </div>

        <section aria-labelledby={`${uid}-team`} className={`${card} lg:col-span-2`}>
          <h2 id={`${uid}-team`} className="text-base font-semibold">
            Zespół ({org.members.length})
          </h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {org.members.map((m) => (
              <li key={m.email} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {m.name} {m.email === email && <span className="text-slate-600">(Ty)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-600">{m.email}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-800">{m.role}</span>
                  {m.status === 'zaproszony' && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-900 ring-1 ring-amber-300">Zaproszenie wysłane</span>}
                  {isOwner && m.email !== email && (
                    <button
                      type="button"
                      aria-label={`Usuń ${m.email} z zespołu`}
                      className="rounded-md px-2 py-1 font-medium text-rose-800 hover:bg-rose-50"
                      onClick={() => {
                        updateOrg({ ...org, members: org.members.filter((x) => x.email !== m.email) })
                        setStatus(`Usunięto ${m.email} z zespołu.`)
                      }}
                    >
                      Usuń
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {isOwner ? (
            <form
              noValidate
              aria-label="Zaproś do zespołu"
              className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                const r = inviteMember(org, invite.email, invite.role)
                if ('error' in r) {
                  setInviteError(r.error)
                  document.getElementById(`${uid}-inv`)?.focus()
                  return
                }
                setInviteError('')
                updateOrg(r.org)
                setStatus(`Wysłano zaproszenie do ${invite.email.trim()}.`)
                setInvite({ email: '', role: 'Członek' })
              }}
            >
              <div>
                <label htmlFor={`${uid}-inv`} className="text-sm font-medium text-slate-800">
                  E-mail osoby
                </label>
                <input
                  id={`${uid}-inv`}
                  type="email"
                  value={invite.email}
                  aria-invalid={inviteError ? true : undefined}
                  aria-describedby={inviteError ? `${uid}-inv-err` : undefined}
                  onChange={(e) => setInvite((x) => ({ ...x, email: e.target.value }))}
                  className={inputCls}
                  placeholder="np. wspolnik@firma.pl"
                />
              </div>
              <div>
                <label htmlFor={`${uid}-role`} className="text-sm font-medium text-slate-800">
                  Rola
                </label>
                <select id={`${uid}-role`} value={invite.role} onChange={(e) => setInvite((x) => ({ ...x, role: e.target.value as Role }))} className={inputCls}>
                  <option>Członek</option>
                  <option>Właściciel</option>
                </select>
              </div>
              <button type="submit" className={btn}>
                Zaproś
              </button>
              {inviteError && (
                <p id={`${uid}-inv-err`} className="text-xs text-rose-800 sm:col-span-3">
                  {inviteError}
                </p>
              )}
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Zapraszać do zespołu może tylko właściciel firmy.</p>
          )}
        </section>

        <section aria-labelledby={`${uid}-acc`} className={`${card} lg:col-span-2`}>
          <h2 id={`${uid}-acc`} className="text-base font-semibold">
            Moje konto
          </h2>
          <p className="mt-2 text-sm text-slate-700">{email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
              onClick={() => setStatus(`Wysłano link do zmiany hasła na ${email}.`)}
            >
              Zmień hasło
            </button>
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50" onClick={onLogout}>
              Wyloguj się
            </button>
          </div>
        </section>

        <p role="status" aria-live="polite" className="text-sm text-emerald-800 lg:col-span-2">
          {status}
        </p>
      </main>
    </div>
  )
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <dt className="text-[11px] text-slate-600">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { Grant, MyStatus, Source, UserState } from '../types'
import {
  MY_STATUSES,
  buildIcs,
  computeStatus,
  daysLeft,
  effective,
  formatDate,
  formatPLN,
  isLowConfidence,
} from '../lib/grants'
import { ForWhomPill, MyStatusBadge, OwnSourcePill, StatusBadge } from './StatusBadge'

const PIPELINE: MyStatus[] = ['Analizuję', 'Przygotowuję wniosek', 'Złożony', 'W ocenie', 'Przyznany']

interface Props {
  grant: Grant | null
  source?: Source
  userState?: UserState
  today: Date
  onClose: () => void
  onStatus: (id: string, status: MyStatus) => void
  onNote: (id: string, note: string) => void
  onOverride: (id: string, field: 'opens_at' | 'closes_at', value: string) => void
  onHideProgram?: (grant: Grant) => void
  /** Usuń z listy / przywróć */
  onRemove?: (id: string, removed: boolean) => void
  forWhomOptions?: string[]
  onForWhom?: (id: string, list: string[]) => void
}

function CheckFlag() {
  return (
    <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900" title="Niska pewność odczytu AI – sprawdź w źródle">
      Sprawdź
    </span>
  )
}

export function GrantModal({ grant, source, userState, today, onClose, onStatus, onNote, onOverride, onHideProgram, onRemove, forWhomOptions = [], onForWhom }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState(false)
  const [newWho, setNewWho] = useState('')

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (grant && !d.open) d.showModal()
    if (!grant && d.open) d.close()
    setEditing(false)
  }, [grant])

  if (!grant) return <dialog ref={ref} />

  const g = effective(grant)
  const status = computeStatus(grant, today)
  const left = daysLeft(grant, today)
  const ics = buildIcs(grant)
  const titleId = `grant-title-${grant.id}`

  const downloadIcs = () => {
    if (!ics) return
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `nabor-${grant.call_number ?? grant.id}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(720px,calc(100vw-32px))] rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl [color-scheme:light] backdrop:bg-slate-900/50"
    >
      <div className="max-h-[85vh] overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <StatusBadge status={status} />
                {userState?.my_status && userState.my_status !== 'Nowy' && <MyStatusBadge status={userState.my_status} />}
                {(userState?.for_whom ?? []).map((f) => (
                  <ForWhomPill key={f} name={f} />
                ))}
                {grant.call_number && <span>{grant.call_number}</span>}
                <span>{source?.name}</span>
                {source?.origin === 'wlasna' && <OwnSourcePill />}
              </div>
              <h2 id={titleId} className="mt-2 text-xl font-semibold leading-snug">
                {g.title}
              </h2>
              <p className="text-sm text-slate-600">{g.institution}</p>
              {g.program && (
                <p className="mt-1 text-sm">
                  <span className="text-slate-600">Program: </span>
                  <a className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900" href={g.program.url} target="_blank" rel="noreferrer">
                    {g.program.name} ↗
                  </a>
                  {onHideProgram && (
                    <button
                      type="button"
                      onClick={() => onHideProgram(grant)}
                      className="ml-3 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
                    >
                      Ukryj ten program
                    </button>
                  )}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
              aria-label="Zamknij"
            >
              ✕
            </button>
          </div>
          {left !== null && left >= 0 && (
            <p className={`mt-3 text-sm font-semibold ${left < 7 ? 'text-amber-800' : 'text-slate-800'}`}>
              {left === 0 ? 'Zamknięcie dziś' : `Do zamknięcia: ${left} dni`}
            </p>
          )}
        </header>

        <div className="space-y-6 px-6 py-5">
          {/* Najważniejsze */}
          <section aria-labelledby="sec-key">
            <h3 id="sec-key" className="sr-only">
              Najważniejsze informacje
            </h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact label="Budżet naboru" value={formatPLN(g.budget_total)} flag={isLowConfidence(grant, 'budget_total')} />
              <Fact label="Maks. dofinansowanie" value={formatPLN(g.max_grant)} flag={isLowConfidence(grant, 'max_grant')} />
              <Fact label="Poziom wsparcia" value={g.funding_percent ? `${g.funding_percent}%` : '—'} flag={isLowConfidence(grant, 'funding_percent')} />
              <Fact label="Publikacja" value={formatDate(g.announced_at)} />
              <Fact label="Otwarcie" value={formatDate(g.opens_at)} flag={isLowConfidence(grant, 'opens_at')} edited={!!grant.manual_overrides.opens_at} />
              <Fact label="Zamknięcie" value={formatDate(g.closes_at)} flag={isLowConfidence(grant, 'closes_at')} edited={!!grant.manual_overrides.closes_at} />
            </dl>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Kto może aplikować</h3>
              <p className="mt-1 text-sm text-slate-700">{g.beneficiaries}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Na co</h3>
              <p className="mt-1 text-sm text-slate-700">{g.scope}</p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Streszczenie AI</h3>
            <p className="mt-1 text-sm text-slate-700">{g.summary_ai}</p>
          </section>

          {g.required_docs.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Wymagane dokumenty</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                {g.required_docs.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Źródła</h3>
            <ul className="mt-1 space-y-1 text-sm">
              <li>
                <a className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900" href={g.source_url} target="_blank" rel="noreferrer">
                  Ogłoszenie źródłowe ↗
                </a>
              </li>
              {g.program && (
                <li>
                  <a className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900" href={g.program.url} target="_blank" rel="noreferrer">
                    Strona programu: {g.program.name} ↗
                  </a>
                </li>
              )}
              {g.attachments.map((a) => (
                <li key={a.url}>
                  <a className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900" href={a.url} target="_blank" rel="noreferrer">
                    {a.name} ↗
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {editing && (
            <section className="rounded-xl bg-slate-50 p-4" aria-label="Ręczna korekta dat">
              <p className="text-sm text-slate-700">Ręczne poprawki mają pierwszeństwo i agent ich nie nadpisze.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="block font-medium">Otwarcie</span>
                  <input
                    type="date"
                    defaultValue={g.opens_at}
                    onChange={(e) => onOverride(grant.id, 'opens_at', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="block font-medium">Zamknięcie</span>
                  <input
                    type="date"
                    defaultValue={g.closes_at}
                    onChange={(e) => onOverride(grant.id, 'closes_at', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
            </section>
          )}

          <section aria-labelledby="sec-stage" className="rounded-xl border border-slate-200 p-4">
            <h3 id="sec-stage" className="text-sm font-semibold text-slate-900">
              Etap mojego wniosku
            </h3>
            <ol className="mt-3 flex flex-wrap items-center gap-1.5">
              {PIPELINE.map((step, i) => {
                const current = userState?.my_status ?? 'Nowy'
                const currentIdx = PIPELINE.indexOf(current === 'Odrzucony' ? 'Przyznany' : current)
                const isCurrent = step === current || (step === 'Przyznany' && current === 'Odrzucony')
                const done = currentIdx > i
                const label = step === 'Przyznany' && current === 'Odrzucony' ? 'Odrzucony' : step
                return (
                  <li key={step} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => onStatus(grant.id, step)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                        isCurrent
                          ? label === 'Odrzucony'
                            ? 'bg-rose-700 text-white ring-rose-700'
                            : 'bg-indigo-700 text-white ring-indigo-700'
                          : done
                            ? 'bg-indigo-50 text-indigo-900 ring-indigo-200'
                            : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {done && <span aria-hidden="true">✓ </span>}
                      {label}
                      {done && <span className="sr-only">, etap zakończony</span>}
                    </button>
                    {i < PIPELINE.length - 1 && <span aria-hidden="true" className="text-slate-400">→</span>}
                  </li>
                )
              })}
            </ol>
            {(userState?.my_status === 'W ocenie' || userState?.my_status === 'Przyznany' || userState?.my_status === 'Odrzucony') && (
              <div className="mt-3 flex gap-2 text-xs">
                <span className="text-slate-600">Wynik:</span>
                <button type="button" onClick={() => onStatus(grant.id, 'Przyznany')} className="font-medium text-emerald-800 underline underline-offset-2">
                  Przyznany
                </button>
                <button type="button" onClick={() => onStatus(grant.id, 'Odrzucony')} className="font-medium text-rose-800 underline underline-offset-2">
                  Odrzucony
                </button>
              </div>
            )}
          </section>

          {onForWhom && (
            <section aria-labelledby="sec-who" className="rounded-xl border border-slate-200 p-4">
              <h3 id="sec-who" className="text-sm font-semibold text-slate-900">
                Dla kogo
              </h3>
              <p className="mt-0.5 text-xs text-slate-600">Zaznacz, dla kogo analizujesz ten nabór. Etykieta pojawi się na karcie naboru.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Dla kogo">
                {[...new Set([...forWhomOptions, ...(userState?.for_whom ?? [])])].map((opt) => {
                  const on = (userState?.for_whom ?? []).includes(opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const cur = userState?.for_whom ?? []
                        onForWhom(grant.id, on ? cur.filter((x) => x !== opt) : [...cur, opt])
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                        on ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {on && <span aria-hidden="true">✓ </span>}
                      {opt}
                    </button>
                  )
                })}
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const v = newWho.trim()
                    if (!v) return
                    const cur = userState?.for_whom ?? []
                    if (!cur.includes(v)) onForWhom(grant.id, [...cur, v])
                    setNewWho('')
                  }}
                >
                  <label htmlFor={`who-${grant.id}`} className="sr-only">
                    Nowa osoba lub firma
                  </label>
                  <input
                    id={`who-${grant.id}`}
                    value={newWho}
                    onChange={(e) => setNewWho(e.target.value)}
                    placeholder="np. Pensjonat Kowalski"
                    className="w-44 rounded-full border border-slate-300 px-3 py-1 text-xs"
                  />
                  <button type="submit" className="rounded-full px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
                    + Dodaj
                  </button>
                </form>
              </div>
            </section>
          )}

          <section className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block font-semibold">Mój status</span>
              <select
                value={userState?.my_status ?? 'Nowy'}
                onChange={(e) => onStatus(grant.id, e.target.value as MyStatus)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                {MY_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:row-span-2">
              <span className="block font-semibold">Notatka</span>
              <textarea
                defaultValue={userState?.note ?? ''}
                onBlur={(e) => onNote(grant.id, e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Np. pasuje do projektu domków – zapytać o kosztorys"
              />
            </label>
          </section>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={() => onStatus(grant.id, 'Obserwuję')}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {userState?.my_status === 'Obserwuję' ? '✓ Obserwuję' : 'Obserwuj'}
          </button>
          <button
            type="button"
            disabled={!ics}
            onClick={downloadIcs}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Dodaj do kalendarza (.ics)
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            {editing ? 'Zakończ edycję' : 'Popraw daty'}
          </button>
          <button
            type="button"
            onClick={() => {
              onStatus(grant.id, 'Nie dla mnie')
              onClose()
            }}
            className="ml-auto rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Nie dla mnie
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => {
                onRemove(grant.id, !userState?.removed)
                onClose()
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-600"
            >
              {userState?.removed ? 'Przywróć na listę' : 'Usuń z listy'}
            </button>
          )}
        </footer>
      </div>
    </dialog>
  )
}

function Fact({ label, value, flag, edited }: { label: string; value: string; flag?: boolean; edited?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${flag ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-slate-50'}`}>
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">
        {value}
        {flag && <CheckFlag />}
        {edited && <span className="ml-2 text-[11px] font-normal text-slate-600">(poprawione ręcznie)</span>}
      </dd>
    </div>
  )
}

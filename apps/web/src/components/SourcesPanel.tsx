import { useId, useState } from 'react'
import { SOURCE_TYPES, type Source, type SourceType } from '../types'
import { FREQUENCY_LABEL, type ScanFrequency } from '../auth/session'
import { formatTime, sourceNotice } from '../lib/agentRun'
import { InfoTip } from './InfoTip'
import { CatalogPill, OwnSourcePill } from './StatusBadge'

const KIND_PILL: Record<NonNullable<Source['kind']>, { label: string; cls: string } | null> = {
  oficjalne: null,
  agregator: { label: 'Agregator – potwierdzamy u źródła', cls: 'bg-amber-50 text-amber-900 ring-amber-300' },
  odniesienie: { label: 'Tylko odniesienie', cls: 'bg-slate-100 text-slate-700 ring-slate-300' },
  wiadomosci: { label: 'Wiadomości – sygnał, potwierdź u źródła', cls: 'bg-sky-50 text-sky-900 ring-sky-300' },
}
import { validateSource, type ProgramInfo, type SourceDraft } from '../lib/grants'

/** „1 ogłoszenie”, „3 ogłoszenia”, „5 ogłoszeń” */
export function announcementsWord(n: number): string {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
  return `${n} ${n === 1 ? 'ogłoszenie' : few ? 'ogłoszenia' : 'ogłoszeń'}`
}

const EMPTY: SourceDraft = { name: '', url: '', type: 'LGD', region: '', notes: '' }

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm aria-[invalid=true]:border-rose-600'
const btnPrimary =
  'rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
const btnGhost =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60'

interface Props {
  sources: Source[]
  grantCounts: Record<string, number>
  programs: ProgramInfo[]
  hiddenPrograms: string[]
  onAdd: (draft: SourceDraft) => void
  onUpdate: (id: string, patch: Partial<Source>) => void
  onDelete: (id: string) => void
  onToggleProgram: (name: string) => void
  ownSourcesLimit?: number | null
  ownScanLabel?: string
  runLog?: React.ReactNode
  /** Sprawdź jedną stronę teraz (tylko strony dodane przez klienta) */
  onCheckOne?: (s: Source) => void
  /** Trwa sprawdzanie (przycisk nieaktywny) */
  checking?: boolean
}

export function SourcesPanel({ sources, grantCounts, programs, hiddenPrograms, onAdd, onUpdate, onDelete, onToggleProgram, ownSourcesLimit = null, ownScanLabel = 'codziennie o 6:00', runLog, onCheckOne, checking = false }: Props) {
  const [originFilter, setOriginFilter] = useState<'all' | 'katalog' | 'wlasna'>('all')
  const ownCount = sources.filter((s) => s.origin === 'wlasna').length
  const atLimit = ownSourcesLimit !== null && ownCount >= ownSourcesLimit
  const shown = originFilter === 'all' ? sources : sources.filter((s) => s.origin === originFilter)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section aria-labelledby="add-source" className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 id="add-source" className="text-base font-semibold">
            Dodaj stronę do monitorowania
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Wklej adres podstrony, na której pojawiają się ogłoszenia o naborach (np. „Aktualności” lub „Nabory” na stronie LGD). Zaraz po dodaniu sprawdzimy, czy są na niej ogłoszenia, a potem agent będzie ją sprawdzał regularnie.
          </p>
          <p className="mt-2 text-sm font-medium text-slate-800">
            Twoje strony: {ownCount}
            {ownSourcesLimit !== null ? ` / ${ownSourcesLimit} w Twoim planie` : ' (bez limitu)'}
          </p>
          {atLimit ? (
            <p role="note" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-300">
              Wykorzystano limit własnych stron w Twoim planie. Wstrzymane strony też się liczą – usuń nieużywaną stronę albo zmień plan w ustawieniach firmy.
            </p>
          ) : (
          <SourceForm
            key="new"
            initial={EMPTY}
            existing={sources}
            submitLabel="Dodaj stronę"
            onSubmit={(d) => {
              onAdd(d)
              setAnnounce(`Dodano stronę „${d.name}”.`)
            }}
          />
          )}
        </section>

        <section aria-labelledby="my-sources" className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-5 py-4">
            <h2 id="my-sources" className="text-base font-semibold">
              Moja baza stron ({sources.length})
            </h2>
            <p className="text-sm text-slate-600">Aktywne: {sources.filter((s) => s.active).length}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
            <div role="group" aria-label="Pokaż strony" className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
              {(
                [
                  ['all', `Wszystkie (${sources.length})`],
                  ['katalog', `Katalog Radaru (${sources.length - ownCount})`],
                  ['wlasna', `Dodane przez Ciebie (${ownCount})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={originFilter === id}
                  onClick={() => setOriginFilter(id)}
                  className={`rounded-md px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${originFilter === id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600">Strony z katalogu utrzymujemy my – możesz je tylko włączać i wyłączać.</p>
          </div>

          {shown.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600">Brak stron w tym widoku. Dodaj własną stronę w formularzu powyżej.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((s) => (
                <li key={s.id} className="px-5 py-4">
                  {editingId === s.id ? (
                    <SourceForm
                      initial={{ name: s.name, url: s.url, type: s.type, region: s.region, notes: s.notes ?? '', query: s.query, kind: s.kind }}
                      existing={sources}
                      editingId={s.id}
                      submitLabel="Zapisz zmiany"
                      onCancel={() => setEditingId(null)}
                      onSubmit={(d) => {
                        onUpdate(s.id, d)
                        setEditingId(null)
                        setAnnounce(`Zapisano zmiany: „${d.name}”.`)
                      }}
                    />
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-medium ${s.active ? 'text-slate-900' : 'text-slate-500'}`}>{s.name}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">{s.type}</span>
                          {s.origin === 'wlasna' ? <OwnSourcePill /> : <CatalogPill />}
                          {s.kind && KIND_PILL[s.kind] && (
                            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${KIND_PILL[s.kind]!.cls}`}>{KIND_PILL[s.kind]!.label}</span>
                          )}
                          {!s.active && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">Wstrzymana</span>}
                          {sourceNotice(s) && <InfoTip label={`${s.name}: w przygotowaniu – szczegóły`} text={sourceNotice(s)!} />}
                        </div>
                        {s.type === 'wiadomości' ? (
                          <p className="mt-0.5 truncate text-sm text-slate-800">
                            Kanał:{' '}
                            <a href={s.url} target="_blank" rel="noreferrer" className="text-indigo-700 underline underline-offset-2">
                              {s.url}
                            </a>
                            {s.query && (
                              <>
                                {' '}
                                · filtr: <strong>„{s.query}”</strong>
                              </>
                            )}
                          </p>
                        ) : (
                          <a href={s.url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-sm text-indigo-700 underline underline-offset-2">
                            {s.url}
                          </a>
                        )}
                        <p className="mt-1 text-xs text-slate-600">
                          {s.category ?? s.region} · naborów: {grantCounts[s.id] ?? 0}
                          {s.origin === 'wlasna' && s.added_at ? ` · dodana ${s.added_at.split('-').reverse().join('.')}` : ''}
                          {s.notes ? ` · ${s.notes}` : ''}
                        </p>
                        {s.kind !== 'odniesienie' && (
                          <p className="mt-1 text-xs text-slate-600">
                            Sprawdzanie:{' '}
                            {s.origin === 'katalog'
                              ? 'codziennie o 6:00 (Radar)'
                              : s.scan_frequency
                                ? `${FREQUENCY_LABEL[s.scan_frequency].toLowerCase()} (ustawione dla tej strony)`
                                : `${ownScanLabel} (jak w ustawieniach)`}
                            {' · ostatnio: '}
                            {formatTime(s.last_checked_at)}
                            {s.origin === 'wlasna' &&
                              (s.type === 'wiadomości'
                                ? ' · artykuły o naborach z ostatnich 60 dni – to sygnał, potwierdź u instytucji'
                                : ' · uniwersalny czytnik (wykrywa nowe ogłoszenia i daty – sprawdzaj u źródła)')}
                          </p>
                        )}
                        {s.last_error ? (
                          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
                            <strong>Problem przy ostatnim sprawdzeniu:</strong> {s.last_error}
                          </p>
                        ) : (
                          s.origin === 'wlasna' &&
                          s.last_checked_at && (
                            <p className="mt-1 text-xs font-medium text-emerald-800">
                              Ostatnio znaleziono {announcementsWord(grantCounts[s.id] ?? 0)} – sprawdź, czy to na pewno nabory.
                            </p>
                          )
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            role="switch"
                            checked={s.active}
                            onChange={(e) => onUpdate(s.id, { active: e.target.checked })}
                            aria-label={`Monitoruj ${s.name}`}
                            className="h-4 w-4 accent-indigo-700"
                          />
                          <span aria-hidden="true">Monitoruj</span>
                        </label>
                        {s.origin === 'wlasna' && (
                        <>
                        <label className="sr-only" htmlFor={`freq-${s.id}`}>
                          Częstotliwość sprawdzania {s.name}
                        </label>
                        <select
                          id={`freq-${s.id}`}
                          value={s.scan_frequency ?? ''}
                          onChange={(e) => {
                            const v = e.target.value as ScanFrequency | ''
                            onUpdate(s.id, { scan_frequency: v || undefined })
                            setAnnounce(`Częstotliwość dla „${s.name}”: ${v ? FREQUENCY_LABEL[v].toLowerCase() : 'jak w ustawieniach'}.`)
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="">Jak w ustawieniach</option>
                          {(Object.keys(FREQUENCY_LABEL) as ScanFrequency[]).map((f) => (
                            <option key={f} value={f}>
                              {FREQUENCY_LABEL[f]}
                            </option>
                          ))}
                        </select>
                        {onCheckOne && (
                          <button type="button" className={btnGhost} aria-label={`Sprawdź teraz ${s.name}`} disabled={checking} onClick={() => onCheckOne(s)}>
                            {checking ? 'Sprawdzam…' : 'Sprawdź'}
                          </button>
                        )}
                        <button type="button" className={btnGhost} aria-label={`Edytuj ${s.name}`} onClick={() => setEditingId(s.id)}>
                          Edytuj
                        </button>
                        {confirmDelete === s.id ? (
                          <span role="group" aria-label={`Potwierdź usunięcie ${s.name}`} className="flex items-center gap-2">
                            <button
                              type="button"
                              className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-rose-600"
                              onClick={() => {
                                onDelete(s.id)
                                setConfirmDelete(null)
                                setAnnounce(`Usunięto stronę „${s.name}”.`)
                              }}
                            >
                              Tak, usuń
                            </button>
                            <button type="button" className={btnGhost} onClick={() => setConfirmDelete(null)}>
                              Anuluj
                            </button>
                          </span>
                        ) : (
                          <button type="button" className={`${btnGhost} text-rose-800`} aria-label={`Usuń ${s.name}`} onClick={() => setConfirmDelete(s.id)}>
                            Usuń
                          </button>
                        )}
                        </>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-6">
      {runLog}
      <aside aria-labelledby="programs" className="h-fit rounded-xl border border-slate-200 bg-white p-5">
        <h2 id="programs" className="text-base font-semibold">
          Programy
        </h2>
        <p className="mt-1 text-sm text-slate-600">Odznacz programy, które Cię nie interesują. Ich nabory znikną z osi czasu i listy.</p>
        <ul className="mt-4 space-y-2">
          {programs.map((p) => {
            const followed = !hiddenPrograms.includes(p.name)
            return (
              <li key={p.name}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <input type="checkbox" checked={followed} onChange={() => onToggleProgram(p.name)} className="mt-0.5 h-4 w-4 accent-indigo-700" />
                  <span className="min-w-0">
                    <span className={`block text-sm font-medium ${followed ? 'text-slate-900' : 'text-slate-500 line-through'}`}>{p.name}</span>
                    <span className="text-xs text-slate-600">naborów: {p.count}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </aside>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  )
}

function SourceForm({
  initial,
  existing,
  editingId,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: SourceDraft
  existing: Source[]
  editingId?: string
  submitLabel: string
  onSubmit: (d: SourceDraft) => void
  onCancel?: () => void
}) {
  const uid = useId()
  const [draft, setDraft] = useState<SourceDraft>(initial)
  const [errors, setErrors] = useState<ReturnType<typeof validateSource>>({})
  const set = <K extends keyof SourceDraft>(k: K, v: SourceDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const news = draft.type === 'wiadomości'
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateSource(draft, existing, editingId)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const first = Object.keys(errs)[0]
      document.getElementById(`${uid}-${first}`)?.focus()
      return
    }
    const query = draft.query?.trim()
    onSubmit(
      news
        ? { ...draft, name: draft.name.trim(), query: query || undefined, url: draft.url.trim(), kind: 'wiadomosci', region: draft.region.trim() }
        : { ...draft, name: draft.name.trim(), url: draft.url.trim(), region: draft.region.trim(), query: undefined, kind: undefined },
    )
    if (!editingId) setDraft(EMPTY)
  }

  const field = (k: keyof SourceDraft) => ({
    id: `${uid}-${k}`,
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined,
  })
  const err = (k: keyof SourceDraft) =>
    errors[k] && (
      <span id={`${uid}-${k}-err`} className="mt-1 block text-xs text-rose-800">
        {errors[k]}
      </span>
    )

  return (
    <form noValidate onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2" aria-label={editingId ? 'Edycja strony' : 'Nowa strona'}>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-slate-800">Co monitorować</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {(
            [
              [false, 'Strona www z ogłoszeniami'],
              [true, 'Wiadomości (kanał RSS)'],
            ] as const
          ).map(([isNews, text]) => (
            <label
              key={text}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${news === isNews ? 'border-indigo-600 bg-indigo-50 text-indigo-950' : 'border-slate-300 bg-white text-slate-800'}`}
            >
              <input
                type="radio"
                name={`${uid}-mode`}
                checked={news === isNews}
                onChange={() => set('type', isNews ? 'wiadomości' : initial.type === 'wiadomości' ? 'LGD' : initial.type)}
                className="accent-indigo-700"
              />
              {text}
            </label>
          ))}
        </div>
        {news && (
          <p className="mt-2 text-xs text-slate-600">
            Wklej adres kanału RSS portalu z wiadomościami (regionalnego, branżowego) albo strony LGD – na WordPressie zwykle kończy się na <code>/feed/</code>. Agent
            wybierze artykuły o nowych naborach; słowa kluczowe zawężą wynik. To sygnał – szczegóły potwierdź u instytucji. Google News i kanał Bing nie pozwalają na
            takie użycie (robots.txt, regulamin), dlatego ich nie podpinamy.
          </p>
        )}
      </fieldset>
      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor={`${uid}-name`}>
          Nazwa
        </label>
        <input
          {...field('name')}
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          className={input}
          placeholder={news ? 'np. Wiadomości – agroturystyka Małopolska' : 'np. LGD Dolina Raby – nabory'}
        />
        {err('name')}
      </div>
      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor={`${uid}-url`}>
          {news ? 'Adres kanału RSS' : 'Adres strony (URL)'}
        </label>
        <input {...field('url')} type="url" inputMode="url" value={draft.url} onChange={(e) => set('url', e.target.value)} className={input} placeholder={news ? 'https://portal.pl/feed/' : 'https://…'} />
        {err('url')}
      </div>
      {news && (
        <div>
          <label className="text-sm font-medium text-slate-800" htmlFor={`${uid}-query`}>
            Słowa kluczowe (filtr, opcjonalnie)
          </label>
          <input {...field('query')} value={draft.query ?? ''} onChange={(e) => set('query', e.target.value)} className={input} placeholder="np. agroturystyka małopolskie" />
          {err('query')}
        </div>
      )}
      {!news && (
      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor={`${uid}-type`}>
          Typ źródła
        </label>
        <select {...field('type')} value={draft.type} onChange={(e) => set('type', e.target.value as SourceType)} className={input}>
          {SOURCE_TYPES.filter((t) => t !== 'wiadomości').map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      )}
      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor={`${uid}-region`}>
          Region
        </label>
        <input {...field('region')} value={draft.region} onChange={(e) => set('region', e.target.value)} className={input} placeholder="np. małopolskie" list={`${uid}-regions`} />
        <datalist id={`${uid}-regions`}>
          <option value="cała Polska" />
          <option value="małopolskie" />
          <option value="śląskie" />
          <option value="podkarpackie" />
        </datalist>
        {err('region')}
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-800" htmlFor={`${uid}-notes`}>
          Notatka (opcjonalnie)
        </label>
        <input {...field('notes')} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} className={input} placeholder="np. ogłoszenia są w PDF w zakładce Aktualności" />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className={btnPrimary}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={btnGhost} onClick={onCancel}>
            Anuluj
          </button>
        )}
      </div>
    </form>
  )
}

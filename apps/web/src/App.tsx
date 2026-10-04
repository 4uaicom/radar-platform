import { useEffect, useMemo, useState } from 'react'
import type { Grant, MyStatus, Source, UserState } from './types'
import { catalogSources } from './data/mock'
import { realGrants } from './data/real'
import { EMPTY_FILTERS, REMIND_STATUSES, allForWhom, applyPreferences, listPrograms, programOf, computeStatus, daysLeft, filterGrants, sortByDeadline, type Filters } from './lib/grants'
import { Legend, Timeline, type Zoom } from './components/Timeline'
import { ListView } from './components/ListView'
import { GrantModal } from './components/GrantModal'
import { FiltersBar } from './components/FiltersBar'
import { SourcesPanel } from './components/SourcesPanel'
import { CheckNowButton, RunLog, RunResult } from './components/AgentPanel'
import { mergeStoredSources, sourceNotice, sourcesToCheck, type AgentRun } from './lib/agentRun'
import { canReadSource } from './agent/live'
import { liveCheck } from './agent/client'
import { programLink } from './agent/programs'
import { MatchPanel } from './components/MatchPanel'
import { aiCheck } from './match/client'
import type { AiMatch, ClientProfile } from './match/types'
import { rankGrants } from './match/rules'
import { markSeen, newMatches } from './match/alerts'
import { compactStored, mb, saveWithStatus, type StorageStatus } from './lib/storage'
import type { CheckResult } from './agent/common'

const STORAGE_KEY = 'radar-grantow:v1'

const TABS = ['nabory', 'zrodla', 'dopasowanie'] as const
type Tab = (typeof TABS)[number]

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}


const IN_PROGRESS: MyStatus[] = ['Analizuję', 'Obserwuję', 'Przygotowuję wniosek', 'Złożony', 'W ocenie']

const DEFAULT_STATE: UserState = { my_status: 'Nowy', note: '', seen: true }

type Overrides = Record<string, Grant['manual_overrides']>

interface Stored {
  state: Record<string, UserState>
  overrides: Overrides
  sources: Source[]
  hiddenPrograms: string[]
  runs?: AgentRun[]
  /** Nabory odczytane na żywo, per strona (zastępują dane z 26.09.2026 dla tej strony) */
  live?: Record<string, LiveData>
  /** Moduł „Dopasowanie klienta”: ankiety klientów i opinie AI (klucz `klient:nabór`) */
  profiles?: ClientProfile[]
  aiChecks?: Record<string, AiMatch>
}

interface LiveData {
  grants: Grant[]
  fetched_at: string
}

interface Props {
  today?: Date
  initialGrants?: Grant[]
  /** Startowa baza stron (domyślnie katalog Radaru) */
  initialSources?: Source[]
  persist?: boolean
  /** Klucz zapisu – osobny dla każdej organizacji */
  storageKey?: string
  /** Menu konta w nagłówku (logowanie) */
  headerRight?: React.ReactNode
  /** Pasek nad treścią, np. informacja o okresie próbnym */
  banner?: React.ReactNode
  /** Limit własnych stron z planu (null = bez limitu) */
  ownSourcesLimit?: number | null
  /** Opis harmonogramu dla stron firmy, np. „codziennie o 6:00” */
  ownScanLabel?: string
  /** Sprawdzenie jednej strony (domyślnie serwer /api/check; w testach atrapa) */
  checker?: (source: Source) => Promise<CheckResult>
  /** Druga opinia z AI (domyślnie serwer /api/ai-match; w testach atrapa) */
  aiChecker?: typeof aiCheck
  /** Pamięć przeglądarki (w testach – atrapa o małej pojemności) */
  store?: Storage
  /** Historia sprawdzeń jest w ustawieniach firmy (Root) – App przekazuje przebiegi i otwiera ją na żądanie */
  onRunsChange?: (runs: AgentRun[]) => void
  onShowHistory?: () => void
  /** E-mail zalogowanej osoby (rozpoznanie jej poczty przy e-mailu do klienta) */
  userEmail?: string
}

export default function App({ today: todayProp, initialGrants, initialSources = catalogSources, persist = true, storageKey = STORAGE_KEY, headerRight, banner, ownSourcesLimit = null, ownScanLabel = 'codziennie o 6:00', checker = liveCheck, aiChecker = aiCheck, store, onRunsChange, onShowHistory, userEmail }: Props) {
  const [today] = useState(() => todayProp ?? new Date())
  const baseGrants = useMemo(() => initialGrants ?? realGrants, [initialGrants])
  const [stored] = useState<Stored>(() => {
    const empty: Stored = { state: {}, overrides: {}, sources: initialSources, hiddenPrograms: [] }
    if (!persist) return empty
    const saved = load<Partial<Stored>>(storageKey, {})
    return { ...empty, ...saved, sources: mergeStoredSources(saved.sources, initialSources) }
  })

  const [userState, setUserState] = useState<Record<string, UserState>>(stored.state)
  const [overrides, setOverrides] = useState<Overrides>(stored.overrides)
  // starsze zapisy w przeglądarce nie mają pola origin → traktujemy jako katalog
  const [sources, setSources] = useState<Source[]>(() => stored.sources.map((x) => ({ ...x, origin: x.origin ?? 'katalog' })))
  const [hiddenPrograms, setHiddenPrograms] = useState<string[]>(stored.hiddenPrograms)
  const [tab, setTab] = useState<Tab>('nabory')
  const [runs, setRuns] = useState<AgentRun[]>(() => (stored.runs ?? []).filter((r) => !r.test_mode)) // bez symulowanych przebiegów z wcześniejszej wersji
  const [live, setLive] = useState<Record<string, LiveData>>(stored.live ?? {})
  const [profiles, setProfiles] = useState<ClientProfile[]>(stored.profiles ?? [])
  const [aiChecks, setAiChecks] = useState<Record<string, AiMatch>>(stored.aiChecks ?? {})
  const [running, setRunning] = useState<{ done: number; total: number; current: string } | null>(null)
  const [lastRun, setLastRun] = useState<AgentRun | null>(null)

  /** „Sprawdź teraz” – ręczny przebieg agenta: strony z czytnikiem pytamy serwer, pozostałe oznaczamy „w przygotowaniu”. */
  const checkNow = () => runCheck(sourcesToCheck(sources), sources.length - sourcesToCheck(sources).length)

  /** Przebieg agenta dla podanych stron (wszystkie aktywne albo jedna – np. zaraz po dodaniu). */
  const runCheck = async (list: Source[], skipped: number) => {
    if (running) return
    const started = new Date().toISOString()
    const errors: AgentRun['errors'] = []
    let added = 0
    let changed = 0
    const okIds = new Set<string>()
    const failed = new Map<string, string>()
    const nextLive = { ...live }
    setLastRun(null)
    for (let i = 0; i < list.length; i++) {
      const s = list[i]
      setRunning({ done: i, total: list.length, current: s.name })
      if (!canReadSource(s)) {
        errors.push({ source: s.name, message: sourceNotice(s) ?? 'Czytnik w przygotowaniu.', kind: 'w_przygotowaniu' })
        continue
      }
      const res = await checker(s)
      if (!res.ok) {
        const message = res.message ?? 'Nie udało się odczytać strony.'
        errors.push({ source: s.name, message, kind: 'blad' })
        failed.set(s.id, message)
        // strona odczytana, ale bez naborów → znikają stare (np. błędnie wzięte linki z menu)
        if (res.empty) nextLive[s.id] = { grants: [], fetched_at: res.fetched_at }
        continue
      }
      okIds.add(s.id)
      const before = new Map(grantsForSource(s.id).map((g) => [g.id, g]))
      const fresh = res.grants.map((g) => {
        const old = before.get(g.id)
        if (!old) {
          added++
          return g
        }
        const moved = old.opens_at !== g.opens_at || old.closes_at !== g.closes_at
        if (moved) changed++
        return moved ? { ...g, updated: true } : { ...g, updated: old.updated }
      })
      nextLive[s.id] = { grants: fresh, fetched_at: res.fetched_at }
    }
    setLive(nextLive)
    const finished = new Date().toISOString()
    setSources((all) =>
      all.map((x) =>
        okIds.has(x.id) ? { ...x, last_checked_at: finished, last_error: undefined } : failed.has(x.id) ? { ...x, last_checked_at: finished, last_error: failed.get(x.id) } : x,
      ),
    )
    const run: AgentRun = {
      id: `run-${Date.now().toString(36)}`,
      trigger: 'ręcznie',
      started_at: started,
      finished_at: finished,
      checked: okIds.size,
      skipped,
      new_grants: added,
      updated_grants: changed,
      errors,
      test_mode: false,
    }
    setRuns((r) => [run, ...r].slice(0, 50))
    setLastRun(run)
    setRunning(null)
  }
  useEffect(() => {
    onRunsChange?.(runs)
  }, [runs, onRunsChange])
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [view, setView] = useState<'timeline' | 'lista'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'lista' : 'timeline',
  )
  const [zoom, setZoom] = useState<Zoom>('kwartal')
  const [openId, setOpenId] = useState<string | null>(null)

  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  useEffect(() => {
    if (!persist) return
    const target = store ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
    if (target) setStorageStatus(saveWithStatus(storageKey, { state: userState, overrides, sources, hiddenPrograms, runs, live, profiles, aiChecks }, target))
  }, [userState, overrides, sources, hiddenPrograms, runs, live, profiles, aiChecks, persist, storageKey, store])
  /** Zwolnij miejsce: stara historia, odczyty wyłączonych stron, stan nieistniejących naborów (bez notatek i statusów). */
  const freeSpace = () => {
    const c = compactStored({ runs, live, state: userState }, new Set(sources.filter((x) => x.active).map((x) => x.id)), new Set(grants.map((g) => g.id)))
    setRuns(c.runs ?? [])
    setLive(c.live ?? {})
    setUserState(c.state as typeof userState)
  }

  // dla stron odczytanych na żywo – świeże dane zamiast zapisu z 26.09.2026
  const merged = useMemo(
    () =>
      [...baseGrants.filter((g) => !live[g.source_id]), ...Object.values(live).flatMap((x) => x.grants)].map((g) =>
        g.program ? { ...g, program: { ...g.program, url: programLink(g.program.name) ?? g.program.url } } : g,
      ),
    [baseGrants, live],
  )
  const grantsForSource = (id: string) => merged.filter((g) => g.source_id === id)
  const grants = useMemo(
    () => merged.map((g) => ({ ...g, manual_overrides: { ...g.manual_overrides, ...overrides[g.id] } })),
    [merged, overrides],
  )

  const catalogReadable = sources.filter((x) => x.origin === 'katalog' && x.kind !== 'odniesienie')
  const catalogPaused = catalogReadable.length > 0 && catalogReadable.every((x) => !x.active)
  const { visible: visibleAll, hiddenByProgram } = useMemo(() => applyPreferences(grants, sources, hiddenPrograms), [grants, sources, hiddenPrograms])
  // usunięte z listy – nie liczą się w statystykach ani dopasowaniach klientów; widać je tylko w „Pokaż usunięte”
  const visible = useMemo(() => visibleAll.filter((g) => !userState[g.id]?.removed), [visibleAll, userState])
  const removedList = useMemo(() => visibleAll.filter((g) => userState[g.id]?.removed), [visibleAll, userState])
  const [showRemoved, setShowRemoved] = useState(false)
  const closedCount = visible.filter((g) => computeStatus(g, today) === 'zamkniety').length
  const removeClosed = () =>
    setUserState((st) => {
      const next = { ...st }
      for (const g of visible) if (computeStatus(g, today) === 'zamkniety') next[g.id] = { ...DEFAULT_STATE, ...st[g.id], removed: true }
      return next
    })
  // klienci: nowe dopasowania (nabory, które pasują, a klient ich jeszcze nie miał na liście)
  const rankedByClient = useMemo(() => new Map(profiles.map((p) => [p.id, rankGrants(p, visible, sources, today)])), [profiles, visible, sources, today])
  const clientAlerts = profiles.map((p) => ({ p, ids: newMatches(p, rankedByClient.get(p.id) ?? []) })).filter((x) => x.ids.length > 0)
  const alertCount = clientAlerts.reduce((n, x) => n + x.ids.length, 0)
  const liveClients = profiles.filter((p) => !p.archived).length
  // klienci zapisani przed tą funkcją: bieżące dopasowania = punkt odniesienia (bez fałszywych „nowych”)
  useEffect(() => {
    if (profiles.some((p) => !p.seen_matches))
      setProfiles((list) => list.map((p) => (p.seen_matches ? p : markSeen(p, rankGrants(p, visible, sources, today)))))
  }, [profiles, visible, sources, today])
  const programs = useMemo(() => listPrograms(grants.filter((g) => sources.some((s) => s.id === g.source_id))), [grants, sources])
  const grantCounts = useMemo(() => Object.fromEntries(sources.map((s) => [s.id, grants.filter((g) => g.source_id === s.id).length])), [grants, sources])
  const toggleProgram = (name: string) => setHiddenPrograms((h) => (h.includes(name) ? h.filter((x) => x !== name) : [...h, name]))

  const filtered = useMemo(
    () => (showRemoved ? removedList : filterGrants(visible, sources, userState, filters, today)),
    [showRemoved, removedList, visible, sources, userState, filters, today],
  )
  const sorted = useMemo(() => sortByDeadline(filtered, today), [filtered, today])
  const announcements = sorted.filter((g) => computeStatus(g, today) === 'zapowiedz')
  const dated = sorted.filter((g) => computeStatus(g, today) !== 'zapowiedz')

  const stats = {
    nowe: visible.filter((g) => !userState[g.id]?.seen).length,
    koncza: visible.filter((g) => computeStatus(g, today) === 'konczy_sie').length,
    wToku: visible.filter((g) => IN_PROGRESS.includes(userState[g.id]?.my_status ?? 'Nowy')).length,
    otwarte: visible.filter((g) => ['otwarty', 'konczy_sie'].includes(computeStatus(g, today))).length,
  }

  const patchState = (id: string, patch: Partial<UserState>) =>
    setUserState((s) => ({ ...s, [id]: { ...DEFAULT_STATE, ...s[id], ...patch } }))

  const open = (id: string) => {
    patchState(id, { seen: true })
    setOpenId(id)
  }

  const openGrant = grants.find((g) => g.id === openId) ?? null
  const upcomingWatched = visible
    .filter((g) => REMIND_STATUSES.includes(userState[g.id]?.my_status ?? 'Nowy'))
    .map((g) => ({ g, left: daysLeft(g, today) }))
    .filter((x) => x.left !== null && x.left >= 0 && x.left <= 7)

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Przejdź do treści
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold">Radar Grantów</h1>
            <p className="text-sm text-slate-600">Prototyp · nabory z portali – „Sprawdź teraz” odświeża dane; przed decyzją sprawdź u źródła</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="max-w-xs text-right text-xs leading-snug text-slate-600">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Agent: katalog codziennie o 6:00 · Twoje strony {ownScanLabel} · aktywne: {sources.filter((x) => x.active).length}
            </div>
            <CheckNowButton running={running} onCheck={checkNow} />
            <p id="check-progress" className="sr-only" aria-live="polite">
              {running ? `Sprawdzam ${running.current}, ${running.done + 1} z ${running.total}` : ''}
            </p>
            {headerRight}
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-4 sm:px-6">
          <div role="tablist" aria-label="Sekcje" className="flex gap-1">
            {(
              [
                ['nabory', 'Nabory'],
                ['zrodla', `Baza stron i programy (${sources.length})`],
                ['dopasowanie', `Klienci${liveClients ? ` (${liveClients})` : ''}${alertCount ? ` · nowe: ${alertCount}` : ''}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                type="button"
                aria-selected={tab === id}
                aria-controls="main"
                onClick={() => setTab(id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    const i = TABS.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1)
                    const next = TABS.at(i % TABS.length)!
                    setTab(next)
                    document.getElementById(`tab-${next}`)?.focus()
                  }
                }}
                tabIndex={tab === id ? 0 : -1}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                  tab === id ? 'border-indigo-700 text-indigo-800' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>
      {banner}

      <main id="main" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {lastRun && <RunResult run={lastRun} onDismiss={() => setLastRun(null)} onShowLog={onShowHistory ?? (() => setTab('zrodla'))} />}
        {storageStatus && storageStatus.level !== 'ok' && (
          <div
            role={storageStatus.level === 'pelna' ? 'alert' : 'status'}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
              storageStatus.level === 'pelna' ? 'border-rose-300 bg-rose-50 text-rose-950' : 'border-amber-300 bg-amber-50 text-amber-950'
            }`}
          >
            <span>
              {storageStatus.failed ? (
                <>
                  <strong>Pamięć aplikacji jest pełna – ostatnie zmiany nie zostały zapisane.</strong> Po odświeżeniu strony mogą zniknąć. Zwolnij miejsce albo usuń
                  niepotrzebnych klientów i strony.
                </>
              ) : (
                <>
                  <strong>
                    Pamięć aplikacji zajęta w {Math.round((storageStatus.used / storageStatus.limit) * 100)}% ({mb(storageStatus.used)} z {mb(storageStatus.limit)} MB).
                  </strong>{' '}
                  {storageStatus.level === 'pelna' ? 'Za chwilę zapis przestanie działać.' : 'Gdy się zapełni, zmiany przestaną się zapisywać.'} Zwolnij miejsce – Twoje notatki,
                  statusy i klienci zostaną.
                </>
              )}
            </span>
            <button
              type="button"
              onClick={freeSpace}
              className="rounded-lg border border-current bg-white px-3 py-1.5 font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Zwolnij miejsce
            </button>
          </div>
        )}
        {clientAlerts.length > 0 && tab === 'nabory' && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
            <span>
              <strong>Nowe nabory pasują do Twoich klientów:</strong> {clientAlerts.map((x) => `${x.p.name} (${x.ids.length})`).join(', ')}
            </span>
            <button
              type="button"
              onClick={() => setTab('dopasowanie')}
              className="rounded-lg bg-indigo-700 px-3 py-1.5 font-medium text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Pokaż klientów
            </button>
          </div>
        )}
        {catalogPaused && (
          <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span>
              <strong>Wszystkie strony z katalogu Radaru są wstrzymane.</strong> Widzisz tylko nabory z Twoich stron – dlatego może ich być mało albo wcale.
            </span>
            <button
              type="button"
              onClick={() => setSources((list) => list.map((x) => (x.origin === 'katalog' && x.kind !== 'odniesienie' ? { ...x, active: true } : x)))}
              className="rounded-lg bg-amber-900 px-3 py-1.5 font-medium text-white hover:bg-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
            >
              Włącz strony z katalogu
            </button>
          </div>
        )}
        {tab === 'dopasowanie' ? (
          <MatchPanel
            userEmail={userEmail}
            profiles={profiles}
            grants={visible}
            sources={sources}
            today={today}
            aiChecks={aiChecks}
            onSave={(p) => setProfiles((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]))}
            onDelete={(id) => {
              setProfiles((list) => list.filter((x) => x.id !== id))
              setAiChecks((m) => Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith(`${id}:`))))
            }}
            onOpenGrant={open}
            onAi={async (p, g) => {
              const r = await aiChecker(p, g)
              if ('error' in r) return r.error
              setAiChecks((m) => ({ ...m, [`${p.id}:${g.id}`]: r }))
              return null
            }}
          />
        ) : tab === 'zrodla' ? (
          <SourcesPanel
            runLog={onShowHistory ? undefined : <RunLog runs={runs} />}
            sources={sources}
            grantCounts={grantCounts}
            programs={programs}
            hiddenPrograms={hiddenPrograms}
            onToggleProgram={toggleProgram}
            ownSourcesLimit={ownSourcesLimit}
            ownScanLabel={ownScanLabel}
            onAdd={(d) => {
              const added: Source = { ...d, id: `s-${Date.now().toString(36)}`, active: true, origin: 'wlasna', added_at: new Date().toISOString().slice(0, 10) }
              setSources((list) => [...list, added])
              void runCheck([added], 0) // od razu sprawdzamy, czy czytnik znajduje tu nabory
            }}
            onCheckOne={(s) => void runCheck([s], 0)}
            checking={running !== null}
            onUpdate={(id, patch) => setSources((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))}
            onDelete={(id) => setSources((list) => list.filter((x) => x.id !== id))}
          />
        ) : (
        <>
        <section aria-label="Podsumowanie" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Nowe od ostatniej wizyty" value={stats.nowe} accent="text-indigo-700" />
          <Stat label="Otwarte teraz" value={stats.otwarte} accent="text-emerald-700" />
          <Stat label="Kończą się w 7 dni" value={stats.koncza} accent="text-amber-700" />
          <Stat label="Moje w toku" value={stats.wToku} accent="text-slate-900" />
        </section>

        {hiddenByProgram > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <span>
              Ukryto {hiddenByProgram} {hiddenByProgram === 1 ? 'nabór' : 'nabory/naborów'} z programów, których nie śledzisz ({hiddenPrograms.length}).
            </span>
            <button type="button" onClick={() => setTab('zrodla')} className="font-medium text-indigo-700 underline underline-offset-2">
              Zarządzaj programami
            </button>
          </div>
        )}

        {upcomingWatched.length > 0 && (
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Przypomnienie: {upcomingWatched.map((x) => `„${x.g.title}” – ${x.left} dni`).join('; ')}
          </div>
        )}

        {(removedList.length > 0 || closedCount > 0 || showRemoved) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {showRemoved ? (
              <>
                <span>
                  <strong>Usunięte z listy ({removedList.length}).</strong> Otwórz nabór i kliknij „Przywróć na listę”.
                </span>
                <button type="button" onClick={() => setShowRemoved(false)} className="font-medium text-indigo-700 underline underline-offset-2">
                  Wróć do naborów
                </button>
              </>
            ) : (
              <>
                {closedCount > 0 && (
                  <button type="button" onClick={removeClosed} className="font-medium text-indigo-700 underline underline-offset-2">
                    Usuń zakończone z listy ({closedCount})
                  </button>
                )}
                {removedList.length > 0 && (
                  <button type="button" onClick={() => setShowRemoved(true)} className="font-medium text-indigo-700 underline underline-offset-2">
                    Pokaż usunięte ({removedList.length})
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <FiltersBar filters={filters} sources={sources} onChange={setFilters} forWhomOptions={allForWhom(userState)} />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Widok" className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
            {(['timeline', 'lista'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${view === v ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {v === 'timeline' ? 'Oś czasu' : 'Lista'}
              </button>
            ))}
          </div>
          {view === 'timeline' && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Zakres
              <select value={zoom} onChange={(e) => setZoom(e.target.value as Zoom)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5">
                <option value="miesiac">2 miesiące</option>
                <option value="kwartal">4 miesiące</option>
                <option value="polrocze">6 miesięcy</option>
              </select>
            </label>
          )}
        </div>

        {view === 'timeline' ? (
          <>
            {announcements.length > 0 && (
              <section aria-labelledby="zapowiedzi" className="space-y-2">
                <h2 id="zapowiedzi" className="text-sm font-semibold text-slate-800">
                  Zapowiedzi – terminy jeszcze nieznane ({announcements.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  {announcements.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => open(g.id)}
                      className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      {!userState[g.id]?.seen && <span className="h-2 w-2 rounded-full bg-indigo-600" aria-label="nowy" />}
                      {g.title}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <Legend />
            <Timeline grants={dated} sources={sources} state={userState} today={today} zoom={zoom} onOpen={open} />
          </>
        ) : (
          <ListView grants={sorted} sources={sources} state={userState} today={today} onOpen={open} />
        )}
        </>
        )}
      </main>

      <GrantModal
        grant={openGrant}
        source={sources.find((x) => x.id === openGrant?.source_id)}
        userState={openGrant ? userState[openGrant.id] : undefined}
        today={today}
        onClose={() => setOpenId(null)}
        onStatus={(id, s: MyStatus) => patchState(id, { my_status: s })}
        onNote={(id, note) => patchState(id, { note })}
        forWhomOptions={allForWhom(userState)}
        onForWhom={(id, list) => patchState(id, { for_whom: list })}
        onRemove={(id, removed) => patchState(id, { removed: removed || undefined })}
        onHideProgram={(g) => {
          toggleProgram(programOf(g))
          setOpenId(null)
        }}
        onOverride={(id, field, value) => setOverrides((o) => ({ ...o, [id]: { ...o[id], [field]: value || undefined } }))}
      />
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className={`text-2xl font-semibold ${accent}`}>{value}</p>
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  )
}

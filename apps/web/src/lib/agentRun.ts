import type { Source } from '../types'
import { canReadSource } from '../agent/live'

/**
 * Przebieg agenta: „Sprawdź teraz” pyta serwer (/api/check) o każdą stronę z czytnikiem.
 * Strony bez czytnika oznaczamy jako „w przygotowaniu”. Docelowo wynik trafi do tabeli agent_runs w Supabase.
 */

export interface AgentRunError {
  source: string
  message: string
  /** blad = strona nie odpowiada / zmieniła układ; w_przygotowaniu = źródło czeka na osobne połączenie (np. API) */
  kind?: 'blad' | 'w_przygotowaniu'
}

/** Liczba prawdziwych problemów (bez źródeł „w przygotowaniu”). */
export function countProblems(run: AgentRun): number {
  return run.errors.filter((e) => e.kind !== 'w_przygotowaniu').length
}

/**
 * Informacja o źródle, którego agent jeszcze nie czyta na żywo (pokazywana jako ikona z podpowiedzią).
 */
export function sourceNotice(s: Pick<Source, 'id' | 'origin' | 'kind'>): string | null {
  if (s.kind === 'odniesienie' || canReadSource(s)) return null
  if (s.kind === 'agregator')
    return 'Czytnik agregatora jest w przygotowaniu (najpierw sprawdzamy jego regulamin). Na razie pokazujemy nabory odczytane 26.09.2026.'
  return 'Czytnik tej strony jest w przygotowaniu. Na razie pokazujemy nabory odczytane 26.09.2026.'
}

/**
 * Łączy bazę stron zapisaną w przeglądarce z aktualnym katalogiem:
 * katalog zawsze z kodu (z zachowaniem włączenia, częstotliwości i daty sprawdzenia),
 * strony własne z zapisu, przykładowe strony demo (example.org) usuwane.
 */
export function mergeStoredSources(stored: Source[] | undefined, catalog: Source[]): Source[] {
  if (!stored?.length) return catalog
  const byId = new Map(stored.map((x) => [x.id, x]))
  const merged = catalog.map((c) => {
    const s = byId.get(c.id)
    return s ? { ...c, active: s.active, scan_frequency: s.scan_frequency, last_checked_at: s.last_checked_at, last_error: s.last_error } : c
  })
  const catalogIds = new Set(catalog.map((c) => c.id))
  const own = stored.filter((x) => !catalogIds.has(x.id) && (x.origin ?? 'katalog') === 'wlasna' && !x.url.includes('example.org'))
  return [...merged, ...own]
}

export interface AgentRun {
  id: string
  trigger: 'ręcznie' | 'harmonogram'
  started_at: string
  finished_at?: string
  checked: number
  skipped: number
  new_grants: number
  updated_grants: number
  errors: AgentRunError[]
  test_mode: boolean
}

/** Które strony wejdą do przebiegu: aktywne i nie „tylko odniesienie”. */
export function sourcesToCheck(sources: Source[]): Source[] {
  return sources.filter((s) => s.active && s.kind !== 'odniesienie')
}


export function formatTime(iso?: string, today = new Date()): string {
  if (!iso) return 'jeszcze nie sprawdzana'
  const d = new Date(iso)
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? `dziś ${time}` : `${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} ${time}`
}

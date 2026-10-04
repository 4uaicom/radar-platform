import type { Grant, GrantStatus, MyStatus, Source, SourceType, UserState } from '../types'

export const DAY = 24 * 60 * 60 * 1000
export const LOW_CONFIDENCE = 0.7

/** Parsuje datę 'YYYY-MM-DD' jako północ czasu lokalnego (bez przesunięć strefy). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY)
}

/** Wartość pola z uwzględnieniem ręcznych poprawek – poprawki mają pierwszeństwo. */
export function effective(grant: Grant): Grant {
  return { ...grant, ...stripUndefined(grant.manual_overrides) }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>
}

export function computeStatus(grant: Grant, today: Date): GrantStatus {
  const g = effective(grant)
  if (!g.opens_at && !g.closes_at) return 'zapowiedz'
  const t = startOfDay(today)
  if (g.closes_at && parseDate(g.closes_at) < t) return 'zamkniety'
  if (g.opens_at && parseDate(g.opens_at) > t) return 'zapowiedziany'
  if (g.closes_at && daysBetween(t, parseDate(g.closes_at)) < 7) return 'konczy_sie'
  return 'otwarty'
}

export function daysLeft(grant: Grant, today: Date): number | null {
  const g = effective(grant)
  if (!g.closes_at) return null
  return daysBetween(today, parseDate(g.closes_at))
}

export const STATUS_LABEL: Record<GrantStatus, string> = {
  zapowiedz: 'Zapowiedź',
  zapowiedziany: 'Zapowiedziany',
  otwarty: 'Otwarty',
  konczy_sie: 'Kończy się',
  zamkniety: 'Zamknięty',
}

export const MY_STATUSES: MyStatus[] = [
  'Nowy',
  'Analizuję',
  'Obserwuję',
  'Przygotowuję wniosek',
  'Złożony',
  'W ocenie',
  'Przyznany',
  'Odrzucony',
  'Nie dla mnie',
]

/** Statusy, dla których przypominamy o terminie zamknięcia. */
export const REMIND_STATUSES: MyStatus[] = ['Obserwuję', 'Analizuję', 'Przygotowuję wniosek']

export function isLowConfidence(grant: Grant, field: keyof Grant['confidence']): boolean {
  if (field in grant.manual_overrides && (grant.manual_overrides as Record<string, unknown>)[field]) return false
  const c = grant.confidence[field]
  return c !== undefined && c < LOW_CONFIDENCE
}

export interface Filters {
  query: string
  sourceType: SourceType | ''
  region: string
  status: GrantStatus | ''
  myStatus: MyStatus | ''
  forWhom: string
  hideRejected: boolean
  /** Ukryj zakończone nabory (termin minął) */
  hideClosed: boolean
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  sourceType: '',
  region: '',
  status: '',
  myStatus: '',
  forWhom: '',
  hideRejected: true,
  hideClosed: true,
}

export function filterGrants(
  grants: Grant[],
  sources: Source[],
  state: Record<string, UserState>,
  filters: Filters,
  today: Date,
): Grant[] {
  const q = filters.query.trim().toLowerCase()
  return grants.filter((g) => {
    const src = sources.find((s) => s.id === g.source_id)
    const my = state[g.id]?.my_status ?? 'Nowy'
    if (filters.hideRejected && my === 'Nie dla mnie' && filters.myStatus !== 'Nie dla mnie') return false
    if (filters.sourceType && src?.type !== filters.sourceType) return false
    if (filters.region && src?.region !== filters.region) return false
    if (filters.status && computeStatus(g, today) !== filters.status) return false
    if (filters.hideClosed && filters.status !== 'zamkniety' && computeStatus(g, today) === 'zamkniety') return false
    if (filters.myStatus && my !== filters.myStatus) return false
    if (filters.forWhom && !(state[g.id]?.for_whom ?? []).includes(filters.forWhom)) return false
    if (q) {
      const hay = [g.title, g.institution, g.scope, g.beneficiaries, g.call_number, g.program?.name, src?.name]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** Sortowanie listy: najpierw najbliższy termin zamknięcia (zamknięte i bez dat na końcu). */
export function sortByDeadline(grants: Grant[], today: Date): Grant[] {
  const rank = (g: Grant) => {
    const s = computeStatus(g, today)
    if (s === 'zamkniety') return 2
    if (s === 'zapowiedz') return 1
    return 0
  }
  return [...grants].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    const ca = effective(a).closes_at ?? '9999'
    const cb = effective(b).closes_at ?? '9999'
    return ca.localeCompare(cb)
  })
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  return parseDate(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatPLN(value?: number): string {
  if (value === undefined) return '—'
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(value)
}

/** Plik .ics z wydarzeniem całodniowym w dniu zamknięcia naboru. */
export function buildIcs(grant: Grant): string | null {
  const g = effective(grant)
  if (!g.closes_at) return null
  const d = g.closes_at.replace(/-/g, '')
  const next = parseDate(g.closes_at)
  next.setDate(next.getDate() + 1)
  const n = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Radar Grantow//PL',
    'BEGIN:VEVENT',
    `UID:${g.id}@radar-grantow`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${n}`,
    `SUMMARY:Zamknięcie naboru: ${g.title}`,
    `URL:${g.source_url}`,
    'BEGIN:VALARM',
    'TRIGGER:-P7D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Za 7 dni zamknięcie naboru',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export interface ProgramInfo {
  name: string
  url?: string
  count: number
}

/** Unikalne programy z naborów wraz z liczbą naborów. */
export function listPrograms(grants: Grant[]): ProgramInfo[] {
  const map = new Map<string, ProgramInfo>()
  for (const g of grants) {
    const name = g.program?.name ?? 'Bez przypisanego programu'
    const cur = map.get(name) ?? { name, url: g.program?.url, count: 0 }
    cur.count += 1
    map.set(name, cur)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl'))
}

export function programOf(g: Grant): string {
  return g.program?.name ?? 'Bez przypisanego programu'
}

/**
 * Stosuje preferencje użytkownika: tylko nabory z aktywnych źródeł z bazy stron
 * i z programów, których użytkownik nie ukrył.
 */
export function applyPreferences(grants: Grant[], sources: Source[], hiddenPrograms: string[]) {
  const active = new Set(sources.filter((s) => s.active).map((s) => s.id))
  const hidden = new Set(hiddenPrograms)
  const fromActive = grants.filter((g) => active.has(g.source_id))
  const visible = fromActive.filter((g) => !hidden.has(programOf(g)))
  return { visible, hiddenByProgram: fromActive.length - visible.length }
}

export type SourceDraft = Pick<Source, 'name' | 'url' | 'type' | 'region'> & { notes?: string; query?: string; kind?: Source['kind'] }

/** Walidacja nowej/edytowanej strony. Zwraca komunikaty błędów per pole. */
export function validateSource(draft: SourceDraft, existing: Source[], editingId?: string): Partial<Record<keyof SourceDraft, string>> {
  const errors: Partial<Record<keyof SourceDraft, string>> = {}
  if (!draft.name.trim()) errors.name = 'Podaj nazwę strony, np. „LGD Dolina Raby – nabory”.'
  const news = draft.type === 'wiadomości'
  const q = (draft.query ?? '').trim()
  if (news && q && q.length < 3) errors.query = 'Wpisz co najmniej jedno słowo, np. „agroturystyka”, albo zostaw puste.'
  const url = draft.url.trim()
  let parsed: URL | null = null
  try {
    parsed = new URL(url)
  } catch {
    parsed = null
  }
  if (!url) errors.url = news ? 'Podaj adres kanału RSS, np. https://lgd.pl/feed/.' : 'Podaj adres strony z naborami.'
  else if (!parsed || !/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes('.'))
    errors.url = 'Adres musi zaczynać się od https:// lub http://, np. https://lgd.pl/nabory.'
  else {
    const norm = (u: string) => u.trim().replace(/\/+$/, '').toLowerCase()
    const dup = existing.find((s) => s.id !== editingId && norm(s.url) === norm(url) && (s.query ?? '').trim().toLowerCase() === q.toLowerCase())
    if (dup) errors.url = `Ta strona jest już w bazie jako „${dup.name}”.`
  }
  if (!draft.region.trim()) errors.region = 'Podaj region, np. „małopolskie” lub „cała Polska”.'
  return errors
}

export const DEFAULT_FOR_WHOM = ['Ja', '4uai', 'Klient']

/** Wszystkie etykiety „dla kogo”: domyślne + użyte przy naborach. */
export function allForWhom(state: Record<string, UserState>): string[] {
  const used = Object.values(state).flatMap((s) => s.for_whom ?? [])
  return [...new Set([...DEFAULT_FOR_WHOM, ...used])]
}

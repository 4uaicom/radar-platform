import type { Grant } from '../types'
import { endOfMonth, parseDate, type Parsed } from './rules'

/** Wynik sprawdzenia jednej strony (odpowiedź /api/check). */
export interface CheckResult {
  source_id: string
  ok: boolean
  grants: Grant[]
  message?: string
  /** Strona odczytana poprawnie, ale nie ma na niej naborów (stare pozycje z tej strony znikają) */
  empty?: boolean
  fetched_at: string
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

export const USER_AGENT = 'RadarGrantow/0.2 (+https://radar-grantow.4uaicom.workers.dev; agent naborow grantowych)'

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', oacute: 'ó', Oacute: 'Ó',
  bdquo: '„', rdquo: '”', ldquo: '“', rsquo: '’', lsquo: '‘', hellip: '…', laquo: '«', raquo: '»', shy: '',
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? m)
}

/** HTML → czysty tekst w jednej linii. */
export function text(html: string | undefined | null): string {
  if (!html) return ''
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/[\s​]+/g, ' ')
    .trim()
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Linki z Outlooka (safelinks) → prawdziwy adres. */
export function unwrapLink(href: string): string {
  const h = decodeEntities(href.trim())
  if (h.includes('safelinks.protection.outlook.com')) {
    const m = h.match(/[?&]url=([^&]+)/)
    if (m) return decodeURIComponent(m[1])
  }
  return h
}

export interface DatePair {
  opens?: string
  closes?: string
  /** Pewność dat (1 = dzień, 0.5 = miesiąc, 0 = brak) */
  confOpens: number
  confCloses: number
  /** Opis przybliżonych terminów, np. „Planowany start: IV kwartał 2026” */
  notes: string[]
}

/** Zamienia surowe terminy na daty; kwartały zostawia jako opis (bez daty), miesiące – z niską pewnością. */
export function datePair(rawOpens?: string, rawCloses?: string): DatePair {
  const out: DatePair = { confOpens: 0, confCloses: 0, notes: [] }
  const use = (raw: string | undefined, p: Parsed<string>, which: 'opens' | 'closes') => {
    if (!raw) return
    if (p.value && p.note === 'tylko kwartał') {
      out.notes.push(`${which === 'opens' ? 'Planowany start' : 'Planowany koniec'}: ${raw.trim()}`)
      return
    }
    if (!p.value) {
      if (raw.trim()) out.notes.push(`${which === 'opens' ? 'Start' : 'Koniec'}: ${raw.trim()}`)
      return
    }
    const value = p.note === 'tylko miesiąc' && which === 'closes' ? endOfMonth(p.value) : p.value
    if (p.note === 'tylko miesiąc') out.notes.push(`${which === 'opens' ? 'Start' : 'Koniec'} podany tylko jako miesiąc (${raw.trim()})`)
    if (which === 'opens') {
      out.opens = value
      out.confOpens = p.confidence
    } else {
      out.closes = value
      out.confCloses = p.confidence
    }
  }
  use(rawOpens, parseDate(rawOpens), 'opens')
  use(rawCloses, parseDate(rawCloses), 'closes')
  if (out.opens && out.closes && out.opens > out.closes) {
    out.notes.push('Daty w źródle są niespójne – sprawdź w ogłoszeniu')
    out.confOpens = out.confCloses = 0.3
  }
  return out
}

export interface GrantDraft {
  id: string
  source_id: string
  sourceName: string
  title: string
  institution: string
  source_url: string
  dates: DatePair
  announced?: string
  call_number?: string
  budget_total?: number
  max_grant?: number
  funding_percent?: number
  program?: { name: string; url: string }
  beneficiaries?: string
  scope?: string
  notes?: string[]
}

/** Buduje nabór w formacie aplikacji. Każdy nabór ma link do źródła; opis mówi, skąd i kiedy odczytano dane. */
export function makeGrant(d: GrantDraft, today: Date): Grant {
  const day = isoDay(today)
  const notes = [...d.dates.notes, ...(d.notes ?? [])].filter(Boolean)
  const announced = d.announced ?? (d.dates.opens && d.dates.opens < day ? d.dates.opens : day)
  const confidence: Grant['confidence'] = {}
  if (d.dates.opens) confidence.opens_at = d.dates.confOpens * 0.9
  if (d.dates.closes) confidence.closes_at = d.dates.confCloses * 0.9
  if (d.budget_total != null) confidence.budget_total = 0.85
  if (d.max_grant != null) confidence.max_grant = 0.85
  if (d.funding_percent != null) confidence.funding_percent = 0.9
  return {
    id: d.id,
    source_id: d.source_id,
    title: d.title,
    institution: d.institution,
    call_number: d.call_number,
    announced_at: announced,
    opens_at: d.dates.opens,
    closes_at: d.dates.closes,
    budget_total: d.budget_total,
    max_grant: d.max_grant,
    funding_percent: d.funding_percent,
    beneficiaries: d.beneficiaries || 'Nie odczytano – sprawdź w ogłoszeniu.',
    scope: d.scope || 'Nie odczytano – sprawdź w ogłoszeniu.',
    required_docs: [],
    summary_ai: `Odczytane automatycznie ze strony ${d.sourceName} (${day.split('-').reverse().join('.')}), bez AI – regułami.${
      notes.length ? ' ' + notes.join('. ') + '.' : ''
    } Przed decyzją sprawdź ogłoszenie u źródła.`,
    source_url: d.source_url,
    program: d.program,
    attachments: [],
    confidence,
    manual_overrides: {},
  }
}

/** Czy nabór jest jeszcze aktualny (niezamknięty albo bez daty końca). */
export function stillOpen(g: Grant, today: Date): boolean {
  return !g.closes_at || g.closes_at >= isoDay(today)
}

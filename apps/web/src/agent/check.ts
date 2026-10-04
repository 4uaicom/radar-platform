import type { Grant } from '../types'
import { USER_AGENT, type CheckResult, type Fetcher } from './common'
import { PARP_URL, parseParp } from './parp'
import { NCBR_URL, parseNcbr } from './ncbr'
import { NFOSIGW_URL, parseNfosigw } from './nfosigw'
import { FESL_OPEN_URL, feslPageUrl, parseFesl } from './fesl'
import { KE_API, keRequestBody, parseKe } from './ke'
import { explainEmpty, isProcurementPage, readGeneric, safePublicUrl } from './generic'
import { isFeed, parseNewsFeed } from './news'

/** Czytniki portali z katalogu (id strony → sposób odczytu). */
interface Reader {
  name: string
  run: (get: (url: string, init?: RequestInit) => Promise<string>, today: Date) => Promise<Grant[]>
}

const READERS: Record<string, Reader> = {
  c04: {
    name: 'FE SL 2021-2027',
    run: async (get, today) => {
      // najpierw filtr „trwa/planowany” (2 strony po 10), a gdy nic nie zwróci – zwykła lista
      const first = parseFesl(await get(FESL_OPEN_URL), today)
      if (!first.length) return parseFesl(await get(feslPageUrl(1)), today)
      if (first.length < 10) return first
      const seen = new Set(first.map((g) => g.id))
      const more = parseFesl(await get(`${FESL_OPEN_URL}&_pl_slaskie_fes_RecruitmentPortlet_page=2`), today).filter((g) => !seen.has(g.id))
      return [...first, ...more]
    },
  },
  c06: { name: 'PARP', run: async (get, today) => parseParp(await get(PARP_URL), today) },
  c07: { name: 'NCBR', run: async (get, today) => parseNcbr(await get(NCBR_URL), today) },
  c08: { name: 'NFOŚiGW', run: async (get, today) => parseNfosigw(await get(NFOSIGW_URL), today) },
  c09: {
    name: 'KE – Portal Finansowania i Przetargów',
    run: async (get, today) => parseKe(JSON.parse(await get(KE_API, { method: 'POST', body: keRequestBody(today) })), today),
  },
}

/** Strony, które agent umie już czytać na żywo (lista musi być zgodna z live.ts – pilnuje tego test). */
export const READER_IDS = Object.keys(READERS)

// ------------------------------------------------------------------ robots.txt
const robotsCache = new Map<string, string[]>()

/** Zakazane ścieżki dla wszystkich robotów (User-agent: *) i dla nas (RadarGrantow). */
export function disallowedPaths(robots: string): string[] {
  const out: string[] = []
  let applies = false
  let inAgents = false
  for (const line of robots.split(/\r?\n/)) {
    const l = line.replace(/#.*/, '').trim()
    const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === 'user-agent') {
      if (!inAgents) applies = false
      inAgents = true
      if (val === '*' || /radargrantow/i.test(val)) applies = true
    } else {
      inAgents = false
      if (key === 'disallow' && applies && val) out.push(val)
    }
  }
  return out
}

export function allowedByRobots(url: string, disallowed: string[]): boolean {
  const u = new URL(url)
  const path = u.pathname + u.search
  return !disallowed.some((d) => {
    const re = new RegExp('^' + d.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))
    return re.test(path)
  })
}

async function robotsFor(fetcher: Fetcher, url: string): Promise<string[]> {
  const origin = new URL(url).origin
  const cached = robotsCache.get(origin)
  if (cached) return cached
  let rules: string[] = []
  try {
    const r = await fetcher(`${origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } })
    if (r.ok) rules = disallowedPaths(await r.text())
  } catch {
    /* brak robots.txt = brak ograniczeń */
  }
  robotsCache.set(origin, rules)
  return rules
}

// ------------------------------------------------------------------ sprawdzenie jednej strony
/**
 * Pobiera i odczytuje jedną stronę z katalogu. Zasady: własny User-Agent, robots.txt, max 1 zapytanie/s na domenę.
 * Nigdy nie rzuca wyjątku – błąd wraca jako `ok: false` z opisem po polsku.
 */
export async function checkSource(
  sourceId: string,
  fetcher: Fetcher,
  today: Date,
  pauseMs = 1000,
  custom?: { url: string; name: string; query?: string },
): Promise<CheckResult> {
  const fetched_at = new Date().toISOString()
  let reader = READERS[sourceId]
  /** Uniwersalny czytnik: gdy nic nie znajdzie, tu trafia wyjaśnienie dlaczego. */
  let emptyReason: string | undefined
  if (!reader && custom) {
    const url = safePublicUrl(custom.url)
    if (!url) return { source_id: sourceId, ok: false, grants: [], fetched_at, message: 'Adres strony jest nieprawidłowy albo niedozwolony.' }
    reader = {
      name: custom.name,
      run: async (get, t) => {
        const html = await get(url)
        // kanał RSS/Atom (Wiadomości albo /feed/ strony) – artykuły jako sygnały o naborach
        if (isFeed(html)) {
          const news = parseNewsFeed(html, t, sourceId, custom.name, { query: custom.query })
          if (!news.length) emptyReason = custom.query
              ? `W kanale nie ma teraz artykułów o naborach ze słowami „${custom.query}”. Spróbuj ogólniejszych słów albo usuń filtr.`
              : 'W kanale nie ma teraz artykułów o naborach z ostatnich 60 dni.'
          return news
        }
        // daty zwykle są dopiero na stronie ogłoszenia – czytnik wchodzi w kilka najnowszych (limit zapytań, 1/s)
        const found = isProcurementPage(html, url) ? [] : await readGeneric(get, html, url, t, sourceId, custom.name)
        if (!found.length) emptyReason = explainEmpty(html, url)
        return found
      },
    }
  }
  if (!reader) return { source_id: sourceId, ok: false, grants: [], fetched_at, message: 'Czytnik tej strony jest w przygotowaniu.' }
  let lastRequest = 0
  const get = async (url: string, init?: RequestInit) => {
    const disallowed = await robotsFor(fetcher, url)
    if (!allowedByRobots(url, disallowed)) throw new Error(`robots.txt nie pozwala na odczyt ${new URL(url).pathname}`)
    const wait = lastRequest + pauseMs - Date.now()
    if (lastRequest && wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastRequest = Date.now()
    const res = await fetcher(url, { ...init, headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pl,en;q=0.8' } })
    if (!res.ok) throw new Error(`strona odpowiedziała kodem ${res.status}`)
    const type = res.headers.get('content-type') ?? ''
    if (type && !/html|json|xml|text/i.test(type)) throw new Error('to nie jest strona internetowa (np. PDF) – podaj adres strony z listą naborów')
    const body = await res.text()
    return body.length > 3_000_000 ? body.slice(0, 3_000_000) : body
  }
  try {
    const grants = await reader.run(get, today)
    if (grants.length === 0 && READERS[sourceId])
      return { source_id: sourceId, ok: false, grants, fetched_at, message: 'Nie znaleziono żadnych naborów – możliwe, że strona zmieniła wygląd.' }
    // strona klienta odczytana, ale bez ogłoszeń → wynik pusty (czyści stare pozycje) + wyjaśnienie
    if (emptyReason) return { source_id: sourceId, ok: false, empty: true, grants, fetched_at, message: emptyReason }
    return { source_id: sourceId, ok: true, grants, fetched_at }
  } catch (e) {
    return { source_id: sourceId, ok: false, grants: [], fetched_at, message: `Nie udało się odczytać: ${(e as Error).message}.` }
  }
}

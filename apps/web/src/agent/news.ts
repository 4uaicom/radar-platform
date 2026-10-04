import type { Grant } from '../types'
import { datePair, decodeEntities, isoDay, makeGrant, slug, text } from './common'
import { datesFromContext } from './generic'

/**
 * WIADOMOŚCI – artykuły o nowych naborach z kanałów RSS/Atom (portale regionalne, branżowe, strony LGD /feed/).
 * Często pojawiają się, zanim instytucja opublikuje ogłoszenie. Wynik to SYGNAŁ: nabór trafia do „Zapowiedzi”
 * z notatką „potwierdź u źródła”.
 *
 * Czego NIE używamy (sprawdzone 30.09.2026):
 * - Google News RSS i Google Alerts – robots.txt blokuje roboty (/rss/search, /alerts/feeds), a my go respektujemy;
 * - kanał RSS wyszukiwarki Bing – regulamin w samym kanale pozwala tylko na własny, niekomercyjny użytek.
 * Wyszukiwanie po słowach w całych mediach = płatne API z licencją komercyjną (np. GNews) – klucz tylko w sekretach Cloudflare.
 */

/** Słowa kluczowe jako filtr: każde słowo (od 4 liter) musi wystąpić – porównujemy początek słowa, żeby łapać odmianę. */
export function matchesQuery(textToSearch: string, query: string | undefined): boolean {
  const words = (query ?? '').toLowerCase().split(/[^\p{L}\d]+/u).filter((w) => w.length >= 4)
  if (!words.length) return true
  const hay = textToSearch.toLowerCase()
  return words.every((w) => hay.includes(w.slice(0, Math.max(4, Math.min(w.length - 2, 6)))))
}

export const isFeed = (body: string) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)\b/i.test(body)

/** Artykuł musi mówić o naborze/konkursie/dotacji… */
const ABOUT_CALL = /nab[óo]r|konkurs|dotacj|grant|dofinansowan|dopłat|pożyczk|program wsparcia|wniosk/i
/** …a nie o jego wynikach czy aferach. */
const NOT_NEWS_OF_CALL = /wynik|rozstrzygni|list[ay] rankingow|laureat|zwycięz|przyznan[aeo] dotacj|otrzymał|otrzymali|podpisan|kontrol|afer|prokurat|zatrzyman|wyrok|sąd\b/i

interface Item {
  title: string
  link: string
  description: string
  published?: string
  outlet?: string
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? ''
const cdata = (s: string) => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')

/** Bing podaje link przez przekierowanie (apiclick.aspx?url=…) – bierzemy adres artykułu. */
export function articleUrl(link: string): string {
  try {
    const u = new URL(decodeEntities(link.trim()))
    const real = /bing\.com$/i.test(u.hostname) ? u.searchParams.get('url') : null
    return real && /^https?:\/\//.test(real) ? real : u.toString()
  } catch {
    return link.trim()
  }
}

function items(xml: string): Item[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0])
  return blocks.map((b) => {
    const atomLink = b.match(/<link\b[^>]*href="([^"]+)"/i)?.[1]
    const pub = cdata(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'))
    const d = pub ? new Date(pub) : null
    return {
      title: text(cdata(tag(b, 'title'))),
      link: articleUrl(atomLink ?? cdata(tag(b, 'link'))),
      description: text(decodeEntities(cdata(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')))),
      published: d && !isNaN(d.getTime()) ? isoDay(d) : undefined,
      outlet: text(cdata(tag(b, 'News:Source') || tag(b, 'source'))) || undefined,
    }
  })
}

export function parseNewsFeed(
  xml: string,
  today: Date,
  source_id: string,
  sourceName: string,
  { maxAgeDays = 60, limit = 20, query }: { maxAgeDays?: number; limit?: number; query?: string } = {},
): Grant[] {
  const day = isoDay(today)
  const oldest = isoDay(new Date(today.getTime() - maxAgeDays * 86_400_000))
  const seen = new Set<string>()
  const out: Grant[] = []
  for (const it of items(xml)) {
    if (!it.title || !/^https?:\/\//.test(it.link) || seen.has(it.link)) continue
    const all = `${it.title} ${it.description}`
    if (!ABOUT_CALL.test(all) || NOT_NEWS_OF_CALL.test(it.title) || !matchesQuery(all, query)) continue
    if (it.published && it.published < oldest) continue
    const d = datesFromContext(it.description)
    if (d.closes && d.closes < day) continue
    seen.add(it.link)
    const dates = datePair(d.opens, d.closes)
    dates.confOpens = dates.opens ? 0.4 : 0
    dates.confCloses = dates.closes ? 0.4 : 0
    const u = new URL(it.link)
    out.push(
      makeGrant(
        {
          id: `news-${source_id}-${slug(u.host + u.pathname).slice(-50)}`,
          source_id,
          sourceName,
          title: it.title,
          institution: it.outlet ? `${it.outlet} (wiadomości)` : sourceName,
          source_url: it.link,
          dates,
          announced: it.published && it.published <= day ? it.published : undefined,
          notes: [
            'Z wiadomości – to sygnał o naborze, nie ogłoszenie. Potwierdź termin i warunki na stronie instytucji.',
            it.description ? `Fragment: ${it.description.slice(0, 280)}` : '',
          ],
        },
        today,
      ),
    )
    if (out.length >= limit) break
  }
  return out
}

import type { Grant } from '../types'
import { parseAmountPLN, parseDate } from './rules'
import { datePair, makeGrant, slug, stillOpen, text } from './common'

export const NCBR_URL = 'https://www.gov.pl/web/ncbr/harmonogram-konkursow-2026'

/**
 * Harmonogram NCBR: nagłówki <h3> (program) i rozwijane <details> z listą:
 * „Alokacja”, „Ogłoszenie konkursu”, „Rozpoczęcie naboru wniosków”, „Zakończenie naboru wniosków”.
 */
export function parseNcbr(html: string, today: Date, source_id = 'c07', pageUrl = NCBR_URL): Grant[] {
  const out: Grant[] = []
  let program = ''
  const a = html.indexOf('<article')
  const main = a >= 0 ? html.slice(a, html.indexOf('</article>', a) >>> 0) : html
  for (const m of main.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>|<details[^>]*>([\s\S]*?)<\/details>/g)) {
    if (m[1] !== undefined) {
      program = text(m[1])
      continue
    }
    const body = m[2]
    const title = text(body.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1])
    if (!title) continue
    const fields: Record<string, string> = {}
    for (const li of body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      const t = text(li[1])
      const i = t.indexOf(':')
      if (i > 0) fields[t.slice(0, i).trim().toLowerCase()] = t.slice(i + 1).trim()
    }
    const get = (prefix: string) => Object.entries(fields).find(([k]) => k.startsWith(prefix))?.[1]
    const rawAnnounce = get('ogłoszenie')
    const dates = datePair(get('rozpoczęcie'), get('zakończenie'))
    const announced = parseDate(rawAnnounce)
    const notes: string[] = []
    if (rawAnnounce && (!announced.value || announced.confidence < 1)) notes.push(`Ogłoszenie konkursu: ${rawAnnounce}`)
    const allocation = get('alokacja')
    if (allocation && !parseAmountPLN(allocation).value) notes.push(`Alokacja: ${allocation}`)
    const link = [...body.matchAll(/<a[^>]+href="([^"]+)"/g)].map((x) => x[1]).find((h) => /gov\.pl\/web\/ncbr\//.test(h))
    out.push(
      makeGrant(
        {
          id: `ncbr-${slug(title)}-${announced.value ?? dates.opens ?? slug(rawAnnounce ?? '')}`,
          source_id,
          sourceName: 'NCBR – harmonogram konkursów',
          title,
          institution: 'Narodowe Centrum Badań i Rozwoju',
          source_url: link ?? pageUrl,
          dates,
          announced: announced.confidence === 1 ? announced.value! : undefined,
          budget_total: parseAmountPLN(allocation).value ?? undefined,
          program: program ? { name: program, url: pageUrl } : undefined,
          notes,
        },
        today,
      ),
    )
  }
  return out.filter((g) => stillOpen(g, today))
}

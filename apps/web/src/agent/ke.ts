import type { Grant } from '../types'
import { datePair, isoDay, makeGrant, slug } from './common'
import { euProgrammeName, programLink } from './programs'

export const KE_API = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=***&pageSize=25&pageNumber=1'
export const KE_PORTAL = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home'
const TOPIC_URL = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/'

/**
 * Zapytanie do publicznej wyszukiwarki portalu KE: tematy konkursów (typ 1 i 2), otwarte i zapowiedziane,
 * z terminem w ciągu `horizonDays` dni. Odpowiedź jest duża (ok. 30 kB na temat), więc pobieramy 25 tematów.
 */
export function keRequestBody(today: Date, horizonDays = 120): FormData {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const to = from + horizonDays * 86_400_000
  const fd = new FormData()
  const json = (o: unknown) => new Blob([JSON.stringify(o)], { type: 'application/json' })
  fd.append('query', json({ bool: { must: [{ terms: { type: ['1', '2'] } }, { terms: { status: ['31094501', '31094502'] } }, { range: { deadlineDate: { gte: from, lte: to } } }] } }))
  fd.append('languages', json(['en']))
  fd.append('sort', json({ field: 'sortStatus', order: 'ASC' }))
  return fd
}

interface KeResult {
  url?: string
  summary?: string
  metadata?: Record<string, string[] | undefined>
}

const first = (r: KeResult, k: string) => r.metadata?.[k]?.[0]

/**
 * Odpowiedź API KE → nabory. Zostawiamy tematy z najbliższym terminem w ciągu `horizonDays` dni
 * (portal ma ich ponad tysiąc) i najwyżej `limit` pozycji.
 */
export function parseKe(json: { results?: KeResult[] }, today: Date, source_id = 'c09', limit = 40, horizonDays = 120): Grant[] {
  const day = isoDay(today)
  const horizon = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + horizonDays))
  const rows = (json.results ?? [])
    .map((r) => {
      const identifier = first(r, 'identifier') ?? ''
      const deadlines = (r.metadata?.deadlineDate ?? []).map((d) => d.slice(0, 10)).sort()
      const next = deadlines.find((d) => d >= day)
      const start = first(r, 'startDate')?.slice(0, 10)
      const status = first(r, 'status') === '31094501' ? 'zapowiedziany' : 'otwarty'
      return { r, identifier, next, start, status, multi: deadlines.filter((d) => d >= day).length > 1 }
    })
    .filter((x) => x.identifier && x.next && x.next <= horizon)
    .sort((a, b) => a.next!.localeCompare(b.next!))
    .slice(0, limit)

  return rows.map(({ r, identifier, next, start, status, multi }) => {
    const title = (first(r, 'title') ?? r.summary ?? identifier).replace(/\s+/g, ' ').trim()
    const programme = euProgrammeName(identifier)
    const notes = [`Status na portalu KE: ${status}`, 'Kwoty w euro – sprawdź w opisie tematu']
    if (multi) notes.push('Temat ma kilka terminów – pokazujemy najbliższy')
    return makeGrant(
      {
        id: `ke-${slug(identifier)}`,
        source_id,
        sourceName: 'KE – Portal Finansowania i Przetargów (API)',
        title,
        institution: 'Komisja Europejska',
        call_number: identifier,
        source_url: TOPIC_URL + encodeURIComponent(identifier),
        dates: datePair(start, next),
        program: { name: programme, url: programLink(programme) ?? KE_PORTAL },
        beneficiaries: 'Zależnie od tematu – sprawdź warunki udziału w opisie tematu.',
        notes,
      },
      today,
    )
  })
}

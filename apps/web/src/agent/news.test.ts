import { describe, expect, it } from 'vitest'
import newsXml from './fixtures/news.xml?raw'
import { articleUrl, isFeed, matchesQuery, parseNewsFeed } from './news'
import { checkSource } from './check'

const TODAY = new Date(2026, 8, 30)

describe('Wiadomości (artykuły o naborach z mediów)', () => {
  it('filtr słów kluczowych łapie odmianę i wymaga wszystkich słów', () => {
    expect(matchesQuery('Dotacje na rozwój agroturystyki w Małopolsce', 'agroturystyka małopolska')).toBe(true)
    expect(matchesQuery('Dotacje na rozwój agroturystyki na Podkarpaciu', 'agroturystyka małopolska')).toBe(false)
    expect(matchesQuery('cokolwiek', '')).toBe(true)
    const only = parseNewsFeed(newsXml, TODAY, 'n1', 'W', { query: 'pompy ciepła' })
    expect(only.map((g) => g.title)).toEqual(['Nowy program dopłat do pomp ciepła. Wnioski od listopada'])
  })

  it('bierze artykuły o nowych naborach; pomija wyniki, inne tematy, stare i po terminie', () => {
    const grants = parseNewsFeed(newsXml, TODAY, 'n1', 'Wiadomości – agroturystyka')
    expect(grants.map((g) => g.title)).toEqual([
      'Ruszy nabór wniosków na rozwój agroturystyki. Do wzięcia 2 mln zł',
      'Nowy program dopłat do pomp ciepła. Wnioski od listopada',
    ])
    const [a, b] = grants
    expect(a.source_url).toBe('https://www.gazetakrakowska.pl/nabor-agroturystyka/ar/123') // bez przekierowania Binga
    expect(a).toMatchObject({ opens_at: '2026-10-15', closes_at: '2026-11-14', announced_at: '2026-09-28', institution: 'Gazeta Krakowska (wiadomości)' })
    expect(a.summary_ai).toMatch(/sygnał o naborze.*Potwierdź/)
    expect(b.opens_at).toBeUndefined()
    expect(b.summary_ai).toMatch(/NFOŚiGW zapowiada nabór/)
  })

  it('rozpoznaje kanał RSS/Atom i linki Binga', () => {
    expect(isFeed(newsXml)).toBe(true)
    expect(isFeed('<feed xmlns="http://www.w3.org/2005/Atom"><entry/></feed>')).toBe(true)
    expect(isFeed('<!doctype html><html></html>')).toBe(false)
    expect(articleUrl('https://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2fa.pl%2fx&c=1')).toBe('https://a.pl/x')
  })

  it('checkSource: kanał wiadomości; brak artykułów → jasny komunikat', async () => {
    const fetcher = (body: string) => async (url: string) =>
      url.endsWith('robots.txt') ? new Response('', { status: 404 }) : new Response(body, { headers: { 'content-type': 'application/rss+xml' } })
    const url = 'https://portal.pl/feed/'
    const r = await checkSource('n1', fetcher(newsXml), TODAY, 0, { url, name: 'Wiadomości' })
    expect(r.ok).toBe(true)
    expect(r.grants).toHaveLength(2)
    const empty = await checkSource('n1', fetcher('<rss><channel></channel></rss>'), TODAY, 0, { url, name: 'Wiadomości' })
    expect(empty).toMatchObject({ ok: false, empty: true })
    expect(empty.message).toMatch(/W kanale nie ma teraz artykułów/)
    const filtered = await checkSource('n1', fetcher(newsXml), TODAY, 0, { url, name: 'Wiadomości', query: 'fotowoltaika' })
    expect(filtered.message).toMatch(/słowami „fotowoltaika”/)
  })
})

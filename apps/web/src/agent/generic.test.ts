import { describe, expect, it } from 'vitest'
import lgdHtml from './fixtures/lgd.html?raw'
import ezHtml from './fixtures/ezamowienia.html?raw'
import listaHtml from './fixtures/lgd-lista.html?raw'
import ogloszenieHtml from './fixtures/lgd-ogloszenie.html?raw'
import { datesFromContext, datesFromDetail, explainEmpty, isProcurementPage, parseGeneric, readGeneric, safePublicUrl } from './generic'
import { checkSource } from './check'

const TODAY = new Date(2026, 8, 27)
const PAGE = 'https://lgd-dolina.example.pl/aktualnosci/'

describe('uniwersalny czytnik (strony dodane przez klienta)', () => {
  const grants = parseGeneric(lgdHtml, PAGE, TODAY, 'u1', 'LGD Dolina')

  it('bierze ogłoszenia, pomija menu, stopkę, skrypty, social media, stare i zamknięte', () => {
    expect(grants.map((g) => g.title)).toEqual([
      'Nabór wniosków nr 3/2026 – Rozwój działalności gospodarczej',
      'Konkurs grantowy „Aktywne wsie” – ogłoszenie',
      'Ogłoszenie o naborze 3/2026 (PDF)',
    ])
  })

  it('daty z kontekstu: zakres, termin „do”, data publikacji; kwota; niska pewność', () => {
    const [a, b] = grants
    expect(a).toMatchObject({ opens_at: '2026-10-01', closes_at: '2026-10-30', budget_total: 1_200_000 })
    expect(a.confidence.closes_at).toBeLessThan(0.6)
    expect(a.summary_ai).toMatch(/uniwersalnym czytnikiem/)
    expect(b).toMatchObject({ closes_at: '2026-11-30', announced_at: '2026-08-20' })
    expect(b.opens_at).toBeUndefined()
    expect(grants[2].closes_at).toBeUndefined()
    expect(grants[2].summary_ai).toMatch(/nie znaleziono terminu/)
    expect(grants[2].source_url).toBe('https://lgd-dolina.example.pl/files/ogloszenie-o-naborze-3-2026.pdf')
  })

  it('stałe id z adresu → ta sama strona daje te same id (wykrywanie nowości)', () => {
    const again = parseGeneric(lgdHtml, PAGE, TODAY, 'u1', 'LGD Dolina')
    expect(again.map((g) => g.id)).toEqual(grants.map((g) => g.id))
    expect(new Set(grants.map((g) => g.id)).size).toBe(grants.length)
  })

  it('datesFromContext', () => {
    expect(datesFromContext('nabór 01.10.2026 – 30.10.2026')).toEqual({ opens: '2026-10-01', closes: '2026-10-30' })
    expect(datesFromContext('Termin naboru: do 7 listopada 2026 r.')).toEqual({ closes: '2026-11-07' })
    expect(datesFromContext('Dodano 2026-09-01')).toEqual({ published: '2026-09-01' })
    expect(datesFromContext('bez dat')).toEqual({})
  })

  it('bezpieczne adresy: tylko publiczne http(s)', () => {
    expect(safePublicUrl('https://lgd.pl/nabory')).toBe('https://lgd.pl/nabory')
    for (const bad of ['ftp://lgd.pl', 'http://localhost:8080', 'http://192.168.1.1/', 'http://intranet/', 'javascript:alert(1)', 'nie-adres'])
      expect(safePublicUrl(bad)).toBeNull()
  })

  it('checkSource z adresem klienta używa uniwersalnego czytnika', async () => {
    const fetcher = async (url: string) => (url.endsWith('robots.txt') ? new Response('', { status: 404 }) : new Response(lgdHtml, { headers: { 'content-type': 'text/html' } }))
    const r = await checkSource('u1', fetcher, TODAY, 0, { url: PAGE, name: 'LGD Dolina' })
    expect(r.ok).toBe(true)
    expect(r.grants).toHaveLength(3)
    const pdf = await checkSource('u2', async (u: string) => (u.endsWith('robots.txt') ? new Response('', { status: 404 }) : new Response('%PDF', { headers: { 'content-type': 'application/pdf' } })), TODAY, 0, { url: 'https://lgd.pl/a.pdf', name: 'X' })
    expect(pdf.message).toMatch(/to nie jest strona/)
    const local = await checkSource('u3', fetcher, TODAY, 0, { url: 'http://127.0.0.1/', name: 'X' })
    expect(local.message).toMatch(/niedozwolony/)
  })

  it('pomija menu i pomoc serwisu: instrukcje, wyszukiwarki, „ogłoszenie” bez daty', () => {
    const html = `<main>
      <a href="/pl/instrukcja-wypelnienia-wniosku/">Instrukcja wypełnienia wniosku o dofinansowanie</a>
      <a href="/szukaj">Przeglądaj wszystkie konkursy na platformie</a>
      <a href="/ogloszenia/archiwum">Ogłoszenia o udzieleniu zamówienia – archiwum</a>
      <a href="/nabory/7-2026">Nabór 7/2026 – wsparcie dla MŚP</a>
      <a href="/ogloszenia/12">Ogłoszenie o konkursie ofert</a><p>Dodano 10.09.2026</p>
      <a href="/aktualnosci/wnioski">Wnioski o płatność – zmiana formularza</a><p>Opublikowano 15.09.2026</p>
    </main>`
    expect(parseGeneric(html, 'https://lgd.pl/', TODAY, 'u9', 'X').map((g) => g.title)).toEqual([
      'Nabór 7/2026 – wsparcie dla MŚP',
      'Ogłoszenie o konkursie ofert',
    ]) // „Wnioski o płatność – zmiana formularza” to nie nabór
  })
})

describe('uniwersalny czytnik – strony, na których nie ma naborów', () => {
  const fetcherFor = (html: string) => async (url: string) =>
    url.endsWith('robots.txt') ? new Response('', { status: 404 }) : new Response(html, { headers: { 'content-type': 'text/html' } })

  it('e-Zamówienia (przetargi): zero pozycji z menu i jasny komunikat', async () => {
    expect(isProcurementPage(ezHtml, 'https://ezamowienia.gov.pl/pl/')).toBe(true)
    expect(parseGeneric(ezHtml, 'https://ezamowienia.gov.pl/pl/', TODAY, 's-ez', 'X')).toEqual([]) // nawet bez rozpoznania przetargów
    const r = await checkSource('s-ez', fetcherFor(ezHtml), TODAY, 0, { url: 'https://ezamowienia.gov.pl/pl/', name: 'nie wiem' })
    expect(r).toMatchObject({ ok: false, empty: true, grants: [] })
    expect(r.message).toMatch(/przetargami/)
  })

  it('rozpoznaje przetargi po treści także na innej domenie, ale nie myli ich ze stroną LGD', () => {
    expect(isProcurementPage(ezHtml, 'https://zamowienia.gmina.pl/')).toBe(true)
    expect(isProcurementPage(lgdHtml, 'https://lgd-dolina.example.pl/')).toBe(false)
  })

  it('strona wczytywana JavaScriptem i strona bez ogłoszeń – różne podpowiedzi', async () => {
    const spa = '<html><body><div id="root"></div><script src="/app.js"></script></body></html>'
    expect(explainEmpty(spa, 'https://lgd.pl/')).toMatch(/JavaScript/)
    const plain = `<main><h1>O nas</h1><p>${'Lokalna Grupa Działania wspiera rozwój regionu. '.repeat(20)}</p><a href="/o-nas/zarzad">Zarząd stowarzyszenia i jego skład</a></main>`
    const r = await checkSource('s-x', fetcherFor(plain), TODAY, 0, { url: 'https://lgd.pl/', name: 'X' })
    expect(r).toMatchObject({ ok: false, empty: true })
    expect(r.message).toMatch(/Nie znaleziono tu ogłoszeń/)
  })
})

describe('uniwersalny czytnik – prawdziwy układ stron LGD (test 30.09.2026)', () => {
  const PAGE = 'https://lgd-test.pl/nabory/ogloszenia-o-naborze'

  it('z listy bierze tylko ogłoszenia: bez menu, załączników, szkoleń, wyników, unieważnień i naborów z 2025', () => {
    expect(parseGeneric(listaHtml, PAGE, TODAY, 'u1', 'LGD').map((g) => g.title)).toEqual([
      'Ogłoszenie o naborze 5/2026',
      'Ogłoszenie o naborze wniosków o powierzenie grantów nr 3/2026/EFS+',
    ])
  })

  it('daty ze strony ogłoszenia: „od dnia 1 września 2026 r. od godz. 0:00 do 30 września 2026 r.”, kwota, publikacja; bez daty regulaminu', () => {
    expect(datesFromDetail(ogloszenieHtml)).toEqual({ opens: '2026-09-01', closes: '2026-09-30', published: '2026-08-17', amount: '536 912,50 PLN' })
    expect(datesFromContext('od dnia 1 września 2026 r. od godz. 0:00 do 30 września 2026 r.')).toMatchObject({ opens: '2026-09-01', closes: '2026-09-30' })
  })

  it('readGeneric wchodzi w ogłoszenia bez terminu (limit wejść) i uzupełnia daty; niedostępna strona ogłoszenia nie psuje wyniku', async () => {
    const asked: string[] = []
    const get = async (url: string) => {
      asked.push(url)
      if (url.endsWith('ogloszenie-o-naborze-5-2026')) return ogloszenieHtml
      throw new Error('404')
    }
    const grants = await readGeneric(get, listaHtml, PAGE, TODAY, 'u1', 'LGD Test')
    expect(asked).toHaveLength(2)
    const [five, efs] = grants
    expect(five).toMatchObject({ opens_at: '2026-09-01', closes_at: '2026-09-30', budget_total: 536912.5, announced_at: '2026-08-17', call_number: '5/2026' })
    expect(five.summary_ai).toMatch(/ze strony ogłoszenia/)
    expect(efs.closes_at).toBeUndefined()
    expect(efs.call_number).toBe('3/2026/EFS+')
    // limit wejść w ogłoszenia
    asked.length = 0
    await readGeneric(get, listaHtml, PAGE, TODAY, 'u1', 'LGD Test', { details: 1 })
    expect(asked).toHaveLength(1)
  })

  it('zamknięty nabór (termin ze strony ogłoszenia minął) odpada', async () => {
    const late = new Date(2026, 9, 5)
    const grants = await readGeneric(async () => ogloszenieHtml, listaHtml, PAGE, late, 'u1', 'LGD')
    expect(grants.map((g) => g.title)).not.toContain('Ogłoszenie o naborze 5/2026')
  })
})

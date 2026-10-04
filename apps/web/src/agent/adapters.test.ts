import { describe, expect, it, vi } from 'vitest'
import parpHtml from './fixtures/parp.html?raw'
import ncbrHtml from './fixtures/ncbr.html?raw'
import nfosHtml from './fixtures/nfosigw.html?raw'
import feslHtml from './fixtures/fesl.html?raw'
import keJson from './fixtures/ke.json'
import { parseParp } from './parp'
import { parseNcbr } from './ncbr'
import { parseNfosigw } from './nfosigw'
import { parseFesl } from './fesl'
import { parseKe } from './ke'
import { allowedByRobots, checkSource, disallowedPaths, READER_IDS } from './check'
import { LIVE_SOURCE_IDS } from './live'
import { datePair, text, unwrapLink } from './common'
import { programLink } from './programs'

// Fragmenty prawdziwych stron (wrzesień 2026), zapisane w fixtures/.
const TODAY = new Date(2026, 8, 27)
const byTitle = <T extends { title: string }>(xs: T[], t: string) => xs.find((x) => x.title.includes(t))!

describe('pomocnicze', () => {
  it('tekst z HTML, encje i linki z Outlooka', () => {
    expect(text('<p>Wniosk&oacute;w&nbsp;<strong>7 sierpnia&nbsp;2026</strong></p>')).toBe('Wniosków 7 sierpnia 2026')
    expect(unwrapLink('https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.gov.pl%2Fweb%2Fx&amp;data=1')).toBe('https://www.gov.pl/web/x')
  })
  it('kwartał → opis bez daty, miesiąc → pierwszy/ostatni dzień z niską pewnością', () => {
    const q = datePair('III/IV kwartał 2026', '')
    expect(q.opens).toBeUndefined()
    expect(q.notes[0]).toMatch(/Planowany start: III\/IV kwartał 2026/)
    expect(datePair('listopad 2026 r.', 'styczeń/luty 2027 r.')).toMatchObject({ opens: '2026-11-01', closes: '2027-01-31', confOpens: 0.5 })
    expect(datePair('8 maja 2026', '')).toMatchObject({ opens: '2026-05-08', confOpens: 1 })
    const m = datePair('05.2024', '12.2026')
    expect(m).toMatchObject({ opens: '2024-05-01', closes: '2026-12-31', confOpens: 0.5, confCloses: 0.5 })
  })
})

describe('PARP – harmonogram', () => {
  const grants = parseParp(parpHtml, TODAY)
  it('jedna pozycja na nabór z bieżącą rundą; zamknięte pomija', () => {
    expect(grants.filter((g) => g.title === 'INDUSTRYLAB GREEN')).toHaveLength(1)
    expect(byTitle(grants, 'INDUSTRYLAB')).toMatchObject({ opens_at: '2026-08-01', closes_at: '2026-09-30', max_grant: 400000 })
    expect(byTitle(grants, 'INDUSTRYLAB').summary_ai).toMatch(/koniec całego naboru: 31.08.2027/)
    expect(grants.some((g) => g.title.includes('zakończony'))).toBe(false)
  })
  it('daty, kwoty, program i link do karty naboru', () => {
    expect(byTitle(grants, 'Horizon Bridge')).toMatchObject({ opens_at: '2026-10-15', closes_at: '2026-12-15', max_grant: 66000, source_url: 'https://www.parp.gov.pl/component/grants/grants/program-horizon-bridge' })
    expect(byTitle(grants, 'EDIH').program?.name).toMatch(/FENG/)
    expect(byTitle(grants, 'EDIH').scope).toMatch(/transformacji cyfrowej/)
    const month = byTitle(grants, 'Przepis na rozwój')
    expect(month).toMatchObject({ opens_at: '2024-05-01', closes_at: '2026-12-31' })
    expect(month.confidence.closes_at).toBeLessThan(0.6)
  })
})

describe('NCBR – harmonogram', () => {
  const grants = parseNcbr(ncbrHtml, TODAY)
  it('odczytuje konkursy, pomija zakończone i nagłówki spoza artykułu', () => {
    expect(grants.map((g) => g.title)).toEqual([
      'Działanie FENG.01.01 Ścieżka SMART – Projekty realizowane w konsorcjach',
      'AGROSTRATEG II',
      'HYDROSTRATEG V',
    ])
  })
  it('daty słowne, data ogłoszenia, alokacja i program', () => {
    expect(grants[0]).toMatchObject({ announced_at: '2026-07-01', opens_at: '2026-08-07', closes_at: '2026-10-16' })
    expect(grants[0].program?.name).toBe('Fundusze Europejskie dla Nowoczesnej Gospodarki')
    expect(grants[0].summary_ai).toMatch(/Alokacja: w trakcie ustalania/)
    expect(grants[2]).toMatchObject({ budget_total: 200_000_000, closes_at: '2026-12-31', program: { name: 'Programy strategiczne' } })
  })
  it('kwartały → zapowiedź bez dat z opisem terminu', () => {
    const a = grants[1]
    expect(a.opens_at).toBeUndefined()
    expect(a.budget_total).toBe(100_000_000)
    expect(a.summary_ai).toMatch(/Planowany start: I kw. 2027/)
  })
})

describe('NFOŚiGW – tabela', () => {
  const grants = parseNfosigw(nfosHtml, TODAY)
  it('wiersze, sekcje, kontynuacje i pomijanie zamkniętych', () => {
    expect(grants.map((g) => g.title)).toEqual([
      '1.1 Budowa/rozbudowa sieci elektroenergetycznych na potrzeby ogólnodostępnych stacji ładowania dużych mocy',
      '1.4 Energia dla wsi',
      '1.12 Poprawa efektywności energetycznej wielorodzinnych budynków mieszkalnych na terenach wiejskich',
      'Fundusz Transformacji Ciepłownictwa',
      '6.4 Współfinansowanie Programu LIFE',
      '6.4 Współfinansowanie Programu LIFE',
      '2.4 Działanie FENX.02.04 Adaptacja do zmian klimatu',
    ])
    expect(new Set(grants.map((g) => g.id)).size).toBe(grants.length)
  })
  it('daty ISO i z kropkami, numer naboru, link (także z Outlooka), program z sekcji', () => {
    expect(byTitle(grants, 'Energia dla wsi')).toMatchObject({ opens_at: '2026-10-01', closes_at: '2026-12-31', program: { name: 'Transformacja energetyczna' } })
    expect(byTitle(grants, 'Ciepłownictwa')).toMatchObject({ opens_at: '2026-12-01', closes_at: '2027-03-31' })
    expect(byTitle(grants, '1.12')).toMatchObject({ call_number: '26/NC/UR/1.12/2026', source_url: 'https://www.gov.pl/web/nfosigw/nabor-20220' })
    expect(grants[5].source_url).toBe('https://www.gov.pl/web/nfosigw/nabor-life-2026')
    expect(byTitle(grants, 'FENX')).toMatchObject({ call_number: 'FENX.02.04-IW.01-001/26', program: { name: 'Fundusze Europejskie na Infrastrukturę, Klimat i Środowisko' } })
    expect(byTitle(grants, '1.1 ').summary_ai).toMatch(/Planowany start: III\/IV kwartał 2026/)
  })
})

describe('FE SL – lista naborów', () => {
  const grants = parseFesl(feslHtml, TODAY)
  it('odczytuje nabór i pomija zakończony', () => {
    expect(grants).toHaveLength(1)
    expect(grants[0]).toMatchObject({
      id: 'fesl-593',
      title: '5.14 Usługi rozwojowe dla kadr administracji samorządowej',
      institution: 'Wojewódzki Urząd Pracy w Katowicach',
      call_number: 'FESL.05.14-IP.02-350/26',
      announced_at: '2026-08-28',
      opens_at: '2026-08-31',
      closes_at: '2026-10-30',
      funding_percent: 85,
      source_url: 'https://funduszeue.slaskie.pl/nabory/lsi/593/',
    })
    expect(grants[0].summary_ai).toMatch(/Status na portalu: Trwa nabór/)
  })
})

describe('KE – API wyszukiwarki', () => {
  const grants = parseKe(keJson, TODAY)
  it('najbliższy przyszły termin, sortowanie, pomija stare tematy', () => {
    expect(grants.map((g) => g.call_number)).toEqual(['CEF-T-2021-AFIFGEN-WORKS-ZE', 'LIFE-2026-SAP-NAT'])
    expect(grants[0]).toMatchObject({ closes_at: '2026-10-01', institution: 'Komisja Europejska' })
    expect(grants[0].source_url).toMatch(/topic-details\/CEF-T-2021-AFIFGEN-WORKS-ZE$/)
    expect(grants[0].summary_ai).toMatch(/kilka terminów/)
  })
  it('pełna nazwa programu UE i link do jego strony', () => {
    expect(grants[0].program).toEqual({ name: 'Program UE: Instrument „Łącząc Europę” (CEF)', url: expect.stringContaining('connecting-europe-facility') })
    expect(grants[1].program?.name).toBe('Program UE: LIFE – środowisko i klimat')
  })
  it('horyzont 120 dni', () => {
    expect(parseKe(keJson, TODAY, 'c09', 40, 400).map((g) => g.call_number)).toContain('HORIZON-CL5-2027-01-D3-02')
  })
})

describe('robots.txt i sprawdzanie strony', () => {
  it('reguły dla * i dla Radaru', () => {
    const d = disallowedPaths('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\nDisallow: /*?print=1$\n')
    expect(d).toEqual(['/admin', '/*?print=1$'])
    expect(allowedByRobots('https://x.pl/harmonogram', d)).toBe(true)
    expect(allowedByRobots('https://x.pl/admin/panel', d)).toBe(false)
    expect(allowedByRobots('https://x.pl/a?print=1', d)).toBe(false)
  })

  it('checkSource: robots.txt, User-Agent, wynik; błąd strony jako komunikat', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /admin', { status: 200 })
      return new Response(parpHtml, { status: 200 })
    })
    const ok = await checkSource('c06', fetcher, TODAY, 0)
    expect(ok.ok).toBe(true)
    expect(ok.grants.length).toBeGreaterThan(2)
    const call = fetcher.mock.calls.find((c) => String(c[0]).includes('harmonogram'))! as unknown as [string, RequestInit]
    expect((call[1].headers as Record<string, string>)['User-Agent']).toMatch(/RadarGrantow/)

    const failing = vi.fn(async (url: string) => (url.endsWith('/robots.txt') ? new Response('', { status: 404 }) : new Response('x', { status: 503 })))
    const bad = await checkSource('c07', failing, TODAY, 0)
    expect(bad).toMatchObject({ ok: false, grants: [] })
    expect(bad.message).toMatch(/kodem 503/)

    const empty = await checkSource('c08', async () => new Response('<html></html>'), TODAY, 0)
    expect(empty.message).toMatch(/zmieniła wygląd/)
    expect((await checkSource('c10', fetcher, TODAY)).message).toMatch(/w przygotowaniu/)
  })

  it('czytniki mają: FE SL, PARP, NCBR, NFOŚiGW, KE', () => {
    expect([...READER_IDS].sort()).toEqual([...LIVE_SOURCE_IDS].sort())
    expect([...LIVE_SOURCE_IDS].sort()).toEqual(['c04', 'c06', 'c07', 'c08', 'c09'])
  })
})

describe('strony programów', () => {
  it('oficjalne strony programów zamiast harmonogramów', () => {
    expect(programLink('Fundusze Europejskie dla Nowoczesnej Gospodarki (FENG)')).toBe('https://nowoczesnagospodarka.gov.pl/')
    expect(programLink('FENG')).toBe('https://nowoczesnagospodarka.gov.pl/')
    expect(programLink('Fundusze Europejskie dla Rozwoju Społecznego (FERS)')).toBe('https://rozwojspoleczny.gov.pl/')
    expect(programLink('Fundusze Europejskie na Infrastrukturę, Klimat i Środowisko')).toBe('https://feniks.gov.pl/')
    expect(programLink('Fundusze Europejskie dla Śląskiego 2021-2027, działanie FESL.05.14')).toBe('https://funduszeue.slaskie.pl/')
    expect(programLink('Fundusze Europejskie dla Rybactwa 2021–2027')).toBe('https://rybactwo.gov.pl/')
    expect(programLink('Programy strategiczne')).toBeUndefined()
  })
})

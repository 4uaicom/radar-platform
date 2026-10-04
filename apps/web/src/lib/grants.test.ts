import { describe, expect, it } from 'vitest'
import type { Grant } from '../types'
import { buildIcs, computeStatus, daysLeft, effective, filterGrants, EMPTY_FILTERS, isLowConfidence, sortByDeadline } from './grants'
import { buildMockGrants, sources } from '../data/mock'

const TODAY = new Date(2026, 8, 26) // 26.09.2026

function grant(p: Partial<Grant>): Grant {
  return {
    id: 'x',
    source_id: 's1',
    title: 'Test',
    institution: 'LGD',
    announced_at: '2026-09-01',
    beneficiaries: '',
    scope: '',
    required_docs: [],
    summary_ai: '',
    source_url: 'https://example.org',
    attachments: [],
    confidence: {},
    manual_overrides: {},
    ...p,
  }
}

describe('computeStatus', () => {
  it('bez dat → zapowiedź', () => {
    expect(computeStatus(grant({}), TODAY)).toBe('zapowiedz')
  })
  it('otwarcie w przyszłości → zapowiedziany', () => {
    expect(computeStatus(grant({ opens_at: '2026-10-10', closes_at: '2026-11-10' }), TODAY)).toBe('zapowiedziany')
  })
  it('trwa, >= 7 dni do końca → otwarty', () => {
    expect(computeStatus(grant({ opens_at: '2026-09-01', closes_at: '2026-10-03' }), TODAY)).toBe('otwarty')
  })
  it('trwa, < 7 dni do końca → kończy się', () => {
    expect(computeStatus(grant({ opens_at: '2026-09-01', closes_at: '2026-10-02' }), TODAY)).toBe('konczy_sie')
  })
  it('zamknięcie dziś nadal liczy się jako kończący się', () => {
    expect(computeStatus(grant({ opens_at: '2026-09-01', closes_at: '2026-09-26' }), TODAY)).toBe('konczy_sie')
    expect(daysLeft(grant({ closes_at: '2026-09-26' }), TODAY)).toBe(0)
  })
  it('po terminie → zamknięty', () => {
    expect(computeStatus(grant({ opens_at: '2026-08-01', closes_at: '2026-09-25' }), TODAY)).toBe('zamkniety')
  })
})

describe('manual_overrides', () => {
  it('ręczna poprawka ma pierwszeństwo przed danymi agenta', () => {
    const g = grant({ opens_at: '2026-09-01', closes_at: '2026-09-20', manual_overrides: { closes_at: '2026-10-30' } })
    expect(effective(g).closes_at).toBe('2026-10-30')
    expect(computeStatus(g, TODAY)).toBe('otwarty')
  })
  it('poprawione pole nie jest już oznaczane „Sprawdź”', () => {
    const g = grant({ closes_at: '2026-10-01', confidence: { closes_at: 0.4 } })
    expect(isLowConfidence(g, 'closes_at')).toBe(true)
    expect(isLowConfidence({ ...g, manual_overrides: { closes_at: '2026-10-02' } }, 'closes_at')).toBe(false)
  })
})

describe('filterGrants', () => {
  const grants = buildMockGrants(TODAY)
  it('filtruje po typie źródła', () => {
    const out = filterGrants(grants, sources, {}, { ...EMPTY_FILTERS, sourceType: 'PARP' }, TODAY)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((g) => g.source_id === 's5')).toBe(true)
  })
  it('szuka w tytule i zakresie (bez wielkości liter)', () => {
    const out = filterGrants(grants, sources, {}, { ...EMPTY_FILTERS, query: 'SAUNA' }, TODAY)
    expect(out.map((g) => g.id)).toEqual(['g1'])
  })
  it('domyślnie ukrywa „Nie dla mnie”', () => {
    const state = { g1: { my_status: 'Nie dla mnie' as const, note: '', seen: true } }
    expect(filterGrants(grants, sources, state, EMPTY_FILTERS, TODAY).find((g) => g.id === 'g1')).toBeUndefined()
    expect(filterGrants(grants, sources, state, { ...EMPTY_FILTERS, hideRejected: false }, TODAY).find((g) => g.id === 'g1')).toBeDefined()
  })
})

describe('sortByDeadline', () => {
  it('najbliższy termin pierwszy, zapowiedzi i zamknięte na końcu', () => {
    const out = sortByDeadline(buildMockGrants(TODAY), TODAY).map((g) => computeStatus(g, TODAY))
    const firstAnnouncement = out.indexOf('zapowiedz')
    const firstClosed = out.indexOf('zamkniety')
    expect(out[0]).toBe('konczy_sie')
    expect(firstAnnouncement).toBeLessThan(firstClosed)
    expect(out.slice(0, firstAnnouncement).every((s) => s !== 'zamkniety' && s !== 'zapowiedz')).toBe(true)
  })
})

describe('buildIcs', () => {
  it('tworzy wydarzenie całodniowe z przypomnieniem 7 dni wcześniej', () => {
    const ics = buildIcs(grant({ closes_at: '2026-10-31', title: 'Nabór X' }))!
    expect(ics).toContain('DTSTART;VALUE=DATE:20261031')
    expect(ics).toContain('DTEND;VALUE=DATE:20261101')
    expect(ics).toContain('TRIGGER:-P7D')
  })
  it('bez daty zamknięcia → brak pliku', () => {
    expect(buildIcs(grant({}))).toBeNull()
  })
})

import { applyPreferences, listPrograms, validateSource } from './grants'

describe('applyPreferences / listPrograms', () => {
  const grants = buildMockGrants(TODAY)
  it('ukrywa nabory z ukrytych programów i nieaktywnych źródeł', () => {
    const srcs = sources.map((s) => (s.id === 's3' ? { ...s, active: false } : s))
    const { visible, hiddenByProgram } = applyPreferences(grants, srcs, ['Fundusze Europejskie dla Nowoczesnej Gospodarki (FENG)'])
    expect(visible.some((g) => g.source_id === 's3')).toBe(false)
    expect(visible.some((g) => g.program?.name.includes('FENG'))).toBe(false)
    expect(hiddenByProgram).toBe(3)
  })
  it('liczy nabory per program', () => {
    const feng = listPrograms(grants).find((p) => p.name.includes('FENG'))
    expect(feng?.count).toBe(3)
  })
})

describe('validateSource', () => {
  const ok = { name: 'LGD', url: 'https://lgd.example.pl/nabory', type: 'LGD' as const, region: 'małopolskie' }
  it('akceptuje poprawną stronę', () => {
    expect(validateSource(ok, sources)).toEqual({})
  })
  it('wymaga http(s) i domeny', () => {
    expect(validateSource({ ...ok, url: 'lgd.pl' }, sources).url).toBeDefined()
    expect(validateSource({ ...ok, url: 'ftp://lgd.pl' }, sources).url).toBeDefined()
    expect(validateSource({ ...ok, url: 'https://localhost' }, sources).url).toBeDefined()
  })
  it('wykrywa duplikat niezależnie od końcowego „/” i wielkości liter', () => {
    expect(validateSource({ ...ok, url: 'https://EXAMPLE.org/arimr/' }, sources).url).toMatch(/już w bazie/)
  })
  it('przy edycji nie zgłasza duplikatu samego siebie', () => {
    expect(validateSource({ ...ok, url: 'https://example.org/arimr' }, sources, 's3')).toEqual({})
  })
  it('wymaga nazwy i regionu', () => {
    const e = validateSource({ ...ok, name: ' ', region: '' }, sources)
    expect(e.name).toBeDefined()
    expect(e.region).toBeDefined()
  })
})

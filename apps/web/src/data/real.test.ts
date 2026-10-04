import { describe, expect, it } from 'vitest'
import { realGrants } from './real'
import { catalogSources, sources as demoSources } from './mock'
import { mergeStoredSources } from '../lib/agentRun'
import { computeStatus } from '../lib/grants'

describe('prawdziwe nabory (26.09.2026)', () => {
  it('każdy nabór ma stronę z katalogu i link do źródła', () => {
    const ids = new Set(catalogSources.map((s) => s.id))
    expect(realGrants).toHaveLength(21)
    for (const g of realGrants) {
      expect(ids.has(g.source_id)).toBe(true)
      expect(g.source_url).toMatch(/^https:\/\//)
      expect(g.source_url).not.toContain('example.org')
    }
  })

  it('daty są spójne (otwarcie ≤ zamknięcie), a nabory bez dat to zapowiedzi', () => {
    const today = new Date(2026, 8, 27)
    for (const g of realGrants) {
      if (g.opens_at && g.closes_at) expect(g.opens_at <= g.closes_at).toBe(true)
      if (!g.opens_at && !g.closes_at) expect(computeStatus(g, today)).toBe('zapowiedz')
    }
  })
})

describe('mergeStoredSources – zapis w przeglądarce a katalog', () => {
  it('usuwa strony przykładowe, zachowuje własne i ustawienia katalogu', () => {
    const own = { id: 'u1', name: 'LGD Moja', type: 'LGD' as const, region: 'śląskie', url: 'https://lgd-moja.pl/nabory', active: true, origin: 'wlasna' as const }
    const stored = [...demoSources.map((s) => (s.id === 'c06' ? { ...s, active: false, last_checked_at: '2026-09-26T08:00:00Z' } : s)), own]
    const out = mergeStoredSources(stored, catalogSources)
    expect(out.some((s) => s.url.includes('example.org'))).toBe(false)
    expect(out.find((s) => s.id === 'u1')).toBeDefined()
    expect(out.find((s) => s.id === 'c06')).toMatchObject({ active: false, last_checked_at: '2026-09-26T08:00:00Z' })
    expect(out).toHaveLength(catalogSources.length + 1)
  })

  it('bez zapisu zwraca katalog', () => {
    expect(mergeStoredSources(undefined, catalogSources)).toBe(catalogSources)
  })
})

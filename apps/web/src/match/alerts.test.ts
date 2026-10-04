import { describe, expect, it } from 'vitest'
import { markSeen, newMatches } from './alerts'
import type { ClientProfile, MatchResult } from './types'

const r = (grant_id: string, verdict: MatchResult['verdict']): MatchResult => ({ grant_id, verdict, score: 50, checks: [] })
const base: ClientProfile = {
  id: 'k1', name: 'Jan', legal_form: 'jdg', size: 'mikro', voivodeship: 'śląskie', stage: 'istniejaca', categories: ['oze'], description: '', updated_at: '',
}

describe('nowe dopasowania dla klientów', () => {
  it('nowy = pasuje/może pasować i nie było go przy ostatnim przeglądzie', () => {
    const seen = markSeen(base, [r('a', 'pasuje'), r('b', 'nie_pasuje')])
    expect(seen.seen_matches).toEqual(['a'])
    expect(newMatches(seen, [r('a', 'pasuje'), r('b', 'moze_pasowac'), r('c', 'pasuje'), r('d', 'nie_pasuje')])).toEqual(['b', 'c'])
  })

  it('wstrzymany klient i klient bez punktu odniesienia nie dostają powiadomień', () => {
    expect(newMatches({ ...markSeen(base, []), active: false }, [r('a', 'pasuje')])).toEqual([])
    expect(newMatches(base, [r('a', 'pasuje')])).toEqual([])
  })
})

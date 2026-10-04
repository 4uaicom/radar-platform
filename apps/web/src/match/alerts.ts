import type { ClientProfile, MatchResult } from './types'

/**
 * Nowe dopasowania: gdy agent znajdzie nabór, który pasuje (albo może pasować) do aktywnego klienta,
 * a klient nie miał go na liście przy ostatnim przeglądzie – pokazujemy go jako „nowy”.
 */

export const isActive = (p: ClientProfile) => p.active !== false && !p.archived
export const isArchived = (p: ClientProfile) => !!p.archived

/** Id naborów, które pasują lub mogą pasować. */
export const matchIds = (ranked: MatchResult[]) => ranked.filter((r) => r.verdict !== 'nie_pasuje').map((r) => r.grant_id)

/** Nowe dopasowania klienta (puste dla wstrzymanych i dla klientów bez punktu odniesienia). */
export function newMatches(p: ClientProfile, ranked: MatchResult[]): string[] {
  if (!isActive(p) || !p.seen_matches) return []
  const seen = new Set(p.seen_matches)
  return matchIds(ranked).filter((id) => !seen.has(id))
}

/** Klient „przejrzany”: bieżące dopasowania stają się punktem odniesienia. */
export const markSeen = (p: ClientProfile, ranked: MatchResult[]): ClientProfile => ({ ...p, seen_matches: matchIds(ranked) })

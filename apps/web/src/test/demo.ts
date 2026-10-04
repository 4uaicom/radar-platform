import { buildMockGrants, sources } from '../data/mock'

/** Dane demo dla testów: stałe, niezależne od prawdziwych naborów. */
export const demoProps = (today: Date) => ({ initialGrants: buildMockGrants(today), initialSources: sources })

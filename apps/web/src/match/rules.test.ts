import { describe, expect, it } from 'vitest'
import type { Grant, Source } from '../types'
import { matchGrant, rankGrants } from './rules'
import type { ClientProfile } from './types'

const TODAY = new Date(2026, 8, 29)

const src = (id: string, region: string): Source => ({ id, name: id, type: 'inny', region, url: `https://${id}.pl`, active: true, origin: 'katalog' })
const grant = (p: Partial<Grant>): Grant => ({
  id: 'g',
  source_id: 'pl',
  title: 'Nabór',
  institution: 'Instytucja',
  announced_at: '2026-09-01',
  opens_at: '2026-09-15',
  closes_at: '2026-11-30',
  beneficiaries: '',
  scope: '',
  required_docs: [],
  summary_ai: '',
  source_url: 'https://x.pl/nabor',
  attachments: [],
  confidence: {},
  manual_overrides: {},
  ...p,
})

const agro: ClientProfile = {
  id: 'p1',
  name: 'Agroturystyka',
  legal_form: 'jdg',
  size: 'mikro',
  voivodeship: 'śląskie',
  stage: 'istniejaca',
  categories: ['turystyka', 'oze'],
  description: 'Budowa domków noclegowych z sauną i fotowoltaiką',
  budget: 400_000,
  own_contribution_pct: 40,
  updated_at: '2026-09-29',
}

const sources = [src('pl', 'cała Polska'), src('sl', 'śląskie'), src('ma', 'małopolskie')]

describe('dopasowanie regułami', () => {
  it('pasuje: firma, region, temat, termin + szacowana dotacja (min z % i limitu)', () => {
    const g = grant({
      title: 'Rozwój usług turystycznych na obszarach wiejskich',
      beneficiaries: 'Mikro i małe przedsiębiorstwa',
      scope: 'baza noclegowa, agroturystyka',
      funding_percent: 65,
      max_grant: 200_000,
      source_id: 'sl',
    })
    const r = matchGrant(agro, g, sources[1], TODAY)
    expect(r.verdict).toBe('pasuje')
    expect(r.score).toBeGreaterThanOrEqual(60)
    expect(r.estimated_grant).toBe(200_000)
    expect(r.checks.find((c) => c.label === 'Kto może składać')?.status).toBe('ok')
    expect(r.checks.find((c) => c.label === 'Temat')?.detail).toMatch(/turystyka/)
    expect(r.checks.find((c) => c.label === 'Wkład własny')).toBeUndefined() // 35% ≤ 40%
  })

  it('twarde „nie”: inny region, tylko samorządy, niekonkurencyjny, zamknięty, założenie firmy dla działającej', () => {
    const base = { title: 'Turystyka i noclegi', beneficiaries: 'przedsiębiorcy' }
    expect(matchGrant(agro, grant({ ...base, source_id: 'ma' }), sources[2], TODAY)).toMatchObject({ verdict: 'nie_pasuje' })
    const jst = matchGrant(agro, grant({ ...base, beneficiaries: 'Jednostki samorządu terytorialnego' }), sources[0], TODAY)
    expect(jst.verdict).toBe('nie_pasuje')
    expect(jst.score).toBeLessThanOrEqual(15)
    expect(jst.checks[0].detail).toMatch(/samorządy/)
    expect(matchGrant(agro, grant({ ...base, summary_ai: 'Nabór niekonkurencyjny' }), sources[0], TODAY).verdict).toBe('nie_pasuje')
    expect(matchGrant(agro, grant({ ...base, closes_at: '2026-09-01' }), sources[0], TODAY).verdict).toBe('nie_pasuje')
    const start = matchGrant(agro, grant({ ...base, title: 'Podejmowanie działalności gospodarczej – turystyka' }), sources[0], TODAY)
    expect(start.checks.find((c) => c.label === 'Etap firmy')?.status).toBe('nie')
  })

  it('niepewne dane → „Sprawdź”, nie „Nie”; zły temat → nie pasuje z niskim wynikiem', () => {
    const unknown = matchGrant(agro, grant({ title: 'Energia dla wsi – instalacje OZE' }), sources[0], TODAY)
    expect(unknown.checks[0].status).toBe('sprawdz')
    expect(unknown.verdict).toBe('moze_pasowac')
    const other = matchGrant(agro, grant({ title: 'Gospodarka wodno-ściekowa', beneficiaries: 'przedsiębiorcy' }), sources[0], TODAY)
    expect(other.verdict).toBe('nie_pasuje')
    expect(other.score).toBeLessThanOrEqual(30)
  })

  it('wkład własny za mały → ostrzeżenie; mało czasu → ostrzeżenie', () => {
    const r = matchGrant({ ...agro, own_contribution_pct: 10 }, grant({ title: 'Turystyka', beneficiaries: 'MŚP', funding_percent: 50, closes_at: '2026-10-02' }), sources[0], TODAY)
    expect(r.checks.find((c) => c.label === 'Wkład własny')?.detail).toMatch(/50%.*10%/)
    expect(r.checks.find((c) => c.label === 'Termin')?.status).toBe('sprawdz')
  })

  it('samorząd pasuje do naboru dla JST; duża firma nie do MŚP', () => {
    const gmina: ClientProfile = { ...agro, legal_form: 'jst', size: 'nie_dotyczy', categories: ['budynki'] }
    expect(matchGrant(gmina, grant({ title: 'Termomodernizacja budynków', beneficiaries: 'gminy i jednostki samorządu terytorialnego' }), sources[0], TODAY).verdict).not.toBe('nie_pasuje')
    const big: ClientProfile = { ...agro, size: 'duza', categories: ['maszyny'] }
    expect(matchGrant(big, grant({ title: 'Inwestycje MŚP w maszyny', beneficiaries: 'MŚP' }), sources[0], TODAY).verdict).toBe('nie_pasuje')
  })

  it('ranking: pasujące na górze, zamknięte pominięte', () => {
    const list = [
      grant({ id: 'a', title: 'Gospodarka wodna', beneficiaries: 'przedsiębiorcy' }),
      grant({ id: 'b', title: 'Turystyka wiejska – noclegi', beneficiaries: 'mikroprzedsiębiorstwa', scope: 'domki noclegowe, sauna' }),
      grant({ id: 'c', title: 'Turystyka', closes_at: '2026-01-01' }),
    ]
    const r = rankGrants(agro, list, sources, TODAY)
    expect(r.map((x) => x.grant_id)).toEqual(['b', 'a'])
  })
})

import { describe, expect, it, vi } from 'vitest'
import { aiMatch, buildPrompt } from './aiMatch'
import type { ClientProfile } from '../match/types'
import type { Grant } from '../types'

const profile: ClientProfile = {
  id: 'p1', name: 'Agro', legal_form: 'jdg', size: 'mikro', voivodeship: 'śląskie', stage: 'istniejaca',
  categories: ['turystyka'], description: 'Domki noclegowe', budget: 300000, own_contribution_pct: 40, updated_at: '2026-09-29',
}
const grant = {
  id: 'fesl-593', source_id: 'c04', title: 'Rozwój turystyki', institution: 'UM', announced_at: '2026-09-01', opens_at: '2026-10-01', closes_at: '2026-10-30',
  beneficiaries: 'MŚP', scope: 'noclegi', required_docs: [], summary_ai: '', source_url: 'https://funduszeue.slaskie.pl/nabory/lsi/593/', attachments: [], confidence: {}, manual_overrides: {},
} as Grant

const toolReply = {
  content: [{ type: 'tool_use', name: 'ocena_dopasowania', input: {
    verdict: 'pasuje', score: 82, estimated_grant_pln: 255000, summary: 'Klient spełnia warunki.', missing_info: ['PKD klienta'],
    conditions: [{ condition: 'Wnioskodawca: MŚP', status: 'spelniony', quote: 'O dofinansowanie mogą ubiegać się MŚP' }],
  } }],
  usage: { input_tokens: 4000, output_tokens: 500 },
}

describe('druga opinia z AI', () => {
  it('prompt: profil klienta, dane naboru, tekst strony, zakaz zgadywania', () => {
    const p = buildPrompt(profile, grant, 'O dofinansowanie mogą ubiegać się MŚP')
    expect(p).toMatch(/WYŁĄCZNIE na tekście/)
    expect(p).toMatch(/Jednoosobowa działalność gospodarcza/)
    expect(p).toMatch(/woj\. śląskie/)
    expect(p).toMatch(/O dofinansowanie mogą ubiegać się MŚP/)
    // dane kontaktowe klienta nigdy nie trafiają do AI
    expect(buildPrompt({ ...profile, email: 'jan@podlasem.pl' }, grant, null)).not.toMatch(/jan@podlasem/)
  })

  it('bez klucza – czytelny komunikat, bez wywołania API', async () => {
    const f = vi.fn()
    expect(await aiMatch({ profile, grant }, f, undefined)).toMatchObject({ error: expect.stringMatching(/ANTHROPIC_API_KEY/) })
    expect(f).not.toHaveBeenCalled()
  })

  it('czyta stronę naboru, wywołuje Claude z narzędziem, liczy koszt', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('https://funduszeue')) return new Response('<html><nav>menu</nav><main><p>O dofinansowanie mogą ubiegać się MŚP</p></main></html>', { headers: { 'content-type': 'text/html' } })
      const body = JSON.parse(String(init!.body))
      expect(body.model).toBe('claude-haiku-4-5')
      expect(body.tool_choice).toEqual({ type: 'tool', name: 'ocena_dopasowania' })
      expect(body.messages[0].content).toMatch(/O dofinansowanie mogą ubiegać się MŚP/)
      expect(body.messages[0].content).not.toMatch(/menu/)
      expect((init!.headers as Record<string, string>)['x-api-key']).toBe('sk-test')
      return Response.json(toolReply)
    })
    const r = await aiMatch({ profile, grant }, fetcher, 'sk-test')
    expect(r).toMatchObject({ grant_id: 'fesl-593', verdict: 'pasuje', score: 82, estimated_grant_pln: 255000, source_read: true })
    expect((r as { cost_usd: number }).cost_usd).toBeCloseTo(0.0065, 4)
  })

  it('błąd API i brak narzędzia → komunikat po polsku', async () => {
    const page = async (u: string) => (u.includes('anthropic') ? new Response('x', { status: 529 }) : new Response('', { status: 404 }))
    expect(await aiMatch({ profile, grant }, page, 'k')).toMatchObject({ error: expect.stringMatching(/529/) })
    const noTool = async (u: string) => (u.includes('anthropic') ? Response.json({ content: [{ type: 'text', text: 'hej' }] }) : new Response('', { status: 404 }))
    expect(await aiMatch({ profile, grant }, noTool, 'k')).toMatchObject({ error: expect.stringMatching(/formacie/) })
  })
})

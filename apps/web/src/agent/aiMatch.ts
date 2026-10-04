import type { Grant } from '../types'
import type { AiMatch, ClientProfile } from '../match/types'
import { CATEGORIES, LEGAL_FORMS, SIZES, STAGES } from '../match/types'
import { USER_AGENT, text, type Fetcher } from './common'
import { safePublicUrl } from './generic'

/**
 * DRUGA OPINIA Z AI (na przycisk): Claude czyta ogłoszenie naboru i porównuje je z profilem klienta.
 * Zasady: tylko to, co jest w tekście; każdy warunek z cytatem; „nie wiadomo” zamiast zgadywania.
 * Klucz ANTHROPIC_API_KEY tylko w sekretach Cloudflare – nigdy w przeglądarce ani w repozytorium.
 */

export const AI_MODEL = 'claude-haiku-4-5'
/** Cena Claude Haiku 4.5 (USD za milion tokenów) – anthropic.com/claude/haiku, 28.09.2026 */
const PRICE_IN = 1
const PRICE_OUT = 5
const MAX_SOURCE_CHARS = 12_000

const TOOL = {
  name: 'ocena_dopasowania',
  description: 'Zapisz ocenę, czy klient może skorzystać z naboru.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['pasuje', 'moze_pasowac', 'nie_pasuje'] },
      score: { type: 'integer', minimum: 0, maximum: 100 },
      conditions: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          properties: {
            condition: { type: 'string', description: 'Warunek naboru, krótko po polsku' },
            status: { type: 'string', enum: ['spelniony', 'niespelniony', 'nie_wiadomo'] },
            quote: { type: 'string', description: 'Dosłowny cytat z tekstu naboru (pusty, gdy brak)' },
          },
          required: ['condition', 'status', 'quote'],
        },
      },
      estimated_grant_pln: { type: ['number', 'null'] },
      summary: { type: 'string', description: 'Dwa zdania po polsku: czy warto i dlaczego' },
      missing_info: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    },
    required: ['verdict', 'score', 'conditions', 'estimated_grant_pln', 'summary', 'missing_info'],
  },
}

const label = <T extends string>(list: [T, string][], v: T) => list.find(([k]) => k === v)?.[1] ?? v

export function profileText(p: ClientProfile): string {
  return [
    `Forma prawna: ${label(LEGAL_FORMS, p.legal_form)}`,
    `Wielkość: ${label(SIZES, p.size)}`,
    `Lokalizacja: woj. ${p.voivodeship}${p.commune ? `, gmina ${p.commune}` : ''}`,
    p.pkd ? `PKD: ${p.pkd}` : '',
    `Etap: ${label(STAGES, p.stage)}`,
    `Planowane inwestycje: ${p.categories.map((c) => label(CATEGORIES, c)).join('; ') || 'nie podano'}`,
    `Opis: ${p.description || 'brak'}`,
    p.budget ? `Budżet projektu: ${p.budget} zł` : '',
    p.own_contribution_pct !== undefined ? `Możliwy wkład własny: ${p.own_contribution_pct}%` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function grantText(g: Grant): string {
  return [
    `Tytuł: ${g.title}`,
    `Instytucja: ${g.institution}`,
    g.call_number ? `Numer: ${g.call_number}` : '',
    g.program ? `Program: ${g.program.name}` : '',
    `Termin: ${g.opens_at ?? '?'} – ${g.closes_at ?? '?'}`,
    g.max_grant ? `Maks. dofinansowanie: ${g.max_grant} zł` : '',
    g.funding_percent ? `Poziom dofinansowania: ${g.funding_percent}%` : '',
    `Beneficjenci (odczyt automatyczny): ${g.beneficiaries}`,
    `Zakres (odczyt automatyczny): ${g.scope}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildPrompt(p: ClientProfile, g: Grant, sourcePage: string | null): string {
  return `Jesteś doradcą ds. dotacji. Oceń, czy KLIENT może skorzystać z NABORU i czy to dla niego dobry wybór.

Zasady:
- Opieraj się WYŁĄCZNIE na tekście poniżej. Nie zgaduj i nie dopisuj warunków z pamięci.
- Dla każdego ważnego warunku (kto może składać, region, wielkość firmy, rodzaj inwestycji, wkład własny, kwoty, terminy) podaj status i DOSŁOWNY cytat z tekstu naboru.
- Gdy tekst nie rozstrzyga warunku, wpisz status „nie_wiadomo” i dodaj brakującą informację do missing_info.
- estimated_grant_pln licz tylko z liczb podanych w tekście i budżetu klienta; inaczej null.
- Odpowiedz, wywołując narzędzie ocena_dopasowania.

KLIENT:
${profileText(p)}

NABÓR (dane z aplikacji):
${grantText(g)}

TEKST OGŁOSZENIA ZE STRONY ŹRÓDŁOWEJ (${g.source_url}):
${sourcePage ?? '(nie udało się pobrać strony – oceniaj tylko na danych z aplikacji)'}`
}

/** Tekst strony naboru (bez menu, skryptów), skrócony do limitu – żeby koszt był przewidywalny. */
export async function fetchSourceText(url: string, fetcher: Fetcher): Promise<string | null> {
  const safe = safePublicUrl(url)
  if (!safe) return null
  try {
    const res = await fetcher(safe, { headers: { 'User-Agent': USER_AGENT } })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || (type && !/html|text/i.test(type))) return null
    const html = await res.text()
    const main = html.match(/<(main|article)\b[\s\S]*?<\/\1>/i)?.[0] ?? html
    const clean = text(main.replace(/<(script|style|noscript|svg|nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' '))
    return clean.slice(0, MAX_SOURCE_CHARS) || null
  } catch {
    return null
  }
}

export interface AiMatchInput {
  profile: ClientProfile
  grant: Grant
}

export async function aiMatch(input: AiMatchInput, fetcher: Fetcher, apiKey: string | undefined): Promise<AiMatch | { error: string }> {
  if (!apiKey) return { error: 'AI nie jest jeszcze włączone: dodaj sekret ANTHROPIC_API_KEY w Cloudflare (Settings → Variables and Secrets).' }
  const page = await fetchSourceText(input.grant.source_url, fetcher)
  const res = await fetcher('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1500,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{ role: 'user', content: buildPrompt(input.profile, input.grant, page) }],
    }),
  })
  if (!res.ok) return { error: `AI odpowiedziało błędem ${res.status}. Spróbuj ponownie za chwilę.` }
  const data = (await res.json()) as {
    content?: { type: string; name?: string; input?: Omit<AiMatch, 'grant_id' | 'checked_at' | 'source_read'> }[]
    usage?: { input_tokens: number; output_tokens: number }
  }
  const out = data.content?.find((c) => c.type === 'tool_use' && c.name === TOOL.name)?.input
  if (!out) return { error: 'AI nie zwróciło oceny w oczekiwanym formacie.' }
  const cost = data.usage ? (data.usage.input_tokens * PRICE_IN + data.usage.output_tokens * PRICE_OUT) / 1e6 : undefined
  return {
    grant_id: input.grant.id,
    verdict: out.verdict,
    score: Math.max(0, Math.min(100, Math.round(out.score))),
    conditions: (out.conditions ?? []).slice(0, 8),
    estimated_grant_pln: out.estimated_grant_pln ?? null,
    summary: out.summary ?? '',
    missing_info: out.missing_info ?? [],
    cost_usd: cost,
    checked_at: new Date().toISOString(),
    source_read: !!page,
  }
}

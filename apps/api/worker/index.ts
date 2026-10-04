/**
 * Cloudflare Worker: serwuje prototyp (folder dist) i odczytuje strony na żądanie.
 * GET /api/check?source=c06                         → czytnik portalu z katalogu
 * GET /api/check?source=u123&url=https://…&name=…   → uniwersalny czytnik (strony dodane przez klienta)
 * POST /api/ai-match { profile, grant }              → druga opinia z AI (Claude), klucz w sekrecie ANTHROPIC_API_KEY
 * Odpowiedź: { source_id, ok, grants, message, fetched_at }. Czytniki są w src/agent (sprawdzane testami).
 */
import { checkSource } from '../src/agent/check'
import { aiMatch, type AiMatchInput } from '../src/agent/aiMatch'

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  ANTHROPIC_API_KEY?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/check') {
      const source = url.searchParams.get('source') ?? ''
      if (!/^[a-z0-9-]{1,40}$/i.test(source)) return Response.json({ ok: false, message: 'Brak lub zły parametr source.' }, { status: 400 })
      const pageUrl = url.searchParams.get('url')
      const name = (url.searchParams.get('name') ?? 'Strona klienta').slice(0, 120)
      const query = url.searchParams.get('query')?.slice(0, 200) || undefined
      const result = await checkSource(source, (u, init) => fetch(u, init), new Date(), 1000, pageUrl ? { url: pageUrl, name, query } : undefined)
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (url.pathname === '/api/ai-match') {
      if (request.method !== 'POST') return Response.json({ error: 'Użyj POST.' }, { status: 405 })
      const raw = await request.text()
      if (raw.length > 60_000) return Response.json({ error: 'Za duże zapytanie.' }, { status: 413 })
      let input: AiMatchInput
      try {
        input = JSON.parse(raw) as AiMatchInput
      } catch {
        return Response.json({ error: 'Niepoprawne dane.' }, { status: 400 })
      }
      if (!input?.profile || !input?.grant?.source_url) return Response.json({ error: 'Brak profilu klienta albo naboru.' }, { status: 400 })
      const result = await aiMatch(input, (u, init) => fetch(u, init), env.ANTHROPIC_API_KEY)
      return Response.json(result, { status: 'error' in result ? 502 : 200, headers: { 'Cache-Control': 'no-store' } })
    }
    return env.ASSETS.fetch(request)
  },
}

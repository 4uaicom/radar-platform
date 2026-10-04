import type { Grant } from '../types'
import type { AiMatch, ClientProfile } from './types'

/** Przycisk „Sprawdź z AI”: pyta serwer (Cloudflare Worker, /api/ai-match). */
export async function aiCheck(profile: ClientProfile, grant: Grant): Promise<AiMatch | { error: string }> {
  const { email: _email, ...safeProfile } = profile // danych kontaktowych nie wysyłamy do AI
  try {
    const res = await fetch('/api/ai-match', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: safeProfile, grant: { ...grant, summary_ai: grant.summary_ai.slice(0, 1000) } }),
    })
    if (!(res.headers.get('content-type') ?? '').includes('application/json'))
      return { error: 'Serwer AI jest niedostępny (działa tylko na opublikowanej stronie).' }
    return (await res.json()) as AiMatch | { error: string }
  } catch {
    return { error: 'Brak połączenia z serwerem AI.' }
  }
}

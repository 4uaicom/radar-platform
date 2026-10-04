import type { Source } from '../types'
import type { CheckResult } from './common'

/** Sprawdzenie jednej strony przez serwer (Cloudflare Worker, /api/check). */
export async function liveCheck(source: Pick<Source, 'id' | 'url' | 'name' | 'origin' | 'query'>, timeoutMs = 45_000): Promise<CheckResult> {
  const sourceId = source.id
  const fetched_at = new Date().toISOString()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const q = new URLSearchParams({ source: sourceId })
    // strony dodane przez klienta → uniwersalny czytnik po adresie
    if (source.origin === 'wlasna') {
      q.set('url', source.url)
      q.set('name', source.name)
      if (source.query) q.set('query', source.query)
    }
    const res = await fetch(`/api/check?${q}`, { signal: ctrl.signal })
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('application/json'))
      return { source_id: sourceId, ok: false, grants: [], fetched_at, message: 'Serwer sprawdzania jest niedostępny (działa tylko na opublikowanej stronie).' }
    return (await res.json()) as CheckResult
  } catch (e) {
    const aborted = (e as Error).name === 'AbortError'
    return { source_id: sourceId, ok: false, grants: [], fetched_at, message: aborted ? 'Strona odpowiadała zbyt długo.' : 'Brak połączenia z serwerem sprawdzania.' }
  } finally {
    clearTimeout(timer)
  }
}

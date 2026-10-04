import type { Grant } from '../types'
import { findCallNumbers } from './rules'
import { datePair, makeGrant, slug, stillOpen, text, unwrapLink } from './common'

export const NFOSIGW_URL = 'https://www.gov.pl/web/nfosigw/harmonogram-naborow'

/**
 * Harmonogram NFOŚiGW – jedna tabela. Kolumny: Nr PP | Nazwa | Tryb | Start | Koniec | Stan | Oznaczenie | Koordynator | Uwagi.
 * Wiersze z 1–2 komórkami to nagłówki sekcji (np. „Transformacja energetyczna”, „FEnIKS”).
 * Wiersze z 7 komórkami to kolejne nabory tego samego programu (bez numeru i nazwy).
 */
export function parseNfosigw(html: string, today: Date, source_id = 'c08', pageUrl = NFOSIGW_URL): Grant[] {
  const t0 = html.indexOf('<table')
  const table = t0 >= 0 ? html.slice(t0, html.indexOf('</table>', t0) >>> 0) : html
  const out: Grant[] = []
  let section = ''
  let last: { nr: string; name: string } | null = null
  const used = new Map<string, number>()

  for (const tr of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1])
    const texts = cells.map(text)
    if (texts.length <= 2) {
      const name = texts.filter(Boolean).pop()
      if (name) section = name
      continue
    }
    if (/^Nr\b/.test(texts[0])) continue // nagłówek tabeli
    let nr: string, name: string, rest: string[], restHtml: string[]
    if (texts.length >= 9) {
      ;[nr, name] = texts
      rest = texts.slice(2)
      restHtml = cells.slice(2)
    } else if (texts.length === 7 && last) {
      ;({ nr, name } = last)
      rest = texts
      restHtml = cells
    } else continue
    if (!name) continue
    last = { nr, name }
    const [mode, rawStart, rawEnd, state, marking, , notesCol] = rest
    const link = [...(restHtml[4] ?? '').matchAll(/href="([^"]+)"/g)].map((x) => unwrapLink(x[1])).find((h) => /^https?:/.test(h))
    const callNumbers = findCallNumbers(marking)
    const call = callNumbers[0] ?? (marking.replace(/^Ogłoszenie o naborze( nr)?/i, '').trim().split(' ')[0] || undefined)
    const title = `${nr ? nr + ' ' : ''}${name.replace(/\*+$/, '').trim()}`
    const dates = datePair(rawStart, rawEnd)
    const notes = [state && `Stan: ${state}`, mode && `Tryb: ${mode}`, notesCol && notesCol.length < 300 ? `Uwagi NFOŚiGW: ${notesCol}` : ''].filter(Boolean) as string[]
    let id = `nfos-${slug(nr || name)}-${slug(call ?? rawStart ?? '')}`
    const n = used.get(id) ?? 0
    used.set(id, n + 1)
    if (n) id = `${id}-${n + 1}`
    out.push(
      makeGrant(
        {
          id,
          source_id,
          sourceName: 'NFOŚiGW – harmonogram naborów',
          title,
          institution: 'Narodowy Fundusz Ochrony Środowiska i Gospodarki Wodnej',
          call_number: call,
          source_url: link ?? pageUrl,
          dates,
          program: section ? { name: section, url: pageUrl } : undefined,
          notes,
        },
        today,
      ),
    )
  }
  return out.filter((g) => stillOpen(g, today))
}

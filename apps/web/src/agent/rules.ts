/**
 * Ekstrakcja regułowa (bez AI, bez kosztów). Kopia agent-lab/src/rules.ts + format 2026.12.01 i ostatni dzień miesiąca.
 * Każda funkcja zwraca wartość + pewność. Niska pewność → w aplikacji „Sprawdź”.
 */

export interface Parsed<T> {
  value: T | null
  /** 1 = pełna data/kwota, 0.5 = przybliżona (miesiąc, kwartał), 0 = brak */
  confidence: number
  note?: string
}

const MONTHS_GEN: Record<string, number> = {
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, września: 9, wrzesnia: 9, października: 10, pazdziernika: 10,
  listopada: 11, grudnia: 12,
}
const MONTHS_EN: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}
const MONTHS_NOM: Record<string, number> = {
  styczeń: 1, luty: 2, marzec: 3, kwiecień: 4, maj: 5, czerwiec: 6, lipiec: 7, sierpień: 8, wrzesień: 9, październik: 10, listopad: 11, grudzień: 12,
}
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || y < 2000 || y > 2100) return false
  const dt = new Date(y, m - 1, d)
  return dt.getMonth() === m - 1 && dt.getDate() === d
}

/** Rozpoznaje daty w formatach spotykanych na portalach grantowych. */
export function parseDate(raw: string | undefined | null): Parsed<string> {
  if (!raw) return { value: null, confidence: 0 }
  const s = raw.trim()
  let m: RegExpMatchArray | null

  // 2026-09-30
  if ((m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)) && valid(+m[1], +m[2], +m[3]))
    return { value: iso(+m[1], +m[2], +m[3]), confidence: 1 }
  // 2026.12.01
  if ((m = s.match(/\b(\d{4})\.(\d{2})\.(\d{2})\b/)) && valid(+m[1], +m[2], +m[3]))
    return { value: iso(+m[1], +m[2], +m[3]), confidence: 1 }
  // 30.09.2026 / 30.09.2026 r.
  if ((m = s.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/)) && valid(+m[3], +m[2], +m[1]))
    return { value: iso(+m[3], +m[2], +m[1]), confidence: 1 }
  // 7 sierpnia 2026 r.
  if ((m = s.toLowerCase().match(/\b(\d{1,2})\s+([a-ząćęłńóśźż]+)\s+(\d{4})/))) {
    const mon = MONTHS_GEN[m[2]]
    if (mon && valid(+m[3], mon, +m[1])) return { value: iso(+m[3], mon, +m[1]), confidence: 1 }
  }
  // Tue Jun 30 11:00:00 CEST 2026 (Date.toString z Javy/JS)
  if ((m = s.match(/\b[A-Z][a-z]{2}\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+\d{2}:\d{2}:\d{2}\s+\w+\s+(\d{4})/))) {
    const mon = MONTHS_EN[m[1].toLowerCase()]
    if (mon && valid(+m[3], mon, +m[2])) return { value: iso(+m[3], mon, +m[2]), confidence: 1 }
  }
  // 05.2024 – tylko miesiąc → pierwszy dzień, niska pewność
  if ((m = s.match(/^(\d{1,2})\.(\d{4})$/)) && +m[1] >= 1 && +m[1] <= 12)
    return { value: iso(+m[2], +m[1], 1), confidence: 0.5, note: 'tylko miesiąc' }
  // „listopad 2026 r.”, „październik/listopad 2026” – nazwa miesiąca w mianowniku → pierwszy dzień, niska pewność
  if ((m = s.toLowerCase().match(/\b(styczeń|luty|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień)(?:\/[a-ząćęłńóśźż]+)?\s+(\d{4})/))) {
    const mon = MONTHS_NOM[m[1]]
    return { value: iso(+m[2], mon, 1), confidence: 0.5, note: 'tylko miesiąc' }
  }
  // III/IV Q 2026 albo III kw. 2026 – kwartał → początek pierwszego kwartału
  if ((m = s.match(/\b(I{1,3}|IV)(?:\/(?:I{1,3}|IV))?\s*(?:Q|kw\.?|kwartał)\s*(\d{4})/i))) {
    const q = ROMAN[m[1].toUpperCase()]
    return { value: iso(+m[2], (q - 1) * 3 + 1, 1), confidence: 0.3, note: 'tylko kwartał' }
  }
  return { value: null, confidence: 0, note: 'nie rozpoznano' }
}

/** Kwoty: „350 000 000 zł”, „300 mln zł”, „46 mln zł”, „400 000 PLN”, „66,000 PLN”, „2,5 mln zł”, „784 tys. euro”. */
export function parseAmountPLN(raw: string | undefined | null): Parsed<number> {
  if (!raw) return { value: null, confidence: 0 }
  const s = raw.replace(/ /g, ' ').toLowerCase()
  if (/eur|€/.test(s) && !/zł|pln/.test(s)) return { value: null, confidence: 0, note: 'kwota w euro' }
  let m: RegExpMatchArray | null
  if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*(mld|mln|tys)\.?/))) {
    const n = parseFloat(m[1].replace(',', '.'))
    const mult = m[2] === 'mld' ? 1e9 : m[2] === 'mln' ? 1e6 : 1e3
    return { value: Math.round(n * mult), confidence: 1 }
  }
  // 350 000 000 / 66,000 / 66.000 – separatory tysięcy
  // z groszami: 536 912,50 zł / 66.000,00 zł
  if ((m = s.match(/(\d{1,3}(?:[ .]\d{3})+|\d+),(\d{2})\s*(?:zł|pln)/))) {
    return { value: parseInt(m[1].replace(/[ .]/g, ''), 10) + Number(m[2]) / 100, confidence: 1 }
  }
  if ((m = s.match(/(\d{1,3}(?:[ ,.]\d{3})+|\d+)\s*(?:zł|pln)/))) {
    return { value: parseInt(m[1].replace(/[ ,.]/g, ''), 10), confidence: 1 }
  }
  return { value: null, confidence: 0, note: 'nie rozpoznano' }
}

/** Procent dofinansowania: „85%”, „do 100% kosztów”, „85 % wydatków”. */
export function parsePercent(raw: string | undefined | null): Parsed<number> {
  if (!raw) return { value: null, confidence: 0 }
  const m = raw.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/)
  if (!m) return { value: null, confidence: 0 }
  const v = parseFloat(m[1].replace(',', '.'))
  return v > 0 && v <= 100 ? { value: v, confidence: 1 } : { value: null, confidence: 0 }
}

/** Numery naborów: FESL.05.14-IP.02-350/26, FENG.02.22-IP.02-001/26, 26/NC/UR/1.12/2026. */
export function findCallNumbers(text: string): string[] {
  const re = /\b(?:[A-Z]{3,6}\.\d{2}\.\d{2}-[A-Z]{2}\.\d{2}-\d{3}\/\d{2}|\d{1,3}\/[A-Z]{2}\/[A-Z]{2}\/\d+\.\d+\/\d{4})\b/g
  return [...new Set(text.match(re) ?? [])]
}

/** „od 7 sierpnia 2026 r. do 16 października 2026 r.” → dwie daty. */
export function parseRange(text: string): { opens: Parsed<string>; closes: Parsed<string> } {
  const parts = text.split(/\s(?:do|–|-)\s/i)
  if (parts.length >= 2) return { opens: parseDate(parts[0]), closes: parseDate(parts.slice(1).join(' ')) }
  return { opens: parseDate(text), closes: { value: null, confidence: 0 } }
}

/** Ostatni dzień miesiąca dla daty „tylko miesiąc” (np. termin zakończenia „12.2026”). */
export function endOfMonth(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number)
  const d = new Date(y, m, 0).getDate()
  return iso(y, m, d)
}

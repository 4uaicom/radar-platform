import type { Grant } from '../types'
import { parseAmountPLN, parseDate } from './rules'
import { datePair, decodeEntities, isoDay, makeGrant, slug, text } from './common'

/**
 * UNIWERSALNY CZYTNIK – dla stron dodanych przez klienta (bez kodu pisanego pod konkretny portal).
 * 1) Zbiera linki, które wyglądają na ogłoszenia (słowa: nabór, konkurs, dotacja, grant…).
 * 2) W tekście wokół linku szuka dat („od … do …”, „termin … do …”) i kwot.
 * 3) Stałe id z adresu linku → przy kolejnym sprawdzeniu nowe linki = nowe nabory.
 * Pewność jest niska, więc aplikacja pokazuje „Sprawdź” – dane zawsze potwierdza się u źródła.
 */

/** Mocne słowa – sam tytuł wystarczy. */
const STRONG = /nab[óo]r|konkurs|dotacj|grant|dofinansowan|pożyczk|premi[ai]|subwencj/i
/** Słabe słowa („wniosek”, „ogłoszenie”, „program”…) – tylko gdy obok jest data. */
const WEAK = /wsparci|ogłoszeni|wniosk|program|środki/i
const NOISE = /polityk[aię] prywatności|cookies|rodo|deklaracj[aię] dostępności|mapa strony|kontakt|logowanie|zaloguj|facebook|youtube|instagram|linkedin|twitter|x\.com|regulamin serwisu|biuletyn informacji|bip/i
/** Menu i pomoc serwisu: instrukcje, wyszukiwarki, poradniki – to nie ogłoszenia. */
const HELP = /instrukcj|poradnik|samouczek|\bpomoc\b|\bfaq\b|pytani[ae] i odpowied|przeglądaj|wyszukiwark|wizualizacj|jak (wypełnić|złożyć|sprawdzić|przygotować)/i

/** Platformy przetargowe (zamówienia publiczne) – nie ogłaszają dotacji. */
const PROCUREMENT_HOSTS = /(^|\.)(ezamowienia\.gov\.pl|platformazakupowa\.pl|smartpzp\.pl|e-propublico\.pl|logintrade\.net|ted\.europa\.eu|przetargi\.[a-z.]+|miniportal\.uzp\.gov\.pl)$/i

const DATE_RE =
  /\b\d{1,2}\.\d{1,2}\.\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)\s+\d{4}/gi

function stripNoise(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|select)\b[\s\S]*?<\/\1>/gi, ' ')
}

function absolute(href: string, base: string): string | null {
  try {
    const u = new URL(decodeEntities(href.trim()), base)
    if (!/^https?:$/.test(u.protocol)) return null
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

/** Daty z kontekstu: zakres „od X do Y” / „X – Y”, termin „do X”, albo pojedyncza data (publikacja). */
export function datesFromContext(ctx: string): { opens?: string; closes?: string; published?: string } {
  const found = [...ctx.matchAll(DATE_RE)].map((m) => ({ raw: m[0], at: m.index ?? 0, iso: parseDate(m[0]).value }))
  const dates = found.filter((d) => d.iso) as { raw: string; at: number; iso: string }[]
  if (!dates.length) return {}
  const before = (d: { at: number }, n = 60) => ctx.slice(Math.max(0, d.at - n), d.at)
  const pub = dates.find((d) => /(dodano|opublikowan|publikacj|z dnia|data)\W{0,15}$/i.test(before(d, 30)))
  const withPub = <T extends object>(r: T) => {
    const p = pub ?? dates[0]
    const others = Object.values(r) as string[]
    return others.length && others.every((v) => p.iso < v) ? { ...r, published: p.iso } : r
  }
  for (let i = 0; i + 1 < dates.length; i++) {
    const between = ctx.slice(dates[i].at + dates[i].raw.length, dates[i + 1].at)
    const plainRange = /^\s*(r\.?)?\s*(do|–|-|—)\s*(dnia\s*)?$/i.test(between)
    // „od dnia 1 września 2026 r. od godz. 0:00 do 30 września 2026 r.”
    const odDo = /\bod(\s+dnia)?\s*$/i.test(before(dates[i], 25)) && /\bdo\b/i.test(between) && between.length < 45
    if (plainRange || odDo)
      return withPub({ opens: dates[i].iso, closes: dates[i + 1].iso })
  }
  const deadline = dates.find((d) => d !== pub && /(termin|składani|nabór|naboru|wniosk|przyjmujemy|zakończ|koniec)[^.]{0,40}(\bdo|dnia|:)\s*$/i.test(before(d)))
  if (deadline) return withPub({ closes: deadline.iso })
  return { published: (pub ?? dates[0]).iso }
}

/** Nie ogłoszenie, tylko coś wokół naboru: dokumenty, wyniki, szkolenia, nawigacja. */
const NOT_A_CALL =
  /regulamin|zał\.|załącznik|\bwz[óo]r|formularz|\bumow[aeyę]\b|kliknij|następny|poprzedni|list[ay] rankingow|wyniki? (naboru|oceny|konkursu)|uniewa[żz]ni|zakończon|rozstrzygni|protokół|procedur|szkoleni|spotkani|archiwum|aktualizacj|zmian[aęy] (w )?regulamin|\bfaq\b/i

/** Numer naboru w tytule, np. „3/2026”, „1/2026/OK/STARTDG”. */
const CALL_NO = /\b\d{1,3}\/(20\d{2})\b/

interface Candidate {
  url: string
  title: string
  isFile: boolean
  opens?: string
  closes?: string
  published?: string
  amount?: string
}

function candidates(html: string, pageUrl: string, today: Date, limit: number): Candidate[] {
  const clean = stripNoise(html)
  const year = today.getFullYear()
  const pageHost = new URL(pageUrl).host
  const seen = new Set<string>()
  const out: Candidate[] = []

  const anchors = [...clean.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  for (let k = 0; k < anchors.length; k++) {
    const m = anchors[k]
    const url = absolute(m[1], pageUrl)
    const title = text(m[2]).replace(/^(czytaj|więcej|zobacz)\s*(więcej)?\s*[:»›-]*\s*/i, '')
    if (!url || seen.has(url) || url === pageUrl) continue
    const u = new URL(url)
    const sameSite = u.host === pageHost || u.host.endsWith('.' + pageHost.replace(/^www\./, ''))
    const isFile = /\.(pdf|docx?|odt|rtf)($|\?)/i.test(u.pathname)
    if (!sameSite && !isFile) continue
    if (title.length < 15 || title.length > 250 || NOISE.test(title) || NOISE.test(u.pathname) || HELP.test(title) || NOT_A_CALL.test(title)) continue
    // plik (PDF, DOC) tylko gdy to samo ogłoszenie, a nie regulamin czy wzór wniosku
    if (isFile && !/ogłosz/i.test(title)) continue
    // nabór z zeszłych lat: numer „1/2025” w tytule albo data w adresie „/2025/01/…”
    const callYear = Number(title.match(CALL_NO)?.[1] ?? 0)
    const urlDate = u.pathname.match(/\/(20\d{2})\/(\d{2})\//)
    if (callYear && callYear < year) continue
    if (urlDate && isoDay(new Date(Number(urlDate[1]), Number(urlDate[2]) - 1, 28)) < isoDay(new Date(year, today.getMonth() - 6, 1))) continue
    const strong = STRONG.test(title) || STRONG.test(u.pathname)
    if (!strong && !WEAK.test(title) && !WEAK.test(u.pathname)) continue

    // kontekst = tekst od linku do następnego linku (max ~700 znaków) – żeby nie mieszać dat sąsiednich ogłoszeń
    const at = m.index ?? 0
    const nextAt = anchors[k + 1]?.index ?? clean.length
    const ctx = text(clean.slice(at, Math.min(nextAt, at + m[0].length + 700)))
    const d = datesFromContext(ctx)
    const hasDate = !!(d.opens || d.closes || d.published)
    if (!strong && !hasDate) continue // „ogłoszenie”/„wniosek” bez daty = raczej menu
    // pozycja menu: sam link bez opisu i bez daty, bez numeru naboru i bez słowa „nabór/ogłoszenie” w tytule
    const extra = ctx.length - title.length
    if (!hasDate && extra < 15 && !CALL_NO.test(title) && !/nab[óo]r|ogłosz|konkurs/i.test(title)) continue

    seen.add(url)
    const amount = ctx.match(/(kwot|budżet|alokacj|wysokoś|limit|środk)\D{0,30}(\d[\d\s.,]*\s*(?:mln|tys\.?)?\s*(?:zł|pln))/i)?.[2]
    out.push({ url, title, isFile, ...d, amount })
    if (out.length >= limit * 2) break
  }
  return out
}

function toGrant(c: Candidate, today: Date, source_id: string, sourceName: string, fromDetail: boolean): Grant {
  const day = isoDay(today)
  const u = new URL(c.url)
  const notes = [fromDetail ? 'Odczyt uniwersalnym czytnikiem ze strony ogłoszenia – sprawdź daty i kwoty u źródła' : 'Odczyt uniwersalnym czytnikiem – daty i kwoty mogą dotyczyć czegoś innego']
  if (!c.opens && !c.closes) notes.push('Na stronie nie znaleziono terminu naboru')
  const dates = datePair(c.opens, c.closes)
  dates.confOpens = dates.opens ? (fromDetail ? 0.7 : 0.5) : 0
  dates.confCloses = dates.closes ? (fromDetail ? 0.7 : 0.5) : 0
  return makeGrant(
    {
      id: `gen-${source_id}-${slug(u.host + u.pathname + u.search).slice(-50)}`,
      source_id,
      sourceName,
      title: c.title,
      institution: sourceName,
      source_url: c.url,
      dates,
      call_number: c.title.match(/\b\d{1,3}\/20\d{2}(\/[A-ZŁŚŻ0-9+]+)*/)?.[0],
      announced: c.published && c.published <= day ? c.published : undefined,
      budget_total: parseAmountPLN(c.amount).value ?? undefined,
      notes,
    },
    today,
  )
}

/** Stare i zamknięte odpadają. */
function stillRelevant(c: Candidate, today: Date): boolean {
  const day = isoDay(today)
  const old = isoDay(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()))
  const newest = [c.opens, c.closes, c.published].filter(Boolean).sort().pop()
  if (newest && newest < old) return false
  return !(c.closes && c.closes < day)
}

export function parseGeneric(html: string, pageUrl: string, today: Date, source_id: string, sourceName: string, limit = 30): Grant[] {
  return candidates(html, pageUrl, today, limit)
    .filter((c) => stillRelevant(c, today))
    .slice(0, limit)
    .map((c) => toGrant(c, today, source_id, sourceName, false))
}

/**
 * Daty ze strony ogłoszenia: szukamy ich tylko przy słowach „termin”, „składanie wniosków”, „nabór trwa”,
 * żeby nie wziąć daty publikacji ani daty z regulaminu.
 */
export function datesFromDetail(html: string): { opens?: string; closes?: string; published?: string; amount?: string } {
  const body = text(stripNoise(html))
  let found: ReturnType<typeof datesFromContext> = {}
  for (const m of body.matchAll(/termin\w*|składani\w* wniosk\w*|nab[óo]r (trwa|potrwa|będzie)|przyjmowani\w* wniosk\w*|wnioski (można|należy) składać/gi)) {
    const d = datesFromContext(body.slice(m.index ?? 0, (m.index ?? 0) + 220))
    if (d.opens || d.closes) {
      found = d
      break
    }
  }
  const pub = body.match(/(z dnia|opublikowan\w*|data publikacji|dodano)\W{0,15}(\d{1,2}[. ]\S+[. ]20\d{2})/i)?.[2]
  const published = pub ? datesFromContext(pub).published : undefined
  const amount = body.match(/(limit\w* środków|kwot\w* (środków|alokacji)|budżet naboru|alokacj\w*)\D{0,40}(\d[\d\s.,]*\s*(?:mln|tys\.?)?\s*(?:zł|pln))/i)?.[3]
  return { opens: found.opens, closes: found.closes, published, amount }
}

/**
 * Pełny odczyt strony klienta: lista ogłoszeń + (dla najnowszych bez terminu) wejście na stronę ogłoszenia po daty.
 * Na stronach LGD daty zwykle są dopiero w treści ogłoszenia, nie na liście.
 */
export async function readGeneric(
  get: (url: string) => Promise<string>,
  html: string,
  pageUrl: string,
  today: Date,
  source_id: string,
  sourceName: string,
  { limit = 30, details = 5 } = {},
): Promise<Grant[]> {
  const list = candidates(html, pageUrl, today, limit)
  let budget = details
  const out: Grant[] = []
  for (const c of list) {
    let fromDetail = false
    if (!c.closes && !c.isFile && budget > 0) {
      budget--
      try {
        const d = datesFromDetail((await get(c.url)).slice(0, 600_000))
        if (d.opens || d.closes) {
          Object.assign(c, { opens: d.opens, closes: d.closes })
          fromDetail = true
        }
        c.published ??= d.published
        c.amount ??= d.amount
      } catch {
        /* strona ogłoszenia niedostępna – zostaje wpis z listy */
      }
    }
    if (!stillRelevant(c, today)) continue
    out.push(toGrant(c, today, source_id, sourceName, fromDetail))
    if (out.length >= limit) break
  }
  return out
}

/** Czy to strona z przetargami (zamówienia publiczne), a nie z dotacjami. */
export function isProcurementPage(html: string, pageUrl: string): boolean {
  if (PROCUREMENT_HOSTS.test(new URL(pageUrl).hostname)) return true
  const body = text(stripNoise(html))
  const tenders = body.match(/zamówie[nń]\w* publiczn|przetarg|postępowa\w* o udzielenie|zamawiając/gi)?.length ?? 0
  const grants = body.match(/nab[óo]r|dotacj|grant|dofinansowan/gi)?.length ?? 0
  return tenders >= 5 && tenders > grants * 2
}

/**
 * Dlaczego czytnik nic nie znalazł – komunikat dla użytkownika (po polsku, z podpowiedzią co zrobić).
 */
export function explainEmpty(html: string, pageUrl: string): string {
  if (isProcurementPage(html, pageUrl))
    return 'To strona z przetargami (zamówienia publiczne), a nie z naborami dotacji – Radar jej nie czyta. Dodaj stronę, na której instytucja ogłasza nabory.'
  const visible = text(stripNoise(html)).length
  const scripts = (html.match(/<script\b/gi) ?? []).length
  if (visible < 400 && scripts > 0)
    return 'Ta strona wczytuje treść dopiero w przeglądarce (JavaScript), więc czytnik widzi pustą ramkę. Podaj adres innej podstrony z listą naborów.'
  return 'Nie znaleziono tu ogłoszeń o naborach. Podaj adres podstrony, na której są ogłoszenia (np. „Nabory” albo „Aktualności”), a nie strony głównej.'
}

/** Adres podany przez klienta: tylko http(s), bez adresów lokalnych i prywatnych. */
export function safePublicUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    if (!/^https?:$/.test(u.protocol)) return null
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.')) return null
    if (/^(\d+\.){3}\d+$/.test(h) || h.includes(':')) return null // adresy IP
    return u.toString()
  } catch {
    return null
  }
}

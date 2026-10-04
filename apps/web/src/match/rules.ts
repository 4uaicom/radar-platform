import type { Grant, Source } from '../types'
import { computeStatus, daysLeft } from '../lib/grants'
import type { Category, ClientProfile, MatchCheck, MatchResult, Verdict } from './types'

/**
 * DOPASOWANIE REGUŁAMI (bez AI, za darmo).
 * Każdy nabór sprawdzamy w 6 punktach: kto może składać, region, wielkość firmy, tryb, termin, temat.
 * Wynik: 0–100 + werdykt + powody (✓ / ✗ / ?). Twarde „nie” (np. nabór tylko dla samorządów) = „Nie pasuje”.
 */

/** Słowa kluczowe tematów (polskie + angielskie dla KE). */
const TOPICS: Record<Category, RegExp> = {
  turystyka: /turysty|noclegow|agroturyst|hotel|pensjonat|rekreac|tourism|gastronom|horeca/i,
  oze: /\bOZE\b|odnawialn|fotowolta|pompy? ciepła|magazyn\w* energii|energi|energet|biogaz|ciepłownic|renewable|energy|kogeneracj/i,
  budynki: /budyn|termomoderniz|efektywnoś\w* energetyczn|renowacj|infrastruktur|building/i,
  maszyny: /maszyn|sprzęt|inwestycj|rozwój działalności|rozwoju działalności|środki trwałe|linii produkcyjn|wyposażeni|MŚP|konkurencyjnoś/i,
  cyfryzacja: /cyfrow|digital|\bIT\b|oprogramowan|\bAI\b|sztuczn\w+ inteligenc|automatyzac|cyberbezpiecz|e-commerce|dane\b|data\b/i,
  br: /badawcz|\bB\+R\b|innowac|research|innovation|prac\w* rozwojow|ścieżka smart|technolog/i,
  szkolenia: /szkoleni|kompetenc|kwalifikac|doradztw|kadr|skills|training|edukac|akademi/i,
  zatrudnienie: /zatrudni|podejmowani\w* działalności|założeni\w* firmy|samozatrudn|startup|aktywizac|rynku pracy|EURES/i,
  eksport: /ekspor|zagraniczn|międzynarodow|targ|internacjonaliz|export|rynk\w* zagraniczn/i,
  srodowisko: /środowisk|klimat|odpad|wod[aynoę]|ściek|przyrod|bioróżnorod|powietrz|adaptac|environment|climate|LIFE\b|obiegu zamkniętego|GOZ/i,
  rolnictwo: /rolni|gospodarstw|przetwórst|rybac|rybołów|akwakult|agro|żywnoś|WPR|LEADER/i,
  spoleczne: /społeczn|zdrowi|opiek|senior|edukac|szkoł|kultur|health|social/i,
}

type Group = 'firma' | 'rolnik' | 'osoba' | 'ngo' | 'jst' | 'nauka'

const GROUP_RE: Record<Group, RegExp> = {
  jst: /jednost\w* samorząd|\bJST\b|samorząd\w* terytorial|administracji samorządowej|park\w* narodow|WFOŚiGW|wojewódzkich funduszy|\bPSZ\b|\bPUP\b|urzęd\w* pracy/i,
  nauka: /organizacj\w* badawcz|uczelni|jednost\w* naukow|instytut\w* badawcz|szkolnictw\w* wyższ/i,
  firma: /przedsiębior|\bMŚP\b|mikro|małe i średnie|firm|startup|spółk|działalnoś\w* gospodarcz|SME/i,
  rolnik: /rolni|gospodarstw\w* roln/i,
  osoba: /osob\w* fizyczn|osoby planujące|mieszkańc|bezrobotn/i,
  ngo: /organizacj\w* pozarząd|\bNGO\b|stowarzysz|fundacj/i,
}

const PROFILE_GROUPS: Record<ClientProfile['legal_form'], Group[]> = {
  jdg: ['firma'],
  spolka: ['firma'],
  rolnik: ['rolnik', 'firma'],
  osoba_fizyczna: ['osoba'],
  ngo: ['ngo'],
  jst: ['jst'],
  uczelnia: ['nauka'],
}

const GROUP_LABEL: Record<Group, string> = {
  firma: 'firmy',
  rolnik: 'rolników',
  osoba: 'osoby fizyczne',
  ngo: 'organizacje pozarządowe',
  jst: 'samorządy i instytucje publiczne',
  nauka: 'uczelnie i instytuty badawcze',
}

const lower = (s: string) => s.toLocaleLowerCase('pl')

/** Tekst naboru, w którym szukamy warunków. */
function grantText(g: Grant): string {
  return [g.title, g.institution, g.beneficiaries, g.scope, g.program?.name, g.summary_ai].filter(Boolean).join(' · ')
}

function whoCanApply(g: Grant): Group[] {
  const t = [g.beneficiaries, g.title, g.institution === 'Wojewódzki Urząd Pracy w Katowicach' ? 'urzędy pracy' : '', g.program?.name].join(' ')
  return (Object.keys(GROUP_RE) as Group[]).filter((k) => GROUP_RE[k].test(t))
}

export function matchGrant(p: ClientProfile, g: Grant, source: Source | undefined, today: Date): MatchResult {
  const checks: MatchCheck[] = []
  const text = grantText(g)
  let score = 0
  let hardNo = false

  // 1. Kto może składać
  const groups = whoCanApply(g)
  const mine = PROFILE_GROUPS[p.legal_form]
  if (!groups.length) {
    checks.push({ label: 'Kto może składać', status: 'sprawdz', detail: 'Nie odczytano grupy wnioskodawców – sprawdź w ogłoszeniu.' })
    score += 10
  } else if (groups.some((x) => mine.includes(x))) {
    checks.push({ label: 'Kto może składać', status: 'ok', detail: `Nabór obejmuje: ${groups.map((x) => GROUP_LABEL[x]).join(', ')}.` })
    score += 25
  } else {
    checks.push({ label: 'Kto może składać', status: 'nie', detail: `Nabór dla: ${groups.map((x) => GROUP_LABEL[x]).join(', ')}.` })
    hardNo = true
  }

  // 2. Region
  const region = lower(source?.region ?? '')
  if (!region || region === 'cała polska' || region === 'ue') {
    checks.push({ label: 'Region', status: 'ok', detail: region === 'ue' ? 'Nabór unijny – cała UE.' : 'Nabór ogólnopolski.' })
    score += 10
  } else if (region === lower(p.voivodeship)) {
    checks.push({ label: 'Region', status: 'ok', detail: `Nabór dla województwa ${region} – zgodnie z lokalizacją klienta.` })
    score += 10
  } else {
    checks.push({ label: 'Region', status: 'nie', detail: `Nabór dla województwa ${region}, a klient jest z ${p.voivodeship}.` })
    hardNo = true
  }

  // 3. Wielkość firmy
  if (/dla pojedynczych firm dużych|duż\w+ przedsiębiorstw/i.test(text) && ['mikro', 'mala', 'srednia'].includes(p.size)) {
    checks.push({ label: 'Wielkość firmy', status: 'nie', detail: 'Nabór dla dużych firm.' })
    hardNo = true
  } else if (/\bMŚP\b|małe i średnie|mikro, mał/i.test(text) && p.size === 'duza') {
    checks.push({ label: 'Wielkość firmy', status: 'nie', detail: 'Nabór tylko dla MŚP.' })
    hardNo = true
  } else if (mine.includes('firma') && p.size !== 'nie_dotyczy') {
    checks.push({ label: 'Wielkość firmy', status: 'ok', detail: 'Brak ograniczeń sprzecznych z wielkością firmy.' })
    score += 5
  }

  // 4. Tryb naboru
  if (/niekonkurencyjn/i.test(text) && p.legal_form !== 'jst') {
    checks.push({ label: 'Tryb', status: 'nie', detail: 'Nabór niekonkurencyjny – dla wskazanego z góry wnioskodawcy.' })
    hardNo = true
  }
  if (/podejmowani\w* działalności|założeni\w* firmy|osoby planujące/i.test(text)) {
    if (p.stage === 'istniejaca') {
      checks.push({ label: 'Etap firmy', status: 'nie', detail: 'Nabór na założenie firmy, a firma klienta już działa.' })
      hardNo = true
    } else {
      checks.push({ label: 'Etap firmy', status: 'ok', detail: 'Nabór na założenie firmy – pasuje do etapu klienta.' })
      score += 5
    }
  }

  // 5. Termin
  const status = computeStatus(g, today)
  const left = daysLeft(g, today)
  if (status === 'zamkniety') {
    checks.push({ label: 'Termin', status: 'nie', detail: 'Nabór zamknięty.' })
    hardNo = true
  } else if (status === 'zapowiedz') {
    checks.push({ label: 'Termin', status: 'sprawdz', detail: 'Zapowiedź – terminy jeszcze nieznane, jest czas na przygotowanie.' })
    score += 5
  } else if (left !== null && left < 7) {
    checks.push({ label: 'Termin', status: 'sprawdz', detail: `Zostało ${left} ${left === 1 ? 'dzień' : 'dni'} – mało czasu na przygotowanie wniosku.` })
  } else {
    checks.push({ label: 'Termin', status: 'ok', detail: left !== null ? `Zostało ${left} ${left === 1 ? 'dzień' : 'dni'}.` : 'Termin do potwierdzenia.' })
    score += 10
  }

  // 6. Temat inwestycji
  const hits = p.categories.filter((c) => TOPICS[c].test(text))
  const words = lower(p.description)
    .split(/[^a-ząćęłńóśźż0-9]+/)
    .filter((w) => w.length >= 6)
  const stems = [...new Set(words.map((w) => w.slice(0, 6)))]
  const overlap = stems.filter((s) => lower(text).includes(s)).length
  if (hits.length) {
    checks.push({ label: 'Temat', status: 'ok', detail: `Zgodny z: ${hits.map((h) => CATEGORY_SHORT[h]).join(', ')}${overlap ? `; wspólne słowa z opisu: ${overlap}` : ''}.` })
    score += Math.min(35, 20 + 10 * (hits.length - 1)) + Math.min(10, overlap * 3)
  } else if (overlap >= 2) {
    checks.push({ label: 'Temat', status: 'sprawdz', detail: `Kilka wspólnych słów z opisem inwestycji (${overlap}) – sprawdź zakres.` })
    score += Math.min(15, overlap * 4)
  } else {
    checks.push({ label: 'Temat', status: 'nie', detail: 'Zakres naboru nie pokrywa się z planowaną inwestycją.' })
  }

  // Kwota i wkład własny
  let estimated: number | undefined
  if (p.budget) {
    const pct = g.funding_percent ?? undefined
    const byPct = pct ? (p.budget * pct) / 100 : undefined
    const cap = g.max_grant ?? undefined
    estimated = byPct !== undefined && cap !== undefined ? Math.min(byPct, cap) : (byPct ?? (cap !== undefined ? Math.min(cap, p.budget) : undefined))
    if (estimated !== undefined) {
      checks.push({ label: 'Kwota', status: 'ok', detail: `Szacowana dotacja ok. ${fmt(estimated)} zł przy budżecie ${fmt(p.budget)} zł.` })
      score += 5
    }
    if (pct && p.own_contribution_pct !== undefined && 100 - pct > p.own_contribution_pct)
      checks.push({ label: 'Wkład własny', status: 'sprawdz', detail: `Wymagany wkład ok. ${100 - pct}%, klient deklaruje ${p.own_contribution_pct}%.` })
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const topicNo = !hits.length && overlap < 2
  const verdict: Verdict = hardNo ? 'nie_pasuje' : topicNo ? 'nie_pasuje' : score >= 60 ? 'pasuje' : score >= 35 ? 'moze_pasowac' : 'nie_pasuje'
  if (hardNo) score = Math.min(score, 15)
  else if (topicNo) score = Math.min(score, 30)
  return { grant_id: g.id, score, verdict, checks, estimated_grant: estimated }
}

const CATEGORY_SHORT: Record<Category, string> = {
  turystyka: 'turystyka',
  oze: 'energia',
  budynki: 'budynki',
  maszyny: 'rozwój firmy',
  cyfryzacja: 'cyfryzacja',
  br: 'B+R',
  szkolenia: 'szkolenia',
  zatrudnienie: 'zatrudnienie',
  eksport: 'eksport',
  srodowisko: 'środowisko',
  rolnictwo: 'rolnictwo',
  spoleczne: 'usługi społeczne',
}

export const fmt = (n: number) => Math.round(n).toLocaleString('pl-PL')

/** Ranking: najpierw „Pasuje”, potem „Może pasować”, w grupie po wyniku; zamknięte pomijamy. */
export function rankGrants(p: ClientProfile, grants: Grant[], sources: Source[], today: Date): MatchResult[] {
  const byId = new Map(sources.map((s) => [s.id, s]))
  const order: Record<Verdict, number> = { pasuje: 0, moze_pasowac: 1, nie_pasuje: 2 }
  return grants
    .filter((g) => computeStatus(g, today) !== 'zamkniety')
    .map((g) => matchGrant(p, g, byId.get(g.source_id), today))
    .sort((a, b) => order[a.verdict] - order[b.verdict] || b.score - a.score)
}

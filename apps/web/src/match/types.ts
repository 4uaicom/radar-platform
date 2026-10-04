/** Moduł „Dopasowanie klienta”: profil firmy klienta i wyniki porównania z naborami. */

export type LegalForm = 'jdg' | 'spolka' | 'rolnik' | 'osoba_fizyczna' | 'ngo' | 'jst' | 'uczelnia'
export type CompanySize = 'mikro' | 'mala' | 'srednia' | 'duza' | 'nie_dotyczy'
export type Stage = 'planowana' | 'nowa' | 'istniejaca'
export type Category =
  | 'turystyka'
  | 'oze'
  | 'maszyny'
  | 'cyfryzacja'
  | 'br'
  | 'szkolenia'
  | 'budynki'
  | 'eksport'
  | 'srodowisko'
  | 'rolnictwo'
  | 'zatrudnienie'
  | 'spoleczne'

export interface ClientProfile {
  id: string
  name: string
  /** Kontakt do klienta – tylko w aplikacji, nigdy nie trafia do AI */
  email?: string
  legal_form: LegalForm
  size: CompanySize
  voivodeship: string
  commune?: string
  pkd?: string
  stage: Stage
  categories: Category[]
  description: string
  /** Planowany budżet projektu (zł) */
  budget?: number
  /** Ile % kosztów klient może pokryć sam */
  own_contribution_pct?: number
  /** Wstrzymany klient (false) zostaje w bazie, ale nie dostaje powiadomień o nowych dopasowaniach. Brak = aktywny. */
  active?: boolean
  /** W archiwum: klient ukryty w tabeli (filtr „Archiwum”), bez dopasowań i powiadomień; można przywrócić */
  archived?: boolean
  /** Nabory (id), które pasowały przy ostatnim przeglądzie klienta – nowe dopasowania to te spoza tej listy */
  seen_matches?: string[]
  updated_at: string
}

export const LEGAL_FORMS: [LegalForm, string][] = [
  ['jdg', 'Jednoosobowa działalność gospodarcza'],
  ['spolka', 'Spółka'],
  ['rolnik', 'Rolnik / gospodarstwo rolne'],
  ['osoba_fizyczna', 'Osoba fizyczna (bez firmy)'],
  ['ngo', 'Fundacja / stowarzyszenie'],
  ['jst', 'Samorząd (gmina, powiat, województwo)'],
  ['uczelnia', 'Uczelnia / instytut badawczy'],
]

export const SIZES: [CompanySize, string][] = [
  ['mikro', 'Mikro (do 9 osób)'],
  ['mala', 'Mała (10–49 osób)'],
  ['srednia', 'Średnia (50–249 osób)'],
  ['duza', 'Duża (250+ osób)'],
  ['nie_dotyczy', 'Nie dotyczy'],
]

export const STAGES: [Stage, string][] = [
  ['planowana', 'Dopiero planuje założyć firmę'],
  ['nowa', 'Firma działa krócej niż 12 miesięcy'],
  ['istniejaca', 'Firma działa dłużej'],
]

export const CATEGORIES: [Category, string][] = [
  ['turystyka', 'Turystyka, noclegi, agroturystyka'],
  ['oze', 'Energia odnawialna, magazyny energii'],
  ['budynki', 'Budynki, termomodernizacja'],
  ['maszyny', 'Maszyny, sprzęt, rozwój firmy'],
  ['cyfryzacja', 'Cyfryzacja, IT, AI'],
  ['br', 'Badania i innowacje (B+R)'],
  ['szkolenia', 'Szkolenia, kompetencje kadr'],
  ['zatrudnienie', 'Zatrudnienie, założenie firmy'],
  ['eksport', 'Eksport, targi, internacjonalizacja'],
  ['srodowisko', 'Środowisko, woda, odpady, klimat'],
  ['rolnictwo', 'Rolnictwo, przetwórstwo, rybactwo'],
  ['spoleczne', 'Usługi społeczne, edukacja, zdrowie'],
]

export const VOIVODESHIPS = [
  'dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie', 'małopolskie', 'mazowieckie', 'opolskie',
  'podkarpackie', 'podlaskie', 'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie', 'wielkopolskie', 'zachodniopomorskie',
]

export type CheckStatus = 'ok' | 'nie' | 'sprawdz'

export interface MatchCheck {
  label: string
  status: CheckStatus
  detail: string
}

export type Verdict = 'pasuje' | 'moze_pasowac' | 'nie_pasuje'

export interface MatchResult {
  grant_id: string
  score: number
  verdict: Verdict
  checks: MatchCheck[]
  /** Szacowana dotacja (zł), gdy znamy budżet klienta i warunki naboru */
  estimated_grant?: number
}

/** Druga opinia z AI – te same pojęcia, co w ocenie regułami, plus cytaty ze źródła. */
export interface AiMatch {
  grant_id: string
  verdict: Verdict
  score: number
  conditions: { condition: string; status: 'spelniony' | 'niespelniony' | 'nie_wiadomo'; quote: string }[]
  estimated_grant_pln: number | null
  summary: string
  missing_info: string[]
  /** Szacunkowy koszt wywołania (USD) */
  cost_usd?: number
  checked_at: string
  source_read: boolean
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  pasuje: 'Pasuje',
  moze_pasowac: 'Może pasować',
  nie_pasuje: 'Nie pasuje',
}

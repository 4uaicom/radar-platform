import type { ScanFrequency } from './auth/session'

export type SourceType = 'LGD' | 'ARiMR' | 'FE' | 'PARP' | 'NCBR' | 'NFOŚiGW' | 'KE' | 'regionalny' | 'agregator' | 'wiadomości' | 'inny'

export const SOURCE_TYPES: SourceType[] = ['LGD', 'ARiMR', 'FE', 'PARP', 'NCBR', 'NFOŚiGW', 'KE', 'regionalny', 'agregator', 'wiadomości', 'inny']

export type GrantStatus = 'zapowiedz' | 'zapowiedziany' | 'otwarty' | 'konczy_sie' | 'zamkniety'

export type MyStatus =
  | 'Nowy'
  | 'Analizuję'
  | 'Obserwuję'
  | 'Przygotowuję wniosek'
  | 'Złożony'
  | 'W ocenie'
  | 'Przyznany'
  | 'Odrzucony'
  | 'Nie dla mnie'

export type ConfidenceField = 'opens_at' | 'closes_at' | 'budget_total' | 'max_grant' | 'funding_percent'

export interface Source {
  id: string
  name: string
  type: SourceType
  region: string
  url: string
  active: boolean
  /** katalog = wspólna baza Radaru, wlasna = dodana przez użytkownika tej firmy */
  origin: 'katalog' | 'wlasna'
  notes?: string
  added_at?: string
  /** Zasięg/kategoria, np. „Krajowy – ogólny”, „Regionalny – Śląskie”, „UE – bezpośrednie” */
  category?: string
  /** oficjalne = instytucja; agregator = serwis prywatny (dane potwierdzamy u źródła); odniesienie = nie ogłasza naborów */
  kind?: 'oficjalne' | 'agregator' | 'odniesienie' | 'wiadomosci'
  /** Wiadomości: słowa kluczowe wyszukiwania (adres kanału budujemy z nich) */
  query?: string
  /** Własna częstotliwość dla tej strony; brak = jak w ustawieniach firmy */
  scan_frequency?: ScanFrequency
  /** ISO data-czas ostatniego sprawdzenia */
  last_checked_at?: string
  /** Co poszło nie tak przy ostatnim sprawdzeniu (brak = OK) */
  last_error?: string
}

export interface Grant {
  id: string
  source_id: string
  title: string
  institution: string
  call_number?: string
  announced_at: string // ISO date – kiedy pojawiła się informacja
  opens_at?: string
  closes_at?: string
  budget_total?: number // PLN
  max_grant?: number // PLN
  funding_percent?: number
  beneficiaries: string
  scope: string
  required_docs: string[]
  summary_ai: string
  source_url: string
  /** Program, z którego finansowany jest nabór (np. FENG, PS WPR, program regionalny) */
  program?: { name: string; url: string }
  attachments: { name: string; url: string }[]
  /** 0–1 pewność ekstrakcji AI dla wybranych pól */
  confidence: Partial<Record<ConfidenceField, number>>
  manual_overrides: Partial<Pick<Grant, 'opens_at' | 'closes_at' | 'budget_total' | 'max_grant'>>
  updated?: boolean
}

export interface UserState {
  my_status: MyStatus
  note: string
  seen: boolean
  /** Dla kogo jest nabór – np. „Dla mnie”, klient 4uai */
  for_whom?: string[]
  /** Usunięty z listy (np. zakończony) – nie wraca przy kolejnym sprawdzeniu; można przywrócić */
  removed?: boolean
}

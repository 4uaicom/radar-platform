/**
 * PROTOTYP: symulacja logowania i organizacji w pamięci przeglądarki.
 * W wersji docelowej zastąpią to Supabase Auth + tabele organizations / memberships / subscriptions.
 */

export type Role = 'Właściciel' | 'Członek'
export type PlanId = 'trial' | 'start' | 'firma' | 'doradca'

export interface Plan {
  id: PlanId
  name: string
  ownSources: number | null // null = bez limitu
  users: number | null
  forWhomProfiles: number | null
}

export const PLANS: Record<PlanId, Plan> = {
  trial: { id: 'trial', name: 'Okres próbny', ownSources: 5, users: 3, forWhomProfiles: 5 },
  start: { id: 'start', name: 'Start', ownSources: 5, users: 1, forWhomProfiles: 0 },
  firma: { id: 'firma', name: 'Firma', ownSources: 25, users: 3, forWhomProfiles: 5 },
  doradca: { id: 'doradca', name: 'Doradca', ownSources: null, users: 10, forWhomProfiles: null },
}

export const TRIAL_DAYS = 14

export type ScanFrequency = '2x-dziennie' | 'codziennie' | 'co-2-dni' | 'co-tydzien' | 'recznie'

export interface ScanSettings {
  frequency: ScanFrequency
  /** godzina pierwszego sprawdzenia (0–23), czas polski */
  hour: number
  /** dzień tygodnia dla „co tydzień”: 1 = poniedziałek … 7 = niedziela */
  weekday: number
}

export const DEFAULT_SCAN: ScanSettings = { frequency: 'codziennie', hour: 6, weekday: 1 }

export const FREQUENCY_LABEL: Record<ScanFrequency, string> = {
  '2x-dziennie': '2 razy dziennie',
  codziennie: 'Codziennie',
  'co-2-dni': 'Co 2 dni',
  'co-tydzien': 'Raz w tygodniu',
  recznie: 'Tylko ręcznie',
}

export const WEEKDAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela']

/** Druga godzina przy „2 razy dziennie” – 8 godzin po pierwszej. */
export function secondHour(hour: number): number {
  return (hour + 8) % 24
}

const hh = (h: number) => `${h}:00`

/** Czytelny opis harmonogramu, np. „codziennie o 6:00”. */
export function describeScan(s: ScanSettings): string {
  switch (s.frequency) {
    case '2x-dziennie':
      return `2 razy dziennie – o ${hh(s.hour)} i ${hh(secondHour(s.hour))}`
    case 'codziennie':
      return `codziennie o ${hh(s.hour)}`
    case 'co-2-dni':
      return `co 2 dni o ${hh(s.hour)}`
    case 'co-tydzien':
      return `${[3, 6, 7].includes(s.weekday) ? 'w każdą' : 'w każdy'} ${weekdayPhrase(s.weekday)} o ${hh(s.hour)}`
    case 'recznie':
      return 'tylko ręcznie (przycisk „Sprawdź teraz”)'
  }
}

function weekdayPhrase(d: number): string {
  // „w każdy poniedziałek”, „w każdą środę”
  const forms = ['poniedziałek', 'wtorek', 'środę', 'czwartek', 'piątek', 'sobotę', 'niedzielę']
  return forms[d - 1]
}

/** Wyrażenie cron (strefa Europe/Warsaw) – dla pg_cron w Supabase. null = bez harmonogramu. */
export function toCron(s: ScanSettings): string | null {
  switch (s.frequency) {
    case '2x-dziennie':
      return `0 ${[s.hour, secondHour(s.hour)].sort((a, b) => a - b).join(',')} * * *`
    case 'codziennie':
      return `0 ${s.hour} * * *`
    case 'co-2-dni':
      return `0 ${s.hour} */2 * *`
    case 'co-tydzien':
      return `0 ${s.hour} * * ${s.weekday % 7}`
    case 'recznie':
      return null
  }
}

export interface Member {
  email: string
  name: string
  role: Role
  status: 'aktywny' | 'zaproszony'
}

export interface Org {
  id: string
  name: string
  plan: PlanId
  trial_ends?: string
  members: Member[]
  scan?: ScanSettings
}

export interface Account {
  email: string
  name: string
  password: string // tylko prototyp – w Supabase hasło nigdy nie trafia do aplikacji
}

export interface AuthStore {
  accounts: Account[]
  orgs: Org[]
  session: { email: string; orgId: string } | null
}

export const DEMO_EMAIL = 'demo@radar-grantow.pl'
export const DEMO_PASSWORD = 'demo1234'

function addDays(base: Date, days: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Dane demonstracyjne do testów: dwie firmy i zaproszony członek zespołu. */
export function demoStore(today = new Date()): AuthStore {
  return {
    accounts: [{ email: DEMO_EMAIL, name: 'Anna (demo)', password: DEMO_PASSWORD }],
    orgs: [
      {
        id: 'org-demo',
        name: 'Moja firma (demo)',
        plan: 'doradca',
        members: [
          { email: DEMO_EMAIL, name: 'Anna (demo)', role: 'Właściciel', status: 'aktywny' },
          { email: 'asystent@example.pl', name: 'Asystent', role: 'Członek', status: 'zaproszony' },
        ],
      },
      {
        id: 'org-klient',
        name: 'Pensjonat pod Lasem (klient demo)',
        plan: 'trial',
        trial_ends: addDays(today, 9),
        members: [{ email: DEMO_EMAIL, name: 'Anna (demo)', role: 'Właściciel', status: 'aktywny' }],
      },
    ],
    session: null,
  }
}

/** Start aplikacji: jedno konto i jedna firma, bez przykładowych osób i klientów. */
export function seedStore(): AuthStore {
  return {
    accounts: [{ email: DEMO_EMAIL, name: 'Anna', password: DEMO_PASSWORD }],
    orgs: [{ id: 'org-demo', name: 'Moja firma', plan: 'doradca', members: [{ email: DEMO_EMAIL, name: 'Anna', role: 'Właściciel', status: 'aktywny' }] }],
    session: null,
  }
}

/** Usuwa przykładowe dane z wcześniejszych wersji prototypu zapisane w przeglądarce (klient demo, asystent @example.pl, dopiski „(demo)”). */
export function cleanStore(store: AuthStore): AuthStore {
  const undemo = (n: string) => n.replace(/\s*\((klient )?demo\)\s*$/i, '').trim()
  const orgs = store.orgs
    .filter((o) => o.id !== 'org-klient')
    .map((o) => ({ ...o, name: undemo(o.name), members: o.members.filter((m) => !/@example\.(pl|org|com)$/i.test(m.email)).map((m) => ({ ...m, name: undemo(m.name) })) }))
  const session = store.session && orgs.some((o) => o.id === store.session!.orgId) ? store.session : store.session && orgs[0] ? { ...store.session, orgId: orgs[0].id } : null
  return { ...store, accounts: store.accounts.map((a) => ({ ...a, name: undemo(a.name) })), orgs, session }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type Errors<K extends string> = Partial<Record<K, string>>

export function validateLogin(email: string, password: string): Errors<'email' | 'password'> {
  const e: Errors<'email' | 'password'> = {}
  if (!EMAIL_RE.test(email.trim())) e.email = 'Wpisz adres e-mail w formacie nazwa@firma.pl.'
  if (!password) e.password = 'Wpisz hasło.'
  return e
}

export function validateRegister(d: { name: string; email: string; password: string; org: string; terms: boolean }, accounts: Account[]) {
  const e: Errors<'name' | 'email' | 'password' | 'org' | 'terms'> = {}
  if (!d.name.trim()) e.name = 'Podaj imię i nazwisko.'
  if (!EMAIL_RE.test(d.email.trim())) e.email = 'Wpisz adres e-mail w formacie nazwa@firma.pl.'
  else if (accounts.some((a) => a.email.toLowerCase() === d.email.trim().toLowerCase()))
    e.email = 'Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło.'
  if (d.password.length < 8) e.password = 'Hasło musi mieć co najmniej 8 znaków.'
  if (!d.org.trim()) e.org = 'Podaj nazwę firmy – możesz ją później zmienić.'
  if (!d.terms) e.terms = 'Aby założyć konto, zaakceptuj regulamin i politykę prywatności.'
  return e
}

export function login(store: AuthStore, email: string, password: string): { store: AuthStore } | { error: string } {
  const acc = store.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())
  if (!acc || acc.password !== password) return { error: 'Nieprawidłowy e-mail lub hasło.' }
  return startSession(store, acc.email)
}

/** Logowanie linkiem / Google – w prototypie tylko dla istniejących kont. */
export function loginPasswordless(store: AuthStore, email: string): { store: AuthStore } | { error: string } {
  const acc = store.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())
  if (!acc) return { error: 'Nie znaleziono konta z tym adresem. Załóż konto.' }
  return startSession(store, acc.email)
}

function startSession(store: AuthStore, email: string): { store: AuthStore } | { error: string } {
  const org = store.orgs.find((o) => o.members.some((m) => m.email === email && m.status === 'aktywny'))
  if (!org) return { error: 'Konto nie należy do żadnej firmy. Poproś o zaproszenie.' }
  return { store: { ...store, session: { email, orgId: org.id } } }
}

export function register(store: AuthStore, d: { name: string; email: string; password: string; org: string }, today = new Date()): AuthStore {
  const email = d.email.trim()
  const org: Org = {
    id: `org-${Date.now().toString(36)}`,
    name: d.org.trim(),
    plan: 'trial',
    trial_ends: addDays(today, TRIAL_DAYS),
    members: [{ email, name: d.name.trim(), role: 'Właściciel', status: 'aktywny' }],
  }
  return {
    accounts: [...store.accounts, { email, name: d.name.trim(), password: d.password }],
    orgs: [...store.orgs, org],
    session: { email, orgId: org.id },
  }
}

export function orgsFor(store: AuthStore, email: string): Org[] {
  return store.orgs.filter((o) => o.members.some((m) => m.email === email && m.status === 'aktywny'))
}

export function roleIn(org: Org, email: string): Role | undefined {
  return org.members.find((m) => m.email === email)?.role
}

export function inviteMember(org: Org, email: string, role: Role): { org: Org } | { error: string } {
  const e = email.trim().toLowerCase()
  if (!EMAIL_RE.test(e)) return { error: 'Wpisz adres e-mail w formacie nazwa@firma.pl.' }
  if (org.members.some((m) => m.email.toLowerCase() === e)) return { error: 'Ta osoba jest już w zespole lub ma zaproszenie.' }
  const limit = PLANS[org.plan].users
  if (limit !== null && org.members.length >= limit)
    return { error: `Plan „${PLANS[org.plan].name}” pozwala na ${limit} ${limit === 1 ? 'osobę' : 'osoby'}. Zmień plan, aby zaprosić więcej.` }
  return { org: { ...org, members: [...org.members, { email: e, name: e.split('@')[0], role, status: 'zaproszony' }] } }
}

export function trialDaysLeft(org: Org, today: Date): number | null {
  if (org.plan !== 'trial' || !org.trial_ends) return null
  const [y, m, d] = org.trial_ends.split('-').map(Number)
  const end = new Date(y, m - 1, d).getTime()
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.round((end - t) / 86_400_000)
}

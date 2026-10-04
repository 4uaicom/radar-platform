import { demoProps } from '../test/demo'
import { cleanStore, demoStore } from './session'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Root from '../Root'
import { DEMO_EMAIL, DEMO_PASSWORD, inviteMember, seedStore, validateRegister } from './session'

const TODAY = new Date(2026, 8, 26)

function setup() {
  const user = userEvent.setup()
  render(<Root today={TODAY} persist={false} {...demoProps(TODAY)} seed={demoStore} />)
  return { user }
}

async function loginDemo(user: ReturnType<typeof userEvent.setup>) {
  const form = screen.getByRole('form', { name: 'Logowanie' })
  await user.type(within(form).getByLabelText('E-mail'), DEMO_EMAIL)
  await user.type(within(form).getByLabelText('Hasło'), DEMO_PASSWORD)
  await user.click(within(form).getByRole('button', { name: 'Zaloguj się' }))
}

describe('Logowanie', () => {
  it('bez sesji pokazuje ekran logowania', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Zaloguj się' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Nabory' })).not.toBeInTheDocument()
  })

  it('waliduje pola i pokazuje błąd złego hasła', async () => {
    const { user } = setup()
    const form = screen.getByRole('form', { name: 'Logowanie' })
    await user.click(within(form).getByRole('button', { name: 'Zaloguj się' }))
    expect(within(form).getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(within(form).getByLabelText('E-mail')).toHaveFocus()
    await user.type(within(form).getByLabelText('E-mail'), DEMO_EMAIL)
    await user.type(within(form).getByLabelText('Hasło'), 'zlehaslo')
    await user.click(within(form).getByRole('button', { name: 'Zaloguj się' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Nieprawidłowy e-mail lub hasło.')
  })

  it('poprawne logowanie otwiera aplikację z menu konta; wylogowanie wraca do logowania', async () => {
    const { user } = setup()
    await loginDemo(user)
    expect(screen.getByRole('tab', { name: 'Nabory' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Konto: Anna \(demo\)/ }))
    await user.click(screen.getByRole('button', { name: 'Wyloguj się' }))
    expect(screen.getByRole('heading', { name: 'Zaloguj się' })).toBeInTheDocument()
  })

  it('link logowania: ekran „Sprawdź skrzynkę” i wejście przez link', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText('E-mail'), DEMO_EMAIL)
    await user.click(screen.getByRole('button', { name: 'Wyślij mi link logowania' }))
    expect(screen.getByRole('heading', { name: 'Sprawdź skrzynkę' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Otwórz link z e-maila/ }))
    expect(screen.getByRole('tab', { name: 'Nabory' })).toBeInTheDocument()
  })

  it('reset hasła', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Nie pamiętasz hasła?' }))
    await user.type(screen.getByLabelText('E-mail'), 'ktos@firma.pl')
    await user.click(screen.getByRole('button', { name: 'Wyślij link' }))
    expect(screen.getByRole('heading', { name: 'Link do zmiany hasła wysłany' })).toBeInTheDocument()
  })
})

describe('Rejestracja i firmy', () => {
  it('rejestracja zakłada firmę z okresem próbnym 14 dni', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Załóż konto/ }))
    const form = screen.getByRole('form', { name: 'Rejestracja' })
    await user.type(within(form).getByLabelText('Imię i nazwisko'), 'Jan Nowak')
    await user.type(within(form).getByLabelText('E-mail służbowy'), 'jan@pensjonat.pl')
    await user.type(within(form).getByLabelText('Hasło (min. 8 znaków)'), 'bezpieczne1')
    await user.type(within(form).getByLabelText('Nazwa firmy'), 'Pensjonat Nowak')
    await user.click(within(form).getByRole('checkbox'))
    await user.click(within(form).getByRole('button', { name: 'Załóż konto i firmę' }))
    expect(screen.getByText(/Okres próbny: zostało/)).toHaveTextContent('14 dni')
    expect(screen.getByRole('button', { name: /firma: Pensjonat Nowak/ })).toBeInTheDocument()
  })

  it('dane są oddzielne dla każdej firmy (przełączanie firm)', async () => {
    const { user } = setup()
    await loginDemo(user)
    await user.click(screen.getByRole('button', { name: /Rozwój działalności turystycznej/ }))
    await user.click(screen.getByRole('button', { name: 'Analizuję' }))
    await user.click(screen.getByRole('button', { name: 'Zamknij' }))
    expect(screen.getByRole('button', { name: /Rozwój działalności turystycznej.*mój status: Analizuję/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Konto:/ }))
    await user.click(screen.getByRole('button', { name: /Pensjonat pod Lasem/ }))
    expect(screen.getByRole('button', { name: /firma: Pensjonat pod Lasem/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rozwój działalności turystycznej.*mój status: Analizuję/ })).not.toBeInTheDocument()
  })

  it('historia sprawdzeń jest pod „Moja firma” (menu konta → ustawienia), a nie w bazie stron', async () => {
    const { user } = setup()
    await loginDemo(user)
    await user.click(screen.getByRole('tab', { name: /Baza stron/ }))
    expect(screen.queryByRole('region', { name: 'Historia sprawdzeń' })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Konto:/ }))
    await user.click(screen.getByRole('button', { name: 'Historia sprawdzeń' }))
    const log = screen.getByRole('region', { name: 'Historia sprawdzeń' })
    expect(screen.getByRole('heading', { name: /^Ustawienia:/ })).toBeInTheDocument()
    expect(within(log).getByRole('heading', { name: 'Historia sprawdzeń' })).toHaveFocus()
    expect(log).toHaveTextContent('Agent jeszcze nie sprawdzał stron')
  })

  it('ustawienia: zaproszenie do zespołu z walidacją', async () => {
    const { user } = setup()
    await loginDemo(user)
    await user.click(screen.getByRole('button', { name: /Konto:/ }))
    await user.click(screen.getByRole('button', { name: 'Ustawienia firmy i konta' }))
    const form = screen.getByRole('form', { name: 'Zaproś do zespołu' })
    await user.type(within(form).getByLabelText('E-mail osoby'), 'asystent@example.pl')
    await user.click(within(form).getByRole('button', { name: 'Zaproś' }))
    expect(within(form).getByLabelText('E-mail osoby')).toHaveAccessibleDescription(/już w zespole/)
    await user.clear(within(form).getByLabelText('E-mail osoby'))
    await user.type(within(form).getByLabelText('E-mail osoby'), 'nowa@firma.pl')
    await user.click(within(form).getByRole('button', { name: 'Zaproś' }))
    expect(screen.getByRole('heading', { name: 'Zespół (3)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← Wróć do naborów' }))
    expect(screen.getByRole('tab', { name: 'Nabory' })).toBeInTheDocument()
  })
})

describe('session – reguły', () => {
  it('limit użytkowników w planie', () => {
    const org = { ...seedStore().orgs[0], plan: 'start' as const }
    const r = inviteMember(org, 'x@firma.pl', 'Członek')
    expect('error' in r && r.error).toMatch(/pozwala na 1 osobę/)
  })
  it('rejestracja: duplikat e-maila, krótkie hasło, brak zgody', () => {
    const e = validateRegister({ name: 'A', email: DEMO_EMAIL, password: '123', org: 'X', terms: false }, seedStore().accounts)
    expect(e.email).toMatch(/już istnieje/)
    expect(e.password).toBeDefined()
    expect(e.terms).toBeDefined()
  })
})

describe('Ikona ustawień w górnym pasku', () => {
  it('otwiera ustawienia jednym kliknięciem i oznacza aktywną stronę', async () => {
    const user = userEvent.setup()
    render(<Root today={TODAY} persist={false} {...demoProps(TODAY)} seed={demoStore} />)
    await loginDemo(user)
    await user.click(screen.getByRole('button', { name: 'Ustawienia' }))
    expect(screen.getByRole('heading', { name: /Ustawienia: Moja firma/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('Harmonogram sprawdzania stron', () => {
  it('opis i cron dla każdej częstotliwości', async () => {
    const { describeScan, toCron } = await import('./session')
    expect(describeScan({ frequency: 'codziennie', hour: 6, weekday: 1 })).toBe('codziennie o 6:00')
    expect(describeScan({ frequency: '2x-dziennie', hour: 6, weekday: 1 })).toBe('2 razy dziennie – o 6:00 i 14:00')
    expect(describeScan({ frequency: 'co-tydzien', hour: 7, weekday: 3 })).toBe('w każdą środę o 7:00')
    expect(describeScan({ frequency: 'co-tydzien', hour: 7, weekday: 1 })).toBe('w każdy poniedziałek o 7:00')
    expect(toCron({ frequency: '2x-dziennie', hour: 20, weekday: 1 })).toBe('0 4,20 * * *')
    expect(toCron({ frequency: 'co-2-dni', hour: 6, weekday: 1 })).toBe('0 6 */2 * *')
    expect(toCron({ frequency: 'co-tydzien', hour: 6, weekday: 7 })).toBe('0 6 * * 0')
  })

  it('właściciel ustawia częstotliwość; opis pojawia się w ustawieniach, nagłówku i bazie stron', async () => {
    const user = userEvent.setup()
    render(<Root today={TODAY} persist={false} {...demoProps(TODAY)} seed={demoStore} />)
    await loginDemo(user)
    await user.click(screen.getByRole('button', { name: 'Ustawienia' }))
    const form = screen.getByRole('form', { name: 'Harmonogram sprawdzania' })
    await user.click(within(form).getByRole('radio', { name: 'Raz w tygodniu' }))
    await user.selectOptions(within(form).getByLabelText('Dzień tygodnia'), 'piątek')
    await user.selectOptions(within(form).getByLabelText('Godzina'), '8')
    await user.click(within(form).getByRole('button', { name: 'Zapisz harmonogram' }))
    expect(screen.getByText('w każdy piątek o 8:00', { selector: 'strong' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← Wróć do naborów' }))
    expect(screen.getByText(/Twoje strony w każdy piątek o 8:00/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Baza stron/ }))
    expect(screen.getByText(/w każdy piątek o 8:00 \(jak w ustawieniach\)/)).toBeInTheDocument()
    // nadpisanie dla jednej strony
    await user.selectOptions(screen.getByLabelText('Częstotliwość sprawdzania LGD Pogórze (przykład)'), '2x-dziennie')
    expect(screen.getByText(/2 razy dziennie \(ustawione dla tej strony\)/)).toBeInTheDocument()
  })

  it('2 razy dziennie pokazuje drugą godzinę', async () => {
    const user = userEvent.setup()
    render(<Root today={TODAY} persist={false} {...demoProps(TODAY)} seed={demoStore} />)
    await loginDemo(user)
    await user.click(screen.getByRole('button', { name: 'Ustawienia' }))
    await user.click(screen.getByRole('radio', { name: '2 razy dziennie' }))
    expect(screen.getByLabelText('Pierwsze sprawdzenie o')).toBeInTheDocument()
    expect(screen.getByText('Drugie sprawdzenie o 14:00')).toBeInTheDocument()
  })
})


describe('czyszczenie przykładowych danych', () => {
  it('start bez przykładowych osób i klientów', () => {
    const s = seedStore()
    expect(s.orgs.map((o) => o.name)).toEqual(['Moja firma'])
    expect(s.orgs[0].members.map((m) => m.email)).toEqual(['demo@radar-grantow.pl'])
  })
  it('zapis z wcześniejszej wersji: usuwa klienta demo, asystenta @example.pl i dopiski „(demo)”, zostawia firmy użytkownika', () => {
    const old = demoStore(TODAY)
    old.orgs.push({ id: 'org-x', name: 'Agroturystyka Harat', plan: 'trial', members: [{ email: 'demo@radar-grantow.pl', name: 'Anna (demo)', role: 'Właściciel', status: 'aktywny' }] })
    old.session = { email: 'demo@radar-grantow.pl', orgId: 'org-klient' }
    const c = cleanStore(old)
    expect(c.orgs.map((o) => o.name)).toEqual(['Moja firma', 'Agroturystyka Harat'])
    expect(c.orgs[0].members.map((m) => m.name)).toEqual(['Anna'])
    expect(c.accounts[0].name).toBe('Anna')
    expect(c.session?.orgId).toBe('org-demo')
  })
})

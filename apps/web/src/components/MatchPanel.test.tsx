import { demoProps } from '../test/demo'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { MatchPanel, mailProvider, proposalMailto } from './MatchPanel'
import type { AiMatch, ClientProfile } from '../match/types'
import type { Grant } from '../types'

const TODAY = new Date(2026, 8, 26)

// Some integration-like tests can take longer (DOM interactions, userEvent).
// Increase default timeout for this file so Vitest doesn't fail on slow CI runners.
vi.setTimeout(20000)

async function fillProfile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /^Klienci/ }))
  // na początku tabela klientów (pusta), ankieta dopiero po kliknięciu
  expect(screen.getByText('Nie masz jeszcze klientów')).toBeInTheDocument()
  expect(screen.queryByRole('form', { name: 'Ankieta nowego klienta' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '+ Nowy klient' }))
  const form = screen.getByRole('form', { name: 'Ankieta nowego klienta' })
  await user.click(within(form).getByRole('button', { name: 'Zapisz i dopasuj nabory' }))
  // walidacja
  const name = within(form).getByLabelText('Nazwa klienta')
  expect(name).toHaveAttribute('aria-invalid', 'true')
  expect(name).toHaveFocus() // fokus na pierwszym błędzie
  expect(within(form).getByRole('alert')).toHaveTextContent(/Nie zapisano – popraw 3 pola.*Wybierz województwo/)
  await user.type(within(form).getByLabelText('Nazwa klienta'), 'Agroturystyka Pod Lasem')
  await user.type(within(form).getByLabelText(/E-mail klienta/), 'jan@')
  await user.click(within(form).getByRole('button', { name: 'Zapisz i dopasuj nabory' }))
  expect(within(form).getByRole('alert')).toHaveTextContent(/Sprawdź adres e-mail/)
  await user.type(within(form).getByLabelText(/E-mail klienta/), 'podlasem.pl')
  await user.selectOptions(within(form).getByLabelText('Województwo'), 'małopolskie')
  await user.click(within(form).getByLabelText('Turystyka, noclegi, agroturystyka'))
  await user.type(within(form).getByLabelText('Opis planowanej inwestycji'), 'Domki noclegowe z sauną dla turystów')
  await user.type(within(form).getByLabelText('Budżet projektu (zł)'), '300000')
  await user.type(within(form).getByLabelText('Możliwy wkład własny (%)'), '40')
  await user.click(within(form).getByRole('button', { name: 'Zapisz i dopasuj nabory' }))
  // po zapisie otwiera się panel boczny klienta
  return screen.getByRole('dialog', { name: 'Agroturystyka Pod Lasem' })
}

const cardIn = (drawer: HTMLElement) => within(drawer).getAllByRole('listitem').find((li) => within(li).queryByText(/Rozwój działalności turystycznej/))!

describe('Dopasowanie klienta', () => {
  it('ankieta → ranking naborów regułami z powodami i szacowaną dotacją', async () => {
    const user = userEvent.setup()
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} />)
    const drawer = await fillProfile(user)
    expect(within(drawer).getByRole('heading', { name: 'Nabory dla: Agroturystyka Pod Lasem' })).toBeInTheDocument()
    // ankieta w panelu
    expect(within(drawer).getByText('Domki noclegowe z sauną dla turystów')).toBeInTheDocument()
    expect(within(drawer).getByText('300 000 zł')).toBeInTheDocument()
    const first = cardIn(drawer)
    expect(within(first).getByText(/Reguły: Pasuje/)).toBeInTheDocument()
    expect(within(first).getByText(/szacowana dotacja ok\. 195 000 zł/)).toBeInTheDocument() // 65% z 300 tys., limit 200 tys.
    expect(within(first).getAllByText('spełnione:', { exact: false }).length).toBeGreaterThan(2)
    // „Nie pasuje” schowane
    expect(within(drawer).getByRole('button', { name: /Pokaż „Nie pasuje”/ })).toHaveAttribute('aria-expanded', 'false')
    // e-mail z propozycjami
    // e-mail do skopiowania: treść można poprawić, kopiowanie do schowka, opcjonalnie program pocztowy
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(within(drawer).getByRole('button', { name: /^E-mail z propozycjami/ }))
    const box = within(drawer).getByRole('group', { name: 'E-mail z propozycjami' })
    expect(within(box).getByText('jan@podlasem.pl')).toBeInTheDocument()
    expect(within(box).getByLabelText('Temat')).toHaveValue('Proponowane dotacje dla: Agroturystyka Pod Lasem')
    const body = within(box).getByLabelText('Treść')
    expect((body as HTMLTextAreaElement).value).toMatch(/Rozwój działalności turystycznej/)
    await user.type(body, ' Anna')
    await user.click(within(box).getByRole('button', { name: 'Kopiuj treść' }))
    expect(writeText).toHaveBeenLastCalledWith(expect.stringMatching(/Pozdrawiam Anna$/))
    expect(within(box).getByText('Skopiowano: treść.')).toBeInTheDocument()
    await user.click(within(box).getByRole('button', { name: 'Kopiuj adres' }))
    expect(writeText).toHaveBeenLastCalledWith('jan@podlasem.pl')
    expect(within(box).queryByRole('button', { name: /Kopiuj temat|Kopiuj wszystko/ })).toBeNull()
    // poczta nieznana (bez e-maila zalogowanej osoby) → tylko kopiowanie, bez wyboru
    expect(within(box).queryByRole('link', { name: /Otwórz w|Gmail|Outlook|Program pocztowy/ })).toBeNull()
    expect(within(box).getByText(/Nie rozpoznaliśmy poczty/)).toBeInTheDocument()
    await user.click(within(box).getByRole('button', { name: 'Zamknij' }))
    expect(within(drawer).queryByRole('group', { name: 'E-mail z propozycjami' })).toBeNull()
  })

  it('tabela klientów: e-mail, ankieta, proponowane programy; „Pokaż” otwiera panel, „Zamknij” go zamyka', async () => {
    const user = userEvent.setup()
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} />)
    const drawer = await fillProfile(user)
    await user.click(within(drawer).getByRole('button', { name: 'Zamknij' }))
    expect(screen.queryByRole('dialog', { name: 'Agroturystyka Pod Lasem' })).not.toBeInTheDocument()
    const table = screen.getByRole('table', { name: /Klienci/ })
    const row = within(table).getByRole('row', { name: /Agroturystyka Pod Lasem/ })
    expect(within(row).getByRole('link', { name: 'jan@podlasem.pl' })).toHaveAttribute('href', 'mailto:jan@podlasem.pl')
    expect(within(row).getByText('JDG · mikro · małopolskie')).toBeInTheDocument()
    expect(within(row).getByText('300 000 zł')).toBeInTheDocument()
    expect(within(row).getByText(/\d pasuje/)).toBeInTheDocument()
    expect(within(row).getByText(/Rozwój działalności turystycznej/)).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'Pokaż szczegóły: Agroturystyka Pod Lasem' }))
    expect(screen.getByRole('dialog', { name: 'Agroturystyka Pod Lasem' })).toBeInTheDocument()
  })

  it('więcej klientów: wyszukiwarka i sortowanie', async () => {
    const user = userEvent.setup()
    const mk = (id: string, name: string, voivodeship: string, updated_at: string): ClientProfile => ({
      id, name, email: `${id}@firma.pl`, legal_form: 'jdg', size: 'mikro', voivodeship, stage: 'istniejaca', categories: ['turystyka'], description: '', updated_at,
    })
    const profiles = [mk('a', 'Zakład B', 'śląskie', '2026-09-01'), mk('b', 'Agro A', 'małopolskie', '2026-09-20'), mk('c', 'Hotel C', 'pomorskie', '2026-09-10'), mk('d', 'Dom D', 'śląskie', '2026-09-05')]
    const { initialGrants, initialSources } = demoProps(TODAY)
    render(<MatchPanel profiles={profiles} grants={initialGrants} sources={initialSources} today={TODAY} aiChecks={{}} onSave={vi.fn()} onDelete={vi.fn()} onOpenGrant={vi.fn()} onAi={vi.fn()} />)
    const table = screen.getByRole('table', { name: /Klienci/ })
    const names = () => within(table).getAllByRole('rowheader').map((th) => th.querySelector('span')!.textContent)
    expect(names()[0]).toBe('Agro A') // ostatnio zmieniony na górze
    await user.selectOptions(screen.getByLabelText('Sortuj'), 'nazwa')
    expect(names()).toEqual(['Agro A', 'Dom D', 'Hotel C', 'Zakład B'])
    await user.type(screen.getByLabelText('Szukaj klienta'), 'śląsk')
    expect(names()).toHaveLength(2)
    expect(screen.getByText('2 z 4')).toBeInTheDocument()
  })

  it('e-mail z propozycjami: temat, lista naborów z linkami, brak naborów → inna treść', () => {
    const p = { id: 'k', name: 'Firma X', email: 'a@b.pl', legal_form: 'jdg', size: 'mikro', voivodeship: 'śląskie', stage: 'istniejaca', categories: ['oze'], description: '', updated_at: '' } as ClientProfile
    const g = { id: 'g1', title: 'Fotowoltaika dla firm', closes_at: '2026-11-30', source_url: 'https://x.pl/n' } as Grant
    const href = decodeURIComponent(proposalMailto(p, [{ grant_id: 'g1', score: 80, verdict: 'pasuje', checks: [], estimated_grant: 50000 }], [g]))
    expect(href).toMatch(/subject=Proponowane dotacje dla: Firma X/)
    expect(href).toMatch(/1\. Fotowoltaika dla firm/)
    expect(href).toMatch(/ok\. 50\s000 zł/)
    expect(href).toMatch(/https:\/\/x\.pl\/n/)
    expect(decodeURIComponent(proposalMailto(p, [], [g]))).toMatch(/nie znalazłam teraz otwartych naborów/)
  })

  it('„Sprawdź z AI”: druga opinia z cytatem, zestawienie z regułami i licznik zgodności', async () => {
    const user = userEvent.setup()
    const aiChecker = vi.fn(async (p: ClientProfile, g: Grant): Promise<AiMatch> => ({
      grant_id: g.id,
      verdict: 'pasuje',
      score: 88,
      conditions: [{ condition: 'Wnioskodawca: mikroprzedsiębiorstwo', status: 'spelniony', quote: 'Mikro i małe przedsiębiorstwa' }],
      estimated_grant_pln: 195000,
      summary: `${p.name} spełnia warunki naboru.`,
      missing_info: ['PKD klienta'],
      cost_usd: 0.006,
      checked_at: new Date().toISOString(),
      source_read: true,
    }))
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} aiChecker={aiChecker} />)
    const drawer = await fillProfile(user)
    const card = cardIn(drawer)
    await user.click(within(card).getByRole('button', { name: 'Sprawdź z AI' }))
    expect(aiChecker).toHaveBeenCalledTimes(1)
    expect(await within(card).findByText(/AI: Pasuje · 88\/100/)).toBeInTheDocument()
    expect(within(card).getByText('Mikro i małe przedsiębiorstwa', { selector: 'q' })).toBeInTheDocument()
    expect(within(card).getByText(/Zgodne z regułami/)).toBeInTheDocument()
    expect(within(card).getByText(/Brakuje: PKD klienta/)).toBeInTheDocument()
    expect(within(drawer).getByRole('status', { name: '' })).toHaveTextContent(/AI sprawdziło 1 nabór, zgodny werdykt z regułami w 1 z 1/)
  })

  it('błąd AI (np. brak klucza) pokazuje się przy naborze', async () => {
    const user = userEvent.setup()
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} aiChecker={async () => ({ error: 'AI nie jest jeszcze włączone.' })} />)
    const drawer = await fillProfile(user)
    const card = cardIn(drawer)
    await user.click(within(card).getByRole('button', { name: 'Sprawdź z AI' }))
    expect(await within(card).findByRole('alert')).toHaveTextContent('AI nie jest jeszcze włączone.')
  })
})

describe('rozpoznanie poczty po adresie zalogowanej osoby', () => {
  it('Gmail, Outlook, Onet, WP, Interia, firmowa', () => {
    expect(['ania@gmail.com', 'a@outlook.com', 'a@hotmail.co.uk', 'a@op.pl', 'a@onet.pl', 'a@wp.pl', 'a@o2.pl', 'a@interia.pl', 'a@4uai.com.pl', undefined].map(mailProvider)).toEqual([
      'gmail', 'outlook', 'outlook', 'onet', 'onet', 'wp', 'wp', 'interia', 'inna', 'inna',
    ])
  })

  it('użytkownik Gmaila dostaje od razu „Otwórz w Gmail”; Onet – podpowiedź, żeby skopiować', async () => {
    const user = userEvent.setup()
    const p: ClientProfile = {
      id: 'k1', name: 'Jan', email: 'jan@x.pl', legal_form: 'jdg', size: 'mikro', voivodeship: 'małopolskie', stage: 'istniejaca', categories: ['turystyka'], description: '', updated_at: '2026-09-20',
    }
    const { unmount } = render(<MatchPanel grants={demoProps(TODAY).initialGrants} sources={demoProps(TODAY).initialSources} profiles={[p]} today={TODAY} aiChecks={{}} onSave={() => {}} onDelete={() => {}} onOpenGrant={() => {}} onAi={async () => null} userEmail="artgo@gmail.com" />)
    await user.click(within(screen.getByRole('row', { name: /Jan/ })).getByRole('button', { name: /Pokaż szczegóły/ }))
    await user.click(screen.getByRole('button', { name: /^E-mail z propozycjami/ }))
    const open = screen.getByRole('link', { name: 'Otwórz w Gmail' })
    const u = new URL(open.getAttribute('href')!)
    expect(u.origin).toBe('https://mail.google.com')
    expect(u.searchParams.get('to')).toBe('jan@x.pl')
    expect(u.searchParams.get('su')).toBe('Proponowane dotacje dla: Jan')
    expect(open).toHaveAttribute('target', '_blank')
    expect(screen.queryByRole('link', { name: /Outlook|Program pocztowy/ })).toBeNull() // bez opcji
    unmount()

    render(<MatchPanel grants={demoProps(TODAY).initialGrants} sources={demoProps(TODAY).initialSources} profiles={[p]} today={TODAY} aiChecks={{}} onSave={() => {}} onDelete={() => {}} onOpenGrant={() => {}} onAi={async () => null} userEmail="ania@op.pl" />)
    await user.click(within(screen.getByRole('row', { name: /Jan/ })).getByRole('button', { name: /Pokaż szczegóły/ }))
    await user.click(screen.getByRole('button', { name: /^E-mail z propozycjami/ }))
    expect(screen.queryByRole('link', { name: /^Otwórz w/ })).toBeNull()
    expect(screen.getByText(/Onet Poczta nie pozwala otworzyć gotowej wiadomości/)).toBeInTheDocument()
  })
})

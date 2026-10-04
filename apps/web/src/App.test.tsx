import { demoProps } from './test/demo'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const TODAY = new Date(2026, 8, 26)

function setup() {
  const user = userEvent.setup()
  render(<App today={TODAY} persist={false} {...demoProps(TODAY)} />)
  return { user }
}

describe('Radar Grantów – scenariusze z PRD', () => {
  it('pokazuje oś czasu z naborami i sekcję zapowiedzi', () => {
    setup()
    expect(screen.getByRole('region', { name: 'Oś czasu naborów' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Zapowiedzi/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rozwój działalności turystycznej/ })).toBeInTheDocument()
  })

  it('klawiatura: strzałka w dół przenosi fokus, Enter otwiera modal', async () => {
    const { user } = setup()
    const rows = within(screen.getByRole('list', { name: /Nabory/ })).getAllByRole('button')
    rows[0].focus()
    await user.keyboard('{ArrowDown}')
    expect(rows[1]).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('modal pokazuje najważniejsze informacje i oznaczenie „Sprawdź” dla niepewnych pól', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Podejmowanie działalności gospodarczej/ }))
    const dialog = screen.getByRole('dialog', { name: /Podejmowanie działalności/ })
    expect(within(dialog).getByText('Maks. dofinansowanie')).toBeInTheDocument()
    expect(within(dialog).getByText('Kto może aplikować')).toBeInTheDocument()
    expect(within(dialog).getByText('Sprawdź')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Ogłoszenie źródłowe/ })).toHaveAttribute('href')
  })

  it('„Obserwuj” zmienia mój status i licznik obserwowanych', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Rozwój działalności turystycznej/ }))
    await user.click(screen.getByRole('button', { name: 'Obserwuj' }))
    expect(screen.getByRole('button', { name: '✓ Obserwuję' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zamknij' }))
    expect(screen.getByText('Moje w toku').previousSibling).toHaveTextContent('1')
    // nabór kończy się za 4 dni → przypomnienie
    expect(screen.getByRole('status')).toHaveTextContent('Rozwój działalności turystycznej')
  })

  it('„Nie dla mnie” ukrywa nabór', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Infrastruktura rekreacyjna/ }))
    await user.click(screen.getByRole('button', { name: 'Nie dla mnie' }))
    expect(screen.queryByRole('button', { name: /Infrastruktura rekreacyjna/ })).not.toBeInTheDocument()
  })

  it('filtr i przełączenie na listę', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('searchbox', { name: 'Szukaj' }), 'UX')
    await user.click(screen.getByRole('button', { name: 'Lista' }))
    const list = screen.getByRole('list', { name: /Lista naborów/ })
    expect(within(list).getAllByRole('button')).toHaveLength(1)
    expect(within(list).getByText(/Wzornictwo i dostępność cyfrowa/)).toBeInTheDocument()
  })

  it('ręczna korekta daty zamknięcia zmienia status naboru', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Rozwój działalności turystycznej/ }))
    await user.click(screen.getByRole('button', { name: 'Popraw daty' }))
    const input = screen.getByLabelText('Zamknięcie', { selector: 'input' })
    fireEvent.change(input, { target: { value: '2026-11-30' } })
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('(poprawione ręcznie)')).toBeInTheDocument()
    expect(within(dialog).getByText('Otwarty')).toBeInTheDocument()
  })

  it('etap wniosku: przejście do „Przygotowuję wniosek” widoczne na osi czasu', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Wzornictwo i dostępność/ }))
    await user.click(screen.getByRole('button', { name: 'Przygotowuję wniosek' }))
    expect(screen.getByRole('button', { name: 'Przygotowuję wniosek', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Analizuję.*etap zakończony/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zamknij' }))
    expect(screen.getByRole('button', { name: /Wzornictwo i dostępność.*mój status: Przygotowuję wniosek/ })).toBeInTheDocument()
    expect(screen.getByText('Moje w toku').previousSibling).toHaveTextContent('1')
  })

  it('etap wniosku: wynik „Odrzucony” po ocenie', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Wzornictwo i dostępność/ }))
    await user.click(screen.getByRole('button', { name: 'W ocenie' }))
    await user.click(screen.getByRole('button', { name: 'Odrzucony' }))
    expect(screen.getByRole('button', { name: 'Odrzucony', pressed: true })).toBeInTheDocument()
  })

  it('modal pokazuje link do programu', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Wzornictwo i dostępność/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('link', { name: /^Fundusze Europejskie dla Nowoczesnej Gospodarki \(FENG\) ↗$/ })).toHaveAttribute('href', 'https://nowoczesnagospodarka.gov.pl/')
    expect(within(dialog).getByRole('link', { name: /Strona programu/ })).toBeInTheDocument()
  })

  it('wyszukiwanie po nazwie programu', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('searchbox', { name: 'Szukaj' }), 'FENG')
    await user.click(screen.getByRole('button', { name: 'Lista' }))
    expect(within(screen.getByRole('list', { name: /Lista naborów/ })).getAllByRole('button').length).toBeGreaterThanOrEqual(2)
  })

  it('pigułka statusu pojawia się w modalu i na karcie', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Inwestycje w gospodarstwach/ }))
    await user.click(screen.getByRole('button', { name: 'Analizuję' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByText('Analizuję').length).toBeGreaterThanOrEqual(2) // pigułka w nagłówku + etap
    await user.click(within(dialog).getByRole('button', { name: 'Zamknij' }))
    const row = screen.getByRole('button', { name: /Inwestycje w gospodarstwach.*mój status: Analizuję/ })
    expect(within(row).getByText('Analizuję')).toBeInTheDocument()
  })

  it('„Dla kogo”: wybór i własna etykieta, pigułki na karcie i filtr', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Rozwój działalności turystycznej/ }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Ja' }))
    await user.type(within(dialog).getByLabelText('Nowa osoba lub firma'), 'Pensjonat Kowalski{Enter}')
    expect(within(dialog).getByRole('button', { name: /Pensjonat Kowalski/, pressed: true })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Zamknij' }))
    const row = screen.getByRole('button', { name: /Rozwój działalności turystycznej.*dla: Ja, Pensjonat Kowalski/ })
    expect(within(row).getByText('Pensjonat Kowalski')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Dla kogo' }), 'Pensjonat Kowalski')
    expect(within(screen.getByRole('list', { name: /Nabory/ })).getAllByRole('button')).toHaveLength(1)
  })
})

describe('dane domyślne', () => {
  it('bez danych demo pokazuje prawdziwe nabory z katalogu', () => {
    render(<App today={new Date(2026, 8, 27)} persist={false} />)
    expect(screen.getAllByRole('button', { name: /Horizon Bridge/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Rozwój działalności turystycznej/ })).not.toBeInTheDocument()
  })
})

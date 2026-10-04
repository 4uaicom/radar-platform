import { demoProps } from '../test/demo'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import type { CheckResult } from '../agent/common'
import type { Source } from '../types'
import { buildMockGrants } from '../data/mock'
import { announcementsWord } from './SourcesPanel'

const TODAY = new Date(2026, 8, 26)

async function openSources() {
  const user = userEvent.setup()
  render(<App today={TODAY} persist={false} {...demoProps(TODAY)} />)
  await user.click(screen.getByRole('tab', { name: /Baza stron i programy/ }))
  return { user }
}

describe('Baza stron', () => {
  it('dodaje nową stronę do bazy', async () => {
    const { user } = await openSources()
    const form = screen.getByRole('form', { name: 'Nowa strona' })
    await user.type(within(form).getByLabelText('Nazwa'), 'LGD Dolina Raby – nabory')
    await user.type(within(form).getByLabelText('Adres strony (URL)'), 'https://lgd-dolina-raby.example.pl/nabory')
    await user.type(within(form).getByLabelText('Region'), 'małopolskie')
    await user.click(within(form).getByRole('button', { name: 'Dodaj stronę' }))
    expect(screen.getByRole('heading', { name: 'Moja baza stron (18)' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: /Moja baza stron/ })).getByText('LGD Dolina Raby – nabory')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /\(18\)/ })).toBeInTheDocument()
  })

  it('waliduje adres i duplikaty, fokus na pierwszym błędzie', async () => {
    const { user } = await openSources()
    const form = screen.getByRole('form', { name: 'Nowa strona' })
    await user.type(within(form).getByLabelText('Nazwa'), 'Test')
    await user.type(within(form).getByLabelText('Adres strony (URL)'), 'lgd.pl')
    await user.click(within(form).getByRole('button', { name: 'Dodaj stronę' }))
    const url = within(form).getByLabelText('Adres strony (URL)')
    expect(url).toHaveAttribute('aria-invalid', 'true')
    expect(url).toHaveFocus()
    expect(url).toHaveAccessibleDescription(/https:\/\//)

    await user.clear(url)
    await user.type(url, 'https://example.org/arimr/')
    await user.click(within(form).getByRole('button', { name: 'Dodaj stronę' }))
    expect(url).toHaveAccessibleDescription(/już w bazie jako „ARiMR – nabory \(przykład\)”/)
  })

  it('usuwa własną stronę po potwierdzeniu na stronie (bez okna przeglądarki)', async () => {
    const { user } = await openSources()
    await user.click(screen.getByRole('button', { name: 'Usuń LGD Pogórze (przykład)' }))
    await user.click(screen.getByRole('button', { name: 'Tak, usuń' }))
    expect(screen.queryByText('LGD Pogórze (przykład)')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Nabory' }))
    expect(screen.queryByRole('button', { name: /Infrastruktura rekreacyjna/ })).not.toBeInTheDocument()
  })

  it('wstrzymanie monitorowania ukrywa nabory z tej strony', async () => {
    const { user } = await openSources()
    await user.click(screen.getByRole('switch', { name: /Monitoruj ARiMR – nabory \(przykład\)/ }))
    expect(screen.getAllByText('Wstrzymana')).toHaveLength(3) // + Mapa Dotacji i SCP (domyślnie wyłączone)
    await user.click(screen.getByRole('tab', { name: 'Nabory' }))
    expect(screen.queryByRole('button', { name: /Inwestycje w gospodarstwach/ })).not.toBeInTheDocument()
  })

  it('edycja nazwy własnej strony', async () => {
    const { user } = await openSources()
    await user.click(screen.getByRole('button', { name: 'Edytuj LGD Pogórze (przykład)' }))
    const form = screen.getByRole('form', { name: 'Edycja strony' })
    const name = within(form).getByLabelText('Nazwa')
    await user.clear(name)
    await user.type(name, 'LGD Pogórze – ogłoszenia')
    await user.click(within(form).getByRole('button', { name: 'Zapisz zmiany' }))
    expect(screen.getByText('LGD Pogórze – ogłoszenia')).toBeInTheDocument()
  })

  it('oznaczenie: strony z katalogu vs dodane przez użytkownika', async () => {
    const { user } = await openSources()
    // katalog: tylko włącz/wyłącz, bez edycji i usuwania
    expect(screen.getByRole('switch', { name: 'Monitoruj PARP – nabory (przykład)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edytuj PARP – nabory (przykład)' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Usuń PARP – nabory (przykład)' })).not.toBeInTheDocument()
    // filtr
    await user.click(screen.getByRole('button', { name: /Dodane przez Ciebie \(1\)/ }))
    const list = screen.getByRole('region', { name: /Moja baza stron/ })
    expect(within(list).getAllByRole('switch')).toHaveLength(1)
    expect(within(list).getByText('Twoja strona')).toBeInTheDocument()
    // nowa strona dostaje oznaczenie „Twoja strona”
    const form = screen.getByRole('form', { name: 'Nowa strona' })
    await user.type(within(form).getByLabelText('Nazwa'), 'Gmina Testowa – dotacje')
    await user.type(within(form).getByLabelText('Adres strony (URL)'), 'https://gmina-testowa.example.pl/dotacje')
    await user.type(within(form).getByLabelText('Region'), 'małopolskie')
    await user.click(within(form).getByRole('button', { name: 'Dodaj stronę' }))
    expect(screen.getByRole('button', { name: /Dodane przez Ciebie \(2\)/ })).toBeInTheDocument()
    expect(within(list).getAllByText('Twoja strona')).toHaveLength(2)
  })

  it('własna strona oznaczona na osi czasu i w modalu', async () => {
    const user = userEvent.setup()
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} />)
    const row = screen.getByRole('button', { name: /Infrastruktura rekreacyjna.*twoja strona/ })
    expect(within(row).getByText('Twoja strona')).toBeInTheDocument()
    await user.click(row)
    expect(within(screen.getByRole('dialog')).getByText('Twoja strona')).toBeInTheDocument()
  })

  it('limit własnych stron z planu blokuje dodawanie', async () => {
    const user = userEvent.setup()
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} ownSourcesLimit={1} />)
    await user.click(screen.getByRole('tab', { name: /Baza stron i programy/ }))
    expect(screen.getByText('Twoje strony: 1 / 1 w Twoim planie')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Nowa strona' })).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/Wykorzystano limit/)
  })
})

describe('Katalog Radaru – strony z listy Anny', () => {
  it('zawiera prawdziwe portale z kategorią zasięgu', async () => {
    await openSources()
    const list = screen.getByRole('region', { name: /Moja baza stron/ })
    expect(within(list).getByRole('link', { name: 'https://www.parp.gov.pl/harmonogram-naborow' })).toBeInTheDocument()
    expect(within(list).getAllByText(/Regionalny – Śląskie/)).toHaveLength(2)
    expect(within(list).getByText(/UE – bezpośrednie/)).toBeInTheDocument()
  })

  it('Mapa Dotacji jest tylko odniesieniem i domyślnie nie jest monitorowana', async () => {
    await openSources()
    expect(screen.getByRole('switch', { name: 'Monitoruj Mapa Dotacji UE' })).not.toBeChecked()
    expect(screen.getByText('Tylko odniesienie')).toBeInTheDocument()
  })

  it('agregatory prywatne są oznaczone', async () => {
    await openSources()
    expect(screen.getAllByText('Agregator – potwierdzamy u źródła')).toHaveLength(2)
  })
})

describe('Ukrywanie programów', () => {
  it('odznaczenie programu ukrywa jego nabory i pokazuje informację', async () => {
    const { user } = await openSources()
    await user.click(screen.getByRole('checkbox', { name: /Fundusze Europejskie dla Nowoczesnej Gospodarki/ }))
    await user.click(screen.getByRole('tab', { name: 'Nabory' }))
    expect(screen.queryByRole('button', { name: /Wzornictwo i dostępność/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Ukryto 3 nabory\/naborów z programów/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zarządzaj programami' }))
    expect(screen.getByRole('checkbox', { name: /Fundusze Europejskie dla Nowoczesnej Gospodarki/ })).not.toBeChecked()
  })

  it('„Ukryj ten program” w modalu', async () => {
    const user = userEvent.setup()
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} />)
    await user.click(screen.getByRole('button', { name: /Rozwój działalności turystycznej/ }))
    await user.click(screen.getByRole('button', { name: 'Ukryj ten program' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rozwój działalności turystycznej/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Podejmowanie działalności/ })).not.toBeInTheDocument()
  })
})

describe('Baza stron – sprawdzenie nowej strony i ostrzeżenia', () => {
  it('nowa strona jest sprawdzana od razu; brak naborów → komunikat przy stronie, a przycisk „Sprawdź” ponawia', async () => {
    const user = userEvent.setup()
    const checker = vi.fn(async (s: Source): Promise<CheckResult> => ({
      source_id: s.id,
      ok: false,
      empty: true,
      grants: [],
      fetched_at: new Date().toISOString(),
      message: 'To strona z przetargami (zamówienia publiczne), a nie z naborami dotacji.',
    }))
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} checker={checker} />)
    await user.click(screen.getByRole('tab', { name: /Baza stron i programy/ }))
    const form = screen.getByRole('form', { name: 'Nowa strona' })
    await user.type(within(form).getByLabelText('Nazwa'), 'e-Zamówienia')
    await user.type(within(form).getByLabelText('Adres strony (URL)'), 'https://ezamowienia.gov.pl/pl/')
    await user.type(within(form).getByLabelText('Region'), 'śląskie')
    await user.click(within(form).getByRole('button', { name: 'Dodaj stronę' }))

    expect(checker).toHaveBeenCalledTimes(1)
    expect(checker.mock.calls[0][0]).toMatchObject({ name: 'e-Zamówienia', origin: 'wlasna' })
    const row = (await screen.findByText(/Problem przy ostatnim sprawdzeniu/)).closest('li')!
    expect(row).toHaveTextContent('e-Zamówienia')
    expect(row).toHaveTextContent('przetargami')
    expect(await screen.findByText(/^Sprawdzono 0 stron/)).toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: 'Sprawdź teraz e-Zamówienia' }))
    await waitFor(() => expect(checker).toHaveBeenCalledTimes(2))
  })

  it('udane sprawdzenie własnej strony pokazuje, ile ogłoszeń znaleziono', async () => {
    const user = userEvent.setup()
    const checker = async (s: Source): Promise<CheckResult> => ({
      source_id: s.id,
      ok: true,
      fetched_at: new Date().toISOString(),
      grants: [2, 3].map((n) => ({ ...buildMockGrants(TODAY)[0], id: `${s.id}-${n}`, source_id: s.id, title: `Nabór ${n}/2026 testowy` })),
    })
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} checker={checker} />)
    await user.click(screen.getByRole('tab', { name: /Baza stron i programy/ }))
    const form = screen.getByRole('form', { name: 'Nowa strona' })
    await user.type(within(form).getByLabelText('Nazwa'), 'LGD Nowa')
    await user.type(within(form).getByLabelText('Adres strony (URL)'), 'https://lgd-nowa.pl/nabory')
    await user.type(within(form).getByLabelText('Region'), 'śląskie')
    await user.click(within(form).getByRole('button', { name: 'Dodaj stronę' }))
    expect(await screen.findByText(/Ostatnio znaleziono 2 ogłoszenia/)).toBeInTheDocument()
    expect([1, 2, 5, 12, 22].map(announcementsWord)).toEqual(['1 ogłoszenie', '2 ogłoszenia', '5 ogłoszeń', '12 ogłoszeń', '22 ogłoszenia'])
  })

  it('wszystkie strony z katalogu wstrzymane → ostrzeżenie z przyciskiem, który je włącza', async () => {
    const user = userEvent.setup()
    const props = demoProps(TODAY)
    const paused = props.initialSources!.map((s) => (s.origin === 'katalog' ? { ...s, active: false } : s))
    render(<App today={TODAY} persist={false} {...props} initialSources={paused} />)
    const note = screen.getByText(/Wszystkie strony z katalogu Radaru są wstrzymane/).closest('[role="note"]')!
    await user.click(within(note as HTMLElement).getByRole('button', { name: 'Włącz strony z katalogu' }))
    expect(screen.queryByText(/Wszystkie strony z katalogu Radaru są wstrzymane/)).toBeNull()
  })
})

describe('Baza stron – Wiadomości', () => {
  it('dodaje źródło „Wiadomości” (kanał RSS + filtr słów) i od razu je sprawdza', async () => {
    const user = userEvent.setup()
    const checker = vi.fn(async (s: Source): Promise<CheckResult> => ({ source_id: s.id, ok: true, grants: [], fetched_at: new Date().toISOString() }))
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} checker={checker} />)
    await user.click(screen.getByRole('tab', { name: /Baza stron i programy/ }))
    const form = screen.getByRole('form', { name: 'Nowa strona' })
    await user.click(within(form).getByRole('radio', { name: 'Wiadomości (kanał RSS)' }))
    expect(within(form).queryByLabelText('Typ źródła')).toBeNull()
    await user.type(within(form).getByLabelText('Nazwa'), 'Wiadomości – agroturystyka')
    await user.click(within(form).getByRole('button', { name: 'Dodaj stronę' }))
    expect(within(form).getByLabelText('Adres kanału RSS')).toHaveAccessibleDescription(/adres kanału RSS/)
    await user.type(within(form).getByLabelText('Adres kanału RSS'), 'https://portal-regionalny.pl/feed/')
    await user.type(within(form).getByLabelText(/Słowa kluczowe/), 'agroturystyka')
    await user.type(within(form).getByLabelText('Region'), 'małopolskie')
    await user.click(within(form).getByRole('button', { name: 'Dodaj stronę' }))

    expect(checker.mock.calls[0][0]).toMatchObject({ type: 'wiadomości', kind: 'wiadomosci', query: 'agroturystyka', url: 'https://portal-regionalny.pl/feed/' })
    const row = screen.getByText('Wiadomości – agroturystyka').closest('li')!
    expect(row).toHaveTextContent('Kanał: https://portal-regionalny.pl/feed/ · filtr: „agroturystyka”')
    expect(row).toHaveTextContent('Wiadomości – sygnał, potwierdź u źródła')
  })
})

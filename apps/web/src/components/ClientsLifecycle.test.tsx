import { demoProps } from '../test/demo'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import type { ClientProfile } from '../match/types'

const TODAY = new Date(2026, 8, 26)
const KEY = 'test:klienci'

const jan: ClientProfile = {
  id: 'k-jan',
  name: 'Agroturystyka Pod Lasem',
  email: 'jan@podlasem.pl',
  legal_form: 'jdg',
  size: 'mikro',
  voivodeship: 'małopolskie',
  stage: 'istniejaca',
  categories: ['turystyka'],
  description: 'Domki noclegowe z sauną dla turystów',
  budget: 300000,
  updated_at: '2026-09-20T10:00:00.000Z',
}

function renderWith(profiles: ClientProfile[], extra: Record<string, unknown> = {}) {
  localStorage.setItem(KEY, JSON.stringify({ profiles }))
  return render(<App today={TODAY} storageKey={KEY} {...demoProps(TODAY)} {...extra} />)
}

afterEach(() => localStorage.clear())

describe('Klienci: zakładka, nowe dopasowania, wstrzymanie, usuwanie', () => {
  it('zakładka „Klienci” jest ostatnia', () => {
    renderWith([])
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Nabory', expect.stringMatching(/^Baza stron/), 'Klienci'])
  })

  it('nowy nabór pasujący do aktywnego klienta → komunikat, licznik i „nowe” w tabeli; po przeglądzie znika', async () => {
    const user = userEvent.setup()
    renderWith([{ ...jan, seen_matches: [] }]) // przy ostatnim przeglądzie nic nie pasowało
    const banner = screen.getByText(/Nowe nabory pasują do Twoich klientów/).closest('[role="status"]') as HTMLElement
    expect(banner).toHaveTextContent(/Agroturystyka Pod Lasem \(\d+\)/)
    const n = Number(banner.textContent!.match(/\((\d+)\)/)![1])
    expect(screen.getByRole('tab', { name: `Klienci (1) · nowe: ${n}` })).toBeInTheDocument()

    await user.click(within(banner).getByRole('button', { name: 'Pokaż klientów' }))
    const row = screen.getByRole('row', { name: /Agroturystyka Pod Lasem/ })
    expect(within(row).getByText(`${n} nowe`)).toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: /Pokaż szczegóły/ }))
    const drawer = screen.getByRole('dialog', { name: 'Agroturystyka Pod Lasem' })
    expect(within(drawer).getByRole('heading', { name: `Nowe dopasowania (${n})` })).toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: /^E-mail o nowych/ }))
    const box = within(drawer).getByRole('group', { name: 'E-mail o nowych naborach' })
    expect(within(box).getByLabelText('Temat')).toHaveValue('Nowe nabory dla: Agroturystyka Pod Lasem')
    await user.keyboard('{Escape}')
    // przejrzane – bez „nowych”
    expect(screen.getByRole('tab', { name: 'Klienci (1)' })).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /Agroturystyka Pod Lasem/ })).queryByText(/nowe$/)).toBeNull()
  })

  it('wyszukiwarka: klientów od pierwszego klienta, nabory w panelu klienta', async () => {
    const user = userEvent.setup()
    renderWith([jan, { ...jan, id: 'k2', name: 'Firma Druga', email: 'biuro@druga.pl' }])
    await user.click(screen.getByRole('tab', { name: /^Klienci/ }))
    await user.type(screen.getByLabelText('Szukaj klienta'), 'druga')
    expect(screen.getByText('1 z 2')).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /Agroturystyka/ })).toBeNull()
    await user.click(within(screen.getByRole('row', { name: /Firma Druga/ })).getByRole('button', { name: /Pokaż szczegóły/ }))
    const drawer = screen.getByRole('dialog', { name: 'Firma Druga' })
    const search = within(drawer).getByLabelText('Szukaj w naborach dla klienta')
    await user.type(search, 'turystyczn')
    expect(within(drawer).getByText(/^Znaleziono: \d+/)).toBeInTheDocument()
    expect(within(drawer).getAllByText(/Rozwój działalności turystycznej/).length).toBeGreaterThan(0)
    await user.clear(search)
    await user.type(search, 'xyz-brak')
    expect(within(drawer).getByText('Brak pasujących naborów dla tego wyszukiwania.')).toBeInTheDocument()
  })

  it('klient zapisany przed tą funkcją nie dostaje fałszywych „nowych”', () => {
    renderWith([jan])
    expect(screen.queryByText(/Nowe nabory pasują/)).toBeNull()
    expect(screen.getByRole('tab', { name: 'Klienci (1)' })).toBeInTheDocument()
  })

  it('wstrzymany klient: zostaje w bazie, bez powiadomień, filtr statusu', async () => {
    const user = userEvent.setup()
    renderWith([{ ...jan, seen_matches: [] }, { ...jan, id: 'k2', name: 'Firma Druga', seen_matches: [] }])
    await user.click(screen.getByRole('tab', { name: /^Klienci/ }))
    await user.click(within(screen.getByRole('row', { name: /Firma Druga/ })).getByRole('button', { name: /Pokaż szczegóły/ }))
    const drawer = screen.getByRole('dialog', { name: 'Firma Druga' })
    const sw = within(drawer).getByRole('switch', { name: /Automatyczne dopasowanie/ })
    expect(sw).toBeChecked()
    await user.click(sw)
    expect(sw).not.toBeChecked()
    await user.keyboard('{Escape}')
    const row = screen.getByRole('row', { name: /Firma Druga/ })
    expect(within(row).getByText('Wstrzymany')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Status'), 'aktywni')
    expect(screen.queryByRole('row', { name: /Firma Druga/ })).toBeNull()
    expect(screen.getByRole('row', { name: /Agroturystyka Pod Lasem/ })).toBeInTheDocument()
  })

  it('zaznaczanie klientów: wyłącz/włącz automatyczne dopasowanie, ponowne dopasowanie z AI, usuwanie', async () => {
    const user = userEvent.setup()
    const aiChecker = vi.fn(async (_p: ClientProfile, g: { id: string }) => ({
      grant_id: g.id, verdict: 'pasuje' as const, score: 80, conditions: [], estimated_grant_pln: null, summary: 'ok', missing_info: [], checked_at: '2026-09-30', source_read: true,
    }))
    renderWith([jan, { ...jan, id: 'k2', name: 'Firma Druga' }, { ...jan, id: 'k3', name: 'Firma Trzecia', categories: ['oze'] }], { aiChecker })
    await user.click(screen.getByRole('tab', { name: /^Klienci/ }))
    const rowOf = (name: RegExp) => screen.getByRole('row', { name })
    await user.click(within(rowOf(/Agroturystyka/)).getByRole('checkbox', { name: /Zaznacz/ }))
    await user.click(within(rowOf(/Firma Druga/)).getByRole('checkbox', { name: /Zaznacz/ }))
    const bar = screen.getByRole('region', { name: 'Akcje dla zaznaczonych klientów' })
    expect(bar).toHaveTextContent('Zaznaczono: 2')

    await user.click(within(bar).getByRole('button', { name: 'Wyłącz' }))
    expect(within(rowOf(/Agroturystyka/)).getByText('Wstrzymany')).toBeInTheDocument()
    expect(within(rowOf(/Firma Druga/)).getByText('Wstrzymany')).toBeInTheDocument()
    expect(within(rowOf(/Firma Trzecia/)).queryByText('Wstrzymany')).toBeNull()
    await user.click(within(bar).getByRole('button', { name: 'Włącz automatyczne dopasowanie' }))
    expect(within(rowOf(/Agroturystyka/)).queryByText('Wstrzymany')).toBeNull()

    const ai = within(bar).getByRole('button', { name: /Dopasuj ponownie z AI \((\d+)\)/ })
    const n = Number(ai.textContent!.match(/\((\d+)\)/)![1])
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThanOrEqual(6) // max 3 nabory na klienta
    await user.click(ai)
    expect(await screen.findByText(/Gotowe: AI sprawdziło \d+ naborów/)).toBeInTheDocument()
    expect(aiChecker).toHaveBeenCalledTimes(n)
    expect(new Set(aiChecker.mock.calls.map((c) => c[0].id))).toEqual(new Set(['k-jan', 'k2']))
    expect(within(rowOf(/Agroturystyka/)).getByText(/^AI: \d+/)).toBeInTheDocument()

    await user.click(within(bar).getByRole('button', { name: 'Usuń zaznaczonych' }))
    await user.click(within(screen.getByRole('group', { name: 'Potwierdź usunięcie zaznaczonych' })).getByRole('button', { name: 'Tak, usuń' }))
    expect(screen.queryByRole('row', { name: /Agroturystyka/ })).toBeNull()
    expect(rowOf(/Firma Trzecia/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Akcje dla zaznaczonych klientów' })).toBeNull()
  })

  it('archiwum: klient znika z tabeli i powiadomień, filtr „archiwum”, przywrócenie', async () => {
    const user = userEvent.setup()
    renderWith([{ ...jan, seen_matches: [] }, { ...jan, id: 'k2', name: 'Firma Druga' }])
    await user.click(screen.getByRole('tab', { name: /^Klienci/ }))
    await user.click(within(screen.getByRole('row', { name: /Agroturystyka/ })).getByRole('button', { name: /Pokaż szczegóły/ }))
    const drawer = screen.getByRole('dialog', { name: 'Agroturystyka Pod Lasem' })
    await user.click(within(drawer).getByRole('button', { name: 'Przenieś do archiwum' }))
    expect(screen.queryByRole('row', { name: /Agroturystyka/ })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Klienci (1)' })).toBeInTheDocument() // bez archiwum i bez „nowe”
    await user.selectOptions(screen.getByLabelText('Status'), 'archiwum')
    const row = screen.getByRole('row', { name: /Agroturystyka/ })
    expect(within(row).getByText('W archiwum')).toBeInTheDocument()
    await user.click(within(row).getByRole('checkbox', { name: /Zaznacz/ }))
    await user.click(within(screen.getByRole('region', { name: 'Akcje dla zaznaczonych klientów' })).getByRole('button', { name: 'Przywróć z archiwum' }))
    expect(screen.getByText('Archiwum jest puste.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Klienci \(2\)/ })).toBeInTheDocument()
  })

  it('dodawanie: duplikat nazwy jest wychwycony, „Zapisz” jest zawsze widoczny', async () => {
    const user = userEvent.setup()
    renderWith([jan])
    await user.click(screen.getByRole('tab', { name: /^Klienci/ }))
    await user.click(screen.getByRole('button', { name: '+ Nowy klient' }))
    const form = screen.getByRole('form', { name: 'Ankieta nowego klienta' })
    await user.type(within(form).getByLabelText('Nazwa klienta'), '  agroturystyka pod lasem ')
    await user.selectOptions(within(form).getByLabelText('Województwo'), 'śląskie')
    await user.click(within(form).getByLabelText('Energia odnawialna, magazyny energii'))
    const save = within(form).getByRole('button', { name: 'Zapisz i dopasuj nabory' })
    expect(save.parentElement).toHaveClass('sticky')
    await user.click(save)
    expect(within(form).getByRole('alert')).toHaveTextContent('Klient o tej nazwie już jest na liście')
    expect(within(form).getByLabelText('Nazwa klienta')).toHaveFocus()
    await user.type(within(form).getByLabelText('Nazwa klienta'), '(Kraków)')
    await user.click(save)
    expect(screen.getByRole('dialog', { name: /agroturystyka pod lasem/i })).toBeInTheDocument()
  })

  it('bez otwartych naborów – wyjaśnienie, dlaczego klienci mają „brak pasujących”', async () => {
    const user = userEvent.setup()
    localStorage.setItem(KEY, JSON.stringify({ profiles: [jan] }))
    render(<App today={TODAY} storageKey={KEY} initialGrants={[]} initialSources={demoProps(TODAY).initialSources} />)
    await user.click(screen.getByRole('tab', { name: /^Klienci/ }))
    expect(screen.getByText(/Brak otwartych naborów do dopasowania/)).toBeInTheDocument()
  })

  it('usuwanie klienta z potwierdzeniem', async () => {
    const user = userEvent.setup()
    renderWith([jan])
    await user.click(screen.getByRole('tab', { name: /^Klienci/ }))
    await user.click(within(screen.getByRole('row', { name: /Agroturystyka/ })).getByRole('button', { name: /Pokaż szczegóły/ }))
    const drawer = screen.getByRole('dialog', { name: 'Agroturystyka Pod Lasem' })
    await user.click(within(drawer).getByRole('button', { name: 'Usuń klienta' }))
    const confirm = within(drawer).getByRole('group', { name: /Potwierdź usunięcie/ })
    await user.click(within(confirm).getByRole('button', { name: 'Anuluj' }))
    expect(within(drawer).queryByRole('group', { name: /Potwierdź usunięcie/ })).toBeNull()
    await user.click(within(drawer).getByRole('button', { name: 'Usuń klienta' }))
    await user.click(within(drawer).getByRole('button', { name: 'Tak, usuń' }))
    expect(screen.getByText('Nie masz jeszcze klientów')).toBeInTheDocument()
    expect(screen.getByText('Usunięto klienta „Agroturystyka Pod Lasem”.')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(KEY)!).profiles).toEqual([])
  })
})

describe('Pamięć aplikacji', () => {
  function tinyStore(capacity: number): Storage {
    const m = new Map<string, string>()
    return {
      get length() {
        return m.size
      },
      key: (i) => [...m.keys()][i] ?? null,
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => {
        if (k.length + v.length > capacity) throw new DOMException('full', 'QuotaExceededError')
        m.set(k, v)
      },
      removeItem: (k) => void m.delete(k),
      clear: () => m.clear(),
    }
  }

  it('gdy pamięć się zapcha: czerwony komunikat, że zmiany nie zostały zapisane, i przycisk „Zwolnij miejsce”', () => {
    renderWith([], { store: tinyStore(100) })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Pamięć aplikacji jest pełna – ostatnie zmiany nie zostały zapisane')
    expect(within(alert).getByRole('button', { name: 'Zwolnij miejsce' })).toBeInTheDocument()
  })

  it('bez problemów z pamięcią – brak komunikatu', () => {
    renderWith([])
    expect(screen.queryByText(/Pamięć aplikacji/)).toBeNull()
  })
})

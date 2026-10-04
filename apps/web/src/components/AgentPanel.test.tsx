import { demoProps } from '../test/demo'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { buildMockGrants, sources } from '../data/mock'
import type { CheckResult } from '../agent/common'
import type { Source } from '../types'
import { sourcesToCheck } from '../lib/agentRun'
import { describeScan, toCron } from '../auth/session'

const TODAY = new Date(2026, 8, 26)

describe('Sprawdź teraz (ręczny przebieg agenta)', () => {
  it('pomija strony wyłączone i „tylko odniesienie”', () => {
    const list = sourcesToCheck(sources)
    expect(list.find((s) => s.name === 'Mapa Dotacji UE')).toBeUndefined()
    expect(list).toHaveLength(sources.filter((s) => s.active && s.kind !== 'odniesienie').length)
  })

  it('czyta strony przez serwer: nowe nabory, błędy, strony bez czytnika, historia', async () => {
    const user = userEvent.setup()
    const checker = vi.fn(async ({ id }: Source): Promise<CheckResult> => {
      const fetched_at = new Date().toISOString()
      if (id === 'c09') return { source_id: id, ok: false, grants: [], fetched_at, message: 'Nie udało się odczytać: strona odpowiedziała kodem 503.' }
      const grants = id === 'c06' ? [{ ...buildMockGrants(TODAY)[0], id: 'parp-nowy', source_id: 'c06', title: 'Nowy nabór PARP testowy' }] : []
      return { source_id: id, ok: true, grants, fetched_at }
    })
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} checker={checker} />)
    await user.click(screen.getByRole('button', { name: 'Sprawdź teraz' }))
    const result = await screen.findByText(/^Sprawdzono 5 stron/)
    expect(checker.mock.calls.map((c) => c[0].id)).toEqual(['c04', 'c06', 'c07', 'c08', 'c09', 's2'])
    expect(result).toHaveTextContent('nowe nabory: 1')
    expect(result).toHaveTextContent('problemy: 1')
    expect(screen.getByText(/KE – Portal Finansowania i Przetargów:/).closest('li')).toHaveTextContent('kodem 503')
    expect(screen.getAllByRole('button', { name: /Nowy nabór PARP testowy/ }).length).toBeGreaterThan(0)

    // strony bez czytnika: jedna ikona z podpowiedzią
    expect(screen.getByText(/Czytnik w przygotowaniu: 9 stron/)).toBeInTheDocument()
    const tip = screen.getByRole('button', { name: 'Które strony czekają na czytnik' })
    expect(tip).toHaveAccessibleDescription(/Atlas Dotacji/)
    expect(screen.queryByRole('tooltip')).toBeNull()
    await user.hover(tip)
    expect(screen.getByRole('tooltip')).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.queryByText(/Tryb testowy/)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Historia sprawdzeń' }))
    const log = screen.getByRole('region', { name: 'Historia sprawdzeń' })
    expect(within(log).getByText(/stron: 5 · pominięte: 2 · nowe: 1 · zmienione: 0 · problemy: 1/)).toBeInTheDocument()
    expect(screen.getAllByText(/ostatnio: dziś/).length).toBe(6) // 5 odczytanych + KE z błędem
    expect(screen.getByText(/Problem przy ostatnim sprawdzeniu/).closest('li')).toHaveTextContent(/KE – Portal.*kodem 503/)
    expect(screen.getByText(/Mapa Dotacji UE/).closest('li')).toHaveTextContent('Tylko odniesienie')
    // KE ma już czytnik – bez ikony; Atlas Dotacji – z ikoną
    expect(screen.queryByRole('button', { name: /KE – Portal Finansowania i Przetargów: w przygotowaniu/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Atlas Dotacji: w przygotowaniu – szczegóły' })).toBeInTheDocument()
  })

  it('zmiana dat przy kolejnym sprawdzeniu → „zmienione”', async () => {
    const user = userEvent.setup()
    let closes = '2026-10-30'
    const base = { ...buildMockGrants(TODAY)[0], id: 'parp-x', source_id: 'c06', title: 'Nabór X' }
    const checker = async ({ id }: Source): Promise<CheckResult> => ({
      source_id: id, ok: true, fetched_at: new Date().toISOString(), grants: id === 'c06' ? [{ ...base, closes_at: closes }] : [],
    })
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} checker={checker} />)
    await user.click(screen.getByRole('button', { name: 'Sprawdź teraz' }))
    expect(await screen.findByText(/nowe nabory: 1 · zmienione: 0/)).toBeInTheDocument()
    closes = '2026-11-15'
    await user.click(screen.getByRole('button', { name: 'Sprawdź teraz' }))
    expect(await screen.findByText(/nowe nabory: 0 · zmienione: 1/)).toBeInTheDocument()
  })

  it('przed pierwszym sprawdzeniem historia jest pusta', async () => {
    const user = userEvent.setup()
    render(<App today={TODAY} persist={false} {...demoProps(TODAY)} />)
    await user.click(screen.getByRole('tab', { name: /Baza stron/ }))
    expect(screen.getByText(/Agent jeszcze nie sprawdzał stron/)).toBeInTheDocument()
  })

  it('harmonogram „tylko ręcznie” nie tworzy zadania cron', () => {
    const s = { frequency: 'recznie' as const, hour: 6, weekday: 1 }
    expect(toCron(s)).toBeNull()
    expect(describeScan(s)).toMatch(/tylko ręcznie/)
  })
})

describe('odmiana', () => {
  it('stronę / strony / stron', async () => {
    const { pagesWord } = await import('./AgentPanel')
    expect([1, 2, 4, 5, 12, 22, 25].map(pagesWord)).toEqual(['stronę', 'strony', 'strony', 'stron', 'stron', 'strony', 'stron'])
  })
})

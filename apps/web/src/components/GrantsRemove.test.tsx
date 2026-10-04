import { demoProps } from '../test/demo'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

const TODAY = new Date(2026, 8, 26)
const CLOSED = /Odnawialne źródła energii w przedsiębiorstwach/

async function listView() {
  const user = userEvent.setup()
  render(<App today={TODAY} persist={false} {...demoProps(TODAY)} />)
  await user.click(screen.getByRole('button', { name: 'Lista' }))
  return user
}

describe('Nabory: ukrywanie zakończonych i usuwanie z listy', () => {
  it('zakończone są domyślnie ukryte; „Ukryj zakończone” je pokazuje', async () => {
    const user = await listView()
    expect(screen.queryByText(CLOSED)).toBeNull()
    await user.click(screen.getByLabelText('Ukryj zakończone'))
    expect(screen.getAllByText(CLOSED).length).toBeGreaterThan(0)
  })

  it('„Usuń zakończone z listy” i przywracanie z „Pokaż usunięte”', async () => {
    const user = await listView()
    await user.click(screen.getByRole('button', { name: 'Usuń zakończone z listy (1)' }))
    await user.click(screen.getByLabelText('Ukryj zakończone'))
    expect(screen.queryByText(CLOSED)).toBeNull() // usunięty – nie wraca nawet po odznaczeniu filtra
    await user.click(screen.getByRole('button', { name: 'Pokaż usunięte (1)' }))
    await user.click(screen.getAllByText(CLOSED)[0])
    const modal = screen.getByRole('dialog')
    await user.click(within(modal).getByRole('button', { name: 'Przywróć na listę' }))
    expect(screen.queryByRole('button', { name: /Pokaż usunięte/ })).toBeNull()
  })

  it('usuwanie pojedynczego naboru z okna szczegółów', async () => {
    const user = await listView()
    const title = /Rozwój działalności turystycznej/
    const before = screen.getAllByText(title).length
    await user.click(screen.getAllByText(title)[0])
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Usuń z listy' }))
    expect(screen.queryAllByText(title).length).toBeLessThan(before)
    expect(screen.getByRole('button', { name: 'Pokaż usunięte (1)' })).toBeInTheDocument()
  })
})

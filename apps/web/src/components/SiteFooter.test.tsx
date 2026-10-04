import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SiteFooter } from './SiteFooter'

describe('stopka', () => {
  it('prawa zastrzeżone, rok i link do 4uai', () => {
    render(<SiteFooter year={2026} />)
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('© 2026 Radar Grantów · 4uai. Wszelkie prawa zastrzeżone.')
    expect(screen.getByRole('link', { name: '4uai' })).toHaveAttribute('href', 'https://4uai.com.pl')
    expect(footer).toHaveClass('bg-slate-900')
  })
})

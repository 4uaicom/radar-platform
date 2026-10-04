import { describe, expect, it } from 'vitest'
import { compactStored, saveWithStatus, storageLevel, STORAGE_LIMIT } from './storage'

function fakeStore(capacity: number): Storage {
  const m = new Map<string, string>()
  const size = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0)
  return {
    get length() {
      return m.size
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      const before = m.get(k)
      m.set(k, v)
      if (size() > capacity) {
        if (before === undefined) m.delete(k)
        else m.set(k, before)
        throw new DOMException('full', 'QuotaExceededError')
      }
    },
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  }
}

describe('pamięć aplikacji – ostrzeżenie, zanim się zapcha', () => {
  it('poziomy: ok < 70% ≤ uwaga < 90% ≤ pełna; nieudany zapis = pełna', () => {
    expect(storageLevel(STORAGE_LIMIT * 0.5)).toBe('ok')
    expect(storageLevel(STORAGE_LIMIT * 0.75)).toBe('uwaga')
    expect(storageLevel(STORAGE_LIMIT * 0.95)).toBe('pelna')
    expect(storageLevel(10, true)).toBe('pelna')
  })

  it('zapis do pełnej pamięci nie wywraca aplikacji i zwraca failed', () => {
    const store = fakeStore(100)
    expect(saveWithStatus('a', 'x'.repeat(20), store)).toMatchObject({ failed: false, level: 'ok' })
    expect(saveWithStatus('a', 'x'.repeat(500), store)).toMatchObject({ failed: true, level: 'pelna' })
    expect(store.getItem('a')).toBe(JSON.stringify('x'.repeat(20))) // stare dane zostają
  })

  it('zwalnianie miejsca nie rusza tego, co wpisał użytkownik', () => {
    const data = {
      runs: Array.from({ length: 30 }, (_, i) => ({ id: `r${i}` })),
      live: { c04: { grants: [] }, c06: { grants: [] } },
      state: {
        stary: { my_status: 'Nowy', note: '', seen: true },
        z_notatka: { my_status: 'Nowy', note: 'zadzwonić', seen: true },
        w_toku: { my_status: 'Analizuję', note: '', seen: true },
        jest: { my_status: 'Nowy', note: '', seen: true },
      },
      profiles: [{ id: 'k1' }],
    }
    const out = compactStored(data, new Set(['c04']), new Set(['jest']))
    expect(out.runs).toHaveLength(5)
    expect(Object.keys(out.live!)).toEqual(['c04'])
    expect(Object.keys(out.state)).toEqual(['z_notatka', 'w_toku', 'jest'])
    expect(out.profiles).toEqual([{ id: 'k1' }])
  })
})

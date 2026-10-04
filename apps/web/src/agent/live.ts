/** Strony z katalogu, które agent umie czytać na żywo (czytniki w src/agent/check.ts). */
export const LIVE_SOURCE_IDS = ['c04', 'c06', 'c07', 'c08', 'c09'] as const

export const isLiveSource = (id: string) => (LIVE_SOURCE_IDS as readonly string[]).includes(id)

/** Czy agent umie odczytać tę stronę: portale z czytnikiem + każda strona dodana przez klienta (uniwersalny czytnik). */
export const canReadSource = (s: { id: string; origin: 'katalog' | 'wlasna' }) => isLiveSource(s.id) || s.origin === 'wlasna'

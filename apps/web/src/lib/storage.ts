/**
 * Pamięć aplikacji w przeglądarce (localStorage) – do czasu przejścia na Supabase.
 * Przeglądarki dają ok. 5 MB na stronę; gdy się zapełni, zapis się nie udaje, a zmiany giną po odświeżeniu.
 * Dlatego mierzymy zajętość i ostrzegamy wcześniej.
 */

/** Bezpieczny limit (znaki ≈ bajty dla naszych danych); część przeglądarek ma dokładnie 5 MB. */
export const STORAGE_LIMIT = 5_000_000
export const WARN_AT = 0.7
export const FULL_AT = 0.9

export type StorageLevel = 'ok' | 'uwaga' | 'pelna'

export interface StorageStatus {
  level: StorageLevel
  used: number
  limit: number
  /** Ostatni zapis się nie udał (pamięć pełna albo zablokowana) */
  failed: boolean
}

export function storageLevel(used: number, failed = false, limit = STORAGE_LIMIT): StorageLevel {
  if (failed || used >= limit * FULL_AT) return 'pelna'
  if (used >= limit * WARN_AT) return 'uwaga'
  return 'ok'
}

/** Zajętość całej pamięci tej strony (wszystkie klucze). */
export function storageUsed(store: Pick<Storage, 'length' | 'key' | 'getItem'> = localStorage): number {
  let n = 0
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i) ?? ''
    n += k.length + (store.getItem(k)?.length ?? 0)
  }
  return n
}

/** Zapis z informacją, czy się udał, i aktualną zajętością. */
export function saveWithStatus(key: string, value: unknown, store: Storage = localStorage): StorageStatus {
  let failed = false
  try {
    store.setItem(key, JSON.stringify(value))
  } catch {
    failed = true
  }
  let used = 0
  try {
    used = storageUsed(store)
  } catch {
    /* brak dostępu */
  }
  return { level: storageLevel(used, failed), used, limit: STORAGE_LIMIT, failed }
}

export const mb = (n: number) => (n / 1_000_000).toLocaleString('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** Co można bezpiecznie usunąć, żeby zwolnić miejsce (nic, co wpisał użytkownik). */
export interface Compactable {
  runs?: { id: string }[]
  live?: Record<string, unknown>
  state: Record<string, { my_status: string; note: string; for_whom?: string[] }>
}

export function compactStored<T extends Compactable>(data: T, activeSourceIds: Set<string>, existingGrantIds: Set<string>): T {
  return {
    ...data,
    // historia sprawdzeń: 5 ostatnich
    runs: data.runs?.slice(0, 5),
    // odczyty ze stron wyłączonych – przy włączeniu strony agent odczyta je od nowa
    live: data.live && Object.fromEntries(Object.entries(data.live).filter(([id]) => activeSourceIds.has(id))),
    // stan naborów, których już nie ma, bez notatki i bez statusu pracy
    state: Object.fromEntries(
      Object.entries(data.state).filter(([id, s]) => existingGrantIds.has(id) || s.note.trim() || s.my_status !== 'Nowy' || s.for_whom?.length),
    ),
  }
}

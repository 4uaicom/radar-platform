import { SOURCE_TYPES, type GrantStatus, type MyStatus, type Source, type SourceType } from '../types'
import { MY_STATUSES, STATUS_LABEL, type Filters } from '../lib/grants'

interface Props {
  filters: Filters
  sources: Source[]
  onChange: (f: Filters) => void
  forWhomOptions?: string[]
}


const selectCls = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'

export function FiltersBar({ filters, sources, onChange, forWhomOptions = [] }: Props) {
  const regions = [...new Set(sources.map((s) => s.region))]
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v })

  return (
    <form role="search" aria-label="Filtry naborów" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7" onSubmit={(e) => e.preventDefault()}>
      <label className="text-xs font-medium text-slate-700 lg:col-span-2">
        Szukaj
        <input
          type="search"
          value={filters.query}
          onChange={(e) => set('query', e.target.value)}
          placeholder="np. turystyka, domki, UX"
          className={selectCls}
        />
      </label>
      <label className="text-xs font-medium text-slate-700">
        Typ źródła
        <select value={filters.sourceType} onChange={(e) => set('sourceType', e.target.value as SourceType | '')} className={selectCls}>
          <option value="">Wszystkie</option>
          {SOURCE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-700">
        Region
        <select value={filters.region} onChange={(e) => set('region', e.target.value)} className={selectCls}>
          <option value="">Wszystkie</option>
          {regions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-700">
        Status naboru
        <select value={filters.status} onChange={(e) => set('status', e.target.value as GrantStatus | '')} className={selectCls}>
          <option value="">Wszystkie</option>
          {(Object.keys(STATUS_LABEL) as GrantStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-700">
        Mój status
        <select value={filters.myStatus} onChange={(e) => set('myStatus', e.target.value as MyStatus | '')} className={selectCls}>
          <option value="">Wszystkie</option>
          {MY_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-700">
        Dla kogo
        <select value={filters.forWhom} onChange={(e) => set('forWhom', e.target.value)} className={selectCls}>
          <option value="">Wszyscy</option>
          {forWhomOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:col-span-7">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={filters.hideClosed} onChange={(e) => set('hideClosed', e.target.checked)} className="h-4 w-4" />
          Ukryj zakończone
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={filters.hideRejected} onChange={(e) => set('hideRejected', e.target.checked)} className="h-4 w-4" />
          Ukryj oznaczone „Nie dla mnie”
        </label>
      </div>
    </form>
  )
}
